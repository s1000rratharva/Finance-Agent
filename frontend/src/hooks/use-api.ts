"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  ChatResponse,
  Company,
  CompanyDetail,
  Conversation,
  DocumentRecord,
  EvalRun,
  HealthStatus,
  Message,
  Overview,
  RatioRow,
  RiskOut,
  Trend,
} from "@/lib/types";

export interface CompanyInsight {
  company: string;
  fiscal_year?: number;
  insight: string | null;
  note?: string;
}

// --- health ------------------------------------------------------------------

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthStatus>("/api/v1/health", { noWorkspace: true }),
    staleTime: 30_000,
    retry: 1,
  });
}

// --- companies ----------------------------------------------------------------

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: () => api.get<Company[]>("/api/v1/companies"),
  });
}

/** Newest document-derived company, or the first preloaded company. */
export function useFeaturedCompany() {
  return useQuery({
    queryKey: ["featured-company"],
    queryFn: () => api.get<{ slug: string | null }>("/api/v1/companies/featured"),
  });
}

export function useCompany(slug: string | undefined) {
  return useQuery({
    queryKey: ["company", slug],
    queryFn: () => api.get<CompanyDetail>(`/api/v1/companies/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useCompanyOverview(slug: string | undefined) {
  return useQuery({
    queryKey: ["overview", slug],
    queryFn: () => api.get<Overview>(`/api/v1/analytics/${slug}/overview`),
    enabled: Boolean(slug),
  });
}

export function useCompanyTrends(slug: string | undefined, metrics?: string) {
  return useQuery({
    queryKey: ["trends", slug, metrics],
    queryFn: () =>
      api.get<Trend[]>(`/api/v1/analytics/${slug}/trends`, { query: { metrics } }),
    enabled: Boolean(slug),
  });
}

export function useCompanyRatios(slug: string | undefined) {
  return useQuery({
    queryKey: ["ratios", slug],
    queryFn: () => api.get<RatioRow[]>(`/api/v1/analytics/${slug}/ratios`),
    enabled: Boolean(slug),
  });
}

export function useCompanyRisks(slug: string | undefined) {
  return useQuery({
    queryKey: ["risks", slug],
    queryFn: () => api.get<RiskOut>(`/api/v1/analytics/${slug}/risks`),
    enabled: Boolean(slug),
  });
}

/** AI narrative over the latest KPI block (Groq). */
export function useCompanyInsights(slug: string | undefined) {
  return useQuery({
    queryKey: ["insights", slug],
    queryFn: () => api.get<CompanyInsight>(`/api/v1/analytics/${slug}/insights`),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

// --- documents ------------------------------------------------------------------

export function useDocuments() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<DocumentRecord[]>("/api/v1/documents"),
    // Ingestion runs in a FastAPI background task, so the upload response is
    // always "pending". Poll until every document reaches a terminal state.
    refetchInterval: (query) => {
      const docs = query.state.data as DocumentRecord[] | undefined;
      return docs?.some((d) => d.status === "pending" || d.status === "processing")
        ? 2000
        : false;
    },
  });

  // Company rows are created during ingestion, so refresh the catalogue once
  // the background task reaches a terminal state.
  useEffect(() => {
    const docs = query.data;
    if (!docs?.length) return;
    if (docs.some((d) => d.status === "pending" || d.status === "processing")) return;
    void queryClient.invalidateQueries({ queryKey: ["companies"] });
    void queryClient.invalidateQueries({ queryKey: ["featured-company"] });
  }, [query.data, queryClient]);

  return query;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("sync", "false");
      return api.post<{ document: DocumentRecord }>(
        "/api/v1/documents",
        form,
        { body: form } as never,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
      void queryClient.invalidateQueries({ queryKey: ["featured-company"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/documents/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-stats"] });
    },
  });
}

export function useReprocessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ status: string }>(`/api/v1/documents/${id}/reprocess`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
      void queryClient.invalidateQueries({ queryKey: ["featured-company"] });
    },
  });
}

// --- chat --------------------------------------------------------------------------

export function useSendChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      message: string;
      conversation_id?: string | null;
      company_slugs?: string[];
      workspace_id: string;
    }) => api.post<ChatResponse>("/api/v1/chat", payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({
        queryKey: ["messages", data.conversation_id],
      });
    },
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/api/v1/chat/conversations"),
  });
}

export function useMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      api.get<Message[]>(`/api/v1/chat/conversations/${conversationId}/messages`),
    enabled: Boolean(conversationId),
  });
}

// --- evaluations ----------------------------------------------------------------------

export function useEvaluationRuns() {
  return useQuery({
    queryKey: ["eval-runs"],
    queryFn: () => api.get<EvalRun[]>("/api/v1/evaluations/runs"),
    refetchInterval: 15_000,
  });
}

export function useRunEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { dataset_name?: string; limit?: number }) =>
      api.post<EvalRun>("/api/v1/evaluations/run", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["eval-runs"] });
    },
  });
}
