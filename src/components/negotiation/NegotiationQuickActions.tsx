import { Sparkles } from "lucide-react";

export interface NegotiationQuickAction {
  id: string;
  label: string;
  hint: string;
  prompt: string;
  buyerOffer?: number;
}

interface NegotiationQuickActionsProps {
  actions: NegotiationQuickAction[];
  onSelect: (action: NegotiationQuickAction) => void;
}

export default function NegotiationQuickActions({
  actions,
  onSelect,
}: NegotiationQuickActionsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Sparkles className="size-4 text-brand-600" />
        クイックアクション
      </div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onSelect(action)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/60"
          >
            <p className="text-sm font-semibold text-slate-900">{action.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{action.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
