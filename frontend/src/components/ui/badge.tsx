import { HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-transparent text-ink-300 border-line",
  success: "bg-transparent text-bull border-bull/40",
  warning: "bg-transparent text-warn border-warn/40",
  danger: "bg-transparent text-bear border-bear/40",
  info: "bg-transparent text-[#1F4E79] border-[#1F4E79]/40",
  brand: "bg-brand-500 text-surface-900 border-brand-500",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "neutral", dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5",
        "font-mono text-[10px] font-medium uppercase tracking-[0.08em] leading-4 whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  ),
);
Badge.displayName = "Badge";

/** Map a document status string to its visual tone. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "ready":
      return "success";
    case "processing":
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}
