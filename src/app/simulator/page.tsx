"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [sellingPriceInput, setSellingPriceInput] = useState("");
  const [compareAllPlatforms, setCompareAllPlatforms] = useState(true);
  const [marketplaceInput, setMarketplaceInput] =
    useState<MarketplaceOption>("");
  const [lengthCmInput, setLengthCmInput] = useState("");
  const [widthCmInput, setWidthCmInput] = useState("");
  const [heightCmInput, setHeightCmInput] = useState("");
  const [weightGInput, setWeightGInput] = useState("");
  const [packagingMaterialId, setPackagingMaterialId] = useState("none");

  const lastInitializedItemId = useRef<string | null>(null);

  const listedItems = useMemo(
    () => items.filter((item) => item.status === "listed"),
    [items],
  );

  const selectedItem = useMemo(
    () => listedItems.find((item) => item.id === selectedItemId),
    [listedItems, selectedItemId],
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getItems(user.uid)
      .then((data) => {
        setItems(data);
        setError("");
      })
      .catch((e: unknown) => setError(getFirestoreClientErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedItem) {
      setSellingPriceInput("");
      setMarketplaceInput("");
      setLengthCmInput("");
      setWidthCmInput("");
      setHeightCmInput("");
      setWeightGInput("");
      setPackagingMaterialId("none");
      setResult(null);
      setError("");
      setWarning("");
      lastInitializedItemId.current = null;
      return;
    }

    // Only populate fields if this is a newly selected item (prevents clearing results on update)
    if (lastInitializedItemId.current !== selectedItem.id) {
      setSellingPriceInput(String(selectedItem.price ?? ""));
      setMarketplaceInput(selectedItem.marketplace ?? "");
      setLengthCmInput(toInputString(selectedItem.shippingSpec?.lengthCm));
      setWidthCmInput(toInputString(selectedItem.shippingSpec?.widthCm));
      setHeightCmInput(toInputString(selectedItem.shippingSpec?.heightCm));
      setWeightGInput(gramsToKgInputString(selectedItem.shippingSpec?.weightG));
      setPackagingMaterialId(
        selectedItem.shippingSpec?.packagingMaterialId ?? "none",
      );
      setResult(null);
      setError("");
      setWarning("");

      lastInitializedItemId.current = selectedItem.id ?? null;
    }
  }, [selectedItem]);

  const effectiveMarketplace = (marketplaceInput ||
    selectedItem?.marketplace ||
    "") as MarketplaceOption;
  const needsMarketplaceSelection = !selectedItem?.marketplace;
  const selectedPackagingMaterial =
    PACKAGING_MATERIAL_MAP[packagingMaterialId] ?? PACKAGING_MATERIAL_MAP.none;

  const parsePositive = (raw: string, label: string): number | null => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setError(`${label}を数値で入力してください。`);
      return null;
    }
    if (value <= 0) {
      setError(`${label}は0より大きい値で入力してください。`);
      return null;
    }
    return value;
  };

  const handleRunSimulation = async () => {
    if (!user) {
      setError("ログイン状態を確認できません。再ログインしてお試しください。");
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
    const weightKg = parsePositive(weightGInput, "重量（kg）");
    if (
      sellingPrice == null ||
      lengthCm == null ||
      widthCm == null ||
      heightCm == null ||
      weightKg == null
    ) {
      return;
    }

    if (!effectiveMarketplace) {
      setError("プラットフォームを選択してください。");
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
          : effectiveMarketplace,
        shippingSpec,
      });

      setResult(nextResult);
      if (nextResult.candidates.length === 0) {
        setError(
          "条件に合う配送方法が見つかりませんでした。サイズ・重量を見直してください。",
        );
      }

      try {
        await updateItemSimulationInputs(user.uid, selectedItem.id, {
          marketplace: effectiveMarketplace,
          shippingSpec,
        });

        setItems((prev) =>
          prev.map((item) =>
            item.id === selectedItem.id
              ? { ...item, marketplace: effectiveMarketplace, shippingSpec }
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
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>利益シミュレーション</h1>
        <p>
          出品中の商品ごとに、プラットフォーム手数料・送料・資材費を比較して利益を試算します。
        </p>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {warning && (
        <p
          style={{
            color: "var(--warning)",
            fontSize: 13,
            marginTop: error ? 8 : 0,
          }}
        >
          {warning}
        </p>
      )}

      <div className="simulator-layout">
        <div className="result-section">
          <div className="card">
            <div className="card-title">対象商品</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                className="form-control"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                disabled={loading}
              >
                <option value="">
                  {loading ? "読み込み中..." : "出品中の商品を選択してください"}
                </option>
                {listedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}（{formatYen(item.price)}）
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-title">シミュレーション条件</div>
            <div className="sim-field-grid">
              <div className="form-group">
                <label className="form-label">販売価格（円）</label>
                <input
                  className="form-control"
                  type="number"
                  min={1}
                  value={sellingPriceInput}
                  onChange={(e) => setSellingPriceInput(e.target.value)}
                  placeholder="例: 12800"
                  disabled={!selectedItem}
                />
              </div>

              <div className="form-group">
                <label className="form-label">比較モード</label>
                <label className="sim-checkbox">
                  <input
                    type="checkbox"
                    checked={compareAllPlatforms}
                    onChange={(e) => setCompareAllPlatforms(e.target.checked)}
                    disabled={!selectedItem}
                  />
                  全プラットフォームを比較する
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">
                  商品のプラットフォーム（保存）
                  {needsMarketplaceSelection && (
                    <span className="sim-required">必須</span>
                  )}
                </label>
                <select
                  className="form-control"
                  value={effectiveMarketplace}
                  onChange={(e) =>
                    setMarketplaceInput(e.target.value as MarketplaceOption)
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
              </div>

              {!compareAllPlatforms && (
                <div className="sim-note-row">
                  比較対象は
                  {effectiveMarketplace
                    ? `「${getMarketplaceLabel(effectiveMarketplace)}」`
                    : "選択したプラットフォーム"}
                  のみです。
                </div>
              )}

              <div className="form-group">
                <label className="form-label">縦（cm）</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step="0.1"
                  value={lengthCmInput}
                  onChange={(e) => setLengthCmInput(e.target.value)}
                  placeholder="例: 20"
                  disabled={!selectedItem}
                />
              </div>

              <div className="form-group">
                <label className="form-label">横（cm）</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step="0.1"
                  value={widthCmInput}
                  onChange={(e) => setWidthCmInput(e.target.value)}
                  placeholder="例: 15"
                  disabled={!selectedItem}
                />
              </div>

              <div className="form-group">
                <label className="form-label">厚さ（cm）</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step="0.1"
                  value={heightCmInput}
                  onChange={(e) => setHeightCmInput(e.target.value)}
                  placeholder="例: 2.5"
                  disabled={!selectedItem}
                />
              </div>

              <div className="form-group">
                <label className="form-label">重量（kg）</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  step="0.001"
                  value={weightGInput}
                  onChange={(e) => setWeightGInput(e.target.value)}
                  placeholder="例: 0.38"
                  disabled={!selectedItem}
                />
              </div>

              <div className="form-group">
                <label className="form-label">配送資材</label>
                <select
                  className="form-control"
                  value={packagingMaterialId}
                  onChange={(e) => setPackagingMaterialId(e.target.value)}
                  disabled={!selectedItem}
                >
                  {PACKAGING_MATERIALS.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sim-cost-card">
                <span>資材費</span>
                <strong>{formatYen(selectedPackagingMaterial.cost)}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => void handleRunSimulation()}
              disabled={!selectedItem || running}
            >
              {running ? "シミュレーション中..." : "利益を試算する"}
            </button>
          </div>
        </div>

        <div className="result-section">
          {!result && (
            <div className="card">
              <div className="empty-state" style={{ padding: "28px 20px" }}>
                <div className="empty-icon">📦</div>
                <p>
                  商品を選択してサイズ・重量・配送資材を入力すると、
                  <br />
                  利益比較結果を表示します。
                </p>
              </div>
            </div>
          )}

          {result?.recommended && (
            <div className="card sim-recommend-card">
              <div className="sim-recommend-header">
                <span className="sim-kicker">推奨候補</span>
                <div className="sim-profit-value">
                  想定利益 {formatYen(result.recommended.profit)}
                </div>
              </div>
              <div className="sim-summary-grid">
                <div>
                  <span>プラットフォーム</span>
                  <strong>{result.recommended.marketplaceLabel}</strong>
                </div>
                <div>
                  <span>配送方法</span>
                  <strong>{result.recommended.shippingMethodLabel}</strong>
                </div>
                <div>
                  <span>配送資材</span>
                  <strong>{result.recommended.packagingMaterialLabel}</strong>
                </div>
              </div>
              <div className="sim-breakdown">
                <span>手数料: {formatYen(result.recommended.platformFee)}</span>
                <span>送料: {formatYen(result.recommended.shippingFee)}</span>
                <span>
                  資材費: {formatYen(result.recommended.packagingCost)}
                </span>
                <span>
                  合計コスト: {formatYen(result.recommended.totalCost)}
                </span>
              </div>
              {result.recommended.note && (
                <p className="sim-helper-note">
                  備考: {result.recommended.note}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="card">
              <div className="card-title">比較結果（利益順）</div>
              {result.candidates.length === 0 ? (
                <p className="sim-helper-note">
                  条件に一致する配送方法がありません。サイズ・重量を見直してください。
                </p>
              ) : (
                <div className="sim-table-wrap">
                  <table className="sim-table">
                    <thead>
                      <tr>
                        <th>PF</th>
                        <th>配送方法</th>
                        <th>資材</th>
                        <th>手数料</th>
                        <th>送料</th>
                        <th>資材費</th>
                        <th>合計コスト</th>
                        <th>想定利益</th>
                        <th>備考</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.candidates.map((candidate) => (
                        <tr
                          key={`${candidate.marketplace}-${candidate.shippingMethodId}`}
                        >
                          <td>{candidate.marketplaceLabel}</td>
                          <td>{candidate.shippingMethodLabel}</td>
                          <td>{candidate.packagingMaterialLabel}</td>
                          <td>{formatYen(candidate.platformFee)}</td>
                          <td>{formatYen(candidate.shippingFee)}</td>
                          <td>{formatYen(candidate.packagingCost)}</td>
                          <td>{formatYen(candidate.totalCost)}</td>
                          <td
                            className={
                              candidate.profit < 0
                                ? "sim-negative"
                                : "sim-positive"
                            }
                          >
                            {formatYen(candidate.profit)}
                          </td>
                          <td>{candidate.note ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
