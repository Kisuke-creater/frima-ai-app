"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { getItems, getFirestoreClientErrorMessage, Item } from "@/lib/firestore";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getItems(user.uid)
      .then((data) => {
        setItems(data);
        setError("");
      })
      .catch((e: unknown) => {
        setError(getFirestoreClientErrorMessage(e));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    const listed = items.filter((i) => i.status === "listed");
    const sold = items.filter((i) => i.status === "sold");
    const totalSales = sold.reduce(
      (sum, i) => sum + (i.soldPrice ?? i.price ?? 0),
      0
    );
    return { listed: listed.length, sold: sold.length, totalSales };
  }, [items]);

  // 月別売上（直近6か月）
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getMonth() + 1}月`;
      months[key] = 0;
    }
    items
      .filter((i) => i.status === "sold" && i.soldAt)
      .forEach((i) => {
        const d = i.soldAt!.toDate();
        const key = `${d.getMonth() + 1}月`;
        if (key in months) months[key] += i.soldPrice ?? i.price ?? 0;
      });
    return Object.entries(months).map(([month, value]) => ({ month, value }));
  }, [items]);

  const maxVal = Math.max(...monthlyData.map((d) => d.value), 1);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>ダッシュボード</h1>
        <p>フリマ出品の概要を確認できます</p>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-label">出品中</div>
          <div className="stat-value">{loading ? "—" : stats.listed}<span style={{ fontSize: 16, color: "var(--text-secondary)" }}>件</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">売却済み</div>
          <div className="stat-value">{loading ? "—" : stats.sold}<span style={{ fontSize: 16, color: "var(--text-secondary)" }}>件</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💴</div>
          <div className="stat-label">累計売上</div>
          <div className="stat-value accent">
            {loading ? "—" : `¥${stats.totalSales.toLocaleString()}`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-label">成約率</div>
          <div className="stat-value accent">
            {loading || items.length === 0
              ? "—"
              : `${Math.round((stats.sold / items.length) * 100)}%`}
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">月別売上（直近6か月）</div>
        <div className="bar-chart">
          {monthlyData.map(({ month, value }) => (
            <div key={month} className="bar-item">
              <div className="bar-value">
                {value > 0 ? `¥${(value / 1000).toFixed(0)}k` : ""}
              </div>
              <div
                className="bar"
                style={{ height: `${Math.max((value / maxVal) * 90, value > 0 ? 8 : 2)}px` }}
              />
              <div className="bar-month">{month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent items */}
      <div className="card">
        <div className="card-title">最近の出品</div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" style={{ height: 60, borderRadius: 8 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>まだ出品がありません</p>
            <Link href="/generate" className="btn btn-primary" style={{ marginTop: 16 }}>
              AI生成で最初の出品を作る
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--bg-secondary)",
                  borderRadius: 10,
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {item.category}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-light)" }}>
                    ¥{((item.status === "sold" ? item.soldPrice : item.price) ?? item.price ?? 0).toLocaleString()}
                  </div>
                  <span className={`item-badge ${item.status}`}>
                    {item.status === "listed" ? "出品中" : "売却済"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
