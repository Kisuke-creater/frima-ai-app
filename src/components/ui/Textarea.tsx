import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { fieldClassName } from "./Input";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldClassName,
        "h-auto min-h-28 py-3 leading-relaxed",
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;
