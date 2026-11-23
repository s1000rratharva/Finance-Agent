"use client";

import { useState } from "react";
import { Gauge, Play, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";
import { LoadingState } from "@/components/ui/spinner";
import { useEvaluationRuns, useRunEvaluation } from "@/hooks/use-api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const SCORE_KEYS = [
  { key: "faithfulness", label: "Faithfulness", hint: "Is the answer grounded in retrieved context?" },
  { key: "answer_relevancy", label: "Answer relevancy", hint: "Does the answer address the question?" },
  { key: "context_precision", label: "Context precision", hint: "Are retrieved passages ranked well?" },
  { key: "context_recall", label: "Context recall", hint: "Was the needed evidence retrieved?" },
] as const;

function scoreTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-ink-400";
  if (value >= 0.8) return "text-bull";
  if (value >= 0.6) return "text-warn";
  return "text-bear";
}

export default function EvaluationsPage() {
  const { data: runs, isLoading } = useEvaluationRuns();
  const runEvaluation = useRunEvaluation();
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const startRun = async () => {
    try {
      const run = await runEvaluation.mutateAsync({ dataset_name: "default", limit: 8 });
      setToast({
        message:
          run.status === "failed"
            ? `Run failed: ${run.error ?? "unknown error"}`
            : `Evaluation finished — context recall ${run.scores.context_recall ?? "n/a"}`,
        tone: run.status === "failed" ? "error" : "success",
      });
    } catch (error) {
      setToast({
        message: error instanceof ApiError ? error.message : "Failed to start evaluation",
        tone: "error",
      });
    }
  };

  const latest = runs?.[0];

  return (
    <AppShell
      title="Evaluations"
      subtitle="Measure retrieval and answer quality with RAGAS before shipping changes"
      actions={
        <Button
          size="sm"
          icon={runEvaluation.isPending ? RefreshCw : Play}
          loading={runEvaluation.isPending}
          onClick={startRun}
        >
          Run evaluation
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Latest scores */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCORE_KEYS.map(({ key, label, hint }) => {
            const value = latest?.scores?.[key as keyof typeof latest.scores] ?? null;
            return (
              <div key={key} className="card card-hover p-4" title={hint}>
                <p className="label-caps">{label}</p>
                <p className={cn("num mt-2 text-3xl font-semibold", scoreTone(value))}>
                  {value === null || value === undefined ? (
                    <span className="text-xl text-ink-400">—</span>
                  ) : (
                    value.toFixed(3)
                  )}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-700">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      value !== null && value >= 0.8
                        ? "bg-bull"
                        : value !== null && value >= 0.6
                          ? "bg-warn"
                          : "bg-bear/70",
                    )}
                    style={{ width: `${Math.round((value ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Explain + run history */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Run history</CardTitle>
                <CardDescription>
                  Each run replays the labelled dataset through the live pipeline
                </CardDescription>
              </div>
              <Badge tone="neutral">{runs?.length ?? 0} runs</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <LoadingState label="Loading runs…" />
              ) : !runs?.length ? (
                <div className="p-5">
                  <EmptyState
                    icon={Gauge}
                    title="No evaluation runs yet"
                    description="Run an evaluation against data/eval/default.json to get a quality baseline."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {runs.map((run) => (
                    <li key={run.id} className="flex items-center gap-4 px-5 py-3">
                      <Badge
                        tone={
                          run.status === "completed"
                            ? "success"
                            : run.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {run.status}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-100">
                          {run.dataset_name}
                        </span>
                        <span className="text-[11px] text-ink-400">
                          {formatNumber(run.sample_count)} samples ·{" "}
                          {formatDateTime(run.created_at)}
                        </span>
                        {run.error && (
                          <span className="block truncate text-[11px] text-bear">{run.error}</span>
                        )}
                      </span>
                      <span className="num shrink-0 text-xs text-ink-300">
                        {run.scores.context_recall !== null
                          ? `recall ${run.scores.context_recall.toFixed(3)}`
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What RAGAS measures</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {SCORE_KEYS.map(({ key, label, hint }) => (
                <div key={key} className="rounded-lg border border-line bg-surface-850 p-3">
                  <p className="text-xs font-medium text-ink-200">{label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{hint}</p>
                </div>
              ))}
              <p className="rounded-lg border border-line bg-surface-850 p-3 text-[11px] leading-relaxed text-ink-400">
                Datasets live in <span className="num text-ink-300">data/eval/*.json</span>. Add
                question/reference pairs there to grow the suite.
              </p>
              <p className="text-[11px] leading-relaxed text-ink-400">
                If RAGAS is not installed (Python ≥ 3.13), FinSight falls back to a
                retrieval-only context-recall proxy so the harness still gives signal.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </AppShell>
  );
}
