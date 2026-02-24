import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ビルド時に初期化しないよう dynamic にする
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
  rakuma: "楽天ラクマ",
  yahoo: "Yahoo!フリマ",
  yahoo_auction: "Yahoo!オークション",
};

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, condition, itemName, accessories, marketplace } = await request.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "画像とMIMEタイプが必要です" }, { status: 400 });
    }

    console.log("[/api/generate] Received Request:");
    console.log("- MIME Type:", mimeType);
    console.log("- Base64 Head:", imageBase64.substring(0, 50));
    console.log("- Condition:", condition);
    console.log("- Item Name:", itemName);
    console.log("- Accessories:", accessories);
    console.log("- Marketplace:", marketplace);

    // リクエスト時に初期化（ビルド時にAPIキーが不要）
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const conditionText = CONDITION_MAP[condition] ?? condition;
    const marketplaceName = MARKETPLACE_MAP[marketplace] ?? "フリマアプリ";
    
    // 追加情報プロンプトの構築
    const extraInfo = [];
    if (itemName && itemName.trim() !== "") {
      extraInfo.push(`商品名: ${itemName}`);
    }
    if (accessories && accessories.trim() !== "") {
      extraInfo.push(`付属品: ${accessories}`);
    }
    const extraInfoText = extraInfo.length > 0 
      ? `\n\nユーザーからの追加情報（必ず結果に反映してください）:\n${extraInfo.join("\n")}` 
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "low",
              },
            },
            {
              type: "text",
              text: `あなたはフリマアプリ専門のプロ出品アドバイザーです。
画像と商品の状態から、売れやすく、誇張しない自然な出品情報を作成してください。
余計な文章は一切書かないでください。
価格は${marketplaceName}で実際に売れそうな現実的価格を提示し、高すぎる価格は出さないでください。

この商品画像（${marketplaceName}に出品予定）を分析してください。商品の状態は「${conditionText}」です。${extraInfoText}

以下のJSON形式のみで回答してください（他の文章は不要）：
{
  "title": "${marketplaceName}向けの魅力的な商品タイトル（30文字以内）",
  "description": "${marketplaceName}に最適な商品説明文（100〜200文字、状態や特徴、付属品を含む）",
  "category": "${marketplaceName}のカテゴリ名（例: 家電・スマホ・カメラ、ファッション、etc.）",
  "price_low": 低め価格（円、整数）,
  "price_mid": 適正価格（円、整数）,
  "price_high": 高め価格（円、整数）,
  "condition_note": "状態補足コメント（30文字以内）"
}`,
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const text = response.choices[0].message.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI応答の解析に失敗しました" },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/generate] Error:", err);
    return NextResponse.json(
      { error: `生成中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
