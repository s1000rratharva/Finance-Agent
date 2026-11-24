"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Plus, MessageSquareText } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { CitationPanel, MessageBubble, type ChatTurn } from "@/components/chat/message-bubble";
import { Composer } from "@/components/chat/composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/spinner";
import { useConversations, useMessages, useSendChat } from "@/hooks/use-api";
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
      <div className="grid h-full gap-6 xl:grid-cols-[210px_minmax(0,1fr)_290px]">
        {/* Thread rail */}
        <aside className="hidden flex-col xl:flex">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
            <p className="label-caps">Threads</p>
            <span className="num text-[10px] text-ink-400">{conversations?.length ?? 0}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {loadingConversations ? (
              <LoadingState label="Loading…" />
            ) : conversations?.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setConversationId(conversation.id)}
                  className={cn(
                    "focus-ring border-l-2 px-3 py-2.5 text-left text-xs transition-colors",
                    conversation.id === conversationId
                      ? "border-l-brand-500 bg-brand-500/[0.06] text-ink-100"
                      : "border-l-line text-ink-300 hover:border-l-line-strong hover:bg-surface-850",
                  )}
                >
                  <span className="block truncate">{conversation.title}</span>
                </button>
              ))
            ) : (
              <p className="px-1 pt-2 text-[11px] leading-relaxed text-ink-400">
                No threads yet. Your conversations will appear here.
              </p>
            )}
          </div>
        </aside>

        {/* Transcript */}
        <section className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
            <p className="label-caps">Transcript</p>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
              {turns.length} turn{turns.length === 1 ? "" : "s"}
            </span>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto pr-1"
            style={{ maxHeight: "calc(100vh - 250px)" }}
          >
            {turns.length === 0 ? (
              <div className="flex h-full flex-col justify-center gap-8 py-8">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="h-px w-7 bg-brand-500" aria-hidden />
                    <p className="label-caps">Research desk</p>
                  </div>
                  <h2 className="display mt-4 text-4xl">Ask a research question.</h2>
                  <p className="serif-body mt-3 max-w-xl text-ink-300">
                    FinSight routes the question, retrieves from workspace documents and preloaded
                    filings, runs SQL or Python where numbers are involved, and answers with
                    citations.
                  </p>
                  {companyParam && (
                    <div className="mt-4">
                      <Badge tone="brand">Scoped to {companyParam}</Badge>
                    </div>
                  )}
                </div>

                <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      disabled={busy}
                      className="focus-ring group bg-surface-900 p-4 text-left transition-colors hover:bg-surface-850 disabled:opacity-50"
                    >
                      <span className="num text-[10px] text-brand-500">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="mt-2 block font-serif text-sm leading-snug text-ink-200 transition-colors group-hover:text-ink-100">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>

                <Link
                  href="/documents"
                  className="font-mono text-[10px] uppercase tracking-wider text-ink-400 transition-colors hover:text-brand-500"
                >
                  Or upload your own filings →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col">
                {turns.map((turn) => (
                  <div key={turn.id} id={`source-${turn.citations?.[0]?.index ?? ""}`}>
                    <MessageBubble turn={turn} onCitationClick={selectCitation} />
                  </div>
                ))}
                {busy && (
                  <div className="py-4">
                    <LoadingState label="Retrieving, reranking and reasoning…" />
                  </div>
                )}
                {loadingHistory && conversationId && (
                  <LoadingState label="Loading thread…" />
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 border-l-2 border-l-bear bg-bear/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-bear">
              {error}
            </p>
          )}

          <div className="mt-4">
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

        {/* Sources */}
        <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
          <CitationPanel
            citations={latestCitations}
            activeIndex={activeCitation}
            onSelect={selectCitation}
          />

          <div className="card p-4">
            <p className="label-caps mb-3">How answers are built</p>
            <ol>
              {[
                "Rewrite the query with conversation context",
                "Route: rag / sql / python / chart / compare / risk",
                "Dense + BM25 retrieval, fused with RRF",
                "Rerank, then answer with inline [n] citations",
              ].map((step, index) => (
                <li key={step} className="ledger-row items-start font-mono text-[10px] leading-relaxed text-ink-400">
                  <span className="num w-5 shrink-0 pt-px text-brand-500">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card flex items-start gap-2 p-4 text-[11px] leading-relaxed text-ink-400">
            <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0 text-brand-500" aria-hidden />
            Workspace isolation is enforced per request — retrieval never crosses tenants.
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
