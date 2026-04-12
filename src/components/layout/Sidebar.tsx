"use client";

import Link from "next/link";
import {
  Calculator,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { type AppLanguage, useAppLanguage } from "@/lib/language";

type NavItem = {
  href: string;
  label: Record<AppLanguage, string>;
  mobileLabel: Record<AppLanguage, string>;
  icon: LucideIcon;
};

export const APP_NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: { ja: "ダッシュボード", en: "Dashboard" },
    mobileLabel: { ja: "ホーム", en: "Home" },
    icon: LayoutDashboard,
  },
  {
    href: "/generate",
    label: { ja: "商品登録", en: "Product Registration" },
    mobileLabel: { ja: "登録", en: "Create" },
    icon: Sparkles,
  },
  {
    href: "/items",
    label: { ja: "商品一覧", en: "Items" },
    mobileLabel: { ja: "商品", en: "Items" },
    icon: Package,
  },
  {
    href: "/negotiation",
    label: { ja: "価格交渉AI", en: "Negotiation AI" },
    mobileLabel: { ja: "交渉", en: "Deals" },
    icon: MessageSquareText,
  },
  {
    href: "/simulator?tab=profit",
    label: { ja: "利益シミュレーション", en: "Profit Simulation" },
    mobileLabel: { ja: "利益", en: "Profit" },
    icon: Calculator,
  },
  {
    href: "/simulator?tab=market-analysis",
    label: { ja: "市場分析", en: "Market Analysis" },
    mobileLabel: { ja: "分析", en: "Market" },
    icon: TrendingUp,
  },
  {
    href: "/settings",
    label: { ja: "設定", en: "Settings" },
    mobileLabel: { ja: "設定", en: "Settings" },
    icon: Settings,
  },
];

function splitPathAndQuery(input: string): { path: string; query: URLSearchParams } {
  const [path, query = ""] = input.split("?");
  return {
    path,
    query: new URLSearchParams(query),
  };
}

function isActivePath(currentLocation: string, href: string): boolean {
  const current = splitPathAndQuery(currentLocation);
  const target = splitPathAndQuery(href);

  const pathMatched =
    current.path === target.path || current.path.startsWith(`${target.path}/`);
  if (!pathMatched) return false;

  const targetQueryEntries = Array.from(target.query.entries());
  if (targetQueryEntries.length === 0) return true;

  return targetQueryEntries.every(
    ([key, value]) => current.query.get(key) === value,
  );
}

interface SidebarProps {
  pathname: string;
  userLabel: string;
}

export default function Sidebar({ pathname, userLabel }: SidebarProps) {
  const language = useAppLanguage();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
      <div className="mb-7">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            FA
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
              Frima AI
            </p>
            <p className="text-xs text-slate-500">
              {language === "ja" ? "出品ワークフロー" : "Listing Workflow"}
            </p>
          </div>
        </Link>
      </div>

      <nav className="space-y-1.5">
        {APP_NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className={cn("size-[18px]", active ? "text-brand-600" : "text-slate-400")} />
              <span>{item.label[language]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
        <p className="truncate text-sm font-semibold text-slate-900">{userLabel}</p>
        <p className="mt-1 text-xs text-slate-500">
          {language === "ja" ? "AIで出品作業を短縮" : "Shorten listing work with AI"}
        </p>
      </div>
    </aside>
  );
}

interface MobileNavProps {
  pathname: string;
}

export function MobileNav({ pathname }: MobileNavProps) {
  const language = useAppLanguage();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-2 py-2 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-7 gap-1">
        {APP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="size-4" />
                <span className="leading-none">{item.mobileLabel[language]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
