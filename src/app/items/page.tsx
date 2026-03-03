"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, LoaderCircle, PlusCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  deleteItems,
  getItems,
  getFirestoreClientErrorMessage,
  markAsSold,
  type Item,
} from "@/lib/firestore";
import Button, { buttonClassName } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type Tab = "listed" | "sold";

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

const conditionLabel: Record<string, string> = {
  new: "新品・未使用",
  like_new: "未使用に近い",
  good: "目立った傷や汚れなし",
  fair: "やや傷や汚れあり",
  poor: "全体的に状態が悪い",
};

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
      setSelectedItemIds((prev) => prev.filter((id) => data.some((item) => item.id === id)));
    } catch (cause: unknown) {
      setError(getFirestoreClientErrorMessage(cause));
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchItems().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const listedCount = useMemo(() => items.filter((item) => item.status === "listed").length, [items]);
  const soldCount = useMemo(() => items.filter((item) => item.status === "sold").length, [items]);

  const filtered = useMemo(() => items.filter((item) => item.status === tab), [items, tab]);
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
      setSellDialogError("販売価格は0以上の数値で入力してください。");
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
    } catch (cause: unknown) {
      setError(getFirestoreClientErrorMessage(cause));
    } finally {
      setSoldLoading(null);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
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
      setSelectedItemIds((prev) => prev.filter((id) => !selectedFilteredIds.includes(id)));
      await fetchItems();
    } catch (cause: unknown) {
      setError(getFirestoreClientErrorMessage(cause));
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatItemPrice = (item: Item) =>
    formatYen((item.status === "sold" ? item.soldPrice : item.price) ?? item.price ?? 0);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Items</h2>
          <p className="mt-1 text-sm text-slate-500">出品中 / 販売済みの商品を一覧管理します。</p>
        </div>
        <Link href="/generate" className={buttonClassName({ variant: "primary" })}>
          <PlusCircle className="size-4" />
          商品登録へ
        </Link>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              tab === "listed"
                ? "bg-brand-600 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
            )}
            onClick={() => setTab("listed")}
          >
            出品中 ({listedCount})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              tab === "sold"
                ? "bg-brand-600 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
            )}
            onClick={() => setTab("sold")}
          >
            販売済み ({soldCount})
          </button>
        </div>
      </section>

      {!loading && filtered.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                disabled={deleteLoading}
                className="size-4 accent-blue-600"
              />
              このタブを全選択
            </label>

            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">選択中: {selectedFilteredIds.length}件</p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void deleteSelectedInTab()}
                disabled={deleteLoading || selectedFilteredIds.length === 0}
              >
                <Trash2 className="size-4" />
                {deleteLoading ? "削除中..." : "選択削除"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((value) => (
            <div
              key={value}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm text-slate-500">
              {tab === "listed" ? "出品中の商品がありません。" : "販売済みの商品がありません。"}
            </p>
            {tab === "listed" && (
              <Link
                href="/generate"
                className={buttonClassName({
                  variant: "primary",
                  className: "mt-4",
                })}
              >
                商品登録をはじめる
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.id && (
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(item.id)}
                        onChange={() => toggleItemSelection(item.id!)}
                        disabled={deleteLoading}
                        className="size-4 accent-blue-600"
                        aria-label={`${item.title} を選択`}
                      />
                    )}
                    <Badge variant={item.status === "sold" ? "sold" : "listed"}>
                      {item.status === "sold" ? "販売済み" : "出品中"}
                    </Badge>
                  </div>
                  <Badge>{item.category}</Badge>
                </div>

                <div>
                  <CardTitle className="line-clamp-1">{item.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{item.description}</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-slate-500">
                  状態: {conditionLabel[item.condition] ?? item.condition}
                </p>
                <p className="text-2xl font-bold text-slate-900">{formatItemPrice(item)}</p>
                {item.createdAt && (
                  <p className="text-xs text-slate-500">
                    登録日: {item.createdAt.toDate().toLocaleDateString("ja-JP")}
                    {item.soldAt && ` / 販売日: ${item.soldAt.toDate().toLocaleDateString("ja-JP")}`}
                  </p>
                )}

                {item.status === "listed" && (
                  <Button
                    variant="success"
                    fullWidth
                    onClick={() => openSoldDialog(item)}
                    disabled={soldLoading === item.id || deleteLoading}
                  >
                    {soldLoading === item.id ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      <>
                        <CheckCheck className="size-4" />
                        販売済みにする
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sellDialogItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sell-dialog-title"
          onClick={closeSoldDialog}
        >
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle id="sell-dialog-title">販売価格を入力</CardTitle>
              <CardDescription>{sellDialogItem.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="sold-price-input" className="mb-1.5 block text-sm font-medium text-slate-600">
                  販売価格（円）
                </label>
                <Input
                  id="sold-price-input"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={sellPriceInput}
                  onChange={(event) => {
                    setSellPriceInput(event.target.value);
                    if (sellDialogError) setSellDialogError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitSoldDialog();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeSoldDialog();
                    }
                  }}
                  placeholder="例: 12800"
                />
              </div>

              {sellDialogError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {sellDialogError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={closeSoldDialog}
                  disabled={soldLoading === sellDialogItem.id}
                >
                  キャンセル
                </Button>
                <Button
                  variant="success"
                  onClick={() => void submitSoldDialog()}
                  disabled={soldLoading === sellDialogItem.id}
                >
                  {soldLoading === sellDialogItem.id ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "販売済みにする"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
