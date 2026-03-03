import Link from "next/link";
import { CirclePlus, Sparkles } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import PageContainer from "@/components/common/PageContainer";

type HeaderMeta = {
  title: string;
  description: string;
};

const PAGE_META: Array<{ matcher: (pathname: string) => boolean; meta: HeaderMeta }> = [
  {
    matcher: (pathname) => pathname.startsWith("/dashboard"),
    meta: {
      title: "Dashboard",
      description: "売上や出品状況をひと目で確認できます。",
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/generate"),
    meta: {
      title: "Product Registration",
      description: "画像からタイトル・説明・価格候補を生成します。",
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/items"),
    meta: {
      title: "Item Management",
      description: "出品中と販売済みの商品を管理します。",
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/simulator"),
    meta: {
      title: "Profit Simulation",
      description: "手数料・送料・資材費を含めて利益を比較します。",
    },
  },
  {
    matcher: (pathname) => pathname.startsWith("/settings"),
    meta: {
      title: "Settings",
      description: "テーマとアカウント設定を調整できます。",
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
  const meta = resolveMeta(pathname);
  const showCreateButton = pathname !== "/generate";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
      <PageContainer className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
              Frima AI
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{meta.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
          </div>

          <div className="flex items-center gap-3">
            {showCreateButton && (
              <Link href="/generate" className={buttonClassName({ variant: "primary" })}>
                <CirclePlus className="size-4" />
                新規登録
              </Link>
            )}

            <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 sm:block">
              <p className="max-w-48 truncate text-xs text-slate-500">{userLabel}</p>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-600">
                <Sparkles className="size-3" />
                Active Session
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
