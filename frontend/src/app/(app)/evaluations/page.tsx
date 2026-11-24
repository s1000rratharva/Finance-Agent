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

function scoreFill(value: number | null | undefined): string {
  if (value === null || value === undefined) return "bg-ink-400";
  if (value >= 0.8) return "bg-bull";
  if (value >= 0.6) return "bg-warn";
  return "bg-bear";
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
      <div className="flex flex-col gap-6">
        {/* Latest scores */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <p className="label-caps">Latest run · quality gates</p>
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>

          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {SCORE_KEYS.map(({ key, label, hint }) => {
              const value = latest?.scores?.[key as keyof typeof latest.scores] ?? null;
              return (
                <div key={key} className="bg-surface-900 p-5" title={hint}>
                  <p className="label-caps">{label}</p>
                  <p className={cn("num mt-3 text-3xl leading-none", scoreTone(value))}>
                    {value === null || value === undefined ? "—" : value.toFixed(3)}
                  </p>
                  <div className="progress-track mt-4">
                    <div
                      className={cn("progress-fill", scoreFill(value))}
                      style={{ width: `${Math.round((value ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Explain + run history */}
        <div className="grid gap-6 lg:grid-cols-3">
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
            <CardContent>
              {isLoading ? (
                <LoadingState label="Loading runs…" />
              ) : !runs?.length ? (
                <EmptyState
                  icon={Gauge}
                  title="No evaluation runs yet"
                  description="Run an evaluation against data/eval/default.json to get a quality baseline."
                />
              ) : (
                <ul>
                  {runs.map((run) => (
                    <li key={run.id} className="ledger-row">
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
                        <span className="block font-serif text-base text-ink-100">
                          {run.dataset_name}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                          {formatNumber(run.sample_count)} samples · {formatDateTime(run.created_at)}
                        </span>
                        {run.error && (
                          <span className="mt-1 block truncate font-mono text-[10px] text-bear">
                            {run.error}
                          </span>
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
            <CardContent>
              <ol>
                {SCORE_KEYS.map(({ key, label, hint }, index) => (
                  <li key={key} className="ledger-row items-start">
                    <span className="num w-5 shrink-0 pt-0.5 text-[10px] text-brand-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block text-xs font-medium text-ink-100">{label}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-ink-400">
                        {hint}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 border-l-2 border-line pl-3 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-ink-400">
                Datasets live in <span className="text-ink-200">data/eval/*.json</span>. Add question
                and reference pairs there to grow the suite. If RAGAS is unavailable, FinSight
                falls back to a retrieval-only context-recall proxy.
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
