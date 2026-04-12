"use client";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import Header from "@/components/layout/Header";
import Sidebar, { MobileNav } from "@/components/layout/Sidebar";
import PageContainer from "@/components/common/PageContainer";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { LoaderCircle } from "lucide-react";
import { useAppLanguage } from "@/lib/language";

function LayoutLoadingFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <LoaderCircle className="size-4 animate-spin text-brand-600" />
        Loading user session...
      </div>
    </div>
  );
}

function NavLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const language = useAppLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const publicPaths = useMemo(() => new Set(["/login", "/signup"]), []);
  const pathnameWithSearch = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!loading && !user && !publicPaths.has(pathname)) {
      router.push("/login");
    }
  }, [loading, pathname, publicPaths, router, user]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  if (publicPaths.has(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return <LayoutLoadingFallback />;
  }

  if (!user) return null;

  const userLabel = user.displayName || user.email || (language === "ja" ? "ゲストユーザー" : "Guest User");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar pathname={pathnameWithSearch} userLabel={userLabel} />
      <div className="lg:pl-72">
        <Header pathname={pathnameWithSearch} userLabel={userLabel} />
        <main className="pb-24 pt-6 lg:pb-10">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
      <MobileNav pathname={pathnameWithSearch} />
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<LayoutLoadingFallback />}>
        <NavLayout>{children}</NavLayout>
      </Suspense>
    </AuthProvider>
  );
}
