"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Tag,
  WandSparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { addItem, getFirestoreClientErrorMessage, getItems, type Item } from "@/lib/firestore";
import type { Marketplace } from "@/lib/simulation/types";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import ItemForm from "@/components/items/ItemForm";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const MAX_IMAGES = 6;

const CONDITIONS = [
  { value: "new", label: "新品・未使用" },
  { value: "like_new", label: "未使用に近い" },
  { value: "good", label: "目立った傷や汚れなし" },
  { value: "fair", label: "やや傷や汚れあり" },
  { value: "poor", label: "全体的に状態が悪い" },
];

const MARKETPLACES: Array<{ value: Marketplace; label: string }> = [
  { value: "mercari", label: "メルカリ" },
  { value: "rakuma", label: "ラクマ" },
  { value: "yahoo", label: "Yahoo!フリマ" },
  { value: "yahoo_auction", label: "Yahoo!オークション" },
];

interface GenerateResult {
  title: string;
  description: string;
  category: string;
  price_low: number;
  price_mid: number;
  price_high: number;
  condition_note: string;
}

interface ProcessedImage {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  base64: string;
}

function makeImageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

const CSV_HEADERS = [
  "ID",
  "User ID",
  "Title",
  "Description",
  "Category",
  "Condition",
  "Listed Price",
  "Status",
  "Sold Price",
  "Marketplace",
  "Created At",
  "Sold At",
] as const;

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
    [...CSV_HEADERS],
    ...items.map((item) => [
      item.id ?? "",
      item.uid,
      item.title,
      item.description,
      item.category,
      item.condition,
      item.price ?? "",
      item.status,
      item.soldPrice ?? "",
      item.marketplace ?? "",
      formatTimestamp(item.createdAt),
      formatTimestamp(item.soldAt),
    ]),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}

function downloadItemsCsv(csv: string, fileName: string): void {
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
}

export default function GeneratePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [itemName, setItemName] = useState("");
  const [accessories, setAccessories] = useState("");
  const [condition, setCondition] = useState("good");
  const [marketplace, setMarketplace] = useState<Marketplace>("mercari");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const processImageFile = useCallback((file: File): Promise<ProcessedImage | null> => {
    return new Promise((resolve) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const fileName = file.name.toLowerCase();

      if (
        file.type === "image/heic" ||
        file.type === "image/heif" ||
        fileName.endsWith(".heic") ||
        fileName.endsWith(".heif")
      ) {
        setError(
          "HEIC/HEIF形式は未対応です。iPhone写真はJPEG/PNGへ変換してからアップロードしてください。",
        );
        resolve(null);
        return;
      }

      if (!validTypes.includes(file.type)) {
        setError("対応形式は JPG / PNG / WEBP / GIF です。");
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result;
        if (typeof src !== "string") {
          setError("画像の読み込みに失敗しました。");
          resolve(null);
          return;
        }

        const image = new Image();
        image.onload = () => {
          const maxSize = 1024;
          let width = image.width;
          let height = image.height;

          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height >= width && height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");
          if (!context) {
            setError("画像処理に失敗しました。");
            resolve(null);
            return;
          }

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          const base64 = dataUrl.split(",")[1];
          if (!base64) {
            setError("画像変換に失敗しました。");
            resolve(null);
            return;
          }

          resolve({
            id: makeImageId(),
            name: file.name,
            mimeType: "image/jpeg",
            dataUrl,
            base64,
          });
        };

        image.onerror = () => {
          setError("画像の読み込みに失敗しました。");
          resolve(null);
        };

        image.src = src;
      };

      reader.onerror = () => {
        setError("画像ファイルの読み込みに失敗しました。");
        resolve(null);
      };

      reader.readAsDataURL(file);
    });
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const availableSlots = MAX_IMAGES - images.length;
      if (availableSlots <= 0) {
        setError(`画像は最大${MAX_IMAGES}枚までです。`);
        return;
      }

      const targetFiles = files.slice(0, availableSlots);
      const processed = await Promise.all(targetFiles.map((file) => processImageFile(file)));
      const validImages = processed.filter((image): image is ProcessedImage => image !== null);

      if (validImages.length > 0) {
        setImages((prev) => [...prev, ...validImages]);
        setResult(null);
        setSelectedPrice(null);
        setError("");
      }

      if (files.length > targetFiles.length) {
        setError(`画像は最大${MAX_IMAGES}枚までです。`);
      }
    },
    [images.length, processImageFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      void handleFiles(Array.from(event.dataTransfer.files));
    },
    [handleFiles],
  );

  const handleGenerate = async () => {
    if (images.length === 0) {
      setError("画像を1枚以上アップロードしてください。");
      return;
    }

    setGenerating(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((image) => ({
            imageBase64: image.base64,
            mimeType: image.mimeType,
          })),
          condition,
          itemName,
          accessories,
          marketplace,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "生成に失敗しました。");
      }

      const data = (await response.json()) as GenerateResult;
      setResult(data);
      setSelectedPrice(data.price_mid);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "エラーが発生しました。");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!result || !selectedPrice) return;
    if (!user) {
      setError("ログイン状態を確認してください。");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addItem({
        uid: user.uid,
        title: result.title,
        description: result.description,
        category: result.category,
        condition,
        price: selectedPrice,
        marketplace,
        status: "listed",
      });
      const latestItems = await getItems(user.uid);
      const csv = createItemsCsv(latestItems);
      downloadItemsCsv(csv, "items_latest.csv");
      router.push("/items");
    } catch (cause: unknown) {
      setError(getFirestoreClientErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="size-4 text-brand-600" />
              Product Images
            </CardTitle>
            <CardDescription>画像はドラッグ&ドロップでも追加できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragOver
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40",
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
            >
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-white text-brand-600 shadow-sm">
                <ImagePlus className="size-7" />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                クリックまたはドラッグ&ドロップで画像を追加
              </p>
              <p className="mt-2 text-xs text-slate-500">
                JPG / PNG / WEBP / GIF、最大 {MAX_IMAGES} 枚
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const nextFiles = Array.from(event.target.files ?? []);
                if (nextFiles.length > 0) {
                  void handleFiles(nextFiles);
                }
                event.currentTarget.value = "";
              }}
            />

            {images.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((image, index) => (
                    <figure
                      key={image.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.dataUrl}
                        alt={`アップロード画像 ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImages((prev) => prev.filter((item) => item.id !== image.id));
                          setResult(null);
                          setSelectedPrice(null);
                        }}
                        aria-label={`画像 ${index + 1} を削除`}
                        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="size-4" />
                      </button>
                      <figcaption className="truncate border-t border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500">
                        {image.name}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {images.length} / {MAX_IMAGES} 枚を選択中
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImages([]);
                      setResult(null);
                      setSelectedPrice(null);
                    }}
                  >
                    画像をクリア
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <ItemForm
          itemName={itemName}
          accessories={accessories}
          condition={condition}
          marketplace={marketplace}
          conditionOptions={CONDITIONS}
          marketplaceOptions={MARKETPLACES}
          onItemNameChange={setItemName}
          onAccessoriesChange={setAccessories}
          onConditionChange={setCondition}
          onMarketplaceChange={setMarketplace}
        />

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleGenerate}
          disabled={generating || images.length === 0}
        >
          {generating ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              AIで生成中...
            </>
          ) : (
            <>
              <WandSparkles className="size-4" />
              AIで出品情報を生成
            </>
          )}
        </Button>
      </section>

      <section className="space-y-6">
        {!result && !generating && (
          <Card className="h-full">
            <CardContent className="flex min-h-96 flex-col items-center justify-center text-center">
              <div className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Sparkles className="size-8" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">AI Result</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                画像と商品情報を入力すると、タイトル・カテゴリ・説明文・価格候補を表示します。
              </p>
            </CardContent>
          </Card>
        )}

        {generating && (
          <Card>
            <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
              <LoaderCircle className="size-8 animate-spin text-brand-600" />
              <p className="mt-4 text-sm font-medium text-slate-700">
                画像を解析して出品情報を作成しています...
              </p>
              <p className="mt-1 text-xs text-slate-500">通常10〜20秒程度で完了します</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="size-4 text-brand-600" />
                  タイトル
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-semibold text-slate-900">{result.title}</p>
                {result.condition_note && (
                  <p className="mt-2 text-xs text-slate-500">補足: {result.condition_note}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="size-4 text-brand-600" />
                  カテゴリ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge>{result.category}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4 text-brand-600" />
                  説明文
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-700">{result.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-600" />
                  価格候補（選択）
                </CardTitle>
                <CardDescription>保存する価格を選んでください。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "低め", value: result.price_low },
                  { label: "推奨", value: result.price_mid },
                  { label: "高め", value: result.price_high },
                ].map((option) => {
                  const selected = selectedPrice === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setSelectedPrice(option.value)}
                      className={cn(
                        "rounded-xl border px-3 py-4 text-center transition-colors",
                        selected
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/40",
                      )}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {option.label}
                      </p>
                      <p className="mt-2 text-xl font-bold">{formatYen(option.value)}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Button
              variant="success"
              size="lg"
              fullWidth
              onClick={handleSave}
              disabled={saving || !selectedPrice}
            >
              {saving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  保存中...
                </>
              ) : (
                "この内容で保存する"
              )}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
