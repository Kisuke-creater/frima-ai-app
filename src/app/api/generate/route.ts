import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createResponseWithPriceMcpFallback } from "@/lib/openai/price-mcp";

export const dynamic = "force-dynamic";
const GENERATE_MODEL = process.env.OPENAI_GENERATE_MODEL ?? "gpt-4.1-mini";

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

interface GenerateResult {
  title: string;
  description: string;
  category: string;
  price_low: number;
  price_mid: number;
  price_high: number;
  condition_note: string;
}

const GENERATE_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 1,
      maxLength: 30,
    },
    description: {
      type: "string",
      minLength: 80,
      maxLength: 180,
    },
    category: {
      type: "string",
      minLength: 1,
      maxLength: 80,
    },
    price_low: {
      type: "integer",
      minimum: 0,
    },
    price_mid: {
      type: "integer",
      minimum: 0,
    },
    price_high: {
      type: "integer",
      minimum: 0,
    },
    condition_note: {
      type: "string",
      maxLength: 120,
    },
  },
  required: [
    "title",
    "description",
    "category",
    "price_low",
    "price_mid",
    "price_high",
    "condition_note",
  ],
} as const;

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

function buildUserPrompt(params: {
  conditionText: string;
  marketplaceName: string;
  itemName: string;
  accessories: string;
}): string {
  const extraInfo: string[] = [];

  if (params.itemName.trim()) {
    extraInfo.push(`商品名: ${params.itemName.trim()}`);
  }
  if (params.accessories.trim()) {
    extraInfo.push(`付属品: ${params.accessories.trim()}`);
  }

  const extraInfoText = extraInfo.length > 0 ? `\n${extraInfo.join("\n")}` : "";

  return `以下は同一商品の複数写真です。全ての画像を総合して${params.marketplaceName}向けの出品情報を作成してください。
状態は「${params.conditionText}」です。${extraInfoText}

売れやすさと相場妥当性を両立してください。
以下の点を考慮してください。
- 商品名は検索されやすいキーワードを含める
- ブランド名・特徴・用途などをタイトルに含める
- 商品説明は購入者が安心できる内容にする
- 商品の特徴、用途、サイズ感などを簡潔に説明する
- price_low <= price_mid <= price_high を必ず満たす
- 相場調査用のMCPツールが使える場合は価格帯の根拠として優先利用する
- MCPツールが使えない場合は画像・状態・販路情報から保守的に推定する
- 不明な情報は画像から推測できる範囲で補完する

JSON以外の文字は返さないでください。`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function parseGenerateResult(text: string): GenerateResult {
  if (!text.trim()) {
    throw new Error("AIレスポンスのJSON出力が空でした。");
  }

  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("AIレスポンスがJSONオブジェクトではありませんでした。");
  }

  const prices = [
    readNonNegativeInteger(parsed.price_low),
    readNonNegativeInteger(parsed.price_mid),
    readNonNegativeInteger(parsed.price_high),
  ].sort((left, right) => left - right);

  return {
    title: readText(parsed.title),
    description: readText(parsed.description),
    category: readText(parsed.category),
    price_low: prices[0] ?? 0,
    price_mid: prices[1] ?? 0,
    price_high: prices[2] ?? 0,
    condition_note: readText(parsed.condition_note),
  };
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY が設定されていません。" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const conditionText = CONDITION_MAP[condition] ?? condition;
    const marketplaceName = MARKETPLACE_MAP[marketplace] ?? "フリマアプリ";

    const response = await createResponseWithPriceMcpFallback(openai, {
      model: GENERATE_MODEL,
      instructions: [
        "あなたはフリマ出品のプロです。",
        "タイトル・説明文・カテゴリは画像と入力情報に忠実に作成してください。",
        "価格は相場妥当性を重視し、利用可能なMCP価格調査ツールがあれば優先的に参照してください。",
        "返答は指定されたJSONスキーマに厳密に従ってください。",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "input_image" as const,
              image_url: `data:${img.mimeType};base64,${img.imageBase64}`,
              detail: "low" as const,
            })),
            {
              type: "input_text" as const,
              text: buildUserPrompt({
                conditionText,
                marketplaceName,
                itemName,
                accessories,
              }),
            },
          ],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "listing_generation",
          strict: true,
          schema: GENERATE_RESULT_SCHEMA,
        },
      },
    });

    const result = parseGenerateResult(response.output_text);
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
