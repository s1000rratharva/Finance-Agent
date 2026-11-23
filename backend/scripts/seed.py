"""Seed PostgreSQL with the preloaded company fundamentals.

Usage (from the `backend/` directory):

    python -m scripts.seed            # upsert everything in data/companies/
    python -m scripts.seed --check    # report what exists, change nothing

Idempotent: companies upsert by `slug`, statements by `(company_id, fiscal_year)`.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "companies"

from sqlalchemy import select  # noqa: E402

from app.core.logging import get_logger, setup_logging  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.models import Company, FinancialStatement  # noqa: E402
from app.db.session import dispose_engine, get_engine, get_session_factory  # noqa: E402

log = get_logger("scripts.seed")

# Columns present on FinancialStatement that come straight from the JSON rows.
SCALAR_FIELDS = {
    "fiscal_year", "period", "as_of", "source",
    "revenue", "cost_of_revenue", "gross_profit", "operating_expenses",
    "operating_profit", "interest_expense", "depreciation_amortization",
    "profit_before_tax", "tax_expense", "net_profit", "eps",
    "total_assets", "total_liabilities", "total_equity", "total_debt",
    "cash_and_equivalents", "current_assets", "current_liabilities", "inventory",
    "working_capital",
    "operating_cash_flow", "investing_cash_flow", "financing_cash_flow",
    "capex", "free_cash_flow",
    "market_cap", "dividend_payout_ratio",
}


def load_company_files() -> list[dict]:
    if not DATA_DIR.exists():
        log.warning("seed.no_data_dir", path=str(DATA_DIR))
        return []
    companies = []
    for path in sorted(DATA_DIR.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            log.error("seed.invalid_json", path=path.name, error=str(exc))
            continue
        companies.append(payload)
    return companies


async def seed(check_only: bool = False) -> int:
    setup_logging()

    # Ensure schema exists (Alembic migrations replace this in production).
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    companies = load_company_files()
    if not companies:
        log.error("seed.no_companies", directory=str(DATA_DIR))
        return 1

    async with get_session_factory()() as session:
        created_companies = 0
        created_statements = 0

        for payload in companies:
            slug = payload["slug"]
            company = (
                await session.execute(select(Company).where(Company.slug == slug))
            ).scalar_one_or_none()

            if company is None:
                company = Company(
                    slug=slug,
                    ticker=payload["ticker"],
                    name=payload["name"],
                    sector=payload.get("sector"),
                    industry=payload.get("industry"),
                    exchange=payload.get("exchange"),
                    currency=payload.get("currency", "INR"),
                    description=payload.get("description"),
                )
                session.add(company)
                await session.flush()
                created_companies += 1
            else:
                company.name = payload["name"]
                company.sector = payload.get("sector", company.sector)
                company.industry = payload.get("industry", company.industry)
                company.description = payload.get("description", company.description)

            for row in payload.get("statements", []):
                year = int(row["fiscal_year"])
                existing = (
                    await session.execute(
                        select(FinancialStatement).where(
                            FinancialStatement.company_id == company.id,
                            FinancialStatement.fiscal_year == year,
                        )
                    )
                ).scalar_one_or_none()

                values = {k: row[k] for k in SCALAR_FIELDS if k in row}
                values["source"] = payload.get("source")

                # JSON carries ISO date strings; the Date column needs date objects.
                as_of = values.get("as_of")
                if isinstance(as_of, str) and as_of:
                    from datetime import date as _date

                    values["as_of"] = _date.fromisoformat(as_of)
                elif not as_of:
                    values["as_of"] = None

                if existing is None:
                    if check_only:
                        continue
                    session.add(
                        FinancialStatement(company_id=company.id, **values)
                    )
                    created_statements += 1
                else:
                    if check_only:
                        continue
                    for key, value in values.items():
                        setattr(existing, key, value)

            log.info(
                "seed.company",
                slug=slug,
                statements=len(payload.get("statements", [])),
            )

        if check_only:
            total = (await session.execute(select(Company))).scalars().all()
            log.info("seed.check", companies=len(total))
        else:
            await session.commit()
            log.info(
                "seed.done",
                companies_created=created_companies,
                statements_created=created_statements,
            )

    await dispose_engine()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed FinSight sample data")
    parser.add_argument("--check", action="store_true", help="Report only, write nothing")
    args = parser.parse_args()
    return asyncio.run(seed(check_only=args.check))


if __name__ == "__main__":
    sys.exit(main())
