"use client";

import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // auth-token cookieを設定（ミドルウェア用）
      const token = await result.user.getIdToken();
      document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax`;
      router.push("/dashboard");
    } catch {
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">🏷️</span>
          <h1>フリマAI出品支援</h1>
          <p>AIがあなたのフリマ出品をサポートします</p>
        </div>

        <div className="login-features">
          <div className="feature-item">
            <span>🤖</span>
            <span>AIが商品タイトル・説明文を自動生成</span>
          </div>
          <div className="feature-item">
            <span>💰</span>
            <span>適正価格を3段階で提案</span>
          </div>
          <div className="feature-item">
            <span>📊</span>
            <span>売上をダッシュボードで管理</span>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          className="google-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Googleでログイン
            </>
          )}
        </button>
      </div>
    </div>
  );
}
