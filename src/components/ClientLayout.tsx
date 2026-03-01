"use client";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo } from "react";

function NavLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publicPaths = useMemo(() => new Set(["/login", "/signup"]), []);

  useEffect(() => {
    if (!loading && !user && !publicPaths.has(pathname)) {
      router.push("/login");
    }
  }, [user, loading, pathname, router, publicPaths]);

  if (publicPaths.has(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner-lg" />
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { href: "/dashboard", icon: "📊", label: "ダッシュボード" },
    { href: "/generate", icon: "✨", label: "AI生成" },
    { href: "/items", icon: "📦", label: "商品一覧" },
    { href: "/simulator", icon: "🧮", label: "利益シミュレーション" },
    { href: "/settings", icon: "⚙️", label: "設定" },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🤖</span>
          <h2>フリマAI</h2>
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div className="sidebar-bottom">
          <div
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user.displayName || user.email || "ゲスト"}
          </div>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <nav className="mobile-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <NavLayout>{children}</NavLayout>
    </AuthProvider>
  );
}
