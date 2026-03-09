import Link from "next/link";
import {
  Calculator,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const APP_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Product Registration", icon: Sparkles },
  { href: "/items", label: "Items", icon: Package },
  { href: "/simulator?tab=profit", label: "Profit Simulation", icon: Calculator },
  { href: "/simulator?tab=market-analysis", label: "Market Analysis", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
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
            <p className="text-xs text-slate-500">Listing Workflow</p>
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
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
        <p className="truncate text-sm font-semibold text-slate-900">{userLabel}</p>
        <p className="mt-1 text-xs text-slate-500">AIで出品作業を短縮</p>
      </div>
    </aside>
  );
}

interface MobileNavProps {
  pathname: string;
}

export function MobileNav({ pathname }: MobileNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-2 py-2 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-6 gap-1">
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
                <span className="leading-none">{item.label.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
