"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { MetricChart } from "@/components/charts/metric-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { useCompanies } from "@/hooks/use-api";
import { formatCurrency, formatNumber, formatRatio } from "@/lib/format";
import { METRICS, METRIC_GROUPS, metricLabel } from "@/lib/constants";
import { colorForIndex, cn } from "@/lib/utils";
import type { ChartSpec } from "@/lib/types";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { ComparisonResponse } from "@/lib/types";

function CompareInner() {
  const searchParams = useSearchParams();
  const { data: companies, isLoading } = useCompanies();

  const initial = (searchParams.get("companies") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [selected, setSelected] = useState<string[]>(
    initial.length ? initial : (companies?.slice(0, 2).map((c) => c.slug) ?? []),
  );
  const [metric, setMetric] = useState("revenue");
  const [group, setGroup] = useState<(typeof METRIC_GROUPS)[number]["key"]>("pnl");

  const enabled = selected.length >= 2 && Boolean(companies?.length);

  const { data: comparison, isLoading: loadingComparison } = useQuery({
    queryKey: ["compare", metric, [...selected].sort().join(",")],
    queryFn: () =>
      api.get<ComparisonResponse>(`/api/v1/companies/compare/${metric}`, {
        query: { slugs: selected.join(",") },
      }),
    enabled,
  });

  const toggle = (slug: string) => {
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug].slice(0, 4),
    );
  };

  const spec = useMemo<ChartSpec | null>(() => {
    if (!comparison) return null;
    return {
      chart_type: "line",
      title: `${metricLabel(metric)} — ${comparison.companies.map((c) => c.ticker).join(" vs ")}`,
      unit: metric === "eps" ? "₹" : comparison.unit,
      x_key: "fiscal_year",
      series: comparison.companies.map((company, index) => ({
        key: company.slug,
        label: company.ticker,
        color: colorForIndex(index),
        data: comparison.series.map((row) => ({
          x: row.fiscal_year,
          y: row.values[company.slug] ?? null,
        })),
      })),
    };
  }, [comparison, metric]);

  const metricsForGroup = METRICS.filter((m) => m.group === group);

  if (isLoading) {
    return (
      <AppShell title="Compare" subtitle="Cross-company analysis">
        <LoadingState label="Loading companies…" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Compare"
      subtitle="Compare companies across fiscal years on any statement line"
    >
      <div className="flex flex-col gap-5">
        {/* Company selector */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-1.5">
                <GitCompareArrows className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                Select companies
              </CardTitle>
              <CardDescription>Pick 2–4 names to plot side by side</CardDescription>
            </div>
            <Badge tone="brand">{selected.length} selected</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {companies?.map((company) => {
              const active = selected.includes(company.slug);
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => toggle(company.slug)}
                  disabled={!active && selected.length >= 4}
                  className={cn(
                    "focus-ring flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-40",
                    active
                      ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                      : "border-line bg-surface-850 text-ink-300 hover:border-line-strong",
                  )}
                >
                  {active && <Check className="h-3 w-3" aria-hidden />}
                  <span className="font-medium">{company.ticker}</span>
                  <span className="text-ink-400">{company.name}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Metric picker */}
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Metric</CardTitle>
              <CardDescription>Grouped by statement section</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              {METRIC_GROUPS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setGroup(item.key);
                    const first = METRICS.find((m) => m.group === item.key);
                    if (first) setMetric(first.key);
                  }}
                  className={cn(
                    "focus-ring rounded-lg px-3 py-1.5 text-xs transition-colors",
                    group === item.key
                      ? "bg-surface-700 text-ink-100"
                      : "text-ink-400 hover:bg-surface-850",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {metricsForGroup.map((item) => (
              <button
                key={item.key}
                type="button"
                title={item.description}
                onClick={() => setMetric(item.key)}
                className={cn(
                  "focus-ring rounded-lg border px-3 py-1.5 text-xs transition-colors",
                  metric === item.key
                    ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                    : "border-line bg-surface-850 text-ink-300 hover:border-line-strong",
                )}
              >
                {item.label}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{metricLabel(metric)}</CardTitle>
            <CardDescription>
              {comparison?.unit ?? "INR cr"} · fiscal years FY21–FY25
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selected.length < 2 ? (
              <EmptyState
                icon={GitCompareArrows}
                title="Select at least two companies"
                description="Comparison needs two or more names to be meaningful."
              />
            ) : loadingComparison || !spec ? (
              <LoadingState label="Fetching comparison…" />
            ) : (
              <MetricChart spec={spec} height={330} />
            )}
          </CardContent>
        </Card>

        {/* Data table */}
        {comparison && selected.length >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Underlying values</CardTitle>
              <CardDescription>Exact figures behind the chart</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-2.5 font-medium text-ink-400">Fiscal year</th>
                    {comparison.companies.map((company, index) => (
                      <th key={company.id} className="px-4 py-2.5 text-right font-medium">
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ color: colorForIndex(index) }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: colorForIndex(index) }}
                          />
                          {company.ticker}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.series.map((row) => (
                    <tr key={row.fiscal_year} className="border-b border-line/60">
                      <td className="num px-4 py-2.5 font-medium text-ink-200">
                        FY{row.fiscal_year}
                      </td>
                      {comparison.companies.map((company) => {
                        const value = row.values[company.slug];
                        return (
                          <td
                            key={company.id}
                            className="num px-4 py-2.5 text-right text-ink-200"
                          >
                            {value === null || value === undefined
                              ? "—"
                              : metric === "eps"
                                ? formatNumber(value, 2)
                                : metricRatioOrCurrency(metric, value, comparison.unit)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function metricRatioOrCurrency(metric: string, value: number, unit: string): string {
  if (unit === "ratio" || metric.includes("margin")) return formatRatio(value);
  return formatCurrency(value, "INR", "");
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center">
          <LoadingState label="Loading compare…" />
        </div>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
