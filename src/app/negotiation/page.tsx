"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CircleDollarSign,
  LoaderCircle,
  MessageSquareText,
  PackageOpen,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFirestoreClientErrorMessage, getItems, type Item } from "@/lib/firestore";
import {
  calculateMinimumAcceptablePrice,
  calculateNegotiationProfit,
  canSimulateNegotiationProfit,
  createDefaultNegotiationCostSettings,
} from "@/lib/negotiation/calculate";
import type {
  NegotiationAnalysisResponse,
  NegotiationCostSettings,
  NegotiationHistoryMessage,
} from "@/lib/negotiation/types";
import { getMarketplaceLabel, MARKETPLACE_ORDER } from "@/lib/simulation/platform-fees";
import type { Marketplace } from "@/lib/simulation/types";
import NegotiationChatMessage from "@/components/negotiation/NegotiationChatMessage";
import NegotiationQuickActions, {
  type NegotiationQuickAction,
} from "@/components/negotiation/NegotiationQuickActions";
import { buttonClassName } from "@/components/ui/Button";
import Button from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import Input, { fieldClassName } from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  result?: NegotiationAnalysisResponse["result"];
};

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function currencyInputToNumber(value: string): number {
  const normalized = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) && normalized > 0 ? Math.round(normalized) : 0;
}

function toInputValue(value: number): string {
  return value > 0 ? String(value) : "";
}

function createInitialAssistantMessage(itemTitle?: string): ChatMessage {
  return {
    id: makeMessageId(),
    role: "assistant",
    content: itemTitle
      ? `「${itemTitle}」の交渉相談を始めます。購入希望者のメッセージを貼ると、判断・推奨価格・返信文案までまとめて返します。`
      : "商品を選ぶと、価格交渉の相談を始められます。",
  };
}

function buildQuickActions(listedPrice: number): NegotiationQuickAction[] {
  const offer90 = Math.max(300, Math.round(listedPrice * 0.9 / 100) * 100);
  const offer80 = Math.max(300, Math.round(listedPrice * 0.8 / 100) * 100);

  return [
    {
      id: "offer-90",
      label: "10%オフ相談",
      hint: `${formatYen(offer90)} の即決オファーを想定して本文へ反映`,
      prompt: `購入希望者から「${offer90.toLocaleString("ja-JP")}円なら即決したいです」と連絡が来ました。受けるべきか、いくらで返すべきか、返信文も作ってください。`,
      buyerOffer: offer90,
    },
    {
      id: "offer-80",
      label: "20%オフ相談",
      hint: `${formatYen(offer80)} の値下げ打診を想定して本文へ反映`,
      prompt: `購入希望者から「${offer80.toLocaleString("ja-JP")}円まで下げてもらえませんか？」と言われました。利益面も含めて判断してください。`,
      buyerOffer: offer80,
    },
    {
      id: "soft-discount",
      label: "値下げできますか？",
      hint: "金額指定なしのふわっとした交渉を相談",
      prompt: "購入希望者から「お値下げ可能でしょうか？」とだけ来ました。おすすめ判断と、失礼のない返答文を作ってください。",
    },
    {
      id: "sell-fast",
      label: "早売り3案",
      hint: "強気・標準・早売りの3案を出してもらう",
      prompt: "今週中に売り切りたい気持ちもあります。強気・標準・早売りの3案で返答を考えてください。",
    },
  ];
}

function buildAssistantSummary(result: NegotiationAnalysisResponse["result"]): string {
  const offerText = result.buyerOffer != null ? `提示 ${formatYen(result.buyerOffer)} に対して、` : "";
  return `${offerText}${result.recommendationLabel}として ${formatYen(result.recommendedReplyPrice)} を提案します。想定利益は ${formatYen(result.recommendedProfit.profit)} です。`;
}

export default function NegotiationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace>("mercari");
  const [buyerOfferInput, setBuyerOfferInput] = useState("");
  const [acquisitionCostInput, setAcquisitionCostInput] = useState("");
  const [desiredProfitInput, setDesiredProfitInput] = useState("");
  const [manualShippingFeeInput, setManualShippingFeeInput] = useState("");
  const [manualPackagingCostInput, setManualPackagingCostInput] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([createInitialAssistantMessage()]);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const listedItems = useMemo(() => items.filter((item) => item.status === "listed"), [items]);
  const selectedItem = useMemo(
    () => listedItems.find((item) => item.id === selectedItemId) ?? null,
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
      .catch((cause: unknown) => {
        setError(getFirestoreClientErrorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!listedItems.length) {
      setSelectedItemId("");
      return;
    }

    if (!selectedItemId || !listedItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(listedItems[0].id ?? "");
    }
  }, [listedItems, selectedItemId]);

  useEffect(() => {
    if (!selectedItem) {
      setMessages([createInitialAssistantMessage()]);
      return;
    }

    setSelectedMarketplace(selectedItem.marketplace ?? "mercari");
    const defaults = createDefaultNegotiationCostSettings({
      id: selectedItem.id,
      title: selectedItem.title,
      description: selectedItem.description,
      category: selectedItem.category,
      condition: selectedItem.condition,
      listedPrice: selectedItem.price,
      marketplace: selectedItem.marketplace,
      shippingSpec: selectedItem.shippingSpec,
    });

    setBuyerOfferInput("");
    setAcquisitionCostInput(toInputValue(defaults.acquisitionCost));
    setDesiredProfitInput(toInputValue(defaults.desiredProfit));
    setManualShippingFeeInput(toInputValue(defaults.manualShippingFee));
    setManualPackagingCostInput(toInputValue(defaults.manualPackagingCost));
    setDraftMessage("");
    setMessages([createInitialAssistantMessage(selectedItem.title)]);
    setError("");
  }, [selectedItem]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting]);

  const selectedItemContext = useMemo(() => {
    if (!selectedItem) return null;

    return {
      id: selectedItem.id,
      title: selectedItem.title,
      description: selectedItem.description,
      category: selectedItem.category,
      condition: selectedItem.condition,
      listedPrice: selectedItem.price,
      marketplace: selectedMarketplace,
      shippingSpec: selectedItem.shippingSpec,
    };
  }, [selectedItem, selectedMarketplace]);

  const costSettings = useMemo<NegotiationCostSettings>(
    () => ({
      acquisitionCost: currencyInputToNumber(acquisitionCostInput),
      desiredProfit: currencyInputToNumber(desiredProfitInput),
      manualShippingFee: currencyInputToNumber(manualShippingFeeInput),
      manualPackagingCost: currencyInputToNumber(manualPackagingCostInput),
    }),
    [acquisitionCostInput, desiredProfitInput, manualPackagingCostInput, manualShippingFeeInput],
  );

  const buyerOffer = useMemo(() => {
    const value = currencyInputToNumber(buyerOfferInput);
    return value > 0 ? value : null;
  }, [buyerOfferInput]);

  const currentListingProfit = useMemo(() => {
    if (!selectedItemContext) return null;

    return calculateNegotiationProfit({
      item: selectedItemContext,
      targetPrice: selectedItemContext.listedPrice,
      marketplace: selectedMarketplace,
      costSettings,
    });
  }, [costSettings, selectedItemContext, selectedMarketplace]);

  const buyerOfferProfit = useMemo(() => {
    if (!selectedItemContext || buyerOffer == null) return null;

    return calculateNegotiationProfit({
      item: selectedItemContext,
      targetPrice: buyerOffer,
      marketplace: selectedMarketplace,
      costSettings,
    });
  }, [buyerOffer, costSettings, selectedItemContext, selectedMarketplace]);

  const floorPrice = useMemo(() => {
    if (!selectedItemContext) return null;

    return calculateMinimumAcceptablePrice({
      item: selectedItemContext,
      marketplace: selectedMarketplace,
      costSettings,
    });
  }, [costSettings, selectedItemContext, selectedMarketplace]);

  const usesSavedShipping = useMemo(() => {
    if (!selectedItemContext) return false;
    return canSimulateNegotiationProfit(selectedItemContext, selectedMarketplace);
  }, [selectedItemContext, selectedMarketplace]);

  const quickActions = useMemo(
    () => (selectedItem ? buildQuickActions(selectedItem.price) : []),
    [selectedItem],
  );

  const handleQuickActionSelect = (action: NegotiationQuickAction) => {
    setDraftMessage(action.prompt);
    if (action.buyerOffer) {
      setBuyerOfferInput(String(action.buyerOffer));
    }
  };

  const handleSubmit = async () => {
    if (!selectedItemContext) {
      setError("出品中の商品を選択してください。");
      return;
    }

    const message = draftMessage.trim();
    if (!message) {
      setError("購入希望者のメッセージ、または相談内容を入力してください。");
      return;
    }

    const history: NegotiationHistoryMessage[] = messages.map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
    const nextUserMessage: ChatMessage = {
      id: makeMessageId(),
      role: "user",
      content: message,
    };

    setMessages((prev) => [...prev, nextUserMessage]);
    setDraftMessage("");
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/negotiation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: selectedItemContext,
          buyerMessage: message,
          buyerOffer,
          marketplace: selectedMarketplace,
          costSettings,
          history,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "価格交渉AIの呼び出しに失敗しました。");
      }

      const data = (await response.json()) as NegotiationAnalysisResponse;
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: "assistant",
          content: buildAssistantSummary(data.result),
          result: data.result,
        },
      ]);
    } catch (cause: unknown) {
      const messageText =
        cause instanceof Error ? cause.message : "価格交渉AIの呼び出しに失敗しました。";
      setError(messageText);
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: "assistant",
          content: `今回は回答を返せませんでした。${messageText}`,
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && listedItems.length === 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="py-16 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
              <PackageOpen className="size-8" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">まずは商品を登録してください</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              価格交渉AIは出品中の商品情報と連携して判断します。商品登録後に使えるようになります。
            </p>
            <Link
              href="/generate"
              className={buttonClassName({
                variant: "primary",
                className: "mt-5",
              })}
            >
              商品登録へ進む
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
          <section className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/80 to-brand-50/80">
                <CardTitle className="flex items-center gap-2">
                  <PackageOpen className="size-4 text-brand-600" />
                  交渉対象の商品
                </CardTitle>
                <CardDescription>商品情報を選ぶと、価格交渉の相談内容に反映されます。</CardDescription>
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
                        {item.title} / {formatYen(item.price)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItem && (
                  <>
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                      {selectedItem.imageUrls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedItem.imageUrls[0]}
                          alt={selectedItem.title}
                          className="aspect-[16/10] w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-[16/10] w-full place-items-center bg-slate-100 text-sm font-medium text-slate-400">
                          NO IMAGE
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-slate-950">{selectedItem.title}</p>
                      <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
                        {selectedItem.description}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Current Price
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-950">
                          {formatYen(selectedItem.price)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Category
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{selectedItem.category}</p>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-600">出品先</label>
                      <select
                        className={cn(fieldClassName, "pr-10")}
                        value={selectedMarketplace}
                        onChange={(event) => setSelectedMarketplace(event.target.value as Marketplace)}
                      >
                        {MARKETPLACE_ORDER.map((marketplace) => (
                          <option key={marketplace} value={marketplace}>
                            {getMarketplaceLabel(marketplace)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-brand-600" />
                  利益ガードレール
                </CardTitle>
                <CardDescription>原価や最低利益を入れると、AIの判断が現実寄りになります。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    購入希望価格（任意）
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={buyerOfferInput}
                    onChange={(event) => setBuyerOfferInput(event.target.value)}
                    placeholder="例: 8800"
                    disabled={!selectedItem}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-600">仕入れ原価</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={acquisitionCostInput}
                      onChange={(event) => setAcquisitionCostInput(event.target.value)}
                      placeholder="例: 3000"
                      disabled={!selectedItem}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-600">
                      最低利益ライン
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={desiredProfitInput}
                      onChange={(event) => setDesiredProfitInput(event.target.value)}
                      placeholder="例: 1500"
                      disabled={!selectedItem}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-600">手動送料</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={manualShippingFeeInput}
                      onChange={(event) => setManualShippingFeeInput(event.target.value)}
                      placeholder="例: 210"
                      disabled={!selectedItem}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-600">資材費</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={manualPackagingCostInput}
                      onChange={(event) => setManualPackagingCostInput(event.target.value)}
                      placeholder="例: 70"
                      disabled={!selectedItem}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {usesSavedShipping
                    ? "送料・資材費は保存済みサイズ情報から自動推定されます。手動送料と資材費は、サイズ情報が不足している場合の補助値です。"
                    : "サイズ情報が未登録のため、手動送料と資材費を使って概算利益を計算します。"}
                </div>

                <NegotiationQuickActions actions={quickActions} onSelect={handleQuickActionSelect} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-brand-100 bg-gradient-to-br from-white to-brand-50/70">
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CircleDollarSign className="size-4 text-brand-600" />
                    現在価格の利益
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      currentListingProfit
                        ? currentListingProfit.profit >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                        : "text-slate-400",
                    )}
                  >
                    {currentListingProfit ? formatYen(currentListingProfit.profit) : "--"}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {currentListingProfit?.shippingMethodLabel
                      ? `${currentListingProfit.shippingMethodLabel} を想定`
                      : "送料・資材費を含む概算利益"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Sparkles className="size-4 text-brand-600" />
                    オファー利益
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      buyerOfferProfit && buyerOfferProfit.profit >= 0
                        ? "text-emerald-600"
                        : "text-slate-400",
                    )}
                  >
                    {buyerOfferProfit ? formatYen(buyerOfferProfit.profit) : "--"}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {buyerOffer != null ? `${formatYen(buyerOffer)} で売れた場合` : "購入希望価格を入れると表示"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white">
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ShieldCheck className="size-4 text-brand-600" />
                    最低ライン
                  </div>
                  <p className="text-2xl font-bold text-slate-950">
                    {floorPrice != null ? formatYen(floorPrice) : "--"}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    損をしない、または指定利益を守るための目安です。
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/60 to-brand-50/80">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-4 text-brand-600" />
                  価格交渉AIチャット
                </CardTitle>
                <CardDescription>
                  購入希望者のメッセージを貼ると、判断・推奨返信価格・想定利益・返信文案をまとめて返します。
                </CardDescription>
              </CardHeader>

              <div className="bg-slate-50/70 px-6 py-6">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <NegotiationChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      result={message.result}
                    />
                  ))}

                  {submitting && (
                    <div className="flex justify-start">
                      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                        <div className="flex items-center gap-2">
                          <LoaderCircle className="size-4 animate-spin text-brand-600" />
                          AIが交渉案を整理しています...
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              <div className="border-t border-slate-100 bg-white px-6 py-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <MessageSquareText className="size-4 text-brand-600" />
                  相談メッセージ
                </div>
                <Textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="例: 購入希望者から『8,500円なら即決したいです』と言われました。受けるべきかと返信文を考えてください。"
                  className="mt-3 min-h-36 resize-y"
                  disabled={!selectedItem || submitting}
                />

                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    商品情報・送料・利益ラインを加味して JSON ベースで判断します。`Ctrl + Enter` でも送信できます。
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => void handleSubmit()}
                    disabled={!selectedItem || submitting}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        AIに相談中...
                      </>
                    ) : (
                      <>
                        <SendHorizonal className="size-4" />
                        AIに相談する
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
