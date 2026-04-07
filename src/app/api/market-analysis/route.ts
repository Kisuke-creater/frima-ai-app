import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { normalizeMarketAnalysisResult } from "@/lib/market-analysis/normalize";
import type {
  AnalysisInputImage,
  ItemCondition,
  MarketAnalysisRequestBody,
} from "@/lib/market-analysis/types";

export const dynamic = "force-dynamic";

const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: "新品・未使用",
  like_new: "未使用に近い",
  good: "目立った傷や汚れなし",
  fair: "やや傷や汚れあり",
  poor: "全体的に状態が悪い",
};

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MARKET_ANALYSIS_MODEL = process.env.OPENAI_MARKET_ANALYSIS_MODEL ?? "gpt-4o-mini";

const MARKET_ANALYSIS_SYSTEM_PROMPT = `
あなたは日本のフリマ・オークション市場分析AIです。
入力された商品画像・商品タイトル・商品説明・商品状態をもとに、最適な販売先を提案してください。

対象プラットフォームは必ず次の5つを全て扱うこと:
- mercari (メルカリ)
- yahoo_auction (ヤフオク)
- rakuma (ラクマ)
- paypay_flea (PayPayフリマ)
- jmty (ジモティー)

分析で重視すること:
1. 商品カテゴリ判定
2. 中古市場の需要
3. 各プラットフォームでの推定価格
4. 売れる確率
5. 売れるまでの日数
6. 手数料・送料を加味した期待利益

出力ルール:
- 日本語で返す
- JSONのみを返す
- integersはすべて整数値
- platforms配列は5要素、各platformは重複禁止
- sellProbabilityは0〜100
- estimatedSellDaysMin <= estimatedSellDaysMax
- expectedProfit = estimatedPrice - fee - shippingCost を意識して整合させる

返却JSONスキーマ:
{
  "suggestedTitle": "string",
  "suggestedDescription": "string",
  "category": "string",
  "demandLevel": "high | medium | low",
  "demandSummary": "string",
  "overallPriceLow": 0,
  "overallPriceHigh": 0,
  "estimatedSellDaysMin": 0,
  "estimatedSellDaysMax": 0,
  "recommendedPlatform": "mercari | yahoo_auction | rakuma | paypay_flea | jmty",
  "recommendationReason": "string",
  "conditionNote": "string",
  "platforms": [
    {
      "platform": "mercari | yahoo_auction | rakuma | paypay_flea | jmty",
      "estimatedPrice": 0,
      "sellProbability": 0,
      "estimatedSellDaysMin": 0,
      "estimatedSellDaysMax": 0,
      "fee": 0,
      "shippingCost": 0,
      "expectedProfit": 0,
      "reason": "string"
    }
  ]
}
`.trim();

function normalizeImages(body: MarketAnalysisRequestBody): AnalysisInputImage[] {
  if (!Array.isArray(body.images)) return [];

  return body.images.filter((image) => {
    if (!image) return false;
    if (typeof image.imageBase64 !== "string" || image.imageBase64.length < 16) return false;
    if (typeof image.mimeType !== "string") return false;
    return ALLOWED_IMAGE_MIME_TYPES.has(image.mimeType);
  });
}

function parseAiJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AIレスポンスが空です。");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AIレスポンスからJSONを抽出できませんでした。");
    }
    return JSON.parse(jsonMatch[0]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MarketAnalysisRequestBody;
    const images = normalizeImages(body);
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const condition = (body.condition ?? "good") as ItemCondition;

    if (images.length === 0) {
      return NextResponse.json({ error: "画像を1枚以上送信してください。" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "商品タイトルは必須です。" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません。" },
        { status: 500 },
      );
    }

    const conditionLabel = CONDITION_LABELS[condition] ?? CONDITION_LABELS.good;
    const imageParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map(
      (image) => ({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.imageBase64}`,
          detail: "low",
        },
      }),
    );

    imageParts.push({
      type: "text",
      text: [
        "以下の入力内容を分析してください。",
        `商品タイトル: ${title}`,
        `商品説明: ${description || "（未入力）"}`,
        `商品状態: ${conditionLabel}`,
      ].join("\n"),
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: MARKET_ANALYSIS_MODEL,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        { role: "system", content: MARKET_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: imageParts },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = parseAiJsonResponse(text);
    const normalized = normalizeMarketAnalysisResult(parsed, {
      title,
      description,
    });

    return NextResponse.json({ result: normalized });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: `分析中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
}
