"""RAGAS evaluation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EvalDatasetRow(BaseModel):
    question: str
    reference: str
    context: list[str] = Field(default_factory=list)
    answer: str | None = None


class EvalRunRequest(BaseModel):
    dataset_name: str = "default"
    limit: int = Field(default=20, ge=1, le=500)
    workspace_id: UUID | None = None


class EvalScores(BaseModel):
    faithfulness: float | None = None
    answer_relevancy: float | None = None
    context_precision: float | None = None
    context_recall: float | None = None
    factual_correctness: float | None = None


class EvalRunOut(BaseModel):
    id: UUID
    dataset_name: str
    status: str
    scores: EvalScores = Field(default_factory=EvalScores)
    sample_count: int = 0
    created_at: datetime
    error: str | None = None
