"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Table2,
  MessageSquareText,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { MetricChart } from "@/components/charts/metric-chart";
import { KPITile } from "@/components/charts/kpi-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState, Skeleton } from "@/components/ui/spinner";
import {
  useCompany,
  useCompanyInsights,
  useCompanyOverview,
  useCompanyRatios,
  useCompanyRisks,
  useCompanyTrends,
} from "@/hooks/use-api";
import {
  formatCurrency,
  formatDate,
  formatMultiple,
  formatNumber,
  formatRatio,
} from "@/lib/format";
import { METRICS, metricLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "statements" | "ratios" | "risk";

const TABS: { key: TabKey; label: string; icon: typeof TrendingUp }[] = [
  { key: "overview", label: "Overview", icon: TrendingUp },
  { key: "statements", label: "Statements", icon: Table2 },
  { key: "ratios", label: "Ratios", icon: TrendingUp },
  { key: "risk", label: "Risk", icon: ShieldAlert },
];

export default function CompanyDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [tab, setTab] = useState<TabKey>("overview");
  const [trendMetric, setTrendMetric] = useState("revenue");

  const { data: company, isLoading: loadingCompany } = useCompany(slug);
  const { data: overview, isLoading: loadingOverview } = useCompanyOverview(slug);
  const { data: trends, isLoading: loadingTrends } = useCompanyTrends(slug, trendMetric);
  const { data: ratios, isLoading: loadingRatios } = useCompanyRatios(slug);
  const { data: risks, isLoading: loadingRisks } = useCompanyRisks(slug);
  const { data: insight, isLoading: loadingInsight } = useCompanyInsights(slug);

  const trendSpec = useMemo(() => {
    const metric = trends?.[0];
    if (!metric) return null;
    return {
      chart_type: "line" as const,
      title: `${metric.label} by fiscal year`,
      unit: metric.unit === "per share" ? "₹" : metric.unit,
      x_key: "fiscal_year",
      series: [
        {
          key: metric.metric,
          label: metric.label,
          data: metric.points.map((point) => ({ x: point.fiscal_year, y: point.value })),
        },
      ],
    };
  }, [trends]);

  const loading = loadingCompany || loadingOverview;

  return (
    <AppShell
      title={company?.name ?? "Company"}
      subtitle={company ? `${company.ticker} · ${company.sector ?? ""}` : "Loading…"}
      actions={
        company && (
          <Link href={`/chat?company=${company.slug}`}>
            <Button size="sm" variant="outline" icon={MessageSquareText}>
              Ask about {company.ticker}
            </Button>
          </Link>
        )
      }
    >
      <Link
        href="/companies"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-ink-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All companies
      </Link>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <LoadingState label="Loading company…" />
        </div>
      ) : !company ? (
        <EmptyState
          title="Company not found"
          description="It may not be seeded yet. Run `make seed` to load sample data."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Header card */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface-700 text-base font-semibold text-ink-100">
                  {company.ticker.slice(0, 3)}
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-ink-100">
                    {company.name}
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-400">
                    {company.description}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{company.ticker}</Badge>
                    <Badge tone="neutral">{company.sector ?? "—"}</Badge>
                    <Badge tone="neutral">{company.industry ?? "—"}</Badge>
                    <Badge tone="neutral">{company.exchange ?? "—"}</Badge>
                    <Badge tone="neutral">{company.currency}</Badge>
                  </div>
                </div>
              </div>

              <Link href={`/compare?companies=${company.slug}`}>
                <Button size="sm" variant="outline">
                  Compare with peers
                </Button>
              </Link>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-line">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "focus-ring -mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                  tab === key
                    ? "border-brand-500 text-brand-300"
                    : "border-transparent text-ink-400 hover:text-ink-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {overview?.kpis.map((kpi) => (
                  <KPITile
                    key={kpi.key}
                    label={kpi.label}
                    value={kpi.value}
                    unit={kpi.unit}
                    deltaPct={kpi.delta_pct}
                    fiscalYear={kpi.fiscal_year}
                    currency={overview.currency}
                  />
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex-row items-center justify-between gap-3">
                    <div>
                      <CardTitle>Trend</CardTitle>
                      <CardDescription>
                        Select a statement line to plot across fiscal years
                      </CardDescription>
                    </div>
                    <select
                      value={trendMetric}
                      onChange={(event) => setTrendMetric(event.target.value)}
                      className="h-9 rounded-lg border border-line bg-surface-850 px-3 text-xs text-ink-200 focus:border-brand-500 focus:outline-none"
                    >
                      {METRICS.map((metric) => (
                        <option key={metric.key} value={metric.key}>
                          {metric.label}
                        </option>
                      ))}
                    </select>
                  </CardHeader>
                  <CardContent>
                    {loadingTrends || !trendSpec ? (
                      <LoadingState label="Loading trend…" />
                    ) : (
                      <MetricChart spec={trendSpec} height={300} />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                      AI insights
                    </CardTitle>
                    <CardDescription>Generated from the latest KPI block</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingInsight ? (
                      <LoadingState label="Analysing…" />
                    ) : insight?.insight ? (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-300">
                        {insight.insight}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-400">
                        {insight?.note ??
                          "Configure GROQ_API_KEY to generate AI narratives for this company."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {tab === "statements" && (
            <StatementsTable statements={company.statements} />
          )}

          {tab === "ratios" && (
            <Card>
              <CardHeader>
                <CardTitle>Ratio history</CardTitle>
                <CardDescription>
                  Computed in Python from statement rows — never stored, always derived
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loadingRatios ? (
                  <LoadingState label="Computing ratios…" />
                ) : !ratios?.length ? (
                  <div className="p-5">
                    <EmptyState title="No ratio data" />
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="px-4 py-2.5 font-medium text-ink-400">Fiscal year</th>
                        {Object.keys(ratios[0].ratios).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-2.5 text-right font-medium text-ink-400"
                          >
                            {metricLabel(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ratios.map((row) => (
                        <tr key={row.fiscal_year} className="border-b border-line/60">
                          <td className="num px-4 py-2.5 font-medium text-ink-200">
                            FY{row.fiscal_year}
                          </td>
                          {Object.entries(row.ratios).map(([key, value]) => (
                            <td
                              key={key}
                              className={cn(
                                "num px-4 py-2.5 text-right",
                                value === null ? "text-ink-400" : "text-ink-200",
                              )}
                            >
                              {formatRatioCell(key, value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "risk" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-warn" aria-hidden />
                    Risk flags · FY{risks?.fiscal_year ?? "—"}
                  </CardTitle>
                  <CardDescription>Leverage, liquidity, coverage and cash quality</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  {loadingRisks ? (
                    <LoadingState label="Assessing risk…" />
                  ) : risks?.flags.length ? (
                    risks.flags.map((flag) => (
                      <div
                        key={flag.key}
                        className={cn(
                          "rounded-lg border p-3.5",
                          flag.severity === "high" && "border-bear/35 bg-bear/6",
                          flag.severity === "medium" && "border-warn/35 bg-warn/6",
                          flag.severity === "low" && "border-line bg-surface-850",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-ink-100">{flag.label}</span>
                          <Badge
                            tone={
                              flag.severity === "high"
                                ? "danger"
                                : flag.severity === "medium"
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {flag.severity}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{flag.detail}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No risk signals" description="Statement data unavailable." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-ink-300">
                    {risks?.summary ?? "—"}
                  </p>
                  <p className="mt-4 rounded-lg border border-line bg-surface-850 p-3 text-[11px] leading-relaxed text-ink-400">
                    Flags are threshold-based heuristics on reported figures. They are a
                    starting point for research, not a credit opinion.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function formatRatioCell(key: string, value: number | null): string {
  if (value === null) return "—";
  if (["current_ratio", "quick_ratio", "debt_to_equity", "interest_coverage"].includes(key)) {
    return formatMultiple(value);
  }
  return formatRatio(value);
}

function StatementsTable({
  statements,
}: {
  statements: NonNullable<ReturnType<typeof useCompany>["data"]>["statements"];
}) {
  const columns = [
    { key: "revenue", label: "Revenue" },
    { key: "gross_profit", label: "Gross profit" },
    { key: "operating_profit", label: "Operating profit" },
    { key: "net_profit", label: "Net profit" },
    { key: "total_debt", label: "Total debt" },
    { key: "operating_cash_flow", label: "OCF" },
    { key: "free_cash_flow", label: "FCF" },
    { key: "eps", label: "EPS" },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial statements</CardTitle>
        <CardDescription>
          Consolidated figures in INR crore unless noted · last updated{" "}
          {formatDate(statements[0]?.as_of ?? null)}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {statements.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No statements" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-2.5 font-medium text-ink-400">Fiscal year</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-2.5 text-right font-medium text-ink-400">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...statements].reverse().map((statement) => (
                <tr
                  key={statement.id}
                  className="border-b border-line/60 transition-colors hover:bg-surface-850/60"
                >
                  <td className="num px-4 py-2.5 font-medium text-ink-100">
                    FY{statement.fiscal_year}
                  </td>
                  {columns.map((column) => {
                    const value = statement[column.key as keyof typeof statement];
                    const numeric = typeof value === "number" ? value : null;
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "num px-4 py-2.5 text-right",
                          numeric === null
                            ? "text-ink-400"
                            : numeric < 0
                              ? "text-bear"
                              : "text-ink-200",
                        )}
                      >
                        {column.key === "eps"
                          ? numeric === null
                            ? "—"
                            : formatNumber(numeric, 2)
                          : formatCurrency(numeric, "INR", "")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
