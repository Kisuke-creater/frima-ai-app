import { NEGOTIATION_JUDGMENT_LABELS, NEGOTIATION_STRATEGY_LABELS } from "./types";
import type {
  NegotiationCostSettings,
  NegotiationHistoryMessage,
  NegotiationItemContext,
  NegotiationProfitEstimate,
} from "./types";
import type { Marketplace } from "@/lib/simulation/types";

export const NEGOTIATION_SYSTEM_PROMPT = `
あなたはフリマ出品者専属の価格交渉アドバイザーです。
目的は、購入希望者からの値下げ交渉に対して、出品者が「受けるべきか」「いくらで返すべきか」「どう返信すべきか」をすぐ判断できるようにすることです。

必ず守ること:
- 日本語で回答する
- JSONのみを返す
- recommendedJudgment は accept / counter / decline のいずれか
- recommendedReplyPrice と suggestedPrice は整数の円価格
- strong / standard / quick_sale の3案を必ず返す
- strong の価格 >= standard の価格 >= quick_sale の価格
- 通常は現在の出品価格を上回る価格を提案しない
- floorPrice がある場合、それを明確な理由なく下回らない
- 返信文は購入者にそのまま送れる丁寧な文体にする

出力JSONスキーマ:
{
  "recommendedJudgment": "accept | counter | decline",
  "recommendationLabel": "おすすめ判断を一言で",
  "recommendedReplyPrice": 0,
  "reason": "理由を2〜4文で",
  "replyMessage": "購入者向けの返信文",
  "alternatives": [
    {
      "strategy": "strong | standard | quick_sale",
      "suggestedPrice": 0,
      "reason": "この戦略を選ぶ理由",
      "replyMessage": "購入者向けの返信文"
    }
  ]
}

判断の考え方:
- 利益が薄すぎる場合は安易に受けない
- buyerOffer が十分なら accept、それ以外は counter を基本に考える
- buyerMessage に即決・まとめ買い・送料込みなどの条件がある場合は反映する
- 迷う場合でも seller がすぐ返答できる具体案を返す
`.trim();

function formatProfitSnapshot(label: string, snapshot: NegotiationProfitEstimate | null): string {
  if (!snapshot) {
    return `${label}: なし`;
  }

  return [
    `${label}:`,
    `- sellingPrice: ${snapshot.sellingPrice}`,
    `- profit: ${snapshot.profit}`,
    `- platformFee: ${snapshot.platformFee}`,
    `- shippingFee: ${snapshot.shippingFee}`,
    `- packagingCost: ${snapshot.packagingCost}`,
    `- acquisitionCost: ${snapshot.acquisitionCost}`,
    `- calcMode: ${snapshot.calcMode}`,
    `- note: ${snapshot.note}`,
  ].join("\n");
}

export function buildNegotiationUserPrompt(input: {
  item: NegotiationItemContext;
  buyerMessage: string;
  buyerOffer: number | null;
  marketplace: Marketplace;
  floorPrice: number;
  costSettings: NegotiationCostSettings;
  currentListingProfit: NegotiationProfitEstimate;
  buyerOfferProfit: NegotiationProfitEstimate | null;
  history: NegotiationHistoryMessage[];
}): string {
  const historyText =
    input.history.length === 0
      ? "なし"
      : input.history
          .slice(-8)
          .map((message) => `${message.role}: ${message.content}`)
          .join("\n");

  return `
以下の交渉コンテキストを読み、JSONのみを返してください。

[商品情報]
- title: ${input.item.title}
- category: ${input.item.category}
- condition: ${input.item.condition}
- listedPrice: ${input.item.listedPrice}
- marketplace: ${input.marketplace}
- description: ${input.item.description || "なし"}

[コスト設定]
- acquisitionCost: ${input.costSettings.acquisitionCost}
- desiredProfit: ${input.costSettings.desiredProfit}
- manualShippingFee: ${input.costSettings.manualShippingFee}
- manualPackagingCost: ${input.costSettings.manualPackagingCost}
- floorPrice: ${input.floorPrice}

[利益スナップショット]
${formatProfitSnapshot("currentListingProfit", input.currentListingProfit)}
${formatProfitSnapshot("buyerOfferProfit", input.buyerOfferProfit)}

[交渉情報]
- buyerOffer: ${input.buyerOffer ?? "なし"}
- latestSellerRequest: ${input.buyerMessage}

[会話履歴]
${historyText}

[参考ラベル]
- recommendedJudgment labels:
  - accept = ${NEGOTIATION_JUDGMENT_LABELS.accept}
  - counter = ${NEGOTIATION_JUDGMENT_LABELS.counter}
  - decline = ${NEGOTIATION_JUDGMENT_LABELS.decline}
- strategy labels:
  - strong = ${NEGOTIATION_STRATEGY_LABELS.strong}
  - standard = ${NEGOTIATION_STRATEGY_LABELS.standard}
  - quick_sale = ${NEGOTIATION_STRATEGY_LABELS.quick_sale}
`.trim();
}
