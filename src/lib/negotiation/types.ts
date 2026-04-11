import type { Item } from "@/lib/firestore";
import type { Marketplace } from "@/lib/simulation/types";

export type NegotiationJudgment = "accept" | "counter" | "decline";
export type NegotiationStrategy = "strong" | "standard" | "quick_sale";
export type NegotiationCalcMode = "simulated" | "manual";

export const NEGOTIATION_STRATEGY_ORDER: NegotiationStrategy[] = [
  "strong",
  "standard",
  "quick_sale",
];

export const NEGOTIATION_STRATEGY_LABELS: Record<NegotiationStrategy, string> = {
  strong: "強気",
  standard: "標準",
  quick_sale: "早売り",
};

export const NEGOTIATION_JUDGMENT_LABELS: Record<NegotiationJudgment, string> = {
  accept: "受ける",
  counter: "価格を返す",
  decline: "今回は見送る",
};

export interface NegotiationItemContext {
  id?: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  listedPrice: number;
  marketplace?: Marketplace;
  shippingSpec?: Item["shippingSpec"];
}

export interface NegotiationCostSettings {
  acquisitionCost: number;
  desiredProfit: number;
  manualShippingFee: number;
  manualPackagingCost: number;
}

export interface NegotiationHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NegotiationRequestBody {
  item: NegotiationItemContext;
  buyerMessage: string;
  buyerOffer?: number | null;
  marketplace?: Marketplace;
  costSettings?: Partial<NegotiationCostSettings>;
  history?: NegotiationHistoryMessage[];
}

export interface NegotiationProfitEstimate {
  sellingPrice: number;
  marketplace: Marketplace;
  marketplaceLabel: string;
  calcMode: NegotiationCalcMode;
  platformFee: number;
  shippingFee: number;
  packagingCost: number;
  acquisitionCost: number;
  totalCost: number;
  profit: number;
  profitMarginRate: number;
  shippingMethodLabel?: string;
  note: string;
}

export interface NegotiationAlternative {
  strategy: NegotiationStrategy;
  label: string;
  suggestedPrice: number;
  reason: string;
  replyMessage: string;
  profit: NegotiationProfitEstimate;
}

export interface NegotiationAnalysisResult {
  recommendedJudgment: NegotiationJudgment;
  recommendationLabel: string;
  recommendedReplyPrice: number;
  reason: string;
  replyMessage: string;
  floorPrice: number;
  buyerOffer: number | null;
  currentListingProfit: NegotiationProfitEstimate;
  buyerOfferProfit: NegotiationProfitEstimate | null;
  recommendedProfit: NegotiationProfitEstimate;
  alternatives: NegotiationAlternative[];
}

export interface NegotiationAnalysisResponse {
  result: NegotiationAnalysisResult;
}
