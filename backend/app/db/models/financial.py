"""Relational store for structured financial fundamentals.

Seeded from annual reports (and later from uploaded filings) so analytics can
be answered with SQL instead of brittle LLM arithmetic.
"""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.db.base import Base, TimestampMixin


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(120), nullable=True)
    exchange: Mapped[str | None] = mapped_column(String(40), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    statements = relationship(
        "FinancialStatement", back_populates="company", cascade="all, delete-orphan"
    )


class FinancialStatement(Base, TimestampMixin):
    """One audited fiscal-year snapshot.

    All monetary values are stored in the company's reporting currency
    (INR crore for the preloaded Indian names) as plain floats.
    """

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_year", "period", name="uq_company_year_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    fiscal_year: Mapped[int] = mapped_column(index=True, nullable=False)  # FY ending March
    period: Mapped[str] = mapped_column(String(10), default="FY", nullable=False)  # FY | Q1..Q4
    as_of: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # --- P&L ---
    revenue: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    cost_of_revenue: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    gross_profit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    operating_expenses: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    operating_profit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    interest_expense: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    depreciation_amortization: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    profit_before_tax: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    tax_expense: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    net_profit: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    eps: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    # --- Balance sheet ---
    total_assets: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    total_liabilities: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    total_equity: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    total_debt: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    cash_and_equivalents: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    current_assets: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    current_liabilities: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    inventory: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    working_capital: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)

    # --- Cash flow ---
    operating_cash_flow: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    investing_cash_flow: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    financing_cash_flow: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    capex: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    free_cash_flow: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)

    # --- Market ---
    market_cap: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    dividend_payout_ratio: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)

    company = relationship("Company", back_populates="statements")


class MetricDefinition(Base, TimestampMixin):
    """Registry of derived metrics the Python calculator is allowed to compute."""

    __tablename__ = "metric_definitions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    unit: Mapped[str] = mapped_column(String(40), default="ratio", nullable=False)
    formula: Mapped[str] = mapped_column(String(512), nullable=False)  # python expr over statement cols
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
