"""Embedding providers.

Default: Chroma's built-in ONNX MiniLM (no API key, zero-config).
Optional: Groq embeddings when `GROQ_EMBED_MODEL` is set.
"""

from __future__ import annotations

import asyncio
from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger("rag.embeddings")


class EmbeddingProvider:
    """Thin, pluggable interface so swapping models never touches call sites."""

    def __init__(self) -> None:
        self._model: object | None = None
        self._uses_groq = bool(settings.groq_embed_model)

    @property
    def dimension(self) -> int | None:
        return None  # resolved lazily by the store

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if self._uses_groq:
            return await asyncio.to_thread(self._groq_embed, texts, "documents")
        return await asyncio.to_thread(self._local_embed, texts)

    async def embed_query(self, text: str) -> list[float]:
        if self._uses_groq:
            return (await asyncio.to_thread(self._groq_embed, [text], "query"))[0]
        return (await asyncio.to_thread(self._local_embed, [text]))[0]

    # --- local (Chroma default ONNX model) ------------------------------------
    def _local_embed(self, texts: list[str]) -> list[list[float]]:
        # Chroma applies its default embedding function server-side when we
        # pass raw text, so the "provider" here is really the Chroma default.
        # We keep this method so the interface stays honest for local runs.
        raise NotImplementedError(
            "Local embedding is delegated to Chroma's default embedding function; "
            "pass `documents` (text) instead of vectors to VectorStore."
        )

    # --- Groq ------------------------------------------------------------------
    def _groq_embed(self, texts: list[str], input_type: str) -> list[list[float]]:
        from groq import Groq

        client = Groq(api_key=settings.groq_api_key)
        response = client.embeddings.create(
            model=settings.groq_embed_model,
            input=texts,
            input_type=input_type,
        )
        return [item.embedding for item in response.data]


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    return EmbeddingProvider()
