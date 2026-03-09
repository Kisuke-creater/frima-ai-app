export const ANALYSIS_PLATFORM_ORDER = [
  "mercari",
  "yahoo_auction",
  "rakuma",
  "paypay_flea",
  "jmty",
] as const;

export type AnalysisPlatform = (typeof ANALYSIS_PLATFORM_ORDER)[number];

export const ANALYSIS_PLATFORM_LABELS: Record<AnalysisPlatform, string> = {
  mercari: "メルカリ",
  yahoo_auction: "ヤフオク",
  rakuma: "ラクマ",
  paypay_flea: "PayPayフリマ",
  jmty: "ジモティー",
};

export type ItemCondition = "new" | "like_new" | "good" | "fair" | "poor";
export type DemandLevel = "high" | "medium" | "low";

export interface AnalysisInputImage {
  imageBase64: string;
  mimeType: string;
}

export interface MarketAnalysisRequestBody {
  images?: AnalysisInputImage[];
  title?: string;
  description?: string;
  condition?: ItemCondition;
}

export interface PlatformComparisonResult {
  platform: AnalysisPlatform;
  platformLabel: string;
  estimatedPrice: number;
  sellProbability: number;
  estimatedSellDaysMin: number;
  estimatedSellDaysMax: number;
  fee: number;
  shippingCost: number;
  expectedProfit: number;
  reason: string;
}

export interface ProductMarketAnalysisResult {
  suggestedTitle: string;
  suggestedDescription: string;
  category: string;
  demandLevel: DemandLevel;
  demandSummary: string;
  overallPriceLow: number;
  overallPriceHigh: number;
  estimatedSellDaysMin: number;
  estimatedSellDaysMax: number;
  recommendedPlatform: AnalysisPlatform;
  recommendationReason: string;
  conditionNote: string;
  platforms: PlatformComparisonResult[];
}

export interface ProductMarketAnalysisResponse {
  result: ProductMarketAnalysisResult;
}
