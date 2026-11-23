"""Shared response envelopes and pagination."""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class OkResponse(BaseModel):
    ok: bool = True
    message: str | None = None


class HealthStatus(BaseModel):
    status: str = "ok"
    version: str
    environment: str
    checks: dict[str, str] = Field(default_factory=dict)
