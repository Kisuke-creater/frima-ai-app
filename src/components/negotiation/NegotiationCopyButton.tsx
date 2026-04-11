"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import Button from "@/components/ui/Button";

interface NegotiationCopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export default function NegotiationCopyButton({
  text,
  label = "コピー",
  className,
}: NegotiationCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timerId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timerId);
  }, [copied]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void handleCopy()}
      className={className}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "コピー済み" : label}
    </Button>
  );
}
