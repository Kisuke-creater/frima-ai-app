"use client";

import { useTheme } from "next-themes";
import { useRef, useState, useSyncExternalStore } from "react";
import { Download, Globe, LoaderCircle, LogOut, Monitor, Moon, Sun, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  getFirestoreClientErrorMessage,
  getItems,
  importItems,
  type ImportItemInput,
  type Item,
} from "@/lib/firestore";
import { MARKETPLACE_ORDER, getMarketplaceLabel } from "@/lib/simulation/platform-fees";
import type { Marketplace, ShippingSpec } from "@/lib/simulation/types";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  APP_LANGUAGE_OPTIONS,
  setAppLanguage,
  type AppLanguage,
  useAppLanguage,
} from "@/lib/language";

type ThemeOption = "light" | "dark" | "system";

const themeLabelMap: Record<ThemeOption, { label: string; icon: typeof Sun }> = {
  light: { label: "ライトモード", icon: Sun },
  dark: { label: "ダークモード", icon: Moon },
  system: { label: "システム設定に合わせる", icon: Monitor },
};

const languageLabelMap: Record<
  AppLanguage,
  { label: string; description: string; available: boolean }
> = {
  ja: {
    label: "日本語",
    description: "現在のアプリ表示で利用できます。",
    available: true,
  },
  en: {
    label: "English",
    description: "順次対応予定です。",
    available: false,
  },
};

const conditionLabelMap: Record<string, string> = {
  new: "新品・未使用",
  like_new: "未使用に近い",
  good: "目立った傷や汚れなし",
  fair: "やや傷や汚れあり",
  poor: "全体的に状態が悪い",
};

const statusLabelMap: Record<Item["status"], string> = {
  listed: "出品中",
  sold: "販売済み",
};

const csvHeaders = [
  "ID",
  "ユーザーID",
  "タイトル",
  "説明",
  "カテゴリ",
  "商品状態",
  "出品価格(円)",
  "ステータス",
  "販売価格(円)",
  "出品先",
  "登録日時",
  "販売日時",
  "配送_縦(cm)",
  "配送_横(cm)",
  "配送_高さ(cm)",
  "配送_重量(g)",
  "配送資材ID",
  "配送資材コスト(円)",
] as const;

const csvColumnAliases = {
  uid: ["ユーザーID", "User ID", "uid", "user_id", "userid"],
  title: ["タイトル", "Title", "title", "商品名", "name"],
  description: ["説明", "Description", "description", "商品説明"],
  category: ["カテゴリ", "Category", "category", "カテゴリー"],
  condition: ["商品状態", "Condition", "condition", "状態"],
  price: ["出品価格(円)", "Listed Price", "listed price", "price", "価格", "出品価格"],
  status: ["ステータス", "Status", "status"],
  soldPrice: ["販売価格(円)", "Sold Price", "sold price", "soldprice"],
  marketplace: ["出品先", "Marketplace", "marketplace"],
  createdAt: ["登録日時", "Created At", "created at", "createdat"],
  soldAt: ["販売日時", "Sold At", "sold at", "soldat"],
  lengthCm: ["配送_縦(cm)", "配送縦(cm)", "lengthcm", "length(cm)"],
  widthCm: ["配送_横(cm)", "配送横(cm)", "widthcm", "width(cm)"],
  heightCm: ["配送_高さ(cm)", "配送高さ(cm)", "heightcm", "height(cm)"],
  weightG: ["配送_重量(g)", "配送重量(g)", "weightg", "weight(g)"],
  packagingMaterialId: [
    "配送資材ID",
    "packagingmaterialid",
    "packaging material id",
  ],
  packagingMaterialCost: [
    "配送資材コスト(円)",
    "packagingmaterialcost",
    "packaging material cost",
    "packaging material cost(円)",
  ],
} as const;

type CsvColumnKey = keyof typeof csvColumnAliases;
type CsvColumnIndexes = Record<CsvColumnKey, number>;

function subscribeToClientRender(callback: () => void) {
  callback();
  return () => {};
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function formatTimestamp(timestampLike?: Item["createdAt"] | Item["soldAt"]): string {
  if (!timestampLike) return "";
  return timestampLike.toDate().toISOString();
}

function createItemsCsv(items: Item[]): string {
  const rows: (string | number)[][] = [
    [...csvHeaders],
    ...items.map((item) => [
      item.id ?? "",
      item.uid,
      item.title,
      item.description,
      item.category,
      conditionLabelMap[item.condition] ?? item.condition,
      item.price ?? "",
      statusLabelMap[item.status],
      item.soldPrice ?? "",
      item.marketplace ? getMarketplaceLabel(item.marketplace) : "",
      formatTimestamp(item.createdAt),
      formatTimestamp(item.soldAt),
      item.shippingSpec?.lengthCm ?? "",
      item.shippingSpec?.widthCm ?? "",
      item.shippingSpec?.heightCm ?? "",
      item.shippingSpec?.weightG ?? "",
      item.shippingSpec?.packagingMaterialId ?? "",
      item.shippingSpec?.packagingMaterialCost ?? "",
    ]),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}

function createCsvFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `items_${year}${month}${day}_${hour}${minute}${second}.csv`;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[ _]/g, "");
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === "\"") {
        if (source[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSVの形式が不正です。引用符の閉じ忘れがないか確認してください。");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((nextRow) => nextRow.some((cell) => cell.trim() !== ""));
}

function parseOptionalNumber(value: string, round = true): number | null {
  const normalized = value.replace(/[,\s¥￥]/g, "").trim();
  if (!normalized) return null;

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return null;

  return round ? Math.round(numericValue) : numericValue;
}

function parseOptionalDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate;
}

function getCell(row: string[], index: number): string {
  if (index < 0) return "";
  return row[index] ?? "";
}

function resolveCsvColumns(headers: string[]): CsvColumnIndexes {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));

  const entries = (Object.keys(csvColumnAliases) as CsvColumnKey[]).map((key) => {
    const aliases = csvColumnAliases[key].map((alias) => normalizeHeader(alias));
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    return [key, index] as const;
  });

  const indexes = Object.fromEntries(entries) as CsvColumnIndexes;
  if (indexes.title < 0 || indexes.price < 0) {
    throw new Error(
      "CSVヘッダーに必須列がありません。必須列: タイトル(Title), 出品価格(円)(Listed Price)。",
    );
  }

  return indexes;
}

function createShippingSpecFromRow(
  row: string[],
  columnIndexes: CsvColumnIndexes,
): ShippingSpec | undefined {
  const lengthCm = parseOptionalNumber(getCell(row, columnIndexes.lengthCm), false);
  const widthCm = parseOptionalNumber(getCell(row, columnIndexes.widthCm), false);
  const heightCm = parseOptionalNumber(getCell(row, columnIndexes.heightCm), false);
  const weightG = parseOptionalNumber(getCell(row, columnIndexes.weightG), false);
  const packagingMaterialId = getCell(row, columnIndexes.packagingMaterialId).trim();
  const packagingMaterialCost = parseOptionalNumber(
    getCell(row, columnIndexes.packagingMaterialCost),
  );

  const shippingSpec: ShippingSpec = {};

  if (lengthCm !== null && lengthCm >= 0) shippingSpec.lengthCm = lengthCm;
  if (widthCm !== null && widthCm >= 0) shippingSpec.widthCm = widthCm;
  if (heightCm !== null && heightCm >= 0) shippingSpec.heightCm = heightCm;
  if (weightG !== null && weightG >= 0) shippingSpec.weightG = weightG;
  if (packagingMaterialId) shippingSpec.packagingMaterialId = packagingMaterialId;
  if (packagingMaterialCost !== null && packagingMaterialCost >= 0) {
    shippingSpec.packagingMaterialCost = packagingMaterialCost;
  }

  return Object.keys(shippingSpec).length > 0 ? shippingSpec : undefined;
}

const conditionValueMap = Object.entries(conditionLabelMap).reduce<Record<string, string>>(
  (acc, [condition, label]) => {
    acc[normalizeLookupKey(condition)] = condition;
    acc[normalizeLookupKey(label)] = condition;
    return acc;
  },
  {},
);

const statusValueMap = Object.entries(statusLabelMap).reduce<Record<string, Item["status"]>>(
  (acc, [status, label]) => {
    const normalizedStatus = status as Item["status"];
    acc[normalizeLookupKey(normalizedStatus)] = normalizedStatus;
    acc[normalizeLookupKey(label)] = normalizedStatus;
    return acc;
  },
  {},
);

const marketplaceValueMap = MARKETPLACE_ORDER.reduce<Record<string, Marketplace>>(
  (acc, marketplace) => {
    acc[normalizeLookupKey(marketplace)] = marketplace;
    acc[normalizeLookupKey(getMarketplaceLabel(marketplace))] = marketplace;
    return acc;
  },
  {},
);

function createImportItemsFromCsv(
  csvText: string,
  fallbackUid: string,
): { items: ImportItemInput[]; skippedRows: number } {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("CSVに取り込み可能なデータ行がありません。");
  }

  const [headerRow, ...dataRows] = rows;
  const columnIndexes = resolveCsvColumns(headerRow);
  const items: ImportItemInput[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }

    const title = getCell(row, columnIndexes.title).trim();
    const listedPrice = parseOptionalNumber(getCell(row, columnIndexes.price));

    if (!title || listedPrice === null || listedPrice < 0) {
      skippedRows += 1;
      continue;
    }

    const uid = getCell(row, columnIndexes.uid).trim() || fallbackUid;
    const conditionRaw = getCell(row, columnIndexes.condition);
    const statusRaw = getCell(row, columnIndexes.status);
    const marketplaceRaw = getCell(row, columnIndexes.marketplace);
    const soldPriceRaw = parseOptionalNumber(getCell(row, columnIndexes.soldPrice));

    const condition =
      conditionValueMap[normalizeLookupKey(conditionRaw)] ?? "good";
    const status = statusValueMap[normalizeLookupKey(statusRaw)] ?? "listed";
    const marketplace = marketplaceValueMap[normalizeLookupKey(marketplaceRaw)];
    const soldPrice = status === "sold" ? (soldPriceRaw ?? listedPrice) : null;
    const createdAt = parseOptionalDate(getCell(row, columnIndexes.createdAt));
    const soldAt = parseOptionalDate(getCell(row, columnIndexes.soldAt));
    const shippingSpec = createShippingSpecFromRow(row, columnIndexes);

    items.push({
      uid,
      title,
      description: getCell(row, columnIndexes.description).trim(),
      category: getCell(row, columnIndexes.category).trim() || "未分類",
      condition,
      price: listedPrice,
      marketplace,
      status,
      soldPrice,
      createdAt,
      soldAt,
      shippingSpec,
    });
  }

  if (items.length === 0) {
    throw new Error(
      "有効なデータ行が見つかりませんでした。タイトルと出品価格が入っているか確認してください。",
    );
  }

  return { items, skippedRows };
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);

  const mounted = useSyncExternalStore(
    subscribeToClientRender,
    () => true,
    () => false,
  );
  const language = useAppLanguage();
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  if (!mounted) {
    return <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />;
  }

  const currentTheme = (theme ?? "system") as ThemeOption;

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    if (!languageLabelMap[nextLanguage].available) return;

    setAppLanguage(nextLanguage);
  };

  const handleExportItemsCsv = async () => {
    if (!user?.uid) {
      setExportSuccess("");
      setExportError("ログイン状態を確認してください。再ログイン後にお試しください。");
      return;
    }

    setExportLoading(true);
    setExportError("");
    setExportSuccess("");

    try {
      const items = await getItems(user.uid);
      const csv = createItemsCsv(items);
      const fileName = createCsvFileName(new Date());
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(`${items.length}件のアイテムをCSV出力しました。`);
    } catch (cause: unknown) {
      setExportError(getFirestoreClientErrorMessage(cause));
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportItemsCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!selectedFile) return;

    if (!user?.uid) {
      setImportSuccess("");
      setImportError("ログイン状態を確認してください。再ログイン後にお試しください。");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportSuccess("");

    try {
      const csvText = await selectedFile.text();
      const { items, skippedRows } = createImportItemsFromCsv(csvText, user.uid);
      await importItems(user.uid, items);

      const skippedMessage =
        skippedRows > 0 ? `（${skippedRows}行は形式不備のためスキップ）` : "";
      setImportSuccess(`${items.length}件のアイテムをCSVから取り込みました。${skippedMessage}`);
    } catch (cause: unknown) {
      setImportError(
        cause instanceof Error ? cause.message : "CSV取り込み中にエラーが発生しました。",
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
                <Globe className="size-4" />
              </div>
              <div>
                <CardTitle>言語設定</CardTitle>
                <CardDescription>表示言語をこのブラウザに保存します。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {APP_LANGUAGE_OPTIONS.map((option) => {
              const meta = languageLabelMap[option];
              const active = language === option;
              return (
                <label
                  key={option}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    meta.available ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                  } ${
                    active
                      ? "border-brand-300 bg-brand-50"
                      : meta.available
                        ? "border-slate-200 bg-white hover:bg-slate-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{meta.label}</span>
                      {!meta.available && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          準備中
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                  </div>
                  <input
                    type="radio"
                    name="language"
                    value={option}
                    checked={active}
                    disabled={!meta.available}
                    onChange={() => handleLanguageChange(option)}
                    className="size-4 accent-blue-600"
                  />
                </label>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>テーマ設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["light", "dark", "system"] as ThemeOption[]).map((option) => {
              const meta = themeLabelMap[option];
              const Icon = meta.icon;
              const active = currentTheme === option;
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    active
                      ? "border-brand-300 bg-brand-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{meta.label}</span>
                  </div>
                  <input
                    type="radio"
                    name="theme"
                    value={option}
                    checked={active}
                    onChange={() => setTheme(option)}
                    className="size-4 accent-blue-600"
                  />
                </label>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>アカウント</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">メールアドレス</p>
            <p className="mt-1 break-all font-medium text-slate-900">{user?.email ?? "-"}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">ユーザーID</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{user?.uid ?? "-"}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">データ管理</p>
            <Button
              variant="secondary"
              fullWidth
              disabled={exportLoading || importLoading || !user}
              onClick={() => void handleExportItemsCsv()}
            >
              {exportLoading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  CSV出力中...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  アイテム管理をCSV出力
                </>
              )}
            </Button>
            {exportSuccess && (
              <p className="text-xs text-emerald-700">{exportSuccess}</p>
            )}
            {exportError && (
              <p className="text-xs text-rose-700">{exportError}</p>
            )}

            <Button
              variant="secondary"
              fullWidth
              disabled={exportLoading || importLoading || !user}
              onClick={() => importInputRef.current?.click()}
            >
              {importLoading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  CSV取込中...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  外部CSVを取り込む
                </>
              )}
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                void handleImportItemsCsv(event);
              }}
            />
            {importSuccess && (
              <p className="text-xs text-emerald-700">{importSuccess}</p>
            )}
            {importError && (
              <p className="text-xs text-rose-700">{importError}</p>
            )}
          </div>

          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <LogOut className="size-4" />
            ログアウト
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
