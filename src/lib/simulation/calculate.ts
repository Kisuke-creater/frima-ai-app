import {
  MARKETPLACE_ORDER,
  getMarketplaceLabel,
  PLATFORM_FEE_RULES,
} from "./platform-fees";
import { PACKAGING_MATERIAL_MAP } from "./packaging-materials";
import { SHIPPING_METHODS } from "./shipping-methods";
import type {
  Marketplace,
  PlatformFeeRule,
  ShippingMethod,
  SimulationCandidate,
  SimulationInput,
  SimulationResult,
} from "./types";

function applyRounding(value: number, rounding: PlatformFeeRule["rounding"]): number {
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

function fitsShippingMethod(
  method: ShippingMethod,
  spec: SimulationInput["shippingSpec"]
): boolean {
  const dims = [spec.lengthCm, spec.widthCm, spec.heightCm].sort((a, b) => b - a);
  const [longest, middle, shortest] = dims;
  const sum = spec.lengthCm + spec.widthCm + spec.heightCm;

  if (method.maxWeightG !== undefined && spec.weightG > method.maxWeightG) return false;
  if (method.maxSumCm !== undefined && sum > method.maxSumCm) return false;
  if (method.maxLengthCm !== undefined && longest > method.maxLengthCm) return false;
  if (method.maxWidthCm !== undefined && middle > method.maxWidthCm) return false;
  if (method.maxHeightCm !== undefined && shortest > method.maxHeightCm) return false;

  return true;
}

function getTargetMarketplaces(input: SimulationInput): Marketplace[] {
  if (input.compareAllPlatforms) return MARKETPLACE_ORDER;
  return input.marketplaceSelection ? [input.marketplaceSelection] : [];
}

export function calculateSimulation(input: SimulationInput): SimulationResult {
  const marketplaces = getTargetMarketplaces(input);
  const candidates: SimulationCandidate[] = [];

  for (const marketplace of marketplaces) {
    const feeRule = PLATFORM_FEE_RULES[marketplace];

    for (const method of SHIPPING_METHODS) {
      if (
        method.availablePlatforms &&
        !method.availablePlatforms.includes(marketplace)
      ) {
        continue;
      }
      if (!fitsShippingMethod(method, input.shippingSpec)) continue;

      const packagingMaterial =
        PACKAGING_MATERIAL_MAP[input.shippingSpec.packagingMaterialId] ??
        PACKAGING_MATERIAL_MAP.none;

      const platformFee = applyRounding(
        input.sellingPrice * feeRule.feeRate,
        feeRule.rounding
      );
      const shippingFee = method.shippingFee;
      const packagingCost =
        input.shippingSpec.packagingMaterialCost ?? packagingMaterial.cost;
      const totalCost = platformFee + shippingFee + packagingCost;
      const profit = input.sellingPrice - totalCost;

      candidates.push({
        marketplace,
        marketplaceLabel: getMarketplaceLabel(marketplace),
        shippingMethodId: method.id,
        shippingMethodLabel: method.label,
        packagingMaterialId: packagingMaterial.id,
        packagingMaterialLabel: packagingMaterial.label,
        platformFee,
        shippingFee,
        packagingCost,
        totalCost,
        profit,
        note: method.note,
      });
    }
  }

  candidates.sort((a, b) => b.profit - a.profit || a.totalCost - b.totalCost);

  return {
    candidates,
    recommended: candidates[0],
  };
}

