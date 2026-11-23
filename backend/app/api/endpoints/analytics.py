"""Analytics endpoints: KPI overview, trends, risk, AI insights."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.core.exceptions import NotFoundError
from app.db.models.financial import FinancialStatement
from app.schemas.analytics import KPI, OverviewOut, RatioOut, RiskOut, TrendOut, TrendPoint
from app.services.financials import calculator as calc
from app.services.financials import queries as fin_queries
from app.services.financials.risk import assess_risk
from app.services.llm.groq_client import get_groq_client
from app.services.llm.prompts import FINANCIAL_INSIGHT_SYSTEM

router = APIRouter()

_KPI_COLUMNS = [
    ("revenue", "Revenue", "currency"),
    ("net_profit", "Net profit", "currency"),
    ("operating_profit", "Operating profit", "currency"),
    ("total_debt", "Total debt", "currency"),
    ("operating_cash_flow", "Operating cash flow", "currency"),
    ("eps", "EPS", "per share"),
]


@router.get("/{slug}/overview", response_model=OverviewOut)
async def overview(slug: str, session: DbSession) -> OverviewOut:
    company, statements = await fin_queries.get_statements_by_slug(session, slug)
    if not statements:
        raise NotFoundError(f"No financial statements for '{slug}'")

    latest = statements[-1]
    previous = statements[-2] if len(statements) > 1 else None

    kpis: list[KPI] = []
    for column, label, unit in _KPI_COLUMNS:
        value = getattr(latest, column)
        prev_value = getattr(previous, column) if previous else None
        kpis.append(
            KPI(
                key=column,
                label=label,
                value=float(value) if value is not None else None,
                unit=unit,
                delta_pct=(
                    round(calc.growth_rate(_f(value), _f(prev_value)) * 100, 2)
                    if value is not None and prev_value is not None
                    else None
                ),
                fiscal_year=latest.fiscal_year,
            )
        )

    return OverviewOut(
        company=company.name,
        ticker=company.ticker,
        currency=company.currency,
        fiscal_year=latest.fiscal_year,
        kpis=kpis,
    )


@router.get("/{slug}/trends", response_model=list[TrendOut])
async def trends(
    slug: str,
    session: DbSession,
    metrics: str | None = Query(
        default="revenue,net_profit,total_debt,operating_expenses",
        description="Comma-separated statement columns",
    ),
) -> list[TrendOut]:
    _, statements = await fin_queries.get_statements_by_slug(session, slug)
    labels = {
        "revenue": "Revenue",
        "net_profit": "Net profit",
        "operating_profit": "Operating profit",
        "gross_profit": "Gross profit",
        "operating_expenses": "Operating expenses",
        "total_debt": "Total debt",
        "total_assets": "Total assets",
        "total_equity": "Total equity",
        "cash_and_equivalents": "Cash & equivalents",
        "operating_cash_flow": "Operating cash flow",
        "capex": "Capex",
        "free_cash_flow": "Free cash flow",
        "eps": "EPS",
    }

    out: list[TrendOut] = []
    for metric in [m.strip() for m in metrics.split(",") if m.strip()]:
        if not hasattr(FinancialStatement, metric) and metric not in labels:
            continue
        out.append(
            TrendOut(
                metric=metric,
                label=labels.get(metric, metric.replace("_", " ").title()),
                unit="per share" if metric == "eps" else "INR cr",
                points=[
                    TrendPoint(
                        fiscal_year=s.fiscal_year,
                        value=_f(getattr(s, metric, None)),
                    )
                    for s in statements
                ],
            )
        )
    return out


@router.get("/{slug}/ratios", response_model=list[RatioOut])
async def ratios(slug: str, session: DbSession) -> list[RatioOut]:
    _, statements = await fin_queries.get_statements_by_slug(session, slug)
    out: list[RatioOut] = []
    for statement in statements:
        ratios_map = {
            "gross_margin": calc.margin(_f(statement.gross_profit), _f(statement.revenue)),
            "operating_margin": calc.margin(
                _f(statement.operating_profit), _f(statement.revenue)
            ),
            "net_margin": calc.margin(_f(statement.net_profit), _f(statement.revenue)),
            "current_ratio": calc.current_ratio(
                _f(statement.current_assets), _f(statement.current_liabilities)
            ),
            "quick_ratio": calc.quick_ratio(
                _f(statement.current_assets),
                _f(statement.inventory),
                _f(statement.current_liabilities),
            ),
            "debt_to_equity": calc.debt_to_equity(
                _f(statement.total_debt), _f(statement.total_equity)
            ),
            "interest_coverage": calc.interest_coverage(
                _f(statement.operating_profit), _f(statement.interest_expense)
            ),
            "roe": calc.roe(_f(statement.net_profit), _f(statement.total_equity)),
            "roa": calc.roa(_f(statement.net_profit), _f(statement.total_assets)),
            "asset_turnover": calc.margin(
                _f(statement.revenue), _f(statement.total_assets)
            ),
        }
        out.append(
            RatioOut(
                fiscal_year=statement.fiscal_year,
                ratios={k: (round(v, 4) if v is not None else None) for k, v in ratios_map.items()},
            )
        )
    return out


@router.get("/{slug}/risks", response_model=RiskOut)
async def risks(slug: str, session: DbSession) -> RiskOut:
    company, statements = await fin_queries.get_statements_by_slug(session, slug)
    if not statements:
        raise NotFoundError(f"No financial statements for '{slug}'")

    latest = statements[-1]
    previous = statements[-2] if len(statements) > 1 else None
    flags, summary = assess_risk(company.name, latest, previous)
    return RiskOut(
        company=company.name,
        fiscal_year=latest.fiscal_year,
        flags=[f.model_dump(mode="json") for f in flags],
        summary=summary,
    )


@router.get("/{slug}/insights")
async def insights(slug: str, session: DbSession) -> dict:
    """AI-generated narrative over the latest KPI block (Groq)."""
    company, statements = await fin_queries.get_statements_by_slug(session, slug)
    if not statements:
        raise NotFoundError(f"No financial statements for '{slug}'")

    latest = statements[-1]
    kpis = {
        str(column): _f(getattr(latest, column))
        for column, _, _ in _KPI_COLUMNS
    }
    client = get_groq_client()
    if not client.available():
        return {"company": company.name, "insight": None,
                "note": "GROQ_API_KEY is not configured"}

    text = await client.chat(
        system=FINANCIAL_INSIGHT_SYSTEM,
        user=(
            f"Company: {company.name} ({company.ticker}), FY{latest.fiscal_year}\n"
            f"Currency: {company.currency} crore\nKPIs: {kpis}"
        ),
        temperature=0.3,
        max_tokens=700,
    )
    return {"company": company.name, "fiscal_year": latest.fiscal_year, "insight": text}


def _f(value) -> float | None:
    return float(value) if value is not None else None
