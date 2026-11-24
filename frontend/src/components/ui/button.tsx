"use client";

import { Loader2, type LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-surface-900 hover:bg-brand-600 disabled:bg-brand-500/40 font-medium",
  secondary:
    "bg-ink-100 text-surface-900 hover:bg-ink-200 disabled:opacity-50 border border-ink-100",
  outline:
    "border border-line-strong text-ink-200 hover:border-ink-100 hover:text-ink-100 disabled:opacity-50",
  ghost: "text-ink-300 hover:bg-surface-800 hover:text-ink-100 disabled:opacity-50",
  danger: "border border-bear/40 text-bear hover:bg-bear/10 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[11px] gap-1.5",
  md: "h-10 px-4 text-xs gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, icon: Icon, children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-sm uppercase tracking-[0.06em] transition-colors",
        "focus-ring disabled:cursor-not-allowed whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
