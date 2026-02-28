"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthTokenCookie } from "@/lib/auth-cookie";
import { useAuth } from "@/context/AuthContext";
import {
  buildGoogleOAuthUrl,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "@/lib/supabase-auth";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const accessToken = params.get("access_token");
    const expiresInRaw = params.get("expires_in");
    const oauthError = params.get("error_description") || params.get("error");

    if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!accessToken) return;

    const expiresIn = Number(expiresInRaw ?? "3600");
    setAuthTokenCookie(
      accessToken,
      Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600
    );
    window.history.replaceState({}, document.title, window.location.pathname);
    void (async () => {
      const authedUser = await refreshUser();
      if (!authedUser) {
        setError("ログイン状態の取得に失敗しました。もう一度お試しください。");
        return;
      }
      router.replace("/dashboard");
    })();
  }, [refreshUser, router]);

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const session = await signInWithEmailPassword(email.trim(), password);
      setAuthTokenCookie(session.accessToken, session.expiresIn);
      const authedUser = await refreshUser();
      if (!authedUser) {
        setError("ログイン状態の取得に失敗しました。もう一度お試しください。");
        return;
      }
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await signUpWithEmailPassword(email.trim(), password);
      if (result.accessToken && result.expiresIn) {
        setAuthTokenCookie(result.accessToken, result.expiresIn);
        const authedUser = await refreshUser();
        if (!authedUser) {
          setError("ログイン状態の取得に失敗しました。もう一度お試しください。");
          return;
        }
        router.push("/dashboard");
        return;
      }

      setNotice(
        "アカウントを作成しました。メール確認が必要な設定の場合は、確認後にログインしてください。"
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "アカウント作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setError("");
    setNotice("");
    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/login`;
    window.location.href = buildGoogleOAuthUrl(redirectTo);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">AI</span>
          <h1>フリマAI出品支援</h1>
          <p>Supabase Authでログインしてください</p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            メールアドレス
          </label>
          <input
            id="email"
            className="form-control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="example@mail.com"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            パスワード
          </label>
          <input
            id="password"
            className="form-control"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="8文字以上"
            disabled={loading}
          />
        </div>

        {error && <p className="error-msg">{error}</p>}
        {notice && (
          <p
            style={{
              color: "var(--success)",
              fontSize: 13,
              marginBottom: 16,
              padding: 10,
              background: "var(--success-glow)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
            }}
          >
            {notice}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            type="button"
          >
            {googleLoading ? (
              <>
                <span className="spinner" />
                Googleへ移動中...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                Googleでログイン
              </>
            )}
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSignIn}
            disabled={loading || googleLoading || !email || !password}
            type="button"
            style={{ width: "100%" }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                処理中...
              </>
            ) : (
              "ログイン"
            )}
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={handleSignUp}
            disabled={loading || googleLoading || !email || password.length < 8}
            type="button"
            style={{ width: "100%" }}
          >
            新規登録
          </button>
        </div>
      </div>
    </div>
  );
}
