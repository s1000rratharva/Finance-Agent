"""BM25 lexical index for the "sparse" half of hybrid search.

The index is built per workspace from Postgres chunks and cached in-process.
It is intentionally simple: swap in PGTRGM/pgvector+tsvector or a managed
search service when the corpus outgrows a single process.
"""

from __future__ import annotations

import asyncio
import math
import re
import time
from collections import defaultdict
from uuid import UUID

from rank_bm25 import BM25Okapi

from app.core.logging import get_logger
from app.db.session import get_session_factory

log = get_logger("rag.bm25")

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?")


class _StableBM25(BM25Okapi):
    """BM25 with a non-negative IDF.

    ``rank_bm25`` replaces negative IDFs with ``epsilon * average_idf``. When a
    fresh workspace has a single document, every term appears in all documents
    and the average is negative too -- so every score is negative and valid
    hits get dropped by the ``score <= 0`` filter. The Robertson/Sparck-Jones
    form below is always positive.
    """

    def _calc_idf(self, nd: dict) -> None:
        super()._calc_idf(nd)
        corpus_size = self.corpus_size
        for term, doc_freq in nd.items():
            self.idf[term] = math.log(
                1 + (corpus_size - doc_freq + 0.5) / (doc_freq + 0.5)
            )


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class BM25Index:
    def __init__(self) -> None:
        self._corpus: dict[str, list[str]] = {}      # workspace_id -> tokenized docs
        self._texts: dict[str, list[str]] = {}        # workspace_id -> raw docs
        self._ids: dict[str, list[str]] = {}          # workspace_id -> chunk ids
        self._meta: dict[str, list[dict]] = {}        # workspace_id -> metadatas
        self._engine: dict[str, BM25Okapi] = {}
        self._loaded_at: dict[str, float] = {}
        self._ttl = 300.0  # seconds

    def invalidate(self, workspace_id: str) -> None:
        self._engine.pop(workspace_id, None)
        self._loaded_at.pop(workspace_id, None)

    async def ensure_loaded(self, workspace_id: str, *, force: bool = False) -> bool:
        loaded_at = self._loaded_at.get(workspace_id)
        if not force and loaded_at and (time.time() - loaded_at) < self._ttl:
            return True

        from sqlalchemy import select

        from app.db.models.document import DocumentChunk

        # The column is a UUID; callers pass string ids. Bind a UUID instance so
        # both SQLite (native UUID bind) and Postgres/asyncpg accept the filter.
        workspace_uuid = (
            workspace_id if isinstance(workspace_id, UUID) else UUID(str(workspace_id))
        )

        async with get_session_factory()() as session:
            rows = (
                await session.execute(
                    select(DocumentChunk)
                    .where(DocumentChunk.workspace_id == workspace_uuid)
                    .order_by(DocumentChunk.created_at)
                )
            ).scalars().all()

        if not rows:
            self._engine.pop(workspace_id, None)
            self._loaded_at[workspace_id] = time.time()
            return False

        self._ids[workspace_id] = [str(r.id) for r in rows]
        self._texts[workspace_id] = [r.text for r in rows]
        self._meta[workspace_id] = [
            {
                "document_id": str(r.document_id),
                "document_name": (r.metadata_json or {}).get("document_name"),
                "chunk_index": r.chunk_index,
                "page": r.page,
                "section": r.section,
            }
            for r in rows
        ]
        self._corpus[workspace_id] = [tokenize(t) for t in self._texts[workspace_id]]
        self._engine[workspace_id] = _StableBM25(self._corpus[workspace_id])
        self._loaded_at[workspace_id] = time.time()
        log.info("bm25.rebuilt", workspace=workspace_id, documents=len(rows))
        return True

    def search(
        self, workspace_id: str, query: str, *, top_k: int = 12
    ) -> list[dict]:
        engine = self._engine.get(workspace_id)
        if engine is None:
            return []
        scores = engine.get_scores(tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        results = []
        for i in ranked:
            if scores[i] <= 0:
                continue
            results.append(
                {
                    "id": self._ids[workspace_id][i],
                    "text": self._texts[workspace_id][i],
                    "metadata": self._meta[workspace_id][i],
                    "score": float(scores[i]),
                }
            )
        return results


_index: BM25Index | None = None


def get_bm25_index() -> BM25Index:
    global _index
    if _index is None:
        _index = BM25Index()
    return _index
