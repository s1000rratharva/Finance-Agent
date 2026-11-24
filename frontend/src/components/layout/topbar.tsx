"use client";

import { Search, Command } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useHealth } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const router = useRouter();
  const { data: health, isFetching } = useHealth();
  const [query, setQuery] = useState("");

  // Global quick-nav: type a company ticker and jump to its page.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim().toLowerCase();
    if (!value) return;
    router.push(`/companies/${value}`);
  };

  const statusLabel = health?.status ?? "unknown";
  const statusTone =
    statusLabel === "ok" ? "bg-bull" : statusLabel === "degraded" ? "bg-warn" : "bg-ink-400";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-5 border-b border-line bg-surface-950/95 px-7">
      <div className="min-w-0 flex-1">
        <p className="label-caps">FinSight / workspace</p>
        <div className="mt-1 flex items-baseline gap-3">
          <h1 className="truncate font-serif text-xl leading-none tracking-tight text-ink-100">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-xs text-ink-400 lg:block">{subtitle}</p>
          )}
        </div>
      </div>

      <form onSubmit={submitSearch} className="relative hidden md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <input
          id="global-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to ticker…"
          className="h-9 w-56 border border-line bg-surface-900 pl-9 pr-12 font-mono text-[11px] text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 font-mono text-[10px] text-ink-400">
          <Command className="h-3 w-3" aria-hidden />K
        </span>
      </form>

      {actions}

      <div
        className="flex shrink-0 items-center gap-2 border border-line px-2.5 py-1.5"
        title={`API status: ${statusLabel}`}
      >
        {isFetching ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <span className={cn("h-1.5 w-1.5", statusTone)} aria-hidden />
        )}
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
          {statusLabel}
        </span>
      </div>
    </header>
  );
}
