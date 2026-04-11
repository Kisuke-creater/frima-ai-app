import NegotiationRecommendationPanel from "@/components/negotiation/NegotiationRecommendationPanel";
import { cn } from "@/lib/cn";
import type { NegotiationAnalysisResult } from "@/lib/negotiation/types";

interface NegotiationChatMessageProps {
  role: "assistant" | "user";
  content: string;
  result?: NegotiationAnalysisResult;
}

export default function NegotiationChatMessage({
  role,
  content,
  result,
}: NegotiationChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%] space-y-3", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-[24px] px-4 py-3 text-sm leading-relaxed shadow-sm",
            isUser
              ? "bg-brand-600 text-white"
              : "border border-slate-200 bg-white text-slate-700",
          )}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {result && <NegotiationRecommendationPanel result={result} />}
      </div>
    </div>
  );
}
