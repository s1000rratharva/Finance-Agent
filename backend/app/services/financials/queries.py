"""SQL-backed financial queries.

The LLM never writes raw SQL against production data; it selects from a fixed
set of parameterised query builders defined here.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.financial import Company, FinancialStatement


async def get_company(session: AsyncSession, slug: str) -> Company:
    company = (
        await session.execute(select(Company).where(Company.slug == slug))
    ).scalar_one_or_none()
    if company is None:
        raise NotFoundError(f"Company '{slug}' not found")
    return company


async def list_companies(session: AsyncSession) -> list[Company]:
    result = await session.execute(select(Company).order_by(Company.name))
    return list(result.scalars().all())


async def get_statements(
    session: AsyncSession,
    company_id: UUID,
    *,
    year_from: int | None = None,
    year_to: int | None = None,
) -> list[FinancialStatement]:
    query = (
        select(FinancialStatement)
        .where(FinancialStatement.company_id == company_id)
        .order_by(FinancialStatement.fiscal_year)
    )
    if year_from is not None:
        query = query.where(FinancialStatement.fiscal_year >= year_from)
    if year_to is not None:
        query = query.where(FinancialStatement.fiscal_year <= year_to)
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_statements_by_slug(
    session: AsyncSession, slug: str, **kwargs
) -> tuple[Company, list[FinancialStatement]]:
    company = await get_company(session, slug)
    statements = await get_statements(session, company.id, **kwargs)
    return company, statements


async def compare_metric(
    session: AsyncSession,
    slugs: list[str],
    column: str,
    *,
    year_from: int | None = None,
    year_to: int | None = None,
) -> dict:
    """Return ``{fiscal_year: {slug: value}}`` for a single statement column."""
    if not hasattr(FinancialStatement, column):
        raise NotFoundError(f"Unknown metric column '{column}'")

    series: dict[int, dict[str, float | None]] = {}
    for slug in slugs:
        _, statements = await get_statements_by_slug(
            session, slug, year_from=year_from, year_to=year_to
        )
        for statement in statements:
            series.setdefault(statement.fiscal_year, {})[slug] = _f(
                getattr(statement, column)
            )

    return {
        "years": sorted(series),
        "values": {year: series[year] for year in sorted(series)},
    }


async def latest_statement(
    session: AsyncSession, company_id: UUID
) -> FinancialStatement | None:
    result = await session.execute(
        select(FinancialStatement)
        .where(FinancialStatement.company_id == company_id)
        .order_by(FinancialStatement.fiscal_year.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _f(value) -> float | None:
    return float(value) if value is not None else None
