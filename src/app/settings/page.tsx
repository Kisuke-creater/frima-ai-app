"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type ThemeOption = "light" | "dark" | "system";

const themeLabelMap: Record<ThemeOption, { label: string; icon: typeof Sun }> = {
  light: { label: "ライトモード", icon: Sun },
  dark: { label: "ダークモード", icon: Moon },
  system: { label: "システム設定に合わせる", icon: Monitor },
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />;
  }

  const currentTheme = (theme ?? "system") as ThemeOption;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>テーマ設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["light", "dark", "system"] as ThemeOption[]).map((option) => {
            const meta = themeLabelMap[option];
            const Icon = meta.icon;
            const active = currentTheme === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                  active
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{meta.label}</span>
                </div>
                <input
                  type="radio"
                  name="theme"
                  value={option}
                  checked={active}
                  onChange={() => setTheme(option)}
                  className="size-4 accent-blue-600"
                />
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>アカウント</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">メールアドレス</p>
            <p className="mt-1 break-all font-medium text-slate-900">{user?.email ?? "-"}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-500">ユーザーID</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-700">{user?.uid ?? "-"}</p>
          </div>

          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <LogOut className="size-4" />
            ログアウト
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
