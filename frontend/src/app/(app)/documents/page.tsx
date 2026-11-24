"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  FileUp,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast } from "@/components/ui/toast";
import { LoadingState } from "@/components/ui/spinner";
import {
  useDeleteDocument,
  useDocuments,
  useReprocessDocument,
  useUploadDocument,
} from "@/hooks/use-api";
import { useWorkspaceStats } from "@/providers/auth-provider";
import { formatBytes, formatDate } from "@/lib/format";
import { SUPPORTED_FILE_TYPES } from "@/lib/constants";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function iconForFile(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return FileText;
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return FileSpreadsheet;
  if (ext === "docx" || ext === "doc") return File;
  return FileText;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "ready") return <CheckCircle2 className="h-3.5 w-3.5 text-bull" aria-hidden />;
  if (status === "failed") return <AlertCircle className="h-3.5 w-3.5 text-bear" aria-hidden />;
  if (status === "processing")
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" aria-hidden />;
  return <Clock className="h-3.5 w-3.5 text-warn" aria-hidden />;
}

export default function DocumentsPage() {
  const { data: documents, isLoading } = useDocuments();
  const { data: stats } = useWorkspaceStats();
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const reprocess = useReprocessDocument();

  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = (message: string, tone: "success" | "error") => setToast({ message, tone });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        try {
          await upload.mutateAsync(file);
          notify(`Uploaded ${file.name}`, "success");
        } catch (error) {
          const message =
            error instanceof ApiError ? error.message : "Upload failed. Is the API running?";
          notify(message, "error");
        }
      }
    },
    [upload],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) void handleFiles(event.dataTransfer.files);
  };

  const readyCount = documents?.filter((doc) => doc.status === "ready").length ?? 0;

  return (
    <AppShell
      title="Documents"
      subtitle="Upload PDFs, Excel, CSV and Word files — text and tables are extracted and indexed"
    >
      <div className="flex flex-col gap-6">
        {/* Ledger */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <p className="label-caps">Ingest register</p>
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>
          <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
            <MiniStat label="Documents" value={stats?.documents ?? 0} />
            <MiniStat label="Indexed chunks" value={stats?.chunks ?? 0} />
            <MiniStat label="Ready" value={readyCount} tone="text-bull" />
          </div>
        </section>

        {/* Dropzone */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "border border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-brand-500 bg-brand-500/[0.04]"
              : "border-line-strong bg-surface-900 hover:border-ink-400",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.docx,.txt"
            onChange={(event) => {
              if (event.target.files?.length) void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />

          <p className="label-caps">01 / Ingest</p>
          <h2 className="display mt-3 text-3xl">Drop filings here.</h2>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-ink-400">
            Files are parsed, chunked and indexed in this workspace only. Retrieval never crosses
            tenants.
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="focus-ring mt-5 border-b border-brand-500 pb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-brand-500 transition-colors hover:text-brand-600"
          >
            Browse files →
          </button>

          <div className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 border-t border-line pt-4">
            {SUPPORTED_FILE_TYPES.map(({ ext, label, hint }) => (
              <span key={ext} title={hint} className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
                <span className="text-ink-200">{label}</span> {ext}
              </span>
            ))}
          </div>

          {upload.isPending && (
            <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-wider text-brand-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Uploading…
            </p>
          )}
        </div>

        {/* File list */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Indexed files</CardTitle>
              <CardDescription>
                Chunks are mirrored into Chroma for vector search and into a BM25 index for
                keyword search
              </CardDescription>
            </div>
            <Badge tone="neutral">{documents?.length ?? 0} files</Badge>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <LoadingState label="Loading documents…" />
            ) : !documents?.length ? (
              <EmptyState
                icon={FileUp}
                title="No documents yet"
                description="Upload an annual report, model or transcript to extend what FinSight can cite."
              />
            ) : (
              <ul>
                {documents.map((document) => {
                  const Icon = iconForFile(document.filename);
                  return (
                    <li key={document.id} className="ledger-row">
                      <span className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-surface-850 text-ink-400">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-base text-ink-100">
                          {document.filename}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                          <span>{formatBytes(document.size_bytes)}</span>
                          <span>·</span>
                          <span>{document.chunk_count} chunks</span>
                          <span>·</span>
                          <span>{formatDate(document.created_at)}</span>
                        </span>
                        {document.error && (
                          <span className="mt-1 block truncate font-mono text-[10px] text-bear">
                            {document.error}
                          </span>
                        )}
                      </span>

                      <span className="flex shrink-0 items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <StatusIcon status={document.status} />
                          <Badge tone={statusTone(document.status)}>{document.status}</Badge>
                        </span>

                        <button
                          type="button"
                          title="Reprocess"
                          onClick={() => reprocess.mutate(document.id)}
                          disabled={reprocess.isPending}
                          className="focus-ring border border-transparent p-1.5 text-ink-400 transition-colors hover:border-line hover:text-ink-100"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => remove.mutate(document.id)}
                          disabled={remove.isPending}
                          className="focus-ring border border-transparent p-1.5 text-ink-400 transition-colors hover:border-line hover:text-bear"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      )}
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  tone = "text-ink-100",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bg-surface-900 p-5">
      <p className="label-caps">{label}</p>
      <p className={cn("num mt-3 text-3xl leading-none", tone)}>
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}
