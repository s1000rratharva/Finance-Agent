import { HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-700 text-ink-300 border-line",
  success: "bg-bull/12 text-bull border-bull/25",
  warning: "bg-warn/12 text-warn border-warn/25",
  danger: "bg-bear/12 text-bear border-bear/25",
  info: "bg-sky-400/12 text-sky-300 border-sky-400/25",
  brand: "bg-brand-500/12 text-brand-300 border-brand-500/25",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-[11px] font-medium leading-5 whitespace-nowrap",
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
