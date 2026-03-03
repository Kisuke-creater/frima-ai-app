"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, LoaderCircle, WandSparkles } from "lucide-react";
import { signUpWithEmailPassword } from "@/lib/firebase-auth";
import Button, { buttonClassName } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

const LOWERCASE = "abcdefghjkmnpqrstuvwxyz";
const UPPERCASE = "ABCDEFGHJKMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%&*+-_=.?";

function randomInt(max: number): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    return randomArray[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleChars(chars: string[]): string[] {
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars;
}

function generatePassword(length = 16): string {
  const all = `${LOWERCASE}${UPPERCASE}${NUMBERS}${SYMBOLS}`;
  const next = [
    LOWERCASE[randomInt(LOWERCASE.length)],
    UPPERCASE[randomInt(UPPERCASE.length)],
    NUMBERS[randomInt(NUMBERS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)],
  ];

  while (next.length < length) {
    next.push(all[randomInt(all.length)]);
  }

  return shuffleChars(next).join("");
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const trimmedEmail = email.trim();
  const canSubmit = useMemo(
    () => trimmedEmail.length > 0 && password.length >= 8,
    [trimmedEmail.length, password.length],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
      await signUpWithEmailPassword(trimmedEmail, password, redirectTo);
      setPassword("");
      setShowPassword(false);
      setNotice(
        `確認メールを ${trimmedEmail} に送信しました。メール内リンクを開いた後にログインしてください。`,
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "アカウント作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePassword = () => {
    setPassword(generatePassword());
    setShowPassword(true);
    setError("");
    setNotice("");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_35%,#f8fafc_100%)] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-xl items-center">
        <Card>
          <CardContent className="space-y-5 p-7 sm:p-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                Signup
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">新規アカウント作成</h1>
              <p className="mt-1 text-sm text-slate-500">
                出品管理を始めるためのアカウントを作成します。
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
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
                  disabled={loading}
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
                    autoComplete="new-password"
                    placeholder="8文字以上"
                    minLength={8}
                    disabled={loading}
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">8文字以上で設定してください。</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGeneratePassword}
                    disabled={loading}
                  >
                    <WandSparkles className="size-4" />
                    自動生成
                  </Button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {notice}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading || !canSubmit}
                type="submit"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    作成中...
                  </>
                ) : (
                  "確認メールを送信"
                )}
              </Button>
            </form>

            <Link
              href="/login"
              className={buttonClassName({
                variant: "ghost",
                size: "md",
                fullWidth: true,
              })}
            >
              ログインページへ戻る
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
