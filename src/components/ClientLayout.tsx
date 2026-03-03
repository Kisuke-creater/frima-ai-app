"use client";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import Header from "@/components/layout/Header";
import Sidebar, { MobileNav } from "@/components/layout/Sidebar";
import PageContainer from "@/components/common/PageContainer";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { LoaderCircle } from "lucide-react";

function NavLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const publicPaths = useMemo(() => new Set(["/login", "/signup"]), []);

  useEffect(() => {
    if (!loading && !user && !publicPaths.has(pathname)) {
      router.push("/login");
    }
  }, [loading, pathname, publicPaths, router, user]);

  if (publicPaths.has(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <LoaderCircle className="size-4 animate-spin text-brand-600" />
          認証情報を確認しています...
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userLabel = user.displayName || user.email || "Guest User";

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar pathname={pathname} userLabel={userLabel} />
      <div className="lg:pl-72">
        <Header pathname={pathname} userLabel={userLabel} />
        <main className="pb-24 pt-6 lg:pb-10">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
      <MobileNav pathname={pathname} />
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavLayout>{children}</NavLayout>
    </AuthProvider>
  );
}
