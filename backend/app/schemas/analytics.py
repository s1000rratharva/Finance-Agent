"""Analytics schemas: overview, trends, ratios, risk."""

from pydantic import BaseModel, Field


class KPI(BaseModel):
    key: str
    label: str
    value: float | None = None
    unit: str = "currency"
    delta_pct: float | None = None
    fiscal_year: int | None = None


class OverviewOut(BaseModel):
    company: str
    ticker: str
    currency: str
    fiscal_year: int
    kpis: list[KPI] = Field(default_factory=list)


class TrendPoint(BaseModel):
    fiscal_year: int
    value: float | None = None


class TrendOut(BaseModel):
    metric: str
    label: str
    unit: str
    points: list[TrendPoint] = Field(default_factory=list)


class RatioOut(BaseModel):
    fiscal_year: int
    ratios: dict[str, float | None] = Field(default_factory=dict)


class RiskOut(BaseModel):
    company: str
    fiscal_year: int
    flags: list[dict] = Field(default_factory=list)
    summary: str | None = None
