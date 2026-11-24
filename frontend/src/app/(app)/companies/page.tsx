"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      subtitle="Seeded fundamentals and companies detected in uploaded documents"
    >
      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
            <div>
              <p className="label-caps">Coverage register</p>
              <h2 className="display mt-2 text-2xl">Company index</h2>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
              {filtered.length} of {companies?.length ?? 0} names
            </p>
          </div>

          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, ticker or sector…"
              className="h-10 w-full border border-line bg-surface-900 pl-9 pr-3 font-mono text-[11px] text-ink-100 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </section>

        <Card>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <SkeletonRows rows={5} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No companies match that search"
                description="Try a ticker like TCS, or a sector like Information Technology."
              />
            ) : (
              <table className="ledger text-xs">
                <thead>
                  <tr>
                    <th className="w-10">No.</th>
                    <th>Company</th>
                    <th>Ticker</th>
                    <th>Sector</th>
                    <th>Exchange</th>
                    <th>Coverage</th>
                    <th aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company, index) => (
                    <tr key={company.id}>
                      <td className="num text-[10px] text-ink-400">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="min-w-[220px] whitespace-normal text-left">
                        <Link
                          href={`/companies/${company.slug}`}
                          className="font-serif text-base text-ink-100 transition-colors hover:text-brand-500"
                        >
                          {company.name}
                        </Link>
                        <p className="mt-0.5 max-w-md whitespace-normal text-[11px] leading-relaxed text-ink-400">
                          {company.description}
                        </p>
                      </td>
                      <td>
                        <Badge tone="brand">{company.ticker}</Badge>
                      </td>
                      <td className="text-ink-400">{company.sector ?? "—"}</td>
                      <td className="text-ink-400">{company.exchange ?? "—"}</td>
                      <td className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                        FY snapshot
                      </td>
                      <td>
                        <Link
                          href={`/companies/${company.slug}`}
                          className="text-ink-400 transition-colors hover:text-brand-500"
                          aria-label={`Open ${company.name}`}
                        >
                          <ArrowUpRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
