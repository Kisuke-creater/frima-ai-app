import {
  ANALYSIS_PLATFORM_LABELS,
  ANALYSIS_PLATFORM_ORDER,
  type AnalysisPlatform,
  type DemandLevel,
  type PlatformComparisonResult,
  type ProductMarketAnalysisResult,
} from "./types";

const PLATFORM_FEE_RATE: Record<AnalysisPlatform, number> = {
  mercari: 0.1,
  yahoo_auction: 0.1,
  rakuma: 0.06,
  paypay_flea: 0.05,
  jmty: 0,
};

const DEFAULT_SHIPPING_COST: Record<AnalysisPlatform, number> = {
  mercari: 750,
  yahoo_auction: 900,
  rakuma: 750,
  paypay_flea: 850,
  jmty: 0,
};

const PLATFORM_ALIAS_MAP: Record<string, AnalysisPlatform> = {
  mercari: "mercari",
  "メルカリ": "mercari",
  rakuma: "rakuma",
  "ラクマ": "rakuma",
  yahoo_auction: "yahoo_auction",
  yahooauction: "yahoo_auction",
  "yahoo!オークション": "yahoo_auction",
  "yahooオークション": "yahoo_auction",
  "ヤフオク": "yahoo_auction",
  "ヤフーオークション": "yahoo_auction",
  paypay_flea: "paypay_flea",
  paypay: "paypay_flea",
  "paypayフリマ": "paypay_flea",
  "ペイペイフリマ": "paypay_flea",
  jmty: "jmty",
  "ジモティ": "jmty",
  "ジモティー": "jmty",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readFirst<T>(
  obj: Record<string, unknown>,
  keys: readonly string[],
  transform: (value: unknown) => T | null,
): T | null {
  for (const key of keys) {
    const value = obj[key];
    const next = transform(value);
    if (next != null) {
      return next;
    }
  }
  return null;
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
}

function toInteger(value: unknown): number | null {
  const numeric = toNumber(value);
  return numeric == null ? null : Math.round(numeric);
}

function normalizeDemandLevel(value: unknown): DemandLevel | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower === "high" || lower.includes("高")) return "high";
  if (lower === "medium" || lower.includes("中")) return "medium";
  if (lower === "low" || lower.includes("低")) return "low";
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolvePlatform(value: unknown): AnalysisPlatform | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "").toLowerCase();
  return (
    PLATFORM_ALIAS_MAP[raw] ??
    PLATFORM_ALIAS_MAP[raw.toLowerCase()] ??
    PLATFORM_ALIAS_MAP[normalized] ??
    null
  );
}

function normalizeDays(minDays: number, maxDays: number): { min: number; max: number } {
  const min = Math.max(1, minDays);
  const max = Math.max(min, maxDays);
  return { min, max };
}

function normalizePlatformComparison(
  value: unknown,
  fallbackPrice: number,
): PlatformComparisonResult | null {
  const row = asRecord(value);
  if (!row) return null;

  const platform = resolvePlatform(
    readFirst(row, ["platform", "platformId", "site", "name"], toTrimmedString),
  );
  if (!platform) return null;

  const estimatedPrice =
    readFirst(row, ["estimatedPrice", "price", "estimated_price"], toInteger) ??
    fallbackPrice;
  const fee =
    readFirst(row, ["fee", "platformFee", "commission"], toInteger) ??
    Math.round(estimatedPrice * PLATFORM_FEE_RATE[platform]);
  const shippingCost =
    readFirst(row, ["shippingCost", "shippingFee", "shipping"], toInteger) ??
    DEFAULT_SHIPPING_COST[platform];
  const expectedProfit =
    readFirst(row, ["expectedProfit", "profit", "netProfit"], toInteger) ??
    estimatedPrice - fee - shippingCost;
  const sellProbability = clamp(
    readFirst(row, ["sellProbability", "probability", "sell_rate"], toInteger) ?? 55,
    0,
    100,
  );
  const normalizedDays = normalizeDays(
    readFirst(row, ["estimatedSellDaysMin", "sellDaysMin", "daysMin"], toInteger) ?? 2,
    readFirst(row, ["estimatedSellDaysMax", "sellDaysMax", "daysMax"], toInteger) ?? 7,
  );

  return {
    platform,
    platformLabel: ANALYSIS_PLATFORM_LABELS[platform],
    estimatedPrice: Math.max(300, estimatedPrice),
    sellProbability,
    estimatedSellDaysMin: normalizedDays.min,
    estimatedSellDaysMax: normalizedDays.max,
    fee: Math.max(0, fee),
    shippingCost: Math.max(0, shippingCost),
    expectedProfit,
    reason:
      readFirst(row, ["reason", "analysis", "comment"], toTrimmedString) ??
      "同カテゴリ商品の需要と手数料水準を踏まえた推定です。",
  };
}

function readObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    return row ? [row] : [];
  });
}

export function normalizeMarketAnalysisResult(
  raw: unknown,
  fallback: { title: string; description?: string },
): ProductMarketAnalysisResult {
  const source = asRecord(raw);
  if (!source) {
    throw new Error("AIレスポンスのJSON形式が不正です。");
  }

  const rawRows = readObjectArray(
    readFirst(
      source,
      ["platforms", "platformComparisons", "platform_comparisons", "comparison"],
      (value) => (Array.isArray(value) ? value : null),
    ) ?? [],
  );

  const estimatedValues = rawRows
    .map((row) => readFirst(row, ["estimatedPrice", "price"], toInteger))
    .filter((value): value is number => value != null && value > 0);
  const derivedPrice = estimatedValues.length > 0 ? Math.round(estimatedValues[0]) : 4500;

  const comparisonsFromAI = rawRows
    .map((row) => normalizePlatformComparison(row, derivedPrice))
    .filter((row): row is PlatformComparisonResult => row != null);

  const comparisonsByPlatform = new Map<AnalysisPlatform, PlatformComparisonResult>();
  for (const entry of comparisonsFromAI) {
    comparisonsByPlatform.set(entry.platform, entry);
  }

  for (const platform of ANALYSIS_PLATFORM_ORDER) {
    if (comparisonsByPlatform.has(platform)) continue;

    const estimatedPrice = Math.max(300, derivedPrice);
    const fee = Math.round(estimatedPrice * PLATFORM_FEE_RATE[platform]);
    const shippingCost = DEFAULT_SHIPPING_COST[platform];
    comparisonsByPlatform.set(platform, {
      platform,
      platformLabel: ANALYSIS_PLATFORM_LABELS[platform],
      estimatedPrice,
      sellProbability: 50,
      estimatedSellDaysMin: 3,
      estimatedSellDaysMax: 9,
      fee,
      shippingCost,
      expectedProfit: estimatedPrice - fee - shippingCost,
      reason: "画像情報と市場傾向をもとに補完した推定値です。",
    });
  }

  const comparisons = ANALYSIS_PLATFORM_ORDER.map((platform) => comparisonsByPlatform.get(platform)!);

  const recommendedFromAI = resolvePlatform(
    readFirst(
      source,
      ["recommendedPlatform", "recommended_platform", "bestPlatform"],
      toTrimmedString,
    ),
  );
  const fallbackRecommended = comparisons.reduce((best, entry) =>
    entry.expectedProfit > best.expectedProfit ? entry : best,
  );
  const recommendedPlatform = recommendedFromAI ?? fallbackRecommended.platform;
  const recommendedEntry =
    comparisons.find((entry) => entry.platform === recommendedPlatform) ?? fallbackRecommended;

  const lowFromAI = readFirst(
    source,
    ["overallPriceLow", "estimatedPriceLow", "marketPriceLow", "priceLow"],
    toInteger,
  );
  const highFromAI = readFirst(
    source,
    ["overallPriceHigh", "estimatedPriceHigh", "marketPriceHigh", "priceHigh"],
    toInteger,
  );

  const comparisonPrices = comparisons.map((entry) => entry.estimatedPrice);
  const fallbackLow = Math.min(...comparisonPrices);
  const fallbackHigh = Math.max(...comparisonPrices);
  const overallPriceLow = Math.max(300, lowFromAI ?? fallbackLow);
  const overallPriceHigh = Math.max(overallPriceLow, highFromAI ?? fallbackHigh);
  const days = normalizeDays(recommendedEntry.estimatedSellDaysMin, recommendedEntry.estimatedSellDaysMax);

  return {
    suggestedTitle:
      readFirst(source, ["suggestedTitle", "title", "recommendedTitle"], toTrimmedString) ??
      fallback.title,
    suggestedDescription:
      readFirst(
        source,
        ["suggestedDescription", "description", "recommendedDescription"],
        toTrimmedString,
      ) ??
      (fallback.description?.trim() || "写真から確認できる状態と特徴を記載し、安心して購入できる説明文を作成してください。"),
    category:
      readFirst(source, ["category", "itemCategory", "productCategory"], toTrimmedString) ??
      "その他",
    demandLevel: normalizeDemandLevel(
      readFirst(source, ["demandLevel", "demand", "marketDemand"], toTrimmedString),
    ) ?? "medium",
    demandSummary:
      readFirst(source, ["demandSummary", "demandReason", "marketSummary"], toTrimmedString) ??
      "同カテゴリの中古市場で一定の需要が見込めます。",
    overallPriceLow,
    overallPriceHigh,
    estimatedSellDaysMin: days.min,
    estimatedSellDaysMax: days.max,
    recommendedPlatform,
    recommendationReason:
      readFirst(
        source,
        ["recommendationReason", "recommendedReason", "reason"],
        toTrimmedString,
      ) ?? recommendedEntry.reason,
    conditionNote:
      readFirst(source, ["conditionNote", "condition_note", "conditionSummary"], toTrimmedString) ??
      "写真から確認できる範囲で状態評価を行いました。",
    platforms: comparisons,
  };
}
