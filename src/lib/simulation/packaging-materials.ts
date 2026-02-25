import type { PackagingMaterial } from "./types";

export const PACKAGING_MATERIALS: PackagingMaterial[] = [
  { id: "none", label: "手持ち資材（0円）", cost: 0 },
  { id: "envelope_small", label: "封筒（小）", cost: 30 },
  { id: "envelope_padded", label: "クッション封筒", cost: 80 },
  { id: "box_nekopos", label: "ネコポス用箱", cost: 70 },
  { id: "box_yupacket", label: "ゆうパケット用箱", cost: 70 },
  { id: "box_takkyubin_compact", label: "宅急便コンパクト専用BOX", cost: 70 },
  { id: "box_yupacket_plus", label: "ゆうパケットプラス専用箱", cost: 65 },
  { id: "box_60_generic", label: "60サイズ段ボール", cost: 120 },
  { id: "box_80_generic", label: "80サイズ段ボール", cost: 160 },
  { id: "box_100_generic", label: "100サイズ段ボール", cost: 220 },
  { id: "box_120_generic", label: "120サイズ段ボール", cost: 250 },
  { id: "box_140_generic", label: "140サイズ段ボール", cost: 350 },
  { id: "box_160_generic", label: "160サイズ段ボール", cost: 500 },
];

export const PACKAGING_MATERIAL_MAP = Object.fromEntries(
  PACKAGING_MATERIALS.map((material) => [material.id, material])
);

