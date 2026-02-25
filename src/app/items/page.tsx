"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  deleteItems,
  getItems,
  getFirestoreClientErrorMessage,
  markAsSold,
  type Item,
} from "@/lib/firestore";

type Tab = "listed" | "sold";

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export default function ItemsPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("listed");
  const [soldLoading, setSoldLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");

  const [sellDialogItem, setSellDialogItem] = useState<Item | null>(null);
  const [sellPriceInput, setSellPriceInput] = useState("");
  const [sellDialogError, setSellDialogError] = useState("");

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const fetchItems = async () => {
    if (!user) return;

    try {
      setError("");
      const data = await getItems(user.uid);
      setItems(data);
      setSelectedItemIds((prev) =>
        prev.filter((id) => data.some((item) => item.id === id)),
      );
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchItems().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const listedCount = useMemo(
    () => items.filter((item) => item.status === "listed").length,
    [items],
  );
  const soldCount = useMemo(
    () => items.filter((item) => item.status === "sold").length,
    [items],
  );

  const filtered = useMemo(
    () => items.filter((item) => item.status === tab),
    [items, tab],
  );
  const filteredIds = useMemo(
    () => filtered.flatMap((item) => (item.id ? [item.id] : [])),
    [filtered],
  );
  const selectedIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedFilteredIds = useMemo(
    () => filteredIds.filter((id) => selectedIdSet.has(id)),
    [filteredIds, selectedIdSet],
  );
  const allFilteredSelected =
    filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;

  const openSoldDialog = (item: Item) => {
    setSellDialogItem(item);
    setSellPriceInput(String(item.soldPrice ?? item.price ?? 0));
    setSellDialogError("");
    setError("");
  };

  const closeSoldDialog = () => {
    if (soldLoading) return;
    setSellDialogItem(null);
    setSellPriceInput("");
    setSellDialogError("");
  };

  const submitSoldDialog = async () => {
    if (!user) {
      setError("ログイン状態を確認してください。再ログイン後にお試しください。");
      return;
    }
    if (!sellDialogItem?.id) return;

    const soldPrice = Number(sellPriceInput.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(soldPrice) || soldPrice < 0) {
      setSellDialogError("実売額は0以上の数値で入力してください。");
      return;
    }

    setSoldLoading(sellDialogItem.id);
    try {
      setSellDialogError("");
      setError("");
      await markAsSold(user.uid, sellDialogItem.id, Math.round(soldPrice));
      setSellDialogItem(null);
      setSellPriceInput("");
      await fetchItems();
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    } finally {
      setSoldLoading(null);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedItemIds((prev) => {
      if (allFilteredSelected) {
        return prev.filter((id) => !filteredIds.includes(id));
      }
      const next = new Set(prev);
      filteredIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const deleteSelectedInTab = async () => {
    if (!user) {
      setError("ログイン状態を確認してください。再ログイン後にお試しください。");
      return;
    }
    if (selectedFilteredIds.length === 0) return;

    setDeleteLoading(true);
    try {
      setError("");
      await deleteItems(user.uid, selectedFilteredIds);
      setSelectedItemIds((prev) =>
        prev.filter((id) => !selectedFilteredIds.includes(id)),
      );
      await fetchItems();
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    } finally {
      setDeleteLoading(false);
    }
  };

  const conditionLabel: Record<string, string> = {
    new: "新品・未使用",
    like_new: "未使用に近い",
    good: "目立った傷や汚れなし",
    fair: "やや傷や汚れあり",
    poor: "全体的に状態が悪い",
  };

  const formatItemPrice = (item: Item) =>
    formatYen((item.status === "sold" ? item.soldPrice : item.price) ?? item.price ?? 0);

  return (
    <div className="fade-in">
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>商品一覧</h1>
          <p>出品中・売却済みの商品をまとめて管理できます。</p>
        </div>
        <Link href="/generate" className="btn btn-primary">
          AI生成で追加
        </Link>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "listed" ? "active" : ""}`}
          onClick={() => setTab("listed")}
        >
          出品中 ({listedCount})
        </button>
        <button
          className={`tab-btn ${tab === "sold" ? "active" : ""}`}
          onClick={() => setTab("sold")}
        >
          売却済み ({soldCount})
        </button>
      </div>

      {!loading && filtered.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            margin: "12px 0 16px",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
              cursor: deleteLoading ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
              disabled={deleteLoading}
              style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
            />
            このタブを全選択
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              選択中: {selectedFilteredIds.length}件
            </span>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void deleteSelectedInTab()}
              disabled={deleteLoading || selectedFilteredIds.length === 0}
            >
              {deleteLoading
                ? "削除中..."
                : `選択を削除 (${selectedFilteredIds.length})`}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="items-grid">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="shimmer"
              style={{ height: 200, borderRadius: 18 }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{tab === "listed" ? "📦" : "✅"}</div>
          <p>
            {tab === "listed"
              ? "出品中の商品はまだありません"
              : "売却済みの商品はまだありません"}
          </p>
          {tab === "listed" && (
            <Link href="/generate" className="btn btn-primary" style={{ marginTop: 16 }}>
              AI生成で出品する
            </Link>
          )}
        </div>
      ) : (
        <div className="items-grid">
          {filtered.map((item) => (
            <div key={item.id} className="item-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {item.id && (
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        cursor: deleteLoading ? "not-allowed" : "pointer",
                      }}
                      aria-label={`${item.title} を選択`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(item.id)}
                        onChange={() => toggleItemSelection(item.id!)}
                        disabled={deleteLoading}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--accent)",
                        }}
                      />
                    </label>
                  )}
                  <span className={`item-badge ${item.status}`}>
                    {item.status === "listed" ? "出品中" : "売却済み"}
                  </span>
                </div>
                <span className="item-category">{item.category}</span>
              </div>

              <div className="item-title">{item.title}</div>

              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.description}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  状態: {conditionLabel[item.condition] ?? item.condition}
                </span>
                <div className="item-price">{formatItemPrice(item)}</div>
              </div>

              {item.createdAt && (
                <div className="item-meta">
                  登録日: {item.createdAt.toDate().toLocaleDateString("ja-JP")}
                  {item.soldAt && (
                    <>
                      {" "}
                      | 売却日: {item.soldAt.toDate().toLocaleDateString("ja-JP")}
                    </>
                  )}
                </div>
              )}

              {item.status === "listed" && (
                <button
                  className="btn btn-success"
                  onClick={() => openSoldDialog(item)}
                  disabled={soldLoading === item.id || deleteLoading}
                  style={{ width: "100%" }}
                >
                  {soldLoading === item.id ? (
                    <>
                      <span className="spinner" />
                      更新中...
                    </>
                  ) : (
                    "売却済みにする"
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sellDialogItem && (
        <div
          className="sell-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sell-dialog-title"
          onClick={closeSoldDialog}
        >
          <div className="sell-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="sell-dialog-header">
              <p className="sell-dialog-kicker">実売額入力</p>
              <h2 id="sell-dialog-title">実売額を入力</h2>
              <p className="sell-dialog-item-title">{sellDialogItem.title}</p>
            </div>

            <div className="sell-dialog-field">
              <label htmlFor="sold-price-input" className="sell-dialog-label">
                実売額（円）
              </label>
              <div className="sell-dialog-input-shell">
                <span className="sell-dialog-yen" aria-hidden="true">
                  ¥
                </span>
                <input
                  id="sold-price-input"
                  className="sell-dialog-input"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={sellPriceInput}
                  onChange={(e) => {
                    setSellPriceInput(e.target.value);
                    if (sellDialogError) setSellDialogError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitSoldDialog();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      closeSoldDialog();
                    }
                  }}
                  placeholder="例: 12800"
                />
              </div>
              <p className="sell-dialog-help">
                入力した実売額が売上集計とグラフに反映されます。
              </p>
            </div>

            {sellDialogError && <p className="error-msg">{sellDialogError}</p>}

            <div className="sell-dialog-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeSoldDialog}
                disabled={soldLoading === sellDialogItem.id}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => void submitSoldDialog()}
                disabled={soldLoading === sellDialogItem.id}
              >
                {soldLoading === sellDialogItem.id ? (
                  <>
                    <span className="spinner" />
                    保存中...
                  </>
                ) : (
                  "売却済みにする"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
