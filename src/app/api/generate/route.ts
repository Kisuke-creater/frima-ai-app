import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const CONDITION_MAP: Record<string, string> = {
  new: "新品・未使用",
  like_new: "未使用に近い",
  good: "目立った傷や汚れなし",
  fair: "やや傷や汚れあり",
  poor: "全体的に状態が悪い",
};

const MARKETPLACE_MAP: Record<string, string> = {
  mercari: "メルカリ",
  rakuma: "ラクマ",
  yahoo: "Yahoo!フリマ",
  yahoo_auction: "Yahoo!オークション",
};

interface InputImage {
  imageBase64: string;
  mimeType: string;
}

interface GenerateRequestBody {
  images?: InputImage[];
  imageBase64?: string;
  mimeType?: string;
  condition?: string;
  itemName?: string;
  accessories?: string;
  marketplace?: string;
}

function normalizeImages(body: GenerateRequestBody): InputImage[] {
  if (Array.isArray(body.images) && body.images.length > 0) {
    return body.images.filter(
      (img) =>
        typeof img?.imageBase64 === "string" &&
        img.imageBase64.length > 0 &&
        typeof img?.mimeType === "string" &&
        img.mimeType.length > 0
    );
  }

  if (body.imageBase64 && body.mimeType) {
    return [{ imageBase64: body.imageBase64, mimeType: body.mimeType }];
  }

  return [];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const images = normalizeImages(body);
    const condition = body.condition ?? "good";
    const itemName = body.itemName ?? "";
    const accessories = body.accessories ?? "";
    const marketplace = body.marketplace ?? "mercari";

    if (images.length === 0) {
      return NextResponse.json({ error: "画像が見つかりません。" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const conditionText = CONDITION_MAP[condition] ?? condition;
    const marketplaceName = MARKETPLACE_MAP[marketplace] ?? "フリマアプリ";

    const extraInfo: string[] = [];
    if (itemName.trim()) {
      extraInfo.push(`商品名: ${itemName.trim()}`);
    }
    if (accessories.trim()) {
      extraInfo.push(`付属品: ${accessories.trim()}`);
    }
    const extraInfoText = extraInfo.length > 0 ? `\n${extraInfo.join("\n")}` : "";

    const content: Array<Record<string, unknown>> = images.map((img) => ({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.imageBase64}`,
        detail: "low",
      },
    }));

    content.push({
      type: "text",
      text: `以下は同一商品の複数写真です。全ての画像を総合して${marketplaceName}向けの出品情報を作成してください。
状態は「${conditionText}」です。${extraInfoText}

次の条件で日本語のJSONのみを返してください。
- title: 30文字以内
- description: 80〜180文字
- category: 出品に適したカテゴリ名
- price_low / price_mid / price_high: 数値（整数）
- condition_note: 状態に関する補足（任意）

出力フォーマット:
{
  "title": "...",
  "description": "...",
  "category": "...",
  "price_low": 0,
  "price_mid": 0,
  "price_high": 0,
  "condition_note": "..."
}`,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 600,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AIレスポンスからJSONを抽出できませんでした。" },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: `生成中にエラーが発生しました: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
