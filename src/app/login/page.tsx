"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import { setAuthTokenCookie } from "@/lib/auth-cookie";
import { useAuth } from "@/context/AuthContext";
import {
  signInWithEmailPassword,
  signInWithGooglePopup,
} from "@/lib/firebase-auth";
import Button, { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

function mapAuthErrorMessage(raw: string): string {
  const normalized = raw.toLowerCase();
  if (normalized.includes("invalid") || normalized.includes("credential")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (normalized.includes("popup")) {
    return "Googleログインのポップアップがブロックされました。";
  }
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmedEmail = email.trim();
  const canSubmit = useMemo(
    () => trimmedEmail.length > 0 && password.length > 0,
    [trimmedEmail, password],
  );

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

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
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "ログインに失敗しました。";
      setError(mapAuthErrorMessage(message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const session = await signInWithGooglePopup();
      setAuthTokenCookie(session.accessToken, session.expiresIn);
      const authedUser = await refreshUser();
      if (!authedUser) {
        setError("Googleログイン後のユーザー情報取得に失敗しました。");
        return;
      }
      router.replace("/dashboard");
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : "Googleログインに失敗しました。";
      setError(mapAuthErrorMessage(message));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_35%,#f8fafc_100%)] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.2fr_480px]">
        <section className="hidden lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Frima AI
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-900">
            出品作業を、
            <br />
            AIで最短ルートに。
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">
            写真をアップロードするだけで、タイトル・説明文・価格候補を自動生成。
            手数料や送料を含めた利益試算まで、ひとつの画面で完了できます。
          </p>
          <div className="mt-8 rounded-2xl border border-brand-200 bg-white/70 p-5">
            <div className="flex items-center gap-2 text-brand-700">
              <Sparkles className="size-5" />
              <p className="font-semibold">SaaS Style Workflow</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Dashboard / Product Registration / AI Result / Profit Simulation を一貫したUIで管理できます。
            </p>
          </div>
        </section>

        <Card className="w-full">
          <CardContent className="space-y-5 p-7 sm:p-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                Login
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">アカウントにログイン</h2>
              <p className="mt-1 text-sm text-slate-500">フリマ出品の作業を続けましょう。</p>
            </div>

            <button
              type="button"
              className={buttonClassName({
                variant: "secondary",
                size: "lg",
                fullWidth: true,
                className: "gap-3",
              })}
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Googleでログイン中...
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">or</span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600" htmlFor="email">
                  メールアドレス
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="example@mail.com"
                  disabled={loading || googleLoading}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600" htmlFor="password">
                  パスワード
                </label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="パスワードを入力"
                    disabled={loading || googleLoading}
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={loading || googleLoading}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading || googleLoading || !canSubmit}
                type="submit"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    ログイン中...
                  </>
                ) : (
                  "ログイン"
                )}
              </Button>
            </form>

            <Link
              href="/signup"
              className={buttonClassName({
                variant: "ghost",
                size: "md",
                fullWidth: true,
              })}
            >
              新規アカウントを作成
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
