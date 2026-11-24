"""FinSight AI API entrypoint."""

import asyncio
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app import __version__
from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.db.models.document import Document, DocumentChunk
from app.db.session import dispose_engine, get_session_factory

log = get_logger("app")


async def _resume_pending_ingestions() -> None:
    """Re-queue uploads interrupted by a restart (background tasks are in-process)."""
    from app.services.ingestion.pipeline import ingest_document

    factory = get_session_factory()
    async with factory() as session:
        rows = (
            await session.execute(
                select(Document).where(Document.status.in_(("pending", "processing")))
            )
        ).scalars().all()
        for doc in rows:
            path = settings.upload_dir / doc.storage_key
            if not path.exists():
                doc.status = "failed"
                doc.error = "Stored file is no longer available for reprocessing"
                log.warning("ingestion.resume_missing_file", document=str(doc.id))
                continue
            try:
                result = await ingest_document(
                    session,
                    doc.id,
                    path,
                    workspace_id=str(doc.workspace_id),
                    document_name=doc.filename,
                )
                log.info("ingestion.resumed", document=str(doc.id), status=result.status)
            except Exception as exc:
                doc.status = "failed"
                doc.error = str(exc)[:2000]
                log.warning("ingestion.resume_failed", document=str(doc.id), error=str(exc))
        await session.commit()


async def _rebuild_vector_indexes() -> None:
    """Repopulate empty Chroma collections from the Postgres chunk rows.

    Chroma runs with an ephemeral disk on Render's free tier, so a restart can
    leave RAG with no vectors. Postgres is the source of truth for chunks; this
    re-upserts them when a workspace collection is empty. Existing collections
    are left alone, so a warm restart never re-embeds thousands of chunks.
    """
    from app.services.rag.vector_store import get_vector_store

    factory = get_session_factory()
    store = get_vector_store()
    try:
        async with factory() as session:
            workspace_ids = (
                await session.execute(select(DocumentChunk.workspace_id).distinct())
            ).scalars().all()
            for workspace_id in workspace_ids:
                workspace = str(workspace_id)
                try:
                    if await store.count(workspace):
                        continue
                except Exception as exc:
                    log.warning(
                        "rag.rebuild_count_failed", workspace=workspace, error=str(exc)
                    )
                    continue

                chunks = (
                    await session.execute(
                        select(DocumentChunk).where(
                            DocumentChunk.workspace_id == workspace_id
                        )
                    )
                ).scalars().all()
                if not chunks:
                    continue

                by_document: dict[uuid.UUID, list[DocumentChunk]] = defaultdict(list)
                for chunk in chunks:
                    by_document[chunk.document_id].append(chunk)

                filenames = dict(
                    (
                        await session.execute(
                            select(Document.id, Document.filename).where(
                                Document.id.in_(by_document.keys())
                            )
                        )
                    ).all()
                )
                rebuilt = 0
                for document_id, doc_chunks in by_document.items():
                    try:
                        rebuilt += await store.upsert_chunks(
                            workspace,
                            doc_chunks,
                            document_name=filenames.get(document_id, "unknown"),
                        )
                    except Exception as exc:
                        log.warning(
                            "rag.rebuild_upsert_failed",
                            workspace=workspace,
                            document=str(document_id),
                            error=str(exc),
                        )
                log.info(
                    "rag.rebuilt", workspace=workspace, chunks=rebuilt
                )
    except Exception as exc:
        log.warning("rag.rebuild_failed", error=str(exc))


async def _startup_recovery() -> None:
    """Resume interrupted uploads, then rebuild any empty vector indexes."""
    await _resume_pending_ingestions()
    await _rebuild_vector_indexes()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    log.info("finsight.startup", version=__version__, env=settings.environment)
    recovery = asyncio.create_task(_startup_recovery())
    yield
    recovery.cancel()
    await dispose_engine()
    log.info("finsight.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Production-oriented financial research platform: hybrid RAG over "
            "filings and uploaded documents, SQL/Python financial analytics, "
            "agentic task routing and interactive charting."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {"service": settings.app_name, "version": __version__, "docs": "/docs"}

    return app


app = create_app()
