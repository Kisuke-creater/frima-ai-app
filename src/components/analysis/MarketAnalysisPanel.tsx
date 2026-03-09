"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Sparkles, TrendingUp, WandSparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { addMarketAnalysis, getFirestoreClientErrorMessage } from "@/lib/firestore";
import type {
  ItemCondition,
  ProductMarketAnalysisResponse,
  ProductMarketAnalysisResult,
} from "@/lib/market-analysis/types";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AnalysisInputForm from "@/components/analysis/AnalysisInputForm";
import PlatformComparisonTable from "@/components/analysis/PlatformComparisonTable";
import { cn } from "@/lib/cn";

const MAX_IMAGES = 6;

const CONDITIONS: Array<{ value: ItemCondition; label: string }> = [
  { value: "new", label: "新品・未使用" },
  { value: "like_new", label: "未使用に近い" },
  { value: "good", label: "目立った傷や汚れなし" },
  { value: "fair", label: "やや傷や汚れあり" },
  { value: "poor", label: "全体的に状態が悪い" },
];

const DEMAND_LABELS: Record<ProductMarketAnalysisResult["demandLevel"], string> = {
  high: "高い",
  medium: "中程度",
  low: "低い",
};

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

function formatSellDays(minDays: number, maxDays: number): string {
  return `${minDays}〜${maxDays}日`;
}

export default function MarketAnalysisPanel() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [result, setResult] = useState<ProductMarketAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageType, setSaveMessageType] = useState<"success" | "warning" | null>(null);
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
        setError("HEIC/HEIF形式は未対応です。JPEG/PNGに変換してからアップロードしてください。");
        resolve(null);
        return;
      }

      if (!validTypes.includes(file.type)) {
        setError("対応形式は JPG / PNG / WEBP / GIF のみです。");
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const source = event.target?.result;
        if (typeof source !== "string") {
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
            setError("画像の変換に失敗しました。");
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

        image.src = source;
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
        setError("");
        setSaveMessage("");
        setSaveMessageType(null);
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

  const handleAnalyze = async () => {
    if (images.length === 0) {
      setError("画像を1枚以上アップロードしてください。");
      return;
    }

    if (!title.trim()) {
      setError("商品タイトルを入力してください。");
      return;
    }

    setAnalyzing(true);
    setError("");
    setResult(null);
    setSaveMessage("");
    setSaveMessageType(null);

    try {
      const response = await fetch("/api/market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((image) => ({
            imageBase64: image.base64,
            mimeType: image.mimeType,
          })),
          title: title.trim(),
          description: description.trim(),
          condition,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "商品分析に失敗しました。");
      }

      const payload = (await response.json()) as ProductMarketAnalysisResponse;
      setResult(payload.result);

      if (user) {
        try {
          await addMarketAnalysis({
            uid: user.uid,
            inputTitle: title.trim(),
            inputDescription: description.trim(),
            inputCondition: condition,
            imageCount: images.length,
            ...payload.result,
          });
          setSaveMessage("分析結果をFirebaseに保存しました。");
          setSaveMessageType("success");
        } catch (saveError: unknown) {
          setSaveMessage(
            `分析結果の保存に失敗しました: ${getFirestoreClientErrorMessage(saveError)}`,
          );
          setSaveMessageType("warning");
        }
      } else {
        setSaveMessage("ログインすると分析結果をFirebaseに保存できます。");
        setSaveMessageType("warning");
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "エラーが発生しました。");
    } finally {
      setAnalyzing(false);
    }
  };

  const recommendedPlatform = result?.platforms.find(
    (platform) => platform.platform === result.recommendedPlatform,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="size-4 text-brand-600" />
              商品画像
            </CardTitle>
            <CardDescription>最大6枚まで。画像が多いほど分析精度が上がります。</CardDescription>
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
                          setSaveMessage("");
                          setSaveMessageType(null);
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
                      setSaveMessage("");
                      setSaveMessageType(null);
                    }}
                  >
                    画像をクリア
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <AnalysisInputForm
          title={title}
          description={description}
          condition={condition}
          conditionOptions={CONDITIONS}
          onTitleChange={(value) => {
            setTitle(value);
            setResult(null);
          }}
          onDescriptionChange={(value) => {
            setDescription(value);
            setResult(null);
          }}
          onConditionChange={(value) => {
            setCondition(value);
            setResult(null);
          }}
        />

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {saveMessage && (
          <div
            className={cn(
              "rounded-xl px-4 py-3 text-sm",
              saveMessageType === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {saveMessage}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleAnalyze}
          disabled={analyzing || images.length === 0}
        >
          {analyzing ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <WandSparkles className="size-4" />
              販売先おすすめAIで分析
            </>
          )}
        </Button>
      </section>

      <section className="space-y-6">
        {!result && !analyzing && (
          <Card className="h-full">
            <CardContent className="flex min-h-96 flex-col items-center justify-center text-center">
              <div className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Sparkles className="size-8" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">商品分析結果</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                商品画像とタイトルを入力すると、最適な販売先と価格・売れやすさを比較表示します。
              </p>
            </CardContent>
          </Card>
        )}

        {analyzing && (
          <Card>
            <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
              <LoaderCircle className="size-8 animate-spin text-brand-600" />
              <p className="mt-4 text-sm font-medium text-slate-700">
                画像を解析して販売先を推定しています...
              </p>
              <p className="mt-1 text-xs text-slate-500">通常10〜20秒ほどで完了します</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card className="border-brand-200 bg-gradient-to-br from-white to-brand-50/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-brand-700">
                  <TrendingUp className="size-5" />
                  おすすめ販売先
                </CardTitle>
                <CardDescription>AIが市場需要と利益見込みから算出</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="text-sm">{recommendedPlatform?.platformLabel ?? "-"}</Badge>
                  <span className="text-xs text-slate-500">
                    売れるまで:{" "}
                    {formatSellDays(result.estimatedSellDaysMin, result.estimatedSellDaysMax)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{result.recommendationReason}</p>
                {recommendedPlatform && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs text-slate-500">推定価格</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {formatYen(recommendedPlatform.estimatedPrice)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs text-slate-500">売れる確率</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {recommendedPlatform.sellProbability}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs text-slate-500">期待利益</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {formatYen(recommendedPlatform.expectedProfit)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>分析サマリー</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    商品カテゴリ
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{result.category}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    需要レベル
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {DEMAND_LABELS[result.demandLevel]}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    推定相場
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatYen(result.overallPriceLow)} 〜 {formatYen(result.overallPriceHigh)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    状態メモ
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{result.conditionNote}</p>
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <p className="text-sm leading-relaxed text-slate-600">{result.demandSummary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>プラットフォーム比較表</CardTitle>
                <CardDescription>
                  推定価格・売れる確率・売れるまでの期間・手数料/送料を比較
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlatformComparisonTable
                  rows={result.platforms}
                  recommendedPlatform={result.recommendedPlatform}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI提案の出品文</CardTitle>
                <CardDescription>
                  将来の「ワンクリック出品」「自動説明文生成」に使える構造で返却
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    提案タイトル
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{result.suggestedTitle}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    提案説明文
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {result.suggestedDescription}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
