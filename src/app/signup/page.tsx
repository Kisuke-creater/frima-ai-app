"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { signUpWithEmailPassword } from "@/lib/supabase-auth";

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
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
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
    [trimmedEmail.length, password.length]
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
        `認証メールを ${trimmedEmail} に送信しました。メール内リンクから認証後、ログインしてください。`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "アカウント作成に失敗しました。");
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
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-icon">AI</span>
          <h1>FRIMA AI</h1>
          <p>新規作成</p>
        </div>

        <form onSubmit={handleSubmit}>
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
                autoComplete="new-password"
                placeholder="8文字以上"
                disabled={loading}
                minLength={8}
                required
              />
              <button
                className="btn btn-secondary btn-sm password-toggle-btn"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
              >
                {showPassword ? "非表示" : "表示"}
              </button>
            </div>
            <div className="password-helper-actions">
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={handleGeneratePassword}
                disabled={loading}
              >
                パスワード生成
              </button>
              <span className="password-rule">8文字以上で入力してください</span>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}
          {notice && <p className="notice-msg">{notice}</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn btn-primary btn-lg"
              disabled={loading || !canSubmit}
              type="submit"
              style={{ width: "100%" }}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  処理中...
                </>
              ) : (
                "認証メールを送信"
              )}
            </button>

            <Link href="/login" className="btn btn-secondary btn-lg" style={{ width: "100%" }}>
              ログインページへ
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
