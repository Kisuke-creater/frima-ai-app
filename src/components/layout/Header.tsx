"use client";

import Link from "next/link";
import { CirclePlus, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { buttonClassName } from "@/components/ui/Button";
import PageContainer from "@/components/common/PageContainer";
import { type AppLanguage, useAppLanguage } from "@/lib/language";

type HeaderMeta = {
  title: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
};

const PAGE_META: Array<{ matcher: (pathname: string) => boolean; meta: HeaderMeta }> = [
  {
    matcher: (pathname) => pathname.startsWith("/dashboard"),
    meta: {
      title: {
        ja: "ダッシュボード",
        en: "Dashboard",
      },
      description: {
        ja: "売上や出品状況をひと目で確認できます。",
        en: "Review sales and listing status at a glance.",
      },
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/generate"),
    meta: {
      title: {
        ja: "商品登録",
        en: "Product Registration",
      },
      description: {
        ja: "画像からタイトル・説明・価格候補を生成します。",
        en: "Generate a title, description, and price suggestions from images.",
      },
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/items"),
    meta: {
      title: {
        ja: "商品管理",
        en: "Item Management",
      },
      description: {
        ja: "出品中と販売済みの商品を管理します。",
        en: "Manage active and sold items.",
      },
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/negotiation"),
    meta: {
      title: {
        ja: "価格交渉AI",
        en: "Negotiation AI",
      },
      description: {
        ja: "値下げ交渉の判断、利益確認、返信文作成をまとめて支援します。",
        en: "Support discount decisions, profit checks, and reply drafting in one flow.",
      },
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/simulator?tab=market-analysis"),
    meta: {
      title: {
        ja: "市場分析",
        en: "Market Analysis",
      },
      description: {
        ja: "販売先おすすめAIで出品先・価格・売れやすさを比較します。",
        en: "Compare marketplaces, prices, and sell-through expectations with recommendation AI.",
      },
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/simulator"),
    meta: {
      title: {
        ja: "利益シミュレーション",
        en: "Profit Simulation",
      },
      description: {
        ja: "手数料・送料・資材費を含めて利益を比較します。",
        en: "Compare profit after fees, shipping, and packaging costs.",
      },
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/settings"),
    meta: {
      title: {
        ja: "設定",
        en: "Settings",
      },
      description: {
        ja: "テーマと言語、アカウント設定を調整できます。",
        en: "Adjust theme, language, and account settings.",
      },
    },
  },
];

function resolveMeta(pathname: string): HeaderMeta {
  return PAGE_META.find((entry) => entry.matcher(pathname))?.meta ?? PAGE_META[0].meta;
}

interface HeaderProps {
  pathname: string;
  userLabel: string;
}

export default function Header({ pathname, userLabel }: HeaderProps) {
  const language = useAppLanguage();
  const meta = resolveMeta(pathname);
  const basePath = pathname.split("?")[0];
  const showCreateButton = basePath !== "/generate";
  const title = meta.title[language];
  const description = meta.description[language];

  useEffect(() => {
    document.title = `${title} | Frima AI`;
  }, [title]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
      <PageContainer className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
              Frima AI
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <div className="flex items-center gap-3">
            {showCreateButton && (
              <Link href="/generate" className={buttonClassName({ variant: "primary" })}>
                <CirclePlus className="size-4" />
                {language === "ja" ? "新規登録" : "Create Item"}
              </Link>
            )}

            <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 sm:block">
              <p className="max-w-48 truncate text-xs text-slate-500">{userLabel}</p>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-600">
                <Sparkles className="size-3" />
                {language === "ja" ? "利用中のセッション" : "Active Session"}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
