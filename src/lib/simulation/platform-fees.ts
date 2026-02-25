import type { Marketplace, PlatformFeeRule } from "./types";

export const PLATFORM_FEE_RULES: Record<Marketplace, PlatformFeeRule> = {
  mercari: {
    marketplace: "mercari",
    label: "メルカリ",
    feeRate: 0.1,
    rounding: "floor",
    note: "概算（販売手数料10%）",
  },
  rakuma: {
    marketplace: "rakuma",
    label: "楽天ラクマ",
    feeRate: 0.06,
    rounding: "floor",
    note: "概算（出店条件により変動あり）",
  },
  yahoo: {
    marketplace: "yahoo",
    label: "Yahoo!フリマ",
    feeRate: 0.05,
    rounding: "floor",
    note: "概算（条件により変動あり）",
  },
  yahoo_auction: {
    marketplace: "yahoo_auction",
    label: "Yahoo!オークション",
    feeRate: 0.1,
    rounding: "floor",
    note: "概算（出品形態・会員条件により変動あり）",
  },
};

export const MARKETPLACE_ORDER: Marketplace[] = [
  "mercari",
  "rakuma",
  "yahoo",
  "yahoo_auction",
];

export function getMarketplaceLabel(marketplace: Marketplace): string {
  return PLATFORM_FEE_RULES[marketplace].label;
}

