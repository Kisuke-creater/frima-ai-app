"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthTokenCookie } from "@/lib/auth-cookie";
import { useAuth } from "@/context/AuthContext";
import {
  buildGoogleOAuthUrl,
  exchangeCodeForSession,
  signInWithEmailPassword,
} from "@/lib/supabase-auth";

const PKCE_VERIFIER_STORAGE_KEY = "google-oauth-pkce-verifier";

function getOAuthParams(): URLSearchParams {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;

  const merged = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash);
  hashParams.forEach((value, key) => merged.set(key, value));
  return merged;
}

function decodeOAuthError(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20"));
  } catch {
    return raw;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  const chars = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(chars).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = toBase64Url(verifierBytes);

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const challenge = toBase64Url(new Uint8Array(digest));

  return { verifier, challenge };
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmedEmail = email.trim();
  const canSubmit = useMemo(
    () => trimmedEmail.length > 0 && password.length > 0,
    [trimmedEmail, password]
  );

  useEffect(() => {
    const params = getOAuthParams();
    const accessToken = params.get("access_token");
    const expiresInRaw = params.get("expires_in");
    const authCode = params.get("code");
    const oauthError = params.get("error_description") || params.get("error");

    if (!accessToken && !authCode && !oauthError) return;

    if (oauthError) {
      setError(decodeOAuthError(oauthError) || "Googleログインに失敗しました。");
      window.history.replaceState({}, document.title, window.location.pathname);
      setGoogleLoading(false);
      return;
    }

    const completeLogin = async (token: string, expiresIn: number) => {
      setAuthTokenCookie(token, expiresIn);
      window.history.replaceState({}, document.title, window.location.pathname);

      const authedUser = await refreshUser();
      if (!authedUser) {
        setError("Googleログイン後のユーザー情報取得に失敗しました。");
        return;
      }
      router.replace("/dashboard");
    };

    void (async () => {
      setLoading(true);
      try {
        if (accessToken) {
          const expiresIn = Number(expiresInRaw ?? "3600");
          const safeExpiresIn =
            Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
          await completeLogin(accessToken, safeExpiresIn);
          return;
        }

        if (!authCode) return;
        const codeVerifier = localStorage.getItem(PKCE_VERIFIER_STORAGE_KEY) ?? undefined;
        const session = await exchangeCodeForSession(authCode, codeVerifier);
        localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
        await completeLogin(session.accessToken, session.expiresIn);
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : "Googleログイン処理に失敗しました。もう一度お試しください。"
        );
      } finally {
        setLoading(false);
        setGoogleLoading(false);
      }
    })();
  }, [refreshUser, router]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    try {
      const session = await signInWithEmailPassword(trimmedEmail, password);
      setAuthTokenCookie(session.accessToken, session.expiresIn);
      const authedUser = await refreshUser();
      if (!authedUser) {
        setError("ログイン後のユーザー情報取得に失敗しました。");
        return;
      }
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const redirectTo = `${window.location.origin}/login`;
      if (!crypto?.subtle || !crypto?.getRandomValues) {
        window.location.href = buildGoogleOAuthUrl(redirectTo, { flowType: "implicit" });
        return;
      }

      const { verifier, challenge } = await createPkcePair();
      localStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
      window.location.href = buildGoogleOAuthUrl(redirectTo, {
        flowType: "pkce",
        codeChallenge: challenge,
        codeChallengeMethod: "s256",
      });
    } catch {
      const redirectTo = `${window.location.origin}/login`;
      window.location.href = buildGoogleOAuthUrl(redirectTo, { flowType: "implicit" });
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">AI</span>
          <h1>FRIMA AI</h1>
          <p>ログイン</p>
        </div>

        <button
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          type="button"
          style={{ marginBottom: 12 }}
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

        <form onSubmit={handleSignIn}>
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
              disabled={loading || googleLoading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              パスワード
            </label>
            <div className="password-field-row">
              <input
                id="password"
                className="form-control"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="パスワードを入力"
                disabled={loading || googleLoading}
                required
              />
              <button
                className="btn btn-secondary btn-sm password-toggle-btn"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading || googleLoading}
              >
                {showPassword ? "非表示" : "表示"}
              </button>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn btn-primary btn-lg"
              disabled={loading || googleLoading || !canSubmit}
              type="submit"
              style={{ width: "100%" }}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  処理中...
                </>
              ) : (
                "ログインする"
              )}
            </button>

            <Link href="/signup" className="btn btn-secondary btn-lg" style={{ width: "100%" }}>
              新規作成ページへ
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
