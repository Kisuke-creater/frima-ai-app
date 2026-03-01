"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addItem, getFirestoreClientErrorMessage } from "@/lib/firestore";
import type { Marketplace } from "@/lib/simulation/types";

const MAX_IMAGES = 6;

const CONDITIONS = [
  { value: "new", label: "新品・未使用" },
  { value: "like_new", label: "未使用に近い" },
  { value: "good", label: "目立った傷や汚れなし" },
  { value: "fair", label: "やや傷や汚れあり" },
  { value: "poor", label: "全体的に状態が悪い" },
];

const MARKETPLACES = [
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

export default function GeneratePage() {
  const { user } = useAuth();
  const router = useRouter();

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          "HEIC/HEIF画像は非対応です。iPhone写真はJPEG/PNGに変換してから追加してください。"
        );
        resolve(null);
        return;
      }

      if (!validTypes.includes(file.type)) {
        setError("対応画像形式は JPG / PNG / WEBP / GIF です。");
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result;
        if (typeof src !== "string") {
          setError("画像読み込みに失敗しました。");
          resolve(null);
          return;
        }

        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (height >= width && height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setError("画像処理に失敗しました。");
            resolve(null);
            return;
          }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

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

        img.onerror = () => {
          setError("画像読み込みに失敗しました。");
          resolve(null);
        };

        img.src = src;
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
      const validImages = processed.filter((img): img is ProcessedImage => img !== null);

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
    [images.length, processImageFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const handleGenerate = async () => {
    if (images.length === 0) {
      setError("画像を1枚以上追加してください。");
      return;
    }

    setGenerating(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => ({
            imageBase64: img.base64,
            mimeType: img.mimeType,
          })),
          condition,
          itemName,
          accessories,
          marketplace,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "生成に失敗しました。");
      }

      const data = (await res.json()) as GenerateResult;
      setResult(data);
      setSelectedPrice(data.price_mid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました。");
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
      router.push("/items");
    } catch (e: unknown) {
      setError(getFirestoreClientErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>AI出品作成</h1>
        <p>複数写真からAIが説明文と価格候補を作成します</p>
      </div>

      <div className="generate-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-title">写真追加</div>
            <div
              className={`image-upload-area ${dragOver ? "drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
            >
              <span className="upload-icon">📷</span>
              <p>クリックまたはドラッグ&ドロップで写真を追加</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                JPG / PNG / WEBP / GIF・最大 {MAX_IMAGES} 枚
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const nextFiles = Array.from(e.target.files ?? []);
                if (nextFiles.length > 0) {
                  void handleFiles(nextFiles);
                }
                e.currentTarget.value = "";
              }}
            />

            {images.length > 0 && (
              <>
                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  }}
                >
                  {images.map((img, index) => (
                    <div key={img.id} className="image-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.dataUrl}
                        alt={`追加画像 ${index + 1}`}
                        style={{ height: 120, objectFit: "cover" }}
                      />
                      <button
                        className="remove-btn"
                        type="button"
                        aria-label={`画像${index + 1}を削除`}
                        onClick={() => {
                          setImages((prev) => prev.filter((item) => item.id !== img.id));
                          setResult(null);
                          setSelectedPrice(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    追加済み: {images.length} / {MAX_IMAGES}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setImages([]);
                      setResult(null);
                      setSelectedPrice(null);
                    }}
                  >
                    写真を全削除
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">追加情報（任意）</div>

            <div className="form-group">
              <label className="form-label">商品名</label>
              <input
                type="text"
                className="form-control"
                placeholder="例: iPhone 13 Pro 256GB"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">付属品</label>
              <input
                type="text"
                className="form-control"
                placeholder="例: 箱・充電ケーブル・説明書"
                value={accessories}
                onChange={(e) => setAccessories(e.target.value)}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title">商品の状態</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                className="form-control"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-title">出品プラットフォーム</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                className="form-control"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace)}
              >
                {MARKETPLACES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            className="btn btn-primary btn-lg"
            onClick={handleGenerate}
            disabled={generating || images.length === 0}
          >
            {generating ? (
              <>
                <span className="spinner" />
                AIが解析中...
              </>
            ) : (
              "AIで出品内容を生成"
            )}
          </button>
        </div>

        <div className="result-section">
          {!result && !generating && (
            <div className="card">
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <div className="empty-icon">🤖</div>
                <p>
                  写真を追加してAI生成ボタンを押すと
                  <br />
                  タイトル・説明文・価格候補を作成します
                </p>
              </div>
            </div>
          )}

          {generating && (
            <div className="card">
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <div className="spinner-lg" style={{ margin: "0 auto 16px" }} />
                <p>写真を解析して出品情報を生成しています...</p>
              </div>
            </div>
          )}

          {result && (
            <>
              <div className="card fade-in">
                <div className="card-title">商品タイトル</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                  {result.title}
                </div>
                {result.condition_note && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                    メモ: {result.condition_note}
                  </div>
                )}
              </div>

              <div className="card fade-in">
                <div className="card-title">カテゴリ</div>
                <span className="item-category" style={{ fontSize: 14 }}>
                  {result.category}
                </span>
              </div>

              <div className="card fade-in">
                <div className="card-title">商品説明文</div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  {result.description}
                </p>
              </div>

              <div className="card fade-in">
                <div className="card-title">価格候補（タップして選択）</div>
                <div className="price-grid">
                  {[
                    { label: "低め", value: result.price_low },
                    { label: "適正", value: result.price_mid },
                    { label: "高め", value: result.price_high },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className={`price-option ${selectedPrice === value ? "selected" : ""}`}
                      onClick={() => setSelectedPrice(value)}
                    >
                      <div className="price-label">{label}</div>
                      <div className="price-value">¥{value.toLocaleString("ja-JP")}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-success btn-lg"
                onClick={handleSave}
                disabled={saving || !selectedPrice}
                style={{ width: "100%" }}
              >
                {saving ? (
                  <>
                    <span className="spinner" />
                    保存中...
                  </>
                ) : (
                  "この内容で保存"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
