"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, LoaderCircle, Wallet } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getFirestoreClientErrorMessage,
  getItems,
  updateItemSimulationInputs,
  type Item,
} from "@/lib/firestore";
import { calculateSimulation } from "@/lib/simulation/calculate";
import {
  MARKETPLACE_ORDER,
  getMarketplaceLabel,
} from "@/lib/simulation/platform-fees";
import {
  PACKAGING_MATERIALS,
  PACKAGING_MATERIAL_MAP,
} from "@/lib/simulation/packaging-materials";
import type { Marketplace, SimulationResult } from "@/lib/simulation/types";
import Button from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Input, { fieldClassName } from "@/components/ui/Input";
import MarketAnalysisPanel from "@/components/analysis/MarketAnalysisPanel";
import { cn } from "@/lib/cn";

type MarketplaceOption = Marketplace | "";

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function toInputString(value?: number): string {
  return value == null ? "" : String(value);
}

function gramsToKgInputString(value?: number): string {
  return value == null ? "" : String(value / 1000);
}

export default function SimulatorPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "profit";

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [sellingPriceInput, setSellingPriceInput] = useState("");
  const [compareAllPlatforms, setCompareAllPlatforms] = useState(true);
  const [marketplaceInput, setMarketplaceInput] = useState<MarketplaceOption>("");
  const [lengthCmInput, setLengthCmInput] = useState("");
  const [widthCmInput, setWidthCmInput] = useState("");
  const [heightCmInput, setHeightCmInput] = useState("");
  const [weightKgInput, setWeightKgInput] = useState("");
  const [packagingMaterialId, setPackagingMaterialId] = useState("none");

  const lastInitializedItemId = useRef<string | null>(null);

  const listedItems = useMemo(() => items.filter((item) => item.status === "listed"), [items]);

  const selectedItem = useMemo(
    () => listedItems.find((item) => item.id === selectedItemId),
    [listedItems, selectedItemId],
  );

  useEffect(() => {
    if (tab === "market-analysis") {
      setLoading(false);
      return;
    }

    if (!user) return;

    setLoading(true);
    getItems(user.uid)
      .then((data) => {
        setItems(data);
        setError("");
      })
      .catch((cause: unknown) => {
        setError(getFirestoreClientErrorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, [tab, user]);

  useEffect(() => {
    if (!selectedItem) {
      setSellingPriceInput("");
      setMarketplaceInput("");
      setLengthCmInput("");
      setWidthCmInput("");
      setHeightCmInput("");
      setWeightKgInput("");
      setPackagingMaterialId("none");
      setResult(null);
      setError("");
      setWarning("");
      lastInitializedItemId.current = null;
      return;
    }

    if (lastInitializedItemId.current === selectedItem.id) return;

    setSellingPriceInput(String(selectedItem.price ?? ""));
    setMarketplaceInput(selectedItem.marketplace ?? "");
    setLengthCmInput(toInputString(selectedItem.shippingSpec?.lengthCm));
    setWidthCmInput(toInputString(selectedItem.shippingSpec?.widthCm));
    setHeightCmInput(toInputString(selectedItem.shippingSpec?.heightCm));
    setWeightKgInput(gramsToKgInputString(selectedItem.shippingSpec?.weightG));
    setPackagingMaterialId(selectedItem.shippingSpec?.packagingMaterialId ?? "none");
    setResult(null);
    setError("");
    setWarning("");
    lastInitializedItemId.current = selectedItem.id ?? null;
  }, [selectedItem]);

  const effectiveMarketplace = (marketplaceInput || selectedItem?.marketplace || "") as MarketplaceOption;
  const selectedPackagingMaterial =
    PACKAGING_MATERIAL_MAP[packagingMaterialId] ?? PACKAGING_MATERIAL_MAP.none;

  const parsePositive = (raw: string, label: string): number | null => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setError(`${label}を数値で入力してください。`);
      return null;
    }
    if (value <= 0) {
      setError(`${label}は0より大きい数値で入力してください。`);
      return null;
    }
    return value;
  };

  const handleRunSimulation = async () => {
    if (!user) {
      setError("ログイン状態を確認してください。再ログイン後にお試しください。");
      return;
    }
    if (!selectedItem?.id) {
      setError("出品中の商品を選択してください。");
      return;
    }

    setError("");
    setWarning("");
    setResult(null);

    const sellingPrice = parsePositive(sellingPriceInput, "販売価格");
    const lengthCm = parsePositive(lengthCmInput, "縦サイズ");
    const widthCm = parsePositive(widthCmInput, "横サイズ");
    const heightCm = parsePositive(heightCmInput, "厚さ");
    const weightKg = parsePositive(weightKgInput, "重量（kg）");

    if (
      sellingPrice == null ||
      lengthCm == null ||
      widthCm == null ||
      heightCm == null ||
      weightKg == null
    ) {
      return;
    }

    if (!compareAllPlatforms && !effectiveMarketplace) {
      setError("比較するプラットフォームを選択してください。");
      return;
    }

    const weightG = Math.round(weightKg * 1000);
    const shippingSpec = {
      lengthCm,
      widthCm,
      heightCm,
      weightG,
      packagingMaterialId: selectedPackagingMaterial.id,
      packagingMaterialCost: selectedPackagingMaterial.cost,
    };

    setRunning(true);
    try {
      const nextResult = calculateSimulation({
        sellingPrice,
        compareAllPlatforms,
        marketplaceSelection: compareAllPlatforms
          ? undefined
          : effectiveMarketplace || undefined,
        shippingSpec,
      });

      setResult(nextResult);

      if (nextResult.candidates.length === 0) {
        setError("条件に合う配送方法が見つかりませんでした。サイズ・重量を見直してください。");
      }

      try {
        await updateItemSimulationInputs(user.uid, selectedItem.id, {
          marketplace: effectiveMarketplace || undefined,
          shippingSpec,
        });

        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedItem.id
              ? {
                  ...item,
                  marketplace: (effectiveMarketplace || item.marketplace) as
                    | Marketplace
                    | undefined,
                  shippingSpec,
                }
              : item,
          ),
        );
      } catch (saveError: unknown) {
        setWarning(
          `結果は表示しましたが、入力値の保存に失敗しました: ${getFirestoreClientErrorMessage(
            saveError,
          )}`,
        );
      }
    } catch (cause: unknown) {
      setError(getFirestoreClientErrorMessage(cause));
    } finally {
      setRunning(false);
    }
  };

  if (tab === "market-analysis") {
    return <MarketAnalysisPanel />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {warning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {warning}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="size-4 text-brand-600" />
              Profit Simulation
            </CardTitle>
            <CardDescription>出品中の商品を選び、利益条件を入力します。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">対象商品</label>
              <select
                className={cn(fieldClassName, "pr-10")}
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? "商品を読み込み中..." : "出品中の商品を選択してください"}
                </option>
                {listedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} / {formatYen(item.price ?? 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  販売価格（円）
                </label>
                <Input
                  type="number"
                  min={1}
                  value={sellingPriceInput}
                  onChange={(event) => setSellingPriceInput(event.target.value)}
                  placeholder="例: 12800"
                  disabled={!selectedItem}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  比較モード
                </label>
                <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={compareAllPlatforms}
                    onChange={(event) => setCompareAllPlatforms(event.target.checked)}
                    disabled={!selectedItem}
                    className="size-4 accent-blue-600"
                  />
                  全プラットフォーム比較
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  比較対象プラットフォーム
                </label>
                <select
                  className={cn(fieldClassName, "pr-10")}
                  value={effectiveMarketplace}
                  onChange={(event) =>
                    setMarketplaceInput(event.target.value as MarketplaceOption)
                  }
                  disabled={!selectedItem}
                >
                  <option value="">選択してください</option>
                  {MARKETPLACE_ORDER.map((marketplace) => (
                    <option key={marketplace} value={marketplace}>
                      {getMarketplaceLabel(marketplace)}
                    </option>
                  ))}
                </select>
                {!compareAllPlatforms && (
                  <p className="mt-1 text-xs text-slate-500">
                    現在は
                    {effectiveMarketplace
                      ? `「${getMarketplaceLabel(effectiveMarketplace)}」`
                      : "プラットフォーム未選択"}
                    のみ比較します。
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">縦（cm）</label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={lengthCmInput}
                  onChange={(event) => setLengthCmInput(event.target.value)}
                  placeholder="例: 20"
                  disabled={!selectedItem}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">横（cm）</label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={widthCmInput}
                  onChange={(event) => setWidthCmInput(event.target.value)}
                  placeholder="例: 15"
                  disabled={!selectedItem}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">厚さ（cm）</label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={heightCmInput}
                  onChange={(event) => setHeightCmInput(event.target.value)}
                  placeholder="例: 2.5"
                  disabled={!selectedItem}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  重量（kg）
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={weightKgInput}
                  onChange={(event) => setWeightKgInput(event.target.value)}
                  placeholder="例: 0.38"
                  disabled={!selectedItem}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-600">配送資材</label>
                <select
                  className={cn(fieldClassName, "pr-10")}
                  value={packagingMaterialId}
                  onChange={(event) => setPackagingMaterialId(event.target.value)}
                  disabled={!selectedItem}
                >
                  {PACKAGING_MATERIALS.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">資材費</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatYen(selectedPackagingMaterial.cost)}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => void handleRunSimulation()}
              disabled={!selectedItem || running}
            >
              {running ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  シミュレーション中...
                </>
              ) : (
                "利益を試算する"
              )}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        {!result && (
          <Card>
            <CardContent className="py-20 text-center">
              <p className="text-sm text-slate-500">
                商品とサイズ情報を入力すると、プラットフォーム別の利益比較が表示されます。
              </p>
            </CardContent>
          </Card>
        )}

        {result?.recommended && (
          <Card className="border-brand-200 bg-gradient-to-br from-white to-brand-50/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand-700">
                <Wallet className="size-5" />
                おすすめ候補
              </CardTitle>
              <CardDescription>想定利益: {formatYen(result.recommended.profit)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">プラットフォーム</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result.recommended.marketplaceLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">配送方法</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result.recommended.shippingMethodLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">配送資材</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {result.recommended.packagingMaterialLabel}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  手数料: {formatYen(result.recommended.platformFee)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  送料: {formatYen(result.recommended.shippingFee)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  資材費: {formatYen(result.recommended.packagingCost)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  合計コスト: {formatYen(result.recommended.totalCost)}
                </span>
              </div>

              {result.recommended.note && (
                <p className="text-xs text-slate-500">備考: {result.recommended.note}</p>
              )}
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>比較結果（利益順）</CardTitle>
              <CardDescription>配送条件に合う候補を表示しています。</CardDescription>
            </CardHeader>
            <CardContent>
              {result.candidates.length === 0 ? (
                <p className="text-sm text-slate-500">
                  条件に一致する配送方法がありません。サイズ・重量を見直してください。
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[840px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                        <th className="px-2 py-2">PF</th>
                        <th className="px-2 py-2">配送方法</th>
                        <th className="px-2 py-2">資材</th>
                        <th className="px-2 py-2">手数料</th>
                        <th className="px-2 py-2">送料</th>
                        <th className="px-2 py-2">資材費</th>
                        <th className="px-2 py-2">合計コスト</th>
                        <th className="px-2 py-2">想定利益</th>
                        <th className="px-2 py-2">備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.candidates.map((candidate) => (
                        <tr
                          key={`${candidate.marketplace}-${candidate.shippingMethodId}`}
                          className="border-b border-slate-100 text-slate-700"
                        >
                          <td className="px-2 py-2">{candidate.marketplaceLabel}</td>
                          <td className="px-2 py-2">{candidate.shippingMethodLabel}</td>
                          <td className="px-2 py-2">{candidate.packagingMaterialLabel}</td>
                          <td className="px-2 py-2">{formatYen(candidate.platformFee)}</td>
                          <td className="px-2 py-2">{formatYen(candidate.shippingFee)}</td>
                          <td className="px-2 py-2">{formatYen(candidate.packagingCost)}</td>
                          <td className="px-2 py-2">{formatYen(candidate.totalCost)}</td>
                          <td
                            className={cn(
                              "px-2 py-2 font-semibold",
                              candidate.profit < 0 ? "text-rose-600" : "text-emerald-600",
                            )}
                          >
                            {formatYen(candidate.profit)}
                          </td>
                          <td className="px-2 py-2">{candidate.note ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
