import { calculateSimulation } from "@/lib/simulation/calculate";
import { getMarketplaceLabel, PLATFORM_FEE_RULES } from "@/lib/simulation/platform-fees";
import type { Marketplace, ShippingSpec } from "@/lib/simulation/types";
import type {
  NegotiationCostSettings,
  NegotiationItemContext,
  NegotiationProfitEstimate,
} from "./types";

const DEFAULT_MARKETPLACE: Marketplace = "mercari";

function clampCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function applyRounding(value: number, rounding: "floor" | "round" | "ceil"): number {
  switch (rounding) {
    case "ceil":
      return Math.ceil(value);
    case "round":
      return Math.round(value);
    case "floor":
    default:
      return Math.floor(value);
  }
}

function hasCompleteShippingSpec(
  shippingSpec?: NegotiationItemContext["shippingSpec"],
): shippingSpec is Required<
  Pick<ShippingSpec, "lengthCm" | "widthCm" | "heightCm" | "weightG" | "packagingMaterialId">
> & {
  packagingMaterialCost: number;
} {
  if (!shippingSpec) return false;

  return (
    typeof shippingSpec.lengthCm === "number" &&
    shippingSpec.lengthCm > 0 &&
    typeof shippingSpec.widthCm === "number" &&
    shippingSpec.widthCm > 0 &&
    typeof shippingSpec.heightCm === "number" &&
    shippingSpec.heightCm > 0 &&
    typeof shippingSpec.weightG === "number" &&
    shippingSpec.weightG > 0 &&
    typeof shippingSpec.packagingMaterialId === "string" &&
    shippingSpec.packagingMaterialId.length > 0 &&
    typeof shippingSpec.packagingMaterialCost === "number" &&
    shippingSpec.packagingMaterialCost >= 0
  );
}

function resolveMarketplace(
  item: NegotiationItemContext,
  marketplaceOverride?: Marketplace,
): Marketplace {
  return marketplaceOverride ?? item.marketplace ?? DEFAULT_MARKETPLACE;
}

function resolveSimulationSnapshot(
  item: NegotiationItemContext,
  marketplace: Marketplace,
  sellingPrice: number,
) {
  if (!hasCompleteShippingSpec(item.shippingSpec)) return null;

  const simulation = calculateSimulation({
    sellingPrice,
    compareAllPlatforms: false,
    marketplaceSelection: marketplace,
    shippingSpec: item.shippingSpec,
  });

  return simulation.recommended ?? simulation.candidates[0] ?? null;
}

export function canSimulateNegotiationProfit(
  item: NegotiationItemContext,
  marketplaceOverride?: Marketplace,
): boolean {
  return hasCompleteShippingSpec(item.shippingSpec) && Boolean(resolveMarketplace(item, marketplaceOverride));
}

export function createDefaultNegotiationCostSettings(
  item: NegotiationItemContext,
  marketplaceOverride?: Marketplace,
): NegotiationCostSettings {
  const marketplace = resolveMarketplace(item, marketplaceOverride);
  const snapshot = resolveSimulationSnapshot(item, marketplace, Math.max(300, item.listedPrice));

  return {
    acquisitionCost: 0,
    desiredProfit: 0,
    manualShippingFee: snapshot?.shippingFee ?? 0,
    manualPackagingCost: snapshot?.packagingCost ?? item.shippingSpec?.packagingMaterialCost ?? 0,
  };
}

export function calculateNegotiationProfit(input: {
  item: NegotiationItemContext;
  targetPrice: number;
  marketplace?: Marketplace;
  costSettings: NegotiationCostSettings;
}): NegotiationProfitEstimate {
  const item = input.item;
  const marketplace = resolveMarketplace(item, input.marketplace);
  const feeRule = PLATFORM_FEE_RULES[marketplace];
  const sellingPrice = clampCurrency(input.targetPrice);
  const acquisitionCost = clampCurrency(input.costSettings.acquisitionCost);

  const simulationSnapshot = resolveSimulationSnapshot(item, marketplace, sellingPrice);
  const platformFee = applyRounding(sellingPrice * feeRule.feeRate, feeRule.rounding);
  const shippingFee = simulationSnapshot
    ? simulationSnapshot.shippingFee
    : clampCurrency(input.costSettings.manualShippingFee);
  const packagingCost = simulationSnapshot
    ? simulationSnapshot.packagingCost
    : clampCurrency(input.costSettings.manualPackagingCost);
  const totalCost = platformFee + shippingFee + packagingCost + acquisitionCost;
  const profit = sellingPrice - totalCost;
  const missingMarketplaceNote =
    item.marketplace || input.marketplace
      ? ""
      : "出品先が未設定のためメルカリ基準で概算しています。";

  return {
    sellingPrice,
    marketplace,
    marketplaceLabel: getMarketplaceLabel(marketplace),
    calcMode: simulationSnapshot ? "simulated" : "manual",
    platformFee,
    shippingFee,
    packagingCost,
    acquisitionCost,
    totalCost,
    profit,
    profitMarginRate: sellingPrice > 0 ? Number((profit / sellingPrice).toFixed(4)) : 0,
    shippingMethodLabel: simulationSnapshot?.shippingMethodLabel,
    note: simulationSnapshot
      ? `${simulationSnapshot.shippingMethodLabel} ベースの概算です。${missingMarketplaceNote}`.trim()
      : `送料・資材費は手動入力値を利用しています。${missingMarketplaceNote}`.trim(),
  };
}

export function calculateMinimumAcceptablePrice(input: {
  item: NegotiationItemContext;
  marketplace?: Marketplace;
  costSettings: NegotiationCostSettings;
}): number {
  const marketplace = resolveMarketplace(input.item, input.marketplace);
  const feeRate = PLATFORM_FEE_RULES[marketplace].feeRate;
  const baseSnapshot = calculateNegotiationProfit({
    item: input.item,
    targetPrice: Math.max(300, input.item.listedPrice),
    marketplace,
    costSettings: input.costSettings,
  });
  const targetProfit = clampCurrency(input.costSettings.desiredProfit);
  const fixedCostWithoutFee =
    baseSnapshot.shippingFee + baseSnapshot.packagingCost + baseSnapshot.acquisitionCost;

  let candidate = Math.max(300, Math.ceil((fixedCostWithoutFee + targetProfit) / (1 - feeRate)));

  while (
    calculateNegotiationProfit({
      item: input.item,
      targetPrice: candidate,
      marketplace,
      costSettings: input.costSettings,
    }).profit < targetProfit
  ) {
    candidate += 1;
  }

  while (
    candidate > 300 &&
    calculateNegotiationProfit({
      item: input.item,
      targetPrice: candidate - 1,
      marketplace,
      costSettings: input.costSettings,
    }).profit >= targetProfit
  ) {
    candidate -= 1;
  }

  return candidate;
}
