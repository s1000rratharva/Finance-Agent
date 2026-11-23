"""Document upload, listing, chunk browsing and reprocessing."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentUser, CurrentWorkspace, DbSession
from app.core.config import settings
from app.core.exceptions import AppError, NotFoundError, UnprocessableError
from app.db.models.document import Document, DocumentChunk
from app.schemas.common import OkResponse
from app.schemas.document import ChunkOut, DocumentOut, IngestionResult, UploadResponse
from app.services.ingestion.loaders import supported_extensions
from app.services.ingestion.pipeline import ingest_document
from app.services.storage.object_store import get_object_store

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "text/csv": ".csv",
    "text/plain": ".txt",
    "application/octet-stream": "",  # browsers sometimes omit MIME
}


async def _run_ingestion(document_id: uuid.UUID, local_path: Path,
                         workspace_id: str, filename: str) -> None:
    from app.api.deps import open_session

    async for session in open_session():
        await ingest_document(
            session, document_id, local_path,
            workspace_id=workspace_id, document_name=filename,
        )


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    workspace: CurrentWorkspace, session: DbSession, status_filter: str | None = None
) -> list[DocumentOut]:
    query = (
        select(Document)
        .where(Document.workspace_id == workspace.id)
        .order_by(Document.created_at.desc())
    )
    if status_filter:
        query = query.where(Document.status == status_filter)
    result = await session.execute(query)
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    session: DbSession,
    workspace: CurrentWorkspace,
    user: CurrentUser,
    file: Annotated[UploadFile, File(...)],
    sync: Annotated[bool, Form()] = False,
) -> UploadResponse:
    """Upload a PDF / Excel / CSV / Word file into the active workspace."""
    filename = file.filename or "unnamed"
    suffix = Path(filename).suffix.lower()
    if suffix not in supported_extensions():
        raise UnprocessableError(
            f"Unsupported file type '{suffix}'. Allowed: {', '.join(supported_extensions())}"
        )

    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise UnprocessableError(f"File exceeds {settings.max_upload_mb} MB limit")
    if not content:
        raise UnprocessableError("Empty file")

    document_id = uuid.uuid4()
    store = get_object_store()
    key = store.build_key(str(workspace.id), str(document_id), filename)

    document = Document(
        id=document_id,
        workspace_id=workspace.id,
        uploaded_by=user.id,
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_key=key,
        status="pending",
        metadata_json={"workspace_slug": workspace.slug},
    )
    session.add(document)
    await session.flush()

    # Persist the raw bytes (S3/R2 in prod, local disk fallback in dev).
    local_path = settings.upload_dir / key
    await store.upload_file(key, content, content_type=document.content_type)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    if not local_path.exists():
        local_path.write_bytes(content)

    if sync:
        result = await ingest_document(
            session, document_id, local_path,
            workspace_id=str(workspace.id), document_name=filename,
        )
        await session.refresh(document)
        return UploadResponse(
            document=DocumentOut.model_validate(document), ingestion=result
        )

    background.add_task(
        _run_ingestion, document_id, local_path, str(workspace.id), filename
    )
    return UploadResponse(document=DocumentOut.model_validate(document), ingestion=None)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: str, workspace: CurrentWorkspace, session: DbSession
) -> DocumentOut:
    document = await _find_document(document_id, workspace.id, session)
    return DocumentOut.model_validate(document)


@router.get("/{document_id}/chunks", response_model=list[ChunkOut])
async def list_chunks(
    document_id: str, workspace: CurrentWorkspace, session: DbSession
) -> list[ChunkOut]:
    document = await _find_document(document_id, workspace.id, session)
    result = await session.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
    )
    return [ChunkOut.model_validate(c) for c in result.scalars().all()]


@router.post("/{document_id}/reprocess", response_model=IngestionResult)
async def reprocess(
    document_id: str,
    background: BackgroundTasks,
    workspace: CurrentWorkspace,
    session: DbSession,
) -> IngestionResult:
    document = await _find_document(document_id, workspace.id, session)
    local_path = settings.upload_dir / document.storage_key
    if not local_path.exists():
        store = get_object_store()
        try:
            await store.download_to(document.storage_key, local_path)
        except AppError as exc:
            raise NotFoundError("Stored file is no longer available") from exc

    document.status = "pending"
    document.error = None
    await session.flush()

    background.add_task(
        _run_ingestion, document.id, local_path, str(workspace.id), document.filename
    )
    return IngestionResult(
        document_id=document.id, status="pending", message="Reprocessing queued"
    )


@router.delete("/{document_id}", response_model=OkResponse)
async def delete_document(
    document_id: str, workspace: CurrentWorkspace, session: DbSession
) -> OkResponse:
    document = await _find_document(document_id, workspace.id, session)

    try:
        from app.services.rag.vector_store import get_vector_store

        await get_vector_store().delete_document(str(workspace.id), str(document.id))
    except Exception:
        pass  # Chroma cleanup is best-effort; Postgres cascade is authoritative

    try:
        await get_object_store().delete(document.storage_key)
    except Exception:
        pass

    await session.delete(document)
    await session.flush()
    return OkResponse(message="Document deleted")


async def _find_document(document_id: str, workspace_id, session) -> Document:
    try:
        parsed = uuid.UUID(document_id)
    except ValueError as exc:
        raise NotFoundError("Document not found") from exc

    document = (
        await session.execute(
            select(Document).where(Document.id == parsed, Document.workspace_id == workspace_id)
        )
    ).scalar_one_or_none()
    if document is None:
        # Explicitly do not reveal existence across workspaces.
        raise NotFoundError("Document not found")
    return document
