import { fieldClassName } from "@/components/ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import type { Marketplace } from "@/lib/simulation/types";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Option = {
  value: string;
  label: string;
};

interface ItemFormProps {
  itemName: string;
  accessories: string;
  condition: string;
  marketplace: Marketplace;
  conditionOptions: Option[];
  marketplaceOptions: Array<{ value: Marketplace; label: string }>;
  onItemNameChange: (value: string) => void;
  onAccessoriesChange: (value: string) => void;
  onConditionChange: (value: string) => void;
  onMarketplaceChange: (value: Marketplace) => void;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </label>
  );
}

export default function ItemForm({
  itemName,
  accessories,
  condition,
  marketplace,
  conditionOptions,
  marketplaceOptions,
  onItemNameChange,
  onAccessoriesChange,
  onConditionChange,
  onMarketplaceChange,
}: ItemFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Registration</CardTitle>
        <CardDescription>商品情報と状態を入力してください。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <FieldLabel>商品名</FieldLabel>
          <Input
            value={itemName}
            onChange={(event) => onItemNameChange(event.target.value)}
            placeholder="例: iPhone 13 Pro 256GB"
          />
        </div>

        <div>
          <FieldLabel>付属品</FieldLabel>
          <Input
            value={accessories}
            onChange={(event) => onAccessoriesChange(event.target.value)}
            placeholder="例: 箱 / 充電ケーブル / 取扱説明書"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>商品の状態</FieldLabel>
            <select
              className={cn(fieldClassName, "pr-10")}
              value={condition}
              onChange={(event) => onConditionChange(event.target.value)}
            >
              {conditionOptions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>プラットフォーム</FieldLabel>
            <select
              className={cn(fieldClassName, "pr-10")}
              value={marketplace}
              onChange={(event) => onMarketplaceChange(event.target.value as Marketplace)}
            >
              {marketplaceOptions.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
