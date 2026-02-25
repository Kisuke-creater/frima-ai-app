"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { addItem, getFirestoreClientErrorMessage } from "@/lib/firestore";
import { useRouter } from "next/navigation";

const CONDITIONS = [
  { value: "new", label: "新品・未使用" },
  { value: "like_new", label: "未使用に近い" },
  { value: "good", label: "目立った傷や汚れなし" },
  { value: "fair", label: "やや傷や汚れあり" },
  { value: "poor", label: "全体的に状態が悪い" },
];

const MARKETPLACES = [
  { value: "mercari", label: "メルカリ" },
  { value: "rakuma", label: "楽天ラクマ" },
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

export default function GeneratePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [itemName, setItemName] = useState("");
  const [accessories, setAccessories] = useState("");
  const [condition, setCondition] = useState("good");
  const [marketplace, setMarketplace] = useState("mercari");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 画像をCanvasでリサイズ・JPEG変換してDataURLを生成する関数
  const processImageFile = (file: File) => {
    // OpenAI Vision対応＋ブラウザで描画可能なフォーマットを厳密に制限
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    
    if (file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic")) {
      setError("iPhone等のHEIC形式は現在サポートされていません。JPEGまたはPNGをお使いください。");
      return;
    }

    if (!validTypes.includes(file.type)) {
      setError(`非対応の画像形式です（${file.type || "拡張子不明"}）。JPEG, PNG, WEBP, GIF のいずれかを選択してください。`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 最大サイズを1024pxに制限
        const MAX_SIZE = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setError("ブラウザが画像処理をサポートしていません");
          return;
        }

        // 白背景で塗りつぶす（PNG等で透過がある場合への対策）
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // 画像を描画
        ctx.drawImage(img, 0, 0, width, height);

        // 確実なJPEGとして出力 (品質 0.8)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

        setImageDataUrl(dataUrl);
        // dataUrl をそのまま base64 として扱うか、プレフィックスを含まないように取得
        setImageBase64(dataUrl.replace(/^data:image\/(png|jpeg|webp);base64,/, ""));
        setResult(null);
        setSelectedPrice(null);
        setError("");
      };
      
      img.onerror = () => {
        setError("画像の読み込みに失敗しました");
      };
      
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFile = useCallback((file: File) => {
    processImageFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleGenerate = async () => {
    if (!imageBase64 || !imageDataUrl) {
      setError("画像をアップロードしてください");
      return;
    }
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      // data:image/png;base64,... から image/png を抽出
      const mimeType = imageDataUrl.substring(
        imageDataUrl.indexOf(":") + 1,
        imageDataUrl.indexOf(";")
      );

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, condition, itemName, accessories, marketplace }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "生成に失敗しました");
      }
      const data: GenerateResult = await res.json();
      setResult(data);
      setSelectedPrice(data.price_mid);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!result || !selectedPrice) return;
    if (!user) {
      setError("You are not signed in. Please sign in again and retry.");
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
        status: "listed",
      });
      router.push("/items");
    } catch (e: unknown) {
      setError("保存に失敗しました");
      setError(getFirestoreClientErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>AI出品生成</h1>
        <p>商品画像をアップロードしてAIに情報生成させましょう</p>
      </div>

      <div className="generate-layout">
        {/* Left: Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Image upload */}
          <div className="card">
            <div className="card-title">📸 商品画像</div>
            {imageDataUrl ? (
              <div className="image-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl} alt="商品画像プレビュー" />
                <button
                  className="remove-btn"
                  onClick={() => {
                    setImageDataUrl(null);
                    setImageBase64("");
                    setResult(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className={`image-upload-area ${dragOver ? "drag-over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
              >
                <span className="upload-icon">🖼️</span>
                <p>クリックまたはドラッグ＆ドロップで画像をアップロード</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>JPG / PNG / WEBP 対応</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {/* Additional Info (Optional) */}
          <div className="card">
            <div className="card-title">✏️ 追加情報（任意）</div>
            
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
                placeholder="例: 箱、充電ケーブル、取扱説明書" 
                value={accessories} 
                onChange={(e) => setAccessories(e.target.value)} 
              />
            </div>
          </div>

          {/* Condition */}
          <div className="card">
            <div className="card-title">🏷️ 商品の状態</div>
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

          {/* Marketplace */}
          <div className="card">
            <div className="card-title">🏪 出品先フリマ</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                className="form-control"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
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
            disabled={generating || !imageBase64}
          >
            {generating ? (
              <>
                <span className="spinner" />
                AIが分析中...
              </>
            ) : (
              "🤖 AI生成スタート"
            )}
          </button>
        </div>

        {/* Right: Result */}
        <div className="result-section">
          {!result && !generating && (
            <div className="card">
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <div className="empty-icon">🤖</div>
                <p>画像をアップロードしてAI生成ボタンを押すと<br />商品情報が自動で生成されます</p>
              </div>
            </div>
          )}

          {generating && (
            <div className="card">
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <div className="spinner-lg" style={{ margin: "0 auto 16px" }} />
                <p>画像を解析して商品情報を生成しています...</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Title */}
              <div className="card fade-in">
                <div className="card-title">📝 商品タイトル</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                  {result.title}
                </div>
                {result.condition_note && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                    💬 {result.condition_note}
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="card fade-in">
                <div className="card-title">🗂️ カテゴリ</div>
                <span className="item-category" style={{ fontSize: 14 }}>
                  {result.category}
                </span>
              </div>

              {/* Description */}
              <div className="card fade-in">
                <div className="card-title">📄 商品説明文</div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  {result.description}
                </p>
              </div>

              {/* Price */}
              <div className="card fade-in">
                <div className="card-title">💰 価格提案（タップして選択）</div>
                <div className="price-grid">
                  {[
                    { label: "控えめ", value: result.price_low },
                    { label: "適正", value: result.price_mid },
                    { label: "強気", value: result.price_high },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className={`price-option ${selectedPrice === value ? "selected" : ""}`}
                      onClick={() => setSelectedPrice(value)}
                    >
                      <div className="price-label">{label}</div>
                      <div className="price-value">¥{value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save */}
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
                  "💾 この内容でFirestoreに保存"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
