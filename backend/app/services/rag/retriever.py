"""Retriever: the full hybrid-search pipeline.

    rewrite -> dense (Chroma) + sparse (BM25) -> RRF fusion
           -> rerank -> top-k context

Everything is workspace-scoped; there is no code path that searches across
tenants.
"""

from __future__ import annotations

import time

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.chat import TraceStep
from app.services.rag.bm25 import get_bm25_index
from app.services.rag.citations import build_citations
from app.services.rag.hybrid import rrf_fuse
from app.services.rag.query_rewriter import rewrite_query
from app.services.rag.reranker import get_reranker
from app.services.rag.vector_store import get_vector_store
from app.schemas.chat import Citation

log = get_logger("rag.retriever")


class Retriever:
    def __init__(self) -> None:
        self.vector_store = get_vector_store()
        self.bm25 = get_bm25_index()
        self.reranker = get_reranker()

    async def retrieve(
        self,
        query: str,
        *,
        workspace_id: str,
        company_slugs: list[str] | None = None,
        history: list[dict] | None = None,
        top_k: int | None = None,
        trace: list[TraceStep] | None = None,
    ) -> tuple[list[Citation], list[str], list[dict]]:
        """Returns ``(citations, passages, raw_results)``."""
        final_top_k = top_k or settings.final_top_k
        candidate_pool = max(settings.default_top_k, final_top_k * 2)
        trace = trace if trace is not None else []

        # 1. Query rewriting ------------------------------------------------------
        t0 = time.perf_counter()
        rewrite = await rewrite_query(
            query, history=history, company_slugs=company_slugs
        )
        search_query = rewrite["rewritten_query"]
        trace.append(
            TraceStep(
                name="rewrite",
                status="skipped" if rewrite.get("skipped") else "ok",
                detail=search_query if search_query != query else None,
                duration_ms=round((time.perf_counter() - t0) * 1000, 1),
                payload={"original": query},
            )
        )

        where: dict = {}
        if company_slugs:
            where["company_slug"] = {"$in": company_slugs}

        # 2. Dense retrieval ------------------------------------------------------
        t0 = time.perf_counter()
        dense: list[dict] = []
        try:
            dense = await self.vector_store.query(
                workspace_id,
                query_texts=[search_query],
                n_results=candidate_pool,
                where=where or None,
            )
        except Exception as exc:
            log.warning("retrieval.dense_failed", error=str(exc))
            trace.append(
                TraceStep(name="retrieve", status="error", detail=f"dense: {exc}")
            )
        trace.append(
            TraceStep(
                name="retrieve.dense",
                payload={"hits": len(dense)},
                duration_ms=round((time.perf_counter() - t0) * 1000, 1),
            )
        )

        # 3. Sparse retrieval -----------------------------------------------------
        t0 = time.perf_counter()
        sparse: list[dict] = []
        try:
            await self.bm25.ensure_loaded(workspace_id)
            sparse = self.bm25.search(workspace_id, search_query, top_k=candidate_pool)
        except Exception as exc:
            log.warning("retrieval.sparse_failed", error=str(exc))
        trace.append(
            TraceStep(
                name="retrieve.sparse",
                payload={"hits": len(sparse)},
                duration_ms=round((time.perf_counter() - t0) * 1000, 1),
            )
        )

        # 4. Fusion ---------------------------------------------------------------
        fused = rrf_fuse([dense, sparse], weights=[1.0, 0.85], top_k=candidate_pool)
        trace.append(
            TraceStep(name="retrieve.fuse", payload={"candidates": len(fused)})
        )
        if not fused:
            trace.append(TraceStep(name="rerank", status="skipped", detail="no candidates"))
            return [], [], []

        # 5. Rerank ----------------------------------------------------------------
        t0 = time.perf_counter()
        reranked = await self.reranker.rerank(
            search_query, fused, top_k=final_top_k
        )
        trace.append(
            TraceStep(
                name="rerank",
                status="ok",
                detail=f"{len(fused)} -> {len(reranked)}",
                duration_ms=round((time.perf_counter() - t0) * 1000, 1),
            )
        )

        citations, passages = build_citations(reranked)
        return citations, passages, reranked


_retriever: Retriever | None = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever
