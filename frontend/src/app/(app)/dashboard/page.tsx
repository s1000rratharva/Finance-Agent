"use client";

import Link from "next/link";
import {
  Building2,
  FileText,
  MessageSquareText,
  ArrowUpRight,
  GitCompareArrows,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { KPITile } from "@/components/charts/kpi-tile";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, SkeletonRows } from "@/components/ui/spinner";
import {
  useCompanies,
  useCompanyOverview,
  useDocuments,
  useFeaturedCompany,
} from "@/hooks/use-api";
import { useWorkspaceStats } from "@/providers/auth-provider";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";
import { SUGGESTED_PROMPTS } from "@/lib/constants";

export default function DashboardPage() {
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: featured, isLoading: loadingFeatured } = useFeaturedCompany();
  const { data: stats, isLoading: loadingStats } = useWorkspaceStats();
  const { data: documents, isLoading: loadingDocs } = useDocuments();

  const featuredSlug = featured?.slug ?? companies?.[0]?.slug;
  const { data: overview, isLoading: loadingOverview } = useCompanyOverview(featuredSlug);

  const loading = loadingCompanies || loadingFeatured || loadingStats || loadingDocs;

  return (
    <AppShell
      title="Overview"
      subtitle="Workspace snapshot across coverage, documents and analytics"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-900">
                <SkeletonRows rows={2} />
              </div>
            ))}
          </div>
          <LoadingState label="Loading workspace…" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Workspace ledger */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <p className="label-caps">Workspace ledger</p>
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>

            <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Building2}
                label="Companies covered"
                value={formatNumber(companies?.length ?? 0)}
                href="/companies"
              />
              <StatCard
                icon={FileText}
                label="Documents indexed"
                value={formatNumber(stats?.documents ?? 0)}
                hint={`${formatNumber(stats?.chunks ?? 0)} chunks`}
                href="/documents"
              />
              <StatCard
                icon={MessageSquareText}
                label="Research threads"
                value={formatNumber(stats?.conversations ?? 0)}
                href="/chat"
              />
              <StatCard
                icon={GitCompareArrows}
                label="Tenant scope"
                value={stats ? "Isolated" : "—"}
                hint="Per-workspace collections"
                href="/documents"
              />
            </div>
          </section>

          {/* Featured company KPIs */}
          {featuredSlug && overview && (
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
                <div>
                  <p className="label-caps">Featured coverage</p>
                  <h2 className="display mt-2 text-2xl">{overview.company}</h2>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                    FY{overview.fiscal_year} snapshot · {overview.currency} crore
                  </p>
                </div>
                <Link href={`/companies/${featuredSlug}`}>
                  <Button variant="outline" size="sm" icon={ArrowUpRight}>
                    Open profile
                  </Button>
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {overview.kpis.slice(0, 6).map((kpi) => (
                  <KPITile
                    key={kpi.key}
                    label={kpi.label}
                    value={kpi.value}
                    unit={kpi.unit}
                    deltaPct={kpi.delta_pct}
                    fiscalYear={kpi.fiscal_year}
                    currency={overview.currency}
                    loading={loadingOverview}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Coverage ledger */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Coverage</CardTitle>
                  <CardDescription>Seeded and document-derived companies</CardDescription>
                </div>
                <Link
                  href="/companies"
                  className="font-mono text-[10px] uppercase tracking-wider text-brand-500 hover:text-brand-600"
                >
                  View all →
                </Link>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {companies?.length ? (
                  <table className="ledger text-xs">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Ticker</th>
                        <th>Sector</th>
                        <th>Exchange</th>
                        <th aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((company) => (
                        <tr key={company.id}>
                          <td>
                            <Link
                              href={`/companies/${company.slug}`}
                              className="font-medium text-ink-100 hover:text-brand-500"
                            >
                              {company.name}
                            </Link>
                          </td>
                          <td className="num text-ink-300">{company.ticker}</td>
                          <td className="text-ink-400">{company.sector ?? "—"}</td>
                          <td className="text-ink-400">{company.exchange ?? "—"}</td>
                          <td>
                            <Link
                              href={`/companies/${company.slug}`}
                              className="text-ink-400 hover:text-brand-500"
                              aria-label={`Open ${company.name}`}
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState
                    icon={Building2}
                    title="No companies loaded"
                    description="Run `make seed` to load the sample fundamentals."
                  />
                )}
              </CardContent>
            </Card>

            {/* Recent documents + prompts */}
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Recent documents</CardTitle>
                  <Link
                    href="/documents"
                    className="font-mono text-[10px] uppercase tracking-wider text-brand-500 hover:text-brand-600"
                  >
                    Manage →
                  </Link>
                </CardHeader>
                <CardContent>
                  {loadingDocs ? (
                    <LoadingState label="Loading…" />
                  ) : documents?.length ? (
                    <ul>
                      {documents.slice(0, 4).map((doc) => (
                        <li key={doc.id} className="ledger-row">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-ink-100">
                              {doc.filename}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-ink-400">
                              {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                            </span>
                          </span>
                          <Badge tone={statusTone(doc.status)}>{doc.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs leading-relaxed text-ink-400">
                      No documents yet. Upload a PDF or spreadsheet to extend coverage.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Try asking</CardTitle>
                  <CardDescription>Jump straight into the research agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol>
                    {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, index) => (
                      <li key={prompt} className="ledger-row items-start">
                        <span className="num w-5 shrink-0 pt-0.5 text-[10px] text-brand-500">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Link
                          href={`/chat?q=${encodeURIComponent(prompt)}`}
                          className="flex-1 text-xs leading-relaxed text-ink-300 transition-colors hover:text-ink-100"
                        >
                          {prompt}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block bg-surface-900 p-5 transition-colors hover:bg-surface-850">
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps">{label}</p>
        <Icon className="h-3.5 w-3.5 text-ink-400 transition-colors group-hover:text-brand-500" aria-hidden />
      </div>
      <p className="num mt-4 text-3xl leading-none text-ink-100">{value}</p>
      {hint && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">{hint}</p>
      )}
    </Link>
  );
}
