"""Reranking of fused candidates.

Strategy (in order of preference):
1. Cross-encoder (sentence-transformers) when installed - best quality.
2. LLM pointwise rerank over Groq - good quality, no local model download.
3. Pass-through - keeps the pipeline working with zero extra deps.
"""

from __future__ import annotations

import asyncio
import json

from app.core.config import settings
from app.core.logging import get_logger
from app.services.llm.groq_client import get_groq_client
from app.services.llm.prompts import RERANK_SYSTEM

log = get_logger("rag.reranker")

_CROSS_ENCODER = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class Reranker:
    def __init__(self) -> None:
        self._cross_encoder = None

    def _try_load_cross_encoder(self):
        if self._cross_encoder is not None:
            return self._cross_encoder
        try:
            from sentence_transformers import CrossEncoder  # type: ignore

            self._cross_encoder = CrossEncoder(_CROSS_ENCODER, max_length=512)
        except Exception as exc:  # optional dependency / no network
            log.info("reranker.cross_encoder_unavailable", reason=str(exc)[:200])
            self._cross_encoder = False  # memoise the failure
        return self._cross_encoder

    async def rerank(
        self,
        query: str,
        candidates: list[dict],
        *,
        top_k: int = 6,
        use_llm: bool = True,
    ) -> list[dict]:
        if len(candidates) <= top_k:
            return candidates[:top_k]

        model = self._try_load_cross_encoder()
        if model:
            return await asyncio.to_thread(self._rerank_local, query, candidates, top_k)
        if use_llm and settings.groq_api_key:
            try:
                return await self._rerank_llm(query, candidates, top_k)
            except Exception as exc:
                log.warning("reranker.llm_failed", error=str(exc))
        return candidates[:top_k]

    # --- local cross-encoder ---------------------------------------------------
    def _rerank_local(self, query: str, candidates: list[dict], top_k: int) -> list[dict]:
        pairs = [(query, c["text"][:1500]) for c in candidates]
        scores = self._cross_encoder.predict(pairs)
        for candidate, score in zip(candidates, scores, strict=False):
            candidate["rerank_score"] = float(score)
        ranked = sorted(candidates, key=lambda c: c.get("rerank_score", 0), reverse=True)
        return ranked[:top_k]

    # --- LLM pointwise rerank --------------------------------------------------
    async def _rerank_llm(self, query: str, candidates: list[dict], top_k: int) -> list[dict]:
        client = get_groq_client()
        payload = [
            {"id": i, "text": c["text"][:1200]} for i, c in enumerate(candidates)
        ]
        raw = await client.chat_json(
            system=RERANK_SYSTEM,
            user=f"Query: {query}\n\nCandidates:\n{json.dumps(payload, ensure_ascii=False)}",
            model=settings.groq_chat_model,
            temperature=0.0,
        )
        data = json.loads(raw) if isinstance(raw, str) else raw
        rankings = {
            str(item["id"]): float(item.get("score", 0))
            for item in data.get("rankings", [])
        }
        if not rankings:
            return candidates[:top_k]
        for i, candidate in enumerate(candidates):
            candidate["rerank_score"] = rankings.get(str(i), 0.0)
        ranked = sorted(candidates, key=lambda c: c.get("rerank_score", 0), reverse=True)
        return ranked[:top_k]


_reranker: Reranker | None = None


def get_reranker() -> Reranker:
    global _reranker
    if _reranker is None:
        _reranker = Reranker()
    return _reranker
