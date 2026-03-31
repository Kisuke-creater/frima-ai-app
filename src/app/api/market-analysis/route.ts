import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { normalizeMarketAnalysisResult } from "@/lib/market-analysis/normalize";
import { createResponseWithPriceMcpFallback } from "@/lib/openai/price-mcp";
import type {
  AnalysisInputImage,
  AnalysisPlatform,
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
const ANALYSIS_PLATFORMS: AnalysisPlatform[] = [
  "mercari",
  "yahoo_auction",
  "rakuma",
  "paypay_flea",
  "jmty",
];

const MARKET_ANALYSIS_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestedTitle: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    suggestedDescription: {
      type: "string",
      minLength: 20,
      maxLength: 400,
    },
    category: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    demandLevel: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    demandSummary: {
      type: "string",
      minLength: 1,
      maxLength: 240,
    },
    overallPriceLow: {
      type: "integer",
      minimum: 0,
    },
    overallPriceHigh: {
      type: "integer",
      minimum: 0,
    },
    estimatedSellDaysMin: {
      type: "integer",
      minimum: 1,
    },
    estimatedSellDaysMax: {
      type: "integer",
      minimum: 1,
    },
    recommendedPlatform: {
      type: "string",
      enum: ANALYSIS_PLATFORMS,
    },
    recommendationReason: {
      type: "string",
      minLength: 1,
      maxLength: 240,
    },
    conditionNote: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    platforms: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          platform: {
            type: "string",
            enum: ANALYSIS_PLATFORMS,
          },
          estimatedPrice: {
            type: "integer",
            minimum: 0,
          },
          sellProbability: {
            type: "integer",
            minimum: 0,
            maximum: 100,
          },
          estimatedSellDaysMin: {
            type: "integer",
            minimum: 1,
          },
          estimatedSellDaysMax: {
            type: "integer",
            minimum: 1,
          },
          fee: {
            type: "integer",
            minimum: 0,
          },
          shippingCost: {
            type: "integer",
            minimum: 0,
          },
          expectedProfit: {
            type: "integer",
          },
          reason: {
            type: "string",
            minLength: 1,
            maxLength: 200,
          },
        },
        required: [
          "platform",
          "estimatedPrice",
          "sellProbability",
          "estimatedSellDaysMin",
          "estimatedSellDaysMax",
          "fee",
          "shippingCost",
          "expectedProfit",
          "reason",
        ],
      },
    },
  },
  required: [
    "suggestedTitle",
    "suggestedDescription",
    "category",
    "demandLevel",
    "demandSummary",
    "overallPriceLow",
    "overallPriceHigh",
    "estimatedSellDaysMin",
    "estimatedSellDaysMax",
    "recommendedPlatform",
    "recommendationReason",
    "conditionNote",
    "platforms",
  ],
} as const;

function normalizeImages(body: MarketAnalysisRequestBody): AnalysisInputImage[] {
  if (!Array.isArray(body.images)) return [];

  return body.images.filter((image) => {
    if (!image) return false;
    if (typeof image.imageBase64 !== "string" || image.imageBase64.length < 16) return false;
    if (typeof image.mimeType !== "string") return false;
    return ALLOWED_IMAGE_MIME_TYPES.has(image.mimeType);
  });
}

function buildAnalysisPrompt(params: {
  title: string;
  description: string;
  conditionLabel: string;
}): string {
  return [
    "あなたは日本のフリマ・オークション市場分析AIです。",
    "入力された商品画像・商品タイトル・商品説明・商品状態をもとに、最適な販売先を提案してください。",
    "",
    "対象プラットフォームは必ず次の5つを全て扱ってください。",
    "- mercari (メルカリ)",
    "- yahoo_auction (ヤフオク)",
    "- rakuma (ラクマ)",
    "- paypay_flea (PayPayフリマ)",
    "- jmty (ジモティー)",
    "",
    "分析で重視すること:",
    "1. 商品カテゴリ判定",
    "2. 中古市場の需要",
    "3. 各プラットフォームでの推定価格",
    "4. 売れる確率",
    "5. 売れるまでの日数",
    "6. 手数料・送料を加味した期待利益",
    "",
    "制約:",
    "- 日本語で返す",
    "- integersはすべて整数値",
    "- platforms配列は5要素、各platformは重複禁止",
    "- sellProbabilityは0〜100",
    "- estimatedSellDaysMin <= estimatedSellDaysMax",
    "- overallPriceLow <= overallPriceHigh",
    "- expectedProfit は estimatedPrice - fee - shippingCost と大きく矛盾しないこと",
    "- 相場調査用のMCPツールが使える場合は価格・需要推定の根拠として優先利用する",
    "- MCPツールが使えない場合は一般的な中古相場感から保守的に推定する",
    "",
    `商品タイトル: ${params.title}`,
    `商品説明: ${params.description || "（未入力）"}`,
    `商品状態: ${params.conditionLabel}`,
    "",
    "JSON以外の文字は返さないでください。",
  ].join("\n");
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
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await createResponseWithPriceMcpFallback(openai, {
      model: MARKET_ANALYSIS_MODEL,
      temperature: 0.2,
      max_output_tokens: 1800,
      instructions: [
        "市場分析と価格評価は、利用可能な価格調査MCPツールがあれば優先して参照してください。",
        "返答は指定されたJSONスキーマに厳密に従ってください。",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            ...images.map((image) => ({
              type: "input_image" as const,
              image_url: `data:${image.mimeType};base64,${image.imageBase64}`,
              detail: "low" as const,
            })),
            {
              type: "input_text" as const,
              text: buildAnalysisPrompt({
                title,
                description,
                conditionLabel,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "market_analysis",
          strict: true,
          schema: MARKET_ANALYSIS_RESULT_SCHEMA,
        },
      },
    });

    const parsed = parseAiJsonResponse(response.output_text);
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
