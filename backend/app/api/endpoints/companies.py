"""Company catalogue, statements and cross-company comparison."""

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.core.exceptions import NotFoundError, UnprocessableError
from app.schemas.company import CompanyDetail, CompanyOut, ComparisonOut, StatementOut
from app.services.financials import queries as fin_queries
from app.services.financials import calculator as calc

router = APIRouter()


@router.get("", response_model=list[CompanyOut])
async def list_companies(session: DbSession) -> list[CompanyOut]:
    companies = await fin_queries.list_companies(session)
    return [CompanyOut.model_validate(c) for c in companies]


@router.get("/{slug}", response_model=CompanyDetail)
async def get_company(slug: str, session: DbSession) -> CompanyDetail:
    company, statements = await fin_queries.get_statements_by_slug(session, slug)
    # Validate the flat fields first: reading `company.statements` would trigger
    # an async lazy-load (MissingGreenlet), so we attach the list explicitly.
    base = CompanyOut.model_validate(company)
    return CompanyDetail(
        **base.model_dump(),
        statements=[StatementOut.model_validate(s) for s in statements],
    )


@router.get("/{slug}/statements", response_model=list[StatementOut])
async def get_statements(
    slug: str,
    session: DbSession,
    year_from: int | None = Query(default=None, ge=1990, le=2100),
    year_to: int | None = Query(default=None, ge=1990, le=2100),
) -> list[StatementOut]:
    _, statements = await fin_queries.get_statements_by_slug(
        session, slug, year_from=year_from, year_to=year_to
    )
    return [StatementOut.model_validate(s) for s in statements]


@router.get("/{slug}/ratios", response_model=list[dict])
async def get_ratios(slug: str, session: DbSession) -> list[dict]:
    """Computed in Python from statement rows (never stored, always derived)."""
    _, statements = await fin_queries.get_statements_by_slug(session, slug)
    out = []
    for statement in statements:
        previous = out[-1] if out else None
        snapshot = calc.RatioSnapshot(
            fiscal_year=statement.fiscal_year,
            gross_margin=calc.margin(_f(statement.gross_profit), _f(statement.revenue)),
            operating_margin=calc.margin(
                _f(statement.operating_profit), _f(statement.revenue)
            ),
            net_margin=calc.margin(_f(statement.net_profit), _f(statement.revenue)),
            current_ratio=calc.current_ratio(
                _f(statement.current_assets), _f(statement.current_liabilities)
            ),
            quick_ratio=calc.quick_ratio(
                _f(statement.current_assets),
                _f(statement.inventory),
                _f(statement.current_liabilities),
            ),
            debt_to_equity=calc.debt_to_equity(
                _f(statement.total_debt), _f(statement.total_equity)
            ),
            interest_coverage=calc.interest_coverage(
                _f(statement.operating_profit), _f(statement.interest_expense)
            ),
            roe=calc.roe(_f(statement.net_profit), _f(statement.total_equity)),
            roa=calc.roa(_f(statement.net_profit), _f(statement.total_assets)),
            free_cash_flow=calc.free_cash_flow(
                _f(statement.operating_cash_flow), _f(statement.capex)
            ),
        )
        row = snapshot.as_dict()
        row["fiscal_year"] = statement.fiscal_year
        if previous:
            row["revenue_yoy"] = calc.growth_rate(
                _f(statement.revenue), previous.get("revenue")
            )
        out.append(row)
    return out


@router.get("/compare/{metric}", response_model=ComparisonOut)
async def compare(
    metric: str,
    session: DbSession,
    slugs: str = Query(..., description="Comma-separated company slugs"),
    year_from: int | None = Query(default=None),
    year_to: int | None = Query(default=None),
) -> ComparisonOut:
    slug_list = [s.strip() for s in slugs.split(",") if s.strip()]
    if len(slug_list) < 2:
        raise UnprocessableError("Provide at least two company slugs")

    from app.db.models.financial import FinancialStatement

    key = metric.strip().lower().replace(" ", "_")
    if not hasattr(FinancialStatement, key):
        raise NotFoundError(f"Unknown metric '{metric}'")

    data = await fin_queries.compare_metric(
        session, slug_list, key, year_from=year_from, year_to=year_to
    )

    companies = []
    for slug in slug_list:
        company = await fin_queries.get_company(session, slug)
        companies.append(CompanyOut.model_validate(company))

    return ComparisonOut(
        metric=key,
        unit="INR cr",
        companies=companies,
        series=[
            {"fiscal_year": year, "values": data["values"][year]} for year in data["years"]
        ],
    )


def _f(value) -> float | None:
    return float(value) if value is not None else None
