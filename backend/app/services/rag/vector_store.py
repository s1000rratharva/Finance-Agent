"""ChromaDB vector store.

Design notes
------------
* Every collection is keyed by `workspace_id` so tenant isolation is enforced
  at the store level (workspace A can never query workspace B's collection).
* Chroma is synchronous; all public methods are async and hop to a thread so
  the event loop is never blocked.
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

import chromadb
from chromadb.api.models.Collection import Collection

from app.core.config import settings
from app.core.logging import get_logger
from app.db.models.document import DocumentChunk

log = get_logger("rag.vector_store")


class VectorStore:
    def __init__(self) -> None:
        self._client: chromadb.ClientAPI | None = None

    @property
    def client(self) -> chromadb.ClientAPI:
        if self._client is None:
            self._client = chromadb.HttpClient(
                host=settings.chroma_host, port=settings.chroma_port
            )
        return self._client

    def collection_name(self, workspace_id: str) -> str:
        return f"ws_{workspace_id}"

    def _collection(self, workspace_id: str) -> Collection:
        return self.client.get_or_create_collection(
            name=self.collection_name(workspace_id),
            metadata={"hnsw:space": "cosine", "workspace": workspace_id},
        )

    # --- writes ---------------------------------------------------------------

    async def upsert_chunks(
        self,
        workspace_id: str,
        chunks: list[DocumentChunk],
        *,
        document_name: str,
        embeddings: list[list[float]] | None = None,
    ) -> int:
        """Mirror Postgres chunks into Chroma. Returns number upserted."""

        def _run() -> int:
            if not chunks:
                return 0
            collection = self._collection(workspace_id)
            ids = [str(c.id) for c in chunks]
            documents = [c.text for c in chunks]
            metadatas: list[dict[str, Any]] = [
                {
                    "workspace_id": workspace_id,
                    "document_id": str(c.document_id),
                    "document_name": document_name,
                    "chunk_index": c.chunk_index,
                    "page": c.page or -1,
                    "section": c.section or "",
                    **{k: v for k, v in (c.metadata_json or {}).items() if _is_scalar(v)},
                }
                for c in chunks
            ]
            kwargs: dict[str, Any] = {}
            if embeddings is not None:
                kwargs["embeddings"] = embeddings
            collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                **kwargs,
            )
            return len(ids)

        count = await asyncio.to_thread(_run)
        log.info("rag.upsert", workspace=workspace_id, chunks=count, document=document_name)
        return count

    async def query(
        self,
        workspace_id: str,
        *,
        query_texts: list[str],
        n_results: int = 12,
        where: dict | None = None,
    ) -> list[dict]:
        """Cosine ANN search restricted to a single workspace collection."""

        def _run() -> list[dict]:
            collection = self._collection(workspace_id)
            filter_where = dict(where or {})
            filter_where["workspace_id"] = workspace_id
            result = collection.query(
                query_texts=query_texts,
                n_results=n_results,
                where=filter_where,
                include=["documents", "metadatas", "distances"],
            )
            out: list[dict] = []
            ids = result.get("ids") or [[]]
            docs = result.get("documents") or [[]]
            metas = result.get("metadatas") or [[]]
            dists = result.get("distances") or [[]]
            for i, chunk_id in enumerate(ids[0]):
                out.append(
                    {
                        "id": chunk_id,
                        "text": docs[0][i],
                        "metadata": metas[0][i] or {},
                        # cosine distance -> similarity
                        "score": 1.0 - (dists[0][i] or 0.0),
                    }
                )
            return out

        return await asyncio.to_thread(_run)

    async def delete_document(self, workspace_id: str, document_id: str) -> None:
        def _run() -> None:
            collection = self._collection(workspace_id)
            collection.delete(where={"document_id": document_id})

        await asyncio.to_thread(_run)

    async def count(self, workspace_id: str) -> int:
        return await asyncio.to_thread(lambda: self._collection(workspace_id).count())


def _is_scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool))


_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store


def new_id() -> str:
    return str(uuid.uuid4())
