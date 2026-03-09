import { cn } from "@/lib/cn";
import type {
  AnalysisPlatform,
  PlatformComparisonResult,
} from "@/lib/market-analysis/types";

interface PlatformComparisonTableProps {
  rows: PlatformComparisonResult[];
  recommendedPlatform: AnalysisPlatform;
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatSellDays(minDays: number, maxDays: number): string {
  return `${minDays}〜${maxDays}日`;
}

export default function PlatformComparisonTable({
  rows,
  recommendedPlatform,
}: PlatformComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
            <th className="px-3 py-2">プラットフォーム</th>
            <th className="px-3 py-2">推定価格</th>
            <th className="px-3 py-2">売れる確率</th>
            <th className="px-3 py-2">売れるまで</th>
            <th className="px-3 py-2">手数料</th>
            <th className="px-3 py-2">送料</th>
            <th className="px-3 py-2">期待利益</th>
            <th className="px-3 py-2">根拠</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRecommended = row.platform === recommendedPlatform;
            return (
              <tr
                key={row.platform}
                className={cn(
                  "border-b border-slate-100 align-top text-slate-700",
                  isRecommended && "bg-brand-50/70",
                )}
              >
                <td className="px-3 py-3 font-semibold text-slate-900">
                  {isRecommended ? `おすすめ: ${row.platformLabel}` : row.platformLabel}
                </td>
                <td className="px-3 py-3">{formatYen(row.estimatedPrice)}</td>
                <td className="px-3 py-3">{row.sellProbability}%</td>
                <td className="px-3 py-3">
                  {formatSellDays(row.estimatedSellDaysMin, row.estimatedSellDaysMax)}
                </td>
                <td className="px-3 py-3">{formatYen(row.fee)}</td>
                <td className="px-3 py-3">{formatYen(row.shippingCost)}</td>
                <td
                  className={cn(
                    "px-3 py-3 font-semibold",
                    row.expectedProfit >= 0 ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {formatYen(row.expectedProfit)}
                </td>
                <td className="px-3 py-3 text-xs leading-relaxed text-slate-600">{row.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
