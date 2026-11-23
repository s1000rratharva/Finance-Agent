"use client";

import { Bot, User, ChevronRight, Database, Terminal } from "lucide-react";
import { useState } from "react";

import { ChartCard } from "@/components/charts/chart-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCopyToClipboard } from "@/hooks/use-copy";
import type { ChartSpec, Citation, TraceStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  trace?: TraceStep[];
  charts?: ChartSpec[];
  sql?: string | null;
  error?: boolean;
}

/** Renders ``[n]`` markers as superscript chips that scroll to the source. */
function renderCitedText(text: string, onJump: (index: number) => void) {
  const parts = text.split(/(\[\d{1,2}\])/g);
  return parts.map((part, i) => {
    const match = /^\[(\d{1,2})\]$/.exec(part);
    if (!match) return <span key={i}>{part}</span>;
    const index = Number(match[1]);
    return (
      <button
        key={i}
        type="button"
        onClick={() => onJump(index)}
        className="focus-ring mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-brand-500/15 px-1 align-super text-[10px] font-semibold text-brand-300 transition-colors hover:bg-brand-500/30"
        title={`Source ${index}`}
      >
        {index}
      </button>
    );
  });
}

function TracePanel({ trace }: { trace: TraceStep[] }) {
  const [open, setOpen] = useState(false);
  if (!trace.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-850/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex w-full items-center justify-between px-3 py-2 text-[11px] text-ink-400 transition-colors hover:text-ink-200"
      >
        <span className="flex items-center gap-1.5">
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          Agent trace · {trace.length} step{trace.length > 1 ? "s" : ""}
        </span>
        <span className="flex gap-1">
          {trace.map((step, index) => (
            <span
              key={index}
              title={`${step.name}: ${step.status}`}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                step.status === "ok" && "bg-brand-500",
                step.status === "skipped" && "bg-warn",
                step.status === "error" && "bg-bear",
              )}
            />
          ))}
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {trace.map((step, index) => (
            <li key={index} className="flex items-baseline gap-2 px-3 py-1.5 text-[11px]">
              <span className="num w-4 shrink-0 text-ink-400">{index + 1}</span>
              <span className="shrink-0 font-medium text-ink-200">{step.name}</span>
              <span
                className={cn(
                  "shrink-0",
                  step.status === "ok" && "text-brand-400",
                  step.status === "skipped" && "text-warn",
                  step.status === "error" && "text-bear",
                )}
              >
                {step.status}
              </span>
              {step.detail && (
                <span className="truncate text-ink-400">{step.detail}</span>
              )}
              {step.duration_ms !== null && (
                <span className="num ml-auto shrink-0 text-ink-400">
                  {step.duration_ms}ms
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SqlPanel({ sql }: { sql: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface-850">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <Database className="h-3 w-3" aria-hidden /> Executed query
        </span>
        <button
          type="button"
          onClick={() => copy(sql)}
          className="focus-ring rounded p-1 text-ink-400 hover:text-ink-200"
          title="Copy SQL"
        >
          {copied ? <Check className="h-3 w-3 text-bull" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-ink-300">
        <code>{sql}</code>
      </pre>
    </div>
  );
}

export function MessageBubble({
  turn,
  onCitationClick,
}: {
  turn: ChatTurn;
  onCitationClick?: (citation: Citation) => void;
}) {
  const isUser = turn.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full",
          isUser ? "bg-surface-700 text-ink-300" : "bg-brand-500/15 text-brand-400",
        )}
      >
        {isUser ? <User className="h-4 w-4" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
      </span>

      <div className={cn("min-w-0 max-w-3xl", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-surface-700 text-ink-100"
              : turn.error
                ? "border border-bear/30 bg-bear/8 text-ink-200"
                : "border border-line bg-surface-900 text-ink-200",
          )}
        >
          {isUser ? (
            turn.content
          ) : (
            <div className="whitespace-pre-wrap">
              {renderCitedText(turn.content, (index) => {
                const citation = turn.citations?.find((c) => c.index === index);
                if (citation && onCitationClick) onCitationClick(citation);
              })}
            </div>
          )}
        </div>

        {!isUser && (
          <>
            {turn.charts?.map((spec, index) => (
              <div key={index} className="mt-3 w-full">
                <ChartCard spec={spec} />
              </div>
            ))}
            {turn.sql && <SqlPanel sql={turn.sql} />}
            {turn.trace && turn.trace.length > 0 && <TracePanel trace={turn.trace} />}
          </>
        )}
      </div>
    </div>
  );
}

/** Right-hand source list; clicking scrolls/highlights the matching citation. */
export function CitationPanel({
  citations,
  activeIndex,
  onSelect,
}: {
  citations: Citation[];
  activeIndex?: number | null;
  onSelect?: (citation: Citation) => void;
}) {
  if (!citations.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-ink-400">
            Citations appear here once the agent retrieves supporting passages.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Sources</CardTitle>
        <Badge tone="brand">{citations.length}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {citations.map((citation) => (
          <button
            key={citation.index}
            type="button"
            onClick={() => onSelect?.(citation)}
            className={cn(
              "focus-ring rounded-lg border p-3 text-left transition-colors",
              activeIndex === citation.index
                ? "border-brand-500/50 bg-brand-500/8"
                : "border-line bg-surface-850 hover:border-line-strong",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="num grid h-5 w-5 shrink-0 place-items-center rounded bg-brand-500/15 text-[10px] font-semibold text-brand-300">
                {citation.index}
              </span>
              <span className="truncate text-xs font-medium text-ink-200">
                {citation.document_name}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-ink-400">
              {citation.snippet}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
              {citation.page !== null && <span>p.{citation.page}</span>}
              {citation.section && <span className="truncate">· {citation.section}</span>}
              {citation.score !== null && (
                <span className="num ml-auto">score {citation.score.toFixed(3)}</span>
              )}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function TraceSummaryIcon({ trace }: { trace: TraceStep[] }) {
  const errors = trace.filter((step) => step.status === "error").length;
  if (!errors) return null;
  return (
    <span className="flex items-center gap-1 text-[11px] text-warn">
      <Terminal className="h-3 w-3" aria-hidden />
      {errors} step{errors > 1 ? "s" : ""} degraded
    </span>
  );
}
