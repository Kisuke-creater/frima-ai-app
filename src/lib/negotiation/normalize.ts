import {
  NEGOTIATION_JUDGMENT_LABELS,
  NEGOTIATION_STRATEGY_LABELS,
  NEGOTIATION_STRATEGY_ORDER,
  type NegotiationAlternative,
  type NegotiationJudgment,
  type NegotiationStrategy,
  type NegotiationAnalysisResult,
  type NegotiationCostSettings,
  type NegotiationItemContext,
} from "./types";
import { calculateMinimumAcceptablePrice, calculateNegotiationProfit } from "./calculate";
import type { Marketplace } from "@/lib/simulation/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;

  const normalized = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) ? Math.round(normalized) : null;
}

function readFirst<T>(
  row: Record<string, unknown>,
  keys: readonly string[],
  transform: (value: unknown) => T | null,
): T | null {
  for (const key of keys) {
    const next = transform(row[key]);
    if (next != null) {
      return next;
    }
  }
  return null;
}

function parseAiJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("AIレスポンスが空でした。");
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

function normalizeJudgment(value: unknown): NegotiationJudgment | null {
  const raw = toTrimmedString(value)?.toLowerCase();
  if (!raw) return null;

  if (raw === "accept" || raw.includes("受け")) return "accept";
  if (raw === "decline" || raw.includes("断") || raw.includes("見送")) return "decline";
  if (raw === "counter" || raw.includes("返") || raw.includes("再提案")) return "counter";
  return null;
}

function normalizeStrategy(value: unknown): NegotiationStrategy | null {
  const raw = toTrimmedString(value)?.toLowerCase();
  if (!raw) return null;

  if (raw === "strong" || raw.includes("強")) return "strong";
  if (raw === "quick_sale" || raw === "quicksale" || raw.includes("早")) return "quick_sale";
  if (raw === "standard" || raw.includes("標")) return "standard";
  return null;
}

function readArrayOfObjects(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = asRecord(entry);
    return row ? [row] : [];
  });
}

function clampSuggestedPrice(price: number, floorPrice: number, listedPrice: number): number {
  return Math.min(listedPrice, Math.max(300, Math.max(floorPrice, price)));
}

function createFallbackPrice(input: {
  strategy: NegotiationStrategy;
  listedPrice: number;
  buyerOffer: number | null;
  floorPrice: number;
}): number {
  const midpoint = input.buyerOffer != null
    ? Math.round((input.listedPrice + input.buyerOffer) / 2)
    : Math.round((input.listedPrice + input.floorPrice) / 2);

  switch (input.strategy) {
    case "strong":
      return input.listedPrice;
    case "quick_sale":
      return clampSuggestedPrice(input.buyerOffer ?? input.floorPrice, input.floorPrice, input.listedPrice);
    case "standard":
    default:
      return clampSuggestedPrice(midpoint, input.floorPrice, input.listedPrice);
  }
}

function defaultReplyMessage(price: number): string {
  return `ご連絡ありがとうございます。現時点では${price.toLocaleString("ja-JP")}円でしたら対応可能です。ご検討よろしくお願いいたします。`;
}

function defaultReason(strategy: NegotiationStrategy): string {
  switch (strategy) {
    case "strong":
      return "現在価格を守りつつ、値崩れを避けたいときの返し方です。";
    case "quick_sale":
      return "成約優先で早めに決めたいときに向いています。";
    case "standard":
    default:
      return "利益と成約率のバランスを取りやすい返し方です。";
  }
}

export function normalizeNegotiationResult(
  raw: unknown,
  context: {
    item: NegotiationItemContext;
    marketplace?: Marketplace;
    buyerOffer: number | null;
    costSettings: NegotiationCostSettings;
  },
): NegotiationAnalysisResult {
  const source = asRecord(raw);
  if (!source) {
    throw new Error("AIレスポンスのJSON形式が不正です。");
  }

  const floorPrice = calculateMinimumAcceptablePrice({
    item: context.item,
    marketplace: context.marketplace,
    costSettings: context.costSettings,
  });

  const currentListingProfit = calculateNegotiationProfit({
    item: context.item,
    targetPrice: context.item.listedPrice,
    marketplace: context.marketplace,
    costSettings: context.costSettings,
  });

  const buyerOfferProfit =
    context.buyerOffer != null
      ? calculateNegotiationProfit({
          item: context.item,
          targetPrice: context.buyerOffer,
          marketplace: context.marketplace,
          costSettings: context.costSettings,
        })
      : null;

  let recommendedJudgment =
    normalizeJudgment(
      readFirst(source, ["recommendedJudgment", "judgment", "decision"], toTrimmedString),
    ) ?? "counter";

  const fallbackRecommendedPrice =
    recommendedJudgment === "accept" && context.buyerOffer != null
      ? context.buyerOffer
      : recommendedJudgment === "decline"
        ? context.item.listedPrice
        : createFallbackPrice({
            strategy: "standard",
            listedPrice: context.item.listedPrice,
            buyerOffer: context.buyerOffer,
            floorPrice,
          });

  const recommendedReplyPrice = clampSuggestedPrice(
    readFirst(
      source,
      ["recommendedReplyPrice", "recommendedPrice", "replyPrice", "price"],
      toInteger,
    ) ?? fallbackRecommendedPrice,
    floorPrice,
    context.item.listedPrice,
  );

  if (
    recommendedJudgment === "accept" &&
    context.buyerOffer != null &&
    recommendedReplyPrice !== context.buyerOffer
  ) {
    recommendedJudgment = "counter";
  }

  const alternativeRows = readArrayOfObjects(
    readFirst(source, ["alternatives", "options", "plans"], (value) =>
      Array.isArray(value) ? value : null,
    ) ?? [],
  );

  const alternativeByStrategy = new Map<NegotiationStrategy, NegotiationAlternative>();

  for (const strategy of NEGOTIATION_STRATEGY_ORDER) {
    const row = alternativeRows.find((entry) => {
      const rawStrategy = readFirst(
        entry,
        ["strategy", "type", "label"],
        toTrimmedString,
      );
      return normalizeStrategy(rawStrategy) === strategy;
    });

    const fallbackPrice = createFallbackPrice({
      strategy,
      listedPrice: context.item.listedPrice,
      buyerOffer: context.buyerOffer,
      floorPrice,
    });

    const suggestedPrice = clampSuggestedPrice(
      row
        ? readFirst(
            row,
            ["suggestedPrice", "price", "recommendedPrice"],
            toInteger,
          ) ?? fallbackPrice
        : fallbackPrice,
      floorPrice,
      context.item.listedPrice,
    );

    alternativeByStrategy.set(strategy, {
      strategy,
      label: NEGOTIATION_STRATEGY_LABELS[strategy],
      suggestedPrice,
      reason:
        (row && readFirst(row, ["reason", "comment", "note"], toTrimmedString)) ??
        defaultReason(strategy),
      replyMessage:
        (row && readFirst(row, ["replyMessage", "message", "reply"], toTrimmedString)) ??
        defaultReplyMessage(suggestedPrice),
      profit: calculateNegotiationProfit({
        item: context.item,
        targetPrice: suggestedPrice,
        marketplace: context.marketplace,
        costSettings: context.costSettings,
      }),
    });
  }

  const strong = alternativeByStrategy.get("strong")!;
  const standard = alternativeByStrategy.get("standard")!;
  const quickSale = alternativeByStrategy.get("quick_sale")!;

  const normalizedStrongPrice = Math.max(strong.suggestedPrice, standard.suggestedPrice);
  const normalizedQuickSalePrice = Math.min(quickSale.suggestedPrice, standard.suggestedPrice);
  const normalizedStandardPrice = Math.min(
    normalizedStrongPrice,
    Math.max(normalizedQuickSalePrice, standard.suggestedPrice),
  );

  strong.suggestedPrice = normalizedStrongPrice;
  standard.suggestedPrice = normalizedStandardPrice;
  quickSale.suggestedPrice = normalizedQuickSalePrice;

  strong.profit = calculateNegotiationProfit({
    item: context.item,
    targetPrice: strong.suggestedPrice,
    marketplace: context.marketplace,
    costSettings: context.costSettings,
  });
  standard.profit = calculateNegotiationProfit({
    item: context.item,
    targetPrice: standard.suggestedPrice,
    marketplace: context.marketplace,
    costSettings: context.costSettings,
  });
  quickSale.profit = calculateNegotiationProfit({
    item: context.item,
    targetPrice: quickSale.suggestedPrice,
    marketplace: context.marketplace,
    costSettings: context.costSettings,
  });

  const recommendedProfit = calculateNegotiationProfit({
    item: context.item,
    targetPrice: recommendedReplyPrice,
    marketplace: context.marketplace,
    costSettings: context.costSettings,
  });

  return {
    recommendedJudgment,
    recommendationLabel:
      readFirst(
        source,
        ["recommendationLabel", "decisionLabel", "summary"],
        toTrimmedString,
      ) ?? NEGOTIATION_JUDGMENT_LABELS[recommendedJudgment],
    recommendedReplyPrice,
    reason:
      readFirst(source, ["reason", "analysis", "why"], toTrimmedString) ??
      "利益と成約率のバランスを見て、無理のない返答ラインを提案しています。",
    replyMessage:
      readFirst(
        source,
        ["replyMessage", "message", "recommendedReply"],
        toTrimmedString,
      ) ?? defaultReplyMessage(recommendedReplyPrice),
    floorPrice,
    buyerOffer: context.buyerOffer,
    currentListingProfit,
    buyerOfferProfit,
    recommendedProfit,
    alternatives: NEGOTIATION_STRATEGY_ORDER.map((strategy) => alternativeByStrategy.get(strategy)!),
  };
}

export { parseAiJsonResponse };
