import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200",
  danger: "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 active:bg-rose-200",
  success:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700 active:bg-emerald-800",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "h-9 rounded-lg px-3 text-sm",
  md: "h-10 rounded-xl px-4 text-sm",
  lg: "h-12 rounded-xl px-5 text-base",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300/70 disabled:pointer-events-none disabled:opacity-50",
    variantClassMap[variant],
    sizeClassMap[size],
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth = false, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  );
});

export default Button;
