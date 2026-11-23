"""Chat / RAG request + response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: UUID | None = None
    workspace_id: UUID
    company_slugs: list[str] = Field(default_factory=list)
    use_web: bool = False
    top_k: int | None = Field(default=None, ge=1, le=30)


class Citation(BaseModel):
    index: int
    document_id: UUID | None = None
    document_name: str
    page: int | None = None
    section: str | None = None
    snippet: str
    score: float | None = None


class TraceStep(BaseModel):
    name: str  # rewrite | route | retrieve | rerank | calculate | generate
    status: str = "ok"  # ok | skipped | error
    detail: str | None = None
    duration_ms: float | None = None
    payload: dict = Field(default_factory=dict)


class ChartSpec(BaseModel):
    """Declarative chart description rendered by the frontend."""

    chart_type: str  # line | bar | area | pie | kpi
    title: str
    unit: str | None = None
    x_key: str = "fiscal_year"
    series: list[dict] = Field(default_factory=list)  # [{key, label, data: [{x, y}]}]


class ChatResponse(BaseModel):
    conversation_id: UUID
    message_id: UUID | None = None
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    trace: list[TraceStep] = Field(default_factory=list)
    charts: list[ChartSpec] = Field(default_factory=list)
    sql: str | None = None
    created_at: datetime | None = None


class MessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    role: str
    content: str
    citations_json: list = Field(default_factory=list)
    trace_json: list = Field(default_factory=list)
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
