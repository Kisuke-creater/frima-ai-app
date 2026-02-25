export type Marketplace = "mercari" | "rakuma" | "yahoo" | "yahoo_auction";

export interface ShippingSpec {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightG?: number;
  packagingMaterialId?: string;
  packagingMaterialCost?: number;
}

export interface PackagingMaterial {
  id: string;
  label: string;
  cost: number;
  note?: string;
}

export interface ShippingMethod {
  id: string;
  label: string;
  shippingFee: number;
  maxLengthCm?: number;
  maxWidthCm?: number;
  maxHeightCm?: number;
  maxSumCm?: number;
  maxWeightG?: number;
  availablePlatforms?: Marketplace[];
  recommendedPackagingMaterialIds?: string[];
  note?: string;
  sourceNote?: string;
}

export interface PlatformFeeRule {
  marketplace: Marketplace;
  label: string;
  feeRate: number;
  rounding: "floor" | "round" | "ceil";
  note?: string;
}

export interface SimulationInput {
  sellingPrice: number;
  marketplaceSelection?: Marketplace;
  compareAllPlatforms: boolean;
  shippingSpec: Required<
    Pick<
      ShippingSpec,
      "lengthCm" | "widthCm" | "heightCm" | "weightG" | "packagingMaterialId"
    >
  > & {
    packagingMaterialCost: number;
  };
}

export interface SimulationCandidate {
  marketplace: Marketplace;
  marketplaceLabel: string;
  shippingMethodId: string;
  shippingMethodLabel: string;
  packagingMaterialId: string;
  packagingMaterialLabel: string;
  platformFee: number;
  shippingFee: number;
  packagingCost: number;
  totalCost: number;
  profit: number;
  note?: string;
}

export interface SimulationResult {
  candidates: SimulationCandidate[];
  recommended?: SimulationCandidate;
}

