"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  getItems,
  getFirestoreClientErrorMessage,
  markAsSold,
  Item,
} from "@/lib/firestore";
import Link from "next/link";

type Tab = "listed" | "sold";

export default function ItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("listed");
  const [soldLoading, setSoldLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchItems = async () => {
    if (!user) return;
    try {
      setError("");
      const data = await getItems(user.uid);
      setItems(data);
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchItems().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSold = async (item: Item) => {
    if (!item.id) return;
    if (!confirm(`「${item.title}」を売れた！にしますか？`)) return;
    setSoldLoading(item.id);
    try {
      setError("");
      await markAsSold(item.id);
      await fetchItems();
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    } finally {
      setSoldLoading(null);
    }
  };

  const filtered = items.filter((i) => i.status === tab);

  const conditionLabel: Record<string, string> = {
    new: "新品・未使用",
    like_new: "未使用に近い",
    good: "目立った傷なし",
    fair: "やや傷あり",
    poor: "全体的に傷あり",
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>商品一覧</h1>
          <p>出品中・売却済み商品を管理できます</p>
        </div>
        <Link href="/generate" className="btn btn-primary">
          ＋ AI生成で追加
        </Link>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "listed" ? "active" : ""}`}
          onClick={() => setTab("listed")}
        >
          出品中 ({items.filter((i) => i.status === "listed").length})
        </button>
        <button
          className={`tab-btn ${tab === "sold" ? "active" : ""}`}
          onClick={() => setTab("sold")}
        >
          売却済み ({items.filter((i) => i.status === "sold").length})
        </button>
      </div>

      {loading ? (
        <div className="items-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer" style={{ height: 200, borderRadius: 18 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{tab === "listed" ? "📭" : "🎉"}</div>
          <p>
            {tab === "listed"
              ? "出品中の商品はありません"
              : "まだ売却済み商品はありません"}
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
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className={`item-badge ${item.status}`}>
                  {item.status === "listed" ? "⚡ 出品中" : "✅ 売却済み"}
                </span>
                <span className="item-category">{item.category}</span>
              </div>

              {/* Title */}
              <div className="item-title">{item.title}</div>

              {/* Description */}
              <p style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {item.description}
              </p>

              {/* Condition + Price */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  🏷️ {conditionLabel[item.condition] ?? item.condition}
                </span>
                <div className="item-price">¥{(item.price ?? 0).toLocaleString()}</div>
              </div>

              {/* Date */}
              {item.createdAt && (
                <div className="item-meta">
                  📅 登録: {item.createdAt.toDate().toLocaleDateString("ja-JP")}
                  {item.soldAt && (
                    <> ・ 売却: {item.soldAt.toDate().toLocaleDateString("ja-JP")}</>
                  )}
                </div>
              )}

              {/* Actions */}
              {item.status === "listed" && (
                <button
                  className="btn btn-success"
                  onClick={() => handleSold(item)}
                  disabled={soldLoading === item.id}
                  style={{ width: "100%" }}
                >
                  {soldLoading === item.id ? (
                    <>
                      <span className="spinner" />
                      更新中...
                    </>
                  ) : (
                    "🎉 売れた！"
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
