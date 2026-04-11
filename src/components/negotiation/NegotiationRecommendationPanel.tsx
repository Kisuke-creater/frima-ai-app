import NegotiationCopyButton from "@/components/negotiation/NegotiationCopyButton";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { NegotiationAnalysisResult } from "@/lib/negotiation/types";

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatMargin(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function judgmentStyle(judgment: NegotiationAnalysisResult["recommendedJudgment"]): string {
  switch (judgment) {
    case "accept":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "decline":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "counter":
    default:
      return "border-brand-200 bg-brand-50 text-brand-700";
  }
}

interface NegotiationRecommendationPanelProps {
  result: NegotiationAnalysisResult;
}

export default function NegotiationRecommendationPanel({
  result,
}: NegotiationRecommendationPanelProps) {
  const previewCards = [
    {
      key: "current",
      label: "現在価格",
      price: result.currentListingProfit.sellingPrice,
      profit: result.currentListingProfit.profit,
      note: result.currentListingProfit.note,
    },
    result.buyerOfferProfit && {
      key: "offer",
      label: "購入希望価格",
      price: result.buyerOfferProfit.sellingPrice,
      profit: result.buyerOfferProfit.profit,
      note: result.buyerOfferProfit.note,
    },
    {
      key: "recommended",
      label: "推奨返信価格",
      price: result.recommendedProfit.sellingPrice,
      profit: result.recommendedProfit.profit,
      note: result.recommendedProfit.note,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    price: number;
    profit: number;
    note: string;
  }>;

  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="rounded-[24px] border border-brand-200 bg-gradient-to-br from-white via-brand-50 to-blue-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
              judgmentStyle(result.recommendedJudgment),
            )}
          >
            {result.recommendationLabel}
          </span>
          <Badge>{result.recommendedProfit.marketplaceLabel}</Badge>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            目標ライン {formatYen(result.floorPrice)}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
              Recommended
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {formatYen(result.recommendedReplyPrice)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{result.reason}</p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">想定利益</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold",
                  result.recommendedProfit.profit >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {formatYen(result.recommendedProfit.profit)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">利益率</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatMargin(result.recommendedProfit.profitMarginRate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {previewCards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-lg font-bold text-slate-900">{formatYen(card.price)}</p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold",
                card.profit >= 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              利益 {formatYen(card.profit)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{card.note}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">返信文案</p>
            <p className="text-xs text-slate-500">そのまま購入希望者へ返せる文面です。</p>
          </div>
          <NegotiationCopyButton text={result.replyMessage} label="返信文をコピー" />
        </div>
        <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
          {result.replyMessage}
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">別案</p>
          <p className="text-xs text-slate-500">強気 / 標準 / 早売りの3パターンを比較できます。</p>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {result.alternatives.map((alternative) => (
            <article
              key={alternative.strategy}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {alternative.label}
                </span>
                <NegotiationCopyButton text={alternative.replyMessage} label="コピー" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-950">
                {formatYen(alternative.suggestedPrice)}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold",
                  alternative.profit.profit >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                想定利益 {formatYen(alternative.profit.profit)}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{alternative.reason}</p>
              <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-700">
                {alternative.replyMessage}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
