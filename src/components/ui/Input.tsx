import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const fieldClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100/70 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldClassName, className)} {...props} />;
});

export default Input;
