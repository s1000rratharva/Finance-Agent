"use client";

import { Bell, Search, Command } from "lucide-react";
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

  const statusTone =
    health?.status === "ok" ? "bg-bull" : health?.status === "degraded" ? "bg-warn" : "bg-ink-400";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-surface-950/85 px-6 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-ink-100">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-400">{subtitle}</p>}
      </div>

      <form onSubmit={submitSearch} className="relative ml-auto hidden md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <input
          id="global-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to company…"
          className="h-9 w-56 rounded-lg border border-line bg-surface-850 pl-9 pr-12 text-xs text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-[10px] text-ink-400">
          <Command className="h-3 w-3" aria-hidden />K
        </span>
      </form>

      {actions}

      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-400",
        )}
        title={`API status: ${health?.status ?? "unknown"}`}
      >
        {isFetching ? <Spinner className="h-3 w-3" /> : <span className={cn("h-1.5 w-1.5 rounded-full", statusTone)} />}
        <span className="hidden sm:inline">{health?.status ?? "…"}</span>
      </div>

      <button
        type="button"
        className="focus-ring rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-800 hover:text-ink-200"
        title="Notifications"
      >
        <Bell className="h-4 w-4" aria-hidden />
      </button>
    </header>
  );
}
