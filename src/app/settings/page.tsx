"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  // hydration mismatchを防ぐため、マウント後にレンダリング
  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="page-header">
        <h1>設定</h1>
        <p>アプリケーションの設定を行います</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>設定</h1>
        <p>アプリケーションの設定を行います</p>
      </div>

      <div className="card" style={{ maxWidth: "600px" }}>
        <h2 className="card-title" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "20px" }}>
          外観 (テーマ)
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <input 
              type="radio" 
              name="theme" 
              value="light" 
              checked={theme === "light"} 
              onChange={() => setTheme("light")} 
              style={{ width: "20px", height: "20px", accentColor: "var(--accent)" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>☀️</span>
              <span style={{ fontWeight: 500 }}>ライトモード</span>
            </div>
          </label>
          
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <input 
              type="radio" 
              name="theme" 
              value="dark" 
              checked={theme === "dark"} 
              onChange={() => setTheme("dark")} 
              style={{ width: "20px", height: "20px", accentColor: "var(--accent)" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🌙</span>
              <span style={{ fontWeight: 500 }}>ダークモード</span>
            </div>
          </label>
          
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <input 
              type="radio" 
              name="theme" 
              value="system" 
              checked={theme === "system"} 
              onChange={() => setTheme("system")} 
              style={{ width: "20px", height: "20px", accentColor: "var(--accent)" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>💻</span>
              <span style={{ fontWeight: 500 }}>システム設定に従う</span>
            </div>
          </label>
        </div>

        <h2 className="card-title" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "20px", marginTop: "40px" }}>
          アカウント情報
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "var(--text-secondary)" }}>
          <p><strong>ログイン中:</strong> {user?.email}</p>
          <p><strong>ユーザーID:</strong> <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: "4px" }}>{user?.uid}</code></p>
          
          <div style={{ marginTop: "24px" }}>
            <button 
              className="btn btn-danger" 
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              style={{ width: "100%", maxWidth: "200px" }}
            >
              <span>🚪</span> ログアウト
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
