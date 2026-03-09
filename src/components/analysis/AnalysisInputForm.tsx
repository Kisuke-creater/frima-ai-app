import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Input, { fieldClassName } from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import type { ItemCondition } from "@/lib/market-analysis/types";
import { cn } from "@/lib/cn";

type ConditionOption = {
  value: ItemCondition;
  label: string;
};

interface AnalysisInputFormProps {
  title: string;
  description: string;
  condition: ItemCondition;
  conditionOptions: ConditionOption[];
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onConditionChange: (value: ItemCondition) => void;
}

function FieldLabel({ text }: { text: string }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{text}</label>;
}

export default function AnalysisInputForm({
  title,
  description,
  condition,
  conditionOptions,
  onTitleChange,
  onDescriptionChange,
  onConditionChange,
}: AnalysisInputFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>商品情報</CardTitle>
        <CardDescription>タイトル・説明・状態を入力して販売先分析を行います。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <FieldLabel text="商品タイトル" />
          <Input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="例: Nikon D5300 ボディ ジャンク"
            maxLength={80}
          />
        </div>

        <div>
          <FieldLabel text="商品説明（任意）" />
          <Textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="例: 動作未確認・バッテリーなし・キズあり。部品取り向け。"
            maxLength={800}
            className="min-h-28"
          />
        </div>

        <div>
          <FieldLabel text="商品状態" />
          <select
            className={cn(fieldClassName, "pr-10")}
            value={condition}
            onChange={(event) => onConditionChange(event.target.value as ItemCondition)}
          >
            {conditionOptions.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
