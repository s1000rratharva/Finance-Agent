"""Company + financial statement schemas (also power the chart components)."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StatementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fiscal_year: int
    period: str
    as_of: date | None = None
    source: str | None = None

    revenue: float | None = None
    cost_of_revenue: float | None = None
    gross_profit: float | None = None
    operating_expenses: float | None = None
    operating_profit: float | None = None
    interest_expense: float | None = None
    depreciation_amortization: float | None = None
    profit_before_tax: float | None = None
    tax_expense: float | None = None
    net_profit: float | None = None
    eps: float | None = None

    total_assets: float | None = None
    total_liabilities: float | None = None
    total_equity: float | None = None
    total_debt: float | None = None
    cash_and_equivalents: float | None = None
    current_assets: float | None = None
    current_liabilities: float | None = None
    inventory: float | None = None
    working_capital: float | None = None

    operating_cash_flow: float | None = None
    investing_cash_flow: float | None = None
    financing_cash_flow: float | None = None
    capex: float | None = None
    free_cash_flow: float | None = None

    market_cap: float | None = None
    dividend_payout_ratio: float | None = None


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    ticker: str
    name: str
    sector: str | None = None
    industry: str | None = None
    exchange: str | None = None
    currency: str = "INR"
    logo_url: str | None = None
    description: str | None = None


class CompanyDetail(CompanyOut):
    statements: list[StatementOut] = []


class DerivedMetric(BaseModel):
    key: str
    label: str
    unit: str
    fiscal_year: int
    value: float | None = None


class ComparisonOut(BaseModel):
    metric: str
    unit: str
    companies: list[CompanyOut]
    series: list[dict]  # [{fiscal_year, values: {slug: float|null}}]
    derived: list[DerivedMetric] = []


class RiskFlag(BaseModel):
    key: str
    label: str
    severity: str  # low | medium | high
    detail: str
    value: float | None = None
