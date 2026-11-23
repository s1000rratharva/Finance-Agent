"""Document ingestion schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    status: str
    error: str | None = None
    chunk_count: int = 0
    created_at: datetime


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chunk_index: int
    text: str
    page: int | None = None
    section: str | None = None


class IngestionResult(BaseModel):
    document_id: UUID
    status: str
    chunks: int = 0
    tables_detected: int = 0
    message: str | None = None


class UploadResponse(BaseModel):
    document: DocumentOut
    ingestion: IngestionResult | None = Field(
        default=None, description="Populated when synchronous ingestion is enabled"
    )
