"""Workspace schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None


class WorkspaceOut(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    owner_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceStats(BaseModel):
    documents: int = 0
    chunks: int = 0
    conversations: int = 0
