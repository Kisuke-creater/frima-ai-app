"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CircleDollarSign,
  PackageCheck,
  PackageOpen,
  Percent,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getItems, getFirestoreClientErrorMessage, Item } from "@/lib/firestore";
import StatCard from "@/components/dashboard/StatCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

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
      .catch((cause: unknown) => {
        setError(getFirestoreClientErrorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const stats = useMemo(() => {
    const listed = items.filter((item) => item.status === "listed");
    const sold = items.filter((item) => item.status === "sold");
    const totalSales = sold.reduce((sum, item) => sum + (item.soldPrice ?? item.price ?? 0), 0);
    const soldRate = items.length === 0 ? 0 : Math.round((sold.length / items.length) * 100);
    return { listed: listed.length, sold: sold.length, totalSales, soldRate };
  }, [items]);

  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getMonth() + 1}月`;
      months[key] = 0;
    }

    items
      .filter((item) => item.status === "sold" && item.soldAt)
      .forEach((item) => {
        if (!item.soldAt) return;
        const date = item.soldAt.toDate();
        const key = `${date.getMonth() + 1}月`;
        if (key in months) {
          months[key] += item.soldPrice ?? item.price ?? 0;
        }
      });

    return Object.entries(months).map(([month, value]) => ({ month, value }));
  }, [items]);

  const maxMonthlyValue = Math.max(...monthlyData.map((entry) => entry.value), 1);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="出品中"
          value={loading ? "..." : `${stats.listed}件`}
          hint="現在販売中の商品"
          icon={PackageOpen}
        />
        <StatCard
          label="販売済み"
          value={loading ? "..." : `${stats.sold}件`}
          hint="成約済みの商品"
          icon={PackageCheck}
        />
        <StatCard
          label="売上合計"
          value={loading ? "..." : formatYen(stats.totalSales)}
          hint="販売済み商品の合計"
          icon={CircleDollarSign}
        />
        <StatCard
          label="販売率"
          value={loading ? "..." : `${stats.soldRate}%`}
          hint="累計商品の販売率"
          icon={Percent}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-brand-600" />
              直近6か月の売上推移
            </CardTitle>
            <CardDescription>月ごとの販売金額（販売済み商品のみ）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-52 items-end justify-between gap-3">
              {monthlyData.map((entry) => (
                <div key={entry.month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] text-slate-400">
                    {entry.value > 0 ? formatYen(entry.value) : "¥0"}
                  </span>
                  <div className="flex h-36 w-full items-end rounded-lg bg-slate-50 px-1.5">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-brand-600 to-brand-300"
                      style={{
                        height: `${Math.max((entry.value / maxMonthlyValue) * 100, entry.value > 0 ? 9 : 3)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">{entry.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最新の商品</CardTitle>
            <CardDescription>最近登録した5件を表示</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((value) => (
                  <div
                    key={value}
                    className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                  />
                ))}
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-500">まだ商品が登録されていません。</p>
                <Link
                  href="/generate"
                  className={buttonClassName({
                    variant: "primary",
                    className: "mt-4",
                  })}
                >
                  最初の商品を登録する
                </Link>
              </div>
            )}

            {!loading &&
              items.slice(0, 5).map((item) => (
                <article
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.category}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-slate-900">
                      {formatYen(
                        (item.status === "sold" ? item.soldPrice : item.price) ?? item.price ?? 0,
                      )}
                    </p>
                    <Badge variant={item.status === "sold" ? "sold" : "listed"}>
                      {item.status === "sold" ? "販売済み" : "出品中"}
                    </Badge>
                  </div>
                </article>
              ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
