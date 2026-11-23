"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Search, ArrowUpRight } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/spinner";
import { useCompanies } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";

export default function CompaniesPage() {
  const { data: companies, isLoading } = useCompanies();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 200);

  const filtered = (companies ?? []).filter((company) => {
    const haystack = `${company.name} ${company.ticker} ${company.sector ?? ""} ${company.industry ?? ""}`.toLowerCase();
    return haystack.includes(debounced.toLowerCase().trim());
  });

  return (
    <AppShell
      title="Companies"
      subtitle="Preloaded fundamentals with five fiscal years of statements"
    >
      <div className="flex flex-col gap-5">
        {/* Search */}
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, ticker or sector…"
            className="h-10 w-full rounded-lg border border-line bg-surface-900 pl-9 pr-3 text-sm text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card">
                <SkeletonRows rows={4} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No companies match that search"
            description="Try a ticker like TCS, or a sector like Information Technology."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.slug}`}
                className="focus-ring card card-hover group flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-700 text-sm font-semibold text-ink-200">
                    {company.ticker.slice(0, 3)}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-ink-400 transition-colors group-hover:text-brand-400" />
                </div>

                <h2 className="mt-4 text-sm font-semibold text-ink-100">{company.name}</h2>
                <p className="mt-1 text-xs text-ink-400">{company.description}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge tone="brand">{company.ticker}</Badge>
                  {company.sector && <Badge tone="neutral">{company.sector}</Badge>}
                  <Badge tone="neutral">{company.exchange}</Badge>
                </div>

                <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-400">
                  {company.currency} · statements FY21–FY25 · ratios, trends and risk signals
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
