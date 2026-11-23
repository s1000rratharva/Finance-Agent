"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Plus, MessageSquareText, Sparkles } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { CitationPanel, MessageBubble, type ChatTurn } from "@/components/chat/message-bubble";
import { Composer } from "@/components/chat/composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import {
  useConversations,
  useMessages,
  useSendChat,
} from "@/hooks/use-api";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api";
import type { Citation } from "@/lib/types";
import { SUGGESTED_PROMPTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function ChatInner() {
  const searchParams = useSearchParams();
  const { workspace } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sendChat = useSendChat();
  const { data: conversations, isLoading: loadingConversations } = useConversations();
  const { data: history, isLoading: loadingHistory } = useMessages(conversationId);

  const companyParam = searchParams.get("company");
  const promptParam = searchParams.get("q");

  // Load persisted messages when the selected conversation changes.
  useEffect(() => {
    if (!conversationId || !history) return;
    setTurns(
      history.map((message) => ({
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
        citations: message.citations_json ?? [],
        trace: message.trace_json ?? [],
      })),
    );
  }, [conversationId, history]);

  // Deep-link: /chat?q=... pre-fills and sends the first message.
  const autoSent = useRef<string | null>(null);
  useEffect(() => {
    if (!promptParam || autoSent.current === promptParam || !workspace) return;
    autoSent.current = promptParam;
    void handleSend(promptParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptParam, workspace]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      if (!workspace) {
        setError("No active workspace. Create one from the sidebar.");
        return;
      }
      setError(null);
      setBusy(true);
      setActiveCitation(null);

      const userTurn: ChatTurn = { id: `local-${Date.now()}`, role: "user", content: message };
      setTurns((current) => [...current, userTurn]);
      scrollToBottom();

      try {
        const response = await sendChat.mutateAsync({
          message,
          conversation_id: conversationId,
          company_slugs: companyParam ? [companyParam] : [],
          workspace_id: workspace.id,
        });

        setConversationId(response.conversation_id);
        setTurns((current) => [
          ...current,
          {
            id: response.message_id ?? `assistant-${Date.now()}`,
            role: "assistant",
            content: response.answer,
            citations: response.citations,
            trace: response.trace,
            charts: response.charts,
            sql: response.sql,
          },
        ]);
      } catch (err) {
        const text =
          err instanceof ApiError ? err.message : "The request failed. Is the API running?";
        setError(text);
        setTurns((current) => [
          ...current,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: text,
            error: true,
          },
        ]);
      } finally {
        setBusy(false);
        scrollToBottom();
      }
    },
    [workspace, conversationId, companyParam, sendChat, scrollToBottom],
  );

  const latestCitations: Citation[] = [...turns]
    .reverse()
    .find((turn) => turn.role === "assistant" && turn.citations?.length)?.citations ?? [];

  const selectCitation = (citation: Citation) => {
    setActiveCitation(citation.index);
    const element = document.getElementById(`source-${citation.index}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const startNew = () => {
    setConversationId(null);
    setTurns([]);
    setActiveCitation(null);
    setError(null);
  };

  return (
    <AppShell
      title="Research chat"
      subtitle="Agentic RAG with hybrid search, reranking and page-level citations"
      actions={
        <Button size="sm" variant="outline" icon={Plus} onClick={startNew}>
          New thread
        </Button>
      }
    >
      <div className="grid h-full gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Conversation list */}
        <aside className="hidden flex-col gap-2 xl:flex">
          <p className="label-caps px-1">Threads</p>
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {loadingConversations ? (
              <LoadingState label="Loading…" />
            ) : conversations?.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setConversationId(conversation.id)}
                  className={cn(
                    "focus-ring rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    conversation.id === conversationId
                      ? "border-brand-500/40 bg-brand-500/8 text-brand-300"
                      : "border-line bg-surface-900 text-ink-300 hover:border-line-strong",
                  )}
                >
                  <span className="block truncate">{conversation.title}</span>
                </button>
              ))
            ) : (
              <p className="px-1 text-[11px] leading-relaxed text-ink-400">
                No threads yet. Your conversations will appear here.
              </p>
            )}
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto pr-1"
            style={{ maxHeight: "calc(100vh - 220px)" }}
          >
            {turns.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
                <div className="text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-400">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-4 text-base font-semibold text-ink-100">
                    Ask a research question
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-400">
                    FinSight routes your question, retrieves from workspace documents and
                    preloaded filings, runs SQL/Python where numbers are involved, and answers
                    with citations.
                  </p>
                  {companyParam && (
                    <div className="mt-3 flex justify-center">
                      <Badge tone="brand">Scoped to {companyParam}</Badge>
                    </div>
                  )}
                </div>

                <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      disabled={busy}
                      className="focus-ring rounded-xl border border-line bg-surface-900 p-3 text-left text-xs leading-relaxed text-ink-300 transition-colors hover:border-line-strong hover:text-ink-100 disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <Link
                  href="/documents"
                  className="text-xs text-ink-400 transition-colors hover:text-brand-400"
                >
                  or upload your own filings →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6 py-2">
                {turns.map((turn) => (
                  <div key={turn.id} id={`source-${turn.citations?.[0]?.index ?? ""}`}>
                    <MessageBubble turn={turn} onCitationClick={selectCitation} />
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-3 pl-11 text-xs text-ink-400">
                    <LoadingState label="Retrieving, reranking and reasoning…" />
                  </div>
                )}
                {loadingHistory && conversationId && (
                  <div className="pl-11">
                    <LoadingState label="Loading thread…" />
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mb-2 rounded-lg border border-bear/30 bg-bear/10 px-3 py-2 text-xs text-bear">
              {error}
            </p>
          )}

          <div className="mt-3">
            <Composer
              onSend={handleSend}
              busy={busy}
              disabled={!workspace}
              placeholder={
                companyParam
                  ? `Ask anything about ${companyParam.toUpperCase()}…`
                  : "Ask about revenue, leverage, margins…"
              }
            />
          </div>
        </section>

        {/* Citations */}
        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto xl:flex">
          <CitationPanel
            citations={latestCitations}
            activeIndex={activeCitation}
            onSelect={selectCitation}
          />

          <div className="card p-4">
            <p className="label-caps mb-2">How answers are built</p>
            <ol className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-ink-400">
              <li>1 · Rewrite the query with conversation context</li>
              <li>2 · Route: rag / sql / python / chart / compare / risk</li>
              <li>3 · Dense + BM25 retrieval, fused with RRF</li>
              <li>4 · Rerank, then answer with inline [n] citations</li>
            </ol>
          </div>

          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <MessageSquareText className="h-3 w-3" aria-hidden />
              Workspace isolation is enforced per request — retrieval never crosses tenants.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center">
          <LoadingState label="Loading chat…" />
        </div>
      }
    >
      <ChatInner />
    </Suspense>
  );
}
