"use client";

import { ChevronRight, Database, Terminal } from "lucide-react";
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
        className="focus-ring citation-mark mx-0.5"
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
    <div className="mt-4 border border-line bg-surface-850/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface-800"
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
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
                "h-1.5 w-1.5",
                step.status === "ok" && "bg-brand-500",
                step.status === "skipped" && "bg-warn",
                step.status === "error" && "bg-bear",
              )}
            />
          ))}
        </span>
      </button>

      {open && (
        <ul className="border-t border-line">
          {trace.map((step, index) => (
            <li key={index} className="flex items-baseline gap-2 border-b border-line px-3 py-1.5 font-mono text-[10px] last:border-b-0">
              <span className="num w-4 shrink-0 text-ink-400">{index + 1}</span>
              <span className="shrink-0 font-medium text-ink-200">{step.name}</span>
              <span
                className={cn(
                  "shrink-0",
                  step.status === "ok" && "text-brand-500",
                  step.status === "skipped" && "text-warn",
                  step.status === "error" && "text-bear",
                )}
              >
                {step.status}
              </span>
              {step.detail && <span className="truncate text-ink-400">{step.detail}</span>}
              {step.duration_ms !== null && (
                <span className="num ml-auto shrink-0 text-ink-400">{step.duration_ms}ms</span>
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
    <div className="mt-4 border border-line bg-surface-850">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
          <Database className="h-3 w-3" aria-hidden /> Executed query
        </span>
        <button
          type="button"
          onClick={() => copy(sql)}
          className="focus-ring p-1 text-ink-400 hover:text-ink-100"
          title="Copy SQL"
        >
          {copied ? <Check className="h-3 w-3 text-bull" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-300">
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
    <article className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-b border-line py-5 first:pt-0 last:border-b-0">
      <div className="border-r border-line pr-3">
        <span className="num block text-lg leading-none text-brand-500">{isUser ? "Q" : "A"}</span>
      </div>

      <div className="min-w-0">
        <p className="label-caps mb-2">
          {isUser ? "Analyst" : turn.error ? "System error" : "FinSight"}
        </p>

        {isUser ? (
          <p className="serif-body text-ink-100">{turn.content}</p>
        ) : (
          <div
            className={cn(
              "serif-body whitespace-pre-wrap",
              turn.error ? "text-bear" : "text-ink-200",
            )}
          >
            {renderCitedText(turn.content, (index) => {
              const citation = turn.citations?.find((c) => c.index === index);
              if (citation && onCitationClick) onCitationClick(citation);
            })}
          </div>
        )}

        {!isUser && (
          <>
            {turn.charts?.map((spec, index) => (
              <div key={index} className="mt-4">
                <ChartCard spec={spec} />
              </div>
            ))}
            {turn.sql && <SqlPanel sql={turn.sql} />}
            {turn.trace && turn.trace.length > 0 && <TracePanel trace={turn.trace} />}
          </>
        )}
      </div>
    </article>
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
          <p className="text-xs leading-relaxed text-ink-400">
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
      <CardContent>
        <ul className="flex flex-col gap-2">
          {citations.map((citation) => (
            <li key={citation.index}>
              <button
                type="button"
                onClick={() => onSelect?.(citation)}
                className={cn(
                  "focus-ring w-full border-l-2 p-3 text-left transition-colors",
                  activeIndex === citation.index
                    ? "border-l-brand-500 bg-brand-500/[0.06]"
                    : "border-l-line bg-surface-850 hover:border-l-line-strong",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="num grid h-5 w-5 shrink-0 place-items-center border border-brand-500/40 text-[10px] text-brand-500">
                    {citation.index}
                  </span>
                  <span className="truncate font-serif text-sm text-ink-100">
                    {citation.document_name}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-ink-400">
                  {citation.snippet}
                </p>
                <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-ink-400">
                  {citation.page !== null && <span>p.{citation.page}</span>}
                  {citation.section && <span className="truncate">· {citation.section}</span>}
                  {citation.score !== null && (
                    <span className="num ml-auto">score {citation.score.toFixed(3)}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function TraceSummaryIcon({ trace }: { trace: TraceStep[] }) {
  const errors = trace.filter((step) => step.status === "error").length;
  if (!errors) return null;
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-warn">
      <Terminal className="h-3 w-3" aria-hidden />
      {errors} step{errors > 1 ? "s" : ""} degraded
    </span>
  );
}
