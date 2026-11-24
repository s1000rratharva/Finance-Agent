"""End-to-end ingestion pipeline.

    upload -> store object -> load -> extract -> persist chunks -> embed

Text chunks land in Postgres (source of truth) and Chroma (ANN index).
Numeric facts are held for the SQL-parsing step (phase 2 of the build) and
are surfaced through ``IngestionResult`` for now.
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models.document import Document, DocumentChunk
from app.schemas.document import IngestionResult
from app.services.ingestion.company import (
    CompanyLinkResult,
    register_company_from_document,
)
from app.services.ingestion.extractors import extract
from app.services.ingestion.loaders import load_document
from app.services.rag.bm25 import get_bm25_index
from app.services.rag.vector_store import get_vector_store

log = get_logger("ingestion.pipeline")


async def ingest_document(
    session: AsyncSession,
    document_id: uuid.UUID,
    local_path: Path,
    *,
    workspace_id: str,
    document_name: str,
) -> IngestionResult:
    document = (
        await session.execute(select(Document).where(Document.id == document_id))
    ).scalar_one_or_none()
    if document is None:
        return IngestionResult(
            document_id=document_id, status="failed", message="Document not found"
        )

    document.status = "processing"
    document.error = None
    # Commit immediately so the UI can show "processing" while extraction runs.
    await session.commit()

    try:
        # 1. Load -------------------------------------------------------------
        pages = await asyncio.to_thread(load_document, local_path)
        if not pages:
            raise ValueError("No extractable content found in file")

        # 2. Extract ----------------------------------------------------------
        extraction = await asyncio.to_thread(
            extract, pages, document_id=str(document_id)
        )
        if not extraction.chunks:
            raise ValueError("Extraction produced no text chunks")

        # 2b. Register the reporting company for Overview / Companies pages --
        company_link = CompanyLinkResult()
        try:
            company_link = await register_company_from_document(
                session,
                document_name=document_name,
                pages=pages,
                facts=extraction.facts,
            )
        except Exception as exc:
            # RAG indexing is still useful even if company detection fails.
            log.warning(
                "ingestion.company_registration_failed",
                error=str(exc),
                document=document_name,
            )

        # 3. Persist text chunks ---------------------------------------------
        # Reprocessing replaces the previous extraction; leaving old rows would
        # duplicate every citation and stale embeddings in Chroma.
        await session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
        )

        chunk_rows: list[DocumentChunk] = []
        for item in extraction.chunks:
            metadata = {
                **item.chunk.metadata,
                "document_name": document_name,
                "source_kind": item.source_kind,
            }
            if company_link.company_slug:
                metadata.update(
                    {
                        "company_slug": company_link.company_slug,
                        "company_name": company_link.company_name,
                    }
                )
            chunk_rows.append(
                DocumentChunk(
                    id=uuid.uuid4(),
                    document_id=document_id,
                    workspace_id=document.workspace_id,
                    chunk_index=item.chunk.index,
                    text=item.chunk.text,
                    page=item.chunk.page,
                    section=item.chunk.section,
                    token_count=item.chunk.token_count,
                    metadata_json=metadata,
                )
            )
        session.add_all(chunk_rows)
        document.chunk_count = len(chunk_rows)
        document.status = "ready"
        document.error = None
        document.metadata_json = {
            **(document.metadata_json or {}),
            "tables_detected": extraction.tables_detected,
            "numeric_facts": len(extraction.facts),
            "pages": len(pages),
            "company_slug": company_link.company_slug,
            "company_name": company_link.company_name,
            "fiscal_year": company_link.fiscal_year,
            "statements_created": company_link.statements_created,
        }
        await session.flush()

        # 4. Vector index -----------------------------------------------------
        try:
            store = get_vector_store()
            await store.delete_document(str(workspace_id), str(document_id))
            await store.upsert_chunks(
                str(workspace_id),
                chunk_rows,
                document_name=document_name,
            )
        except Exception as exc:
            # Postgres still holds the truth; Chroma can be rebuilt.
            log.warning("ingestion.vector_sync_failed", error=str(exc))

        # 5. Refresh BM25 -----------------------------------------------------
        get_bm25_index().invalidate(str(workspace_id))

        log.info(
            "ingestion.complete",
            document=str(document_id),
            chunks=len(chunk_rows),
            tables=extraction.tables_detected,
            facts=len(extraction.facts),
            company=company_link.company_slug,
            statements=company_link.statements_created,
        )
        message = f"Ingested {len(chunk_rows)} chunks from {len(pages)} page(s)"
        if company_link.company_name:
            message += f"; registered {company_link.company_name}"
        return IngestionResult(
            document_id=document_id,
            status="ready",
            chunks=len(chunk_rows),
            tables_detected=extraction.tables_detected,
            message=message,
            company_slug=company_link.company_slug,
            company_name=company_link.company_name,
            statements_created=company_link.statements_created,
        )
    except Exception as exc:
        log.exception("ingestion.failed", document=str(document_id))
        document.status = "failed"
        document.error = str(exc)[:2000]
        await session.flush()
        return IngestionResult(
            document_id=document_id, status="failed", message=str(exc)
        )
