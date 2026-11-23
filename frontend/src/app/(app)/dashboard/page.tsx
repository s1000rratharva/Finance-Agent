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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, SkeletonRows } from "@/components/ui/spinner";
import { useCompanies, useCompanyOverview, useDocuments } from "@/hooks/use-api";
import { useWorkspaceStats } from "@/providers/auth-provider";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";
import { SUGGESTED_PROMPTS } from "@/lib/constants";
import { statusTone } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const { data: stats, isLoading: loadingStats } = useWorkspaceStats();
  const { data: documents, isLoading: loadingDocs } = useDocuments();

  const featuredSlug = companies?.[0]?.slug;
  const { data: overview, isLoading: loadingOverview } = useCompanyOverview(featuredSlug);

  const loading = loadingCompanies || loadingStats || loadingDocs;

  return (
    <AppShell
      title="Overview"
      subtitle="Workspace snapshot across documents, coverage and analytics"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <SkeletonRows rows={2} />
              </Card>
            ))}
          </div>
          <LoadingState label="Loading workspace…" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Stat strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              label="Active workspace"
              value={stats ? "Isolated" : "—"}
              hint="Tenant-scoped data"
              href="/documents"
            />
          </div>

          {/* Featured company KPIs */}
          {featuredSlug && overview && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">{overview.company}</h2>
                  <p className="text-xs text-ink-400">
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

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Coverage */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Coverage</CardTitle>
                  <CardDescription>Preloaded companies with FY21–FY25 statements</CardDescription>
                </div>
                <Link href="/companies" className="text-xs text-brand-400 hover:text-brand-300">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {companies?.length ? (
                  companies.map((company) => (
                    <Link
                      key={company.id}
                      href={`/companies/${company.slug}`}
                      className="focus-ring group flex items-center gap-3 rounded-lg border border-line bg-surface-850 px-4 py-3 transition-colors hover:border-line-strong"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-700 text-xs font-semibold text-ink-200">
                        {company.ticker.slice(0, 3)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-100">
                          {company.name}
                        </span>
                        <span className="block truncate text-xs text-ink-400">
                          {company.sector} · {company.exchange}
                        </span>
                      </span>
                      <Badge tone="neutral">{company.ticker}</Badge>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-400 transition-colors group-hover:text-brand-400" />
                    </Link>
                  ))
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
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Recent documents</CardTitle>
                  <Link href="/documents" className="text-xs text-brand-400 hover:text-brand-300">
                    Manage
                  </Link>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {loadingDocs ? (
                    <LoadingState label="Loading…" />
                  ) : documents?.length ? (
                    documents.slice(0, 4).map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-ink-200">
                            {doc.filename}
                          </span>
                          <span className="block text-[10px] text-ink-400">
                            {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                          </span>
                        </span>
                        <Badge tone={statusTone(doc.status)}>{doc.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-ink-400">
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
                <CardContent className="flex flex-col gap-1.5">
                  {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                    <Link
                      key={prompt}
                      href={`/chat?q=${encodeURIComponent(prompt)}`}
                      className="focus-ring rounded-lg px-3 py-2 text-xs text-ink-300 transition-colors hover:bg-surface-800 hover:text-ink-100"
                    >
                      → {prompt}
                    </Link>
                  ))}
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
    <Link href={href} className="focus-ring card card-hover group flex items-start justify-between p-4">
      <div>
        <p className="label-caps">{label}</p>
        <p className="num mt-1.5 text-2xl font-semibold text-ink-100">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-ink-400">{hint}</p>}
      </div>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-800 text-ink-400 transition-colors group-hover:bg-brand-500/15 group-hover:text-brand-400">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}
