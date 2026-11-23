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
import { Button } from "@/components/ui/button";
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
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" aria-hidden />;
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
      <div className="flex flex-col gap-5">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="Documents" value={stats?.documents ?? 0} />
          <MiniStat label="Indexed chunks" value={stats?.chunks ?? 0} />
          <MiniStat label="Ready" value={readyCount} tone="text-bull" />
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragging
              ? "border-brand-500 bg-brand-500/6"
              : "border-line bg-surface-900 hover:border-line-strong",
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

          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-brand-500/12 text-brand-400">
            <FileUp className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-100">
            Drop files here or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="focus-ring text-brand-400 underline-offset-2 hover:underline"
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Files are stored per workspace and never shared across tenants.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUPPORTED_FILE_TYPES.map(({ ext, label, hint }) => (
              <span
                key={ext}
                title={hint}
                className="rounded-lg border border-line bg-surface-850 px-3 py-1.5 text-[11px] text-ink-300"
              >
                <span className="font-semibold text-ink-200">{label}</span> {ext}
              </span>
            ))}
          </div>

          {upload.isPending && (
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-brand-400">
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

          <CardContent className="p-0">
            {isLoading ? (
              <LoadingState label="Loading documents…" />
            ) : !documents?.length ? (
              <div className="p-5">
                <EmptyState
                  icon={FileUp}
                  title="No documents yet"
                  description="Upload an annual report, model or transcript to extend what FinSight can cite."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {documents.map((document) => {
                  const Icon = iconForFile(document.filename);
                  return (
                    <li
                      key={document.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-850/60"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-800 text-ink-300">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-100">
                          {document.filename}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                          <span>{formatBytes(document.size_bytes)}</span>
                          <span>·</span>
                          <span>{document.chunk_count} chunks</span>
                          <span>·</span>
                          <span>{formatDate(document.created_at)}</span>
                        </span>
                        {document.error && (
                          <span className="mt-1 block truncate text-[11px] text-bear">
                            {document.error}
                          </span>
                        )}
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        <span className="flex items-center gap-1.5">
                          <StatusIcon status={document.status} />
                          <Badge tone={statusTone(document.status)}>{document.status}</Badge>
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reprocess"
                          onClick={() => reprocess.mutate(document.id)}
                          disabled={reprocess.isPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => remove.mutate(document.id)}
                          disabled={remove.isPending}
                          className="hover:text-bear"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
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
    <div className="card p-4">
      <p className="label-caps">{label}</p>
      <p className={cn("num mt-1 text-2xl font-semibold", tone)}>
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}
