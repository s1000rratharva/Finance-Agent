"use client";

import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Lightweight inline toast. Swap for sonner/react-hot-toast when needed. */
interface ToastProps {
  message: string;
  tone?: "success" | "error" | "info";
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, tone = "info", onDismiss, durationMs = 3200 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 right-6 z-50 max-w-sm border-l-2 bg-surface-900 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em]",
        tone === "success" && "border-l-bull text-bull",
        tone === "error" && "border-l-bear text-bear",
        tone === "info" && "border-l-brand-500 text-ink-200",
      )}
    >
      {message}
    </div>
  );
}

export function ToastHost({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
