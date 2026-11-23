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
        "fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-2xl",
        tone === "success" && "border-bull/30 bg-surface-850 text-bull",
        tone === "error" && "border-bear/30 bg-surface-850 text-bear",
        tone === "info" && "border-line-strong bg-surface-850 text-ink-200",
      )}
    >
      {message}
    </div>
  );
}

export function ToastHost({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
