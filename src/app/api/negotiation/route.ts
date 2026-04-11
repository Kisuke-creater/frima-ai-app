import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  calculateMinimumAcceptablePrice,
  calculateNegotiationProfit,
  createDefaultNegotiationCostSettings,
} from "@/lib/negotiation/calculate";
import { normalizeNegotiationResult, parseAiJsonResponse } from "@/lib/negotiation/normalize";
import { buildNegotiationUserPrompt, NEGOTIATION_SYSTEM_PROMPT } from "@/lib/negotiation/prompt";
import type {
  NegotiationCostSettings,
  NegotiationItemContext,
  NegotiationRequestBody,
} from "@/lib/negotiation/types";
import type { Marketplace } from "@/lib/simulation/types";

export const dynamic = "force-dynamic";

const NEGOTIATION_MODEL = process.env.OPENAI_NEGOTIATION_MODEL ?? "gpt-4o-mini";

function normalizeCurrency(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.round(numeric));
    }
  }

  return fallback;
}

function extractOfferFromText(text: string, listedPrice: number): number | null {
  const matches = Array.from(text.matchAll(/(\d[\d,]{2,})\s*円?/g))
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 100 && value <= Math.max(999999, listedPrice));

  return matches[0] ?? null;
}

function normalizeItemContext(raw: NegotiationRequestBody["item"]): NegotiationItemContext | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    title: raw.title.trim(),
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "未分類",
    condition: typeof raw.condition === "string" && raw.condition.trim() ? raw.condition.trim() : "good",
    listedPrice: normalizeCurrency(raw.listedPrice),
    marketplace: raw.marketplace,
    shippingSpec: raw.shippingSpec,
  };
}

function normalizeCostSettings(input: {
  item: NegotiationItemContext;
  marketplace?: Marketplace;
  costSettings?: Partial<NegotiationCostSettings>;
}): NegotiationCostSettings {
  const defaults = createDefaultNegotiationCostSettings(input.item, input.marketplace);
  const raw = input.costSettings;

  return {
    acquisitionCost: normalizeCurrency(raw?.acquisitionCost, defaults.acquisitionCost),
    desiredProfit: normalizeCurrency(raw?.desiredProfit, defaults.desiredProfit),
    manualShippingFee: normalizeCurrency(raw?.manualShippingFee, defaults.manualShippingFee),
    manualPackagingCost: normalizeCurrency(raw?.manualPackagingCost, defaults.manualPackagingCost),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NegotiationRequestBody;
    const item = normalizeItemContext(body.item);
    const buyerMessage = body.buyerMessage?.trim() ?? "";
    const marketplace = body.marketplace ?? item?.marketplace;

    if (!item) {
      return NextResponse.json({ error: "商品情報が不正です。" }, { status: 400 });
    }

    if (item.listedPrice <= 0) {
      return NextResponse.json({ error: "現在の出品価格を設定してください。" }, { status: 400 });
    }

    if (!buyerMessage) {
      return NextResponse.json({ error: "購入希望者のメッセージを入力してください。" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません。" },
        { status: 500 },
      );
    }

    const rawBuyerOffer = normalizeCurrency(body.buyerOffer, 0);
    const buyerOffer =
      rawBuyerOffer > 0 ? rawBuyerOffer : extractOfferFromText(buyerMessage, item.listedPrice);
    const normalizedBuyerOffer = typeof buyerOffer === "number" && buyerOffer > 0 ? buyerOffer : null;
    const costSettings = normalizeCostSettings({
      item,
      marketplace,
      costSettings: body.costSettings,
    });
    const floorPrice = calculateMinimumAcceptablePrice({
      item,
      marketplace,
      costSettings,
    });
    const currentListingProfit = calculateNegotiationProfit({
      item,
      targetPrice: item.listedPrice,
      marketplace,
      costSettings,
    });
    const buyerOfferProfit =
      normalizedBuyerOffer != null
        ? calculateNegotiationProfit({
            item,
            targetPrice: normalizedBuyerOffer,
            marketplace,
            costSettings,
          })
        : null;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: NEGOTIATION_MODEL,
      temperature: 0.35,
      max_tokens: 1400,
      messages: [
        { role: "system", content: NEGOTIATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildNegotiationUserPrompt({
            item,
            buyerMessage,
            buyerOffer: normalizedBuyerOffer,
            marketplace: marketplace ?? item.marketplace ?? "mercari",
            floorPrice,
            costSettings,
            currentListingProfit,
            buyerOfferProfit,
            history: Array.isArray(body.history) ? body.history : [],
          }),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = parseAiJsonResponse(text);
    const result = normalizeNegotiationResult(parsed, {
      item,
      marketplace,
      buyerOffer: normalizedBuyerOffer,
      costSettings,
    });

    return NextResponse.json({ result });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: `価格交渉AIの実行中にエラーが発生しました: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
}
