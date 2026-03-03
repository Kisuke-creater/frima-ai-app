import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "listed" | "sold";

const variantClassMap: Record<BadgeVariant, string> = {
  default: "border-slate-200 bg-slate-50 text-slate-600",
  listed: "border-brand-200 bg-brand-50 text-brand-700",
  sold: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({
  variant = "default",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        variantClassMap[variant],
        className,
      )}
      {...props}
    />
  );
}
