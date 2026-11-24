"""Register a company from an uploaded document.

Document ingestion previously only produced RAG chunks. This module bridges
that pipeline to the relational analytics tables so an uploaded annual report
also appears on the Overview and Companies pages.

Detection is deliberately conservative: known Indian tickers are matched
first, then a legal-name pattern ("Foo Limited") in the opening pages. When no
company can be identified the document is still indexed for RAG, but no
company row is invented from the filename.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.financial import Company, FinancialStatement
from app.services.ingestion.extractors import NumericFact
from app.services.ingestion.loaders import LoadedPage


@dataclass(frozen=True)
class CompanyHint:
    name: str
    slug: str
    ticker: str
    sector: str | None = None
    industry: str | None = None
    exchange: str = "NSE/BSE"
    aliases: tuple[str, ...] = ()


@dataclass
class DetectedCompany:
    name: str
    slug: str
    ticker: str
    sector: str | None
    industry: str | None
    exchange: str | None
    detected_from: str  # "filename" | "document"


@dataclass
class CompanyLinkResult:
    company_slug: str | None = None
    company_name: str | None = None
    company_created: bool = False
    statements_created: int = 0
    fiscal_year: int | None = None
    years: list[int] | None = None
    detected_from: str | None = None


# Keep slugs/tickers aligned with data/companies/*.json so uploads never
# duplicate the preloaded coverage universe.
KNOWN_COMPANIES: tuple[CompanyHint, ...] = (
    CompanyHint(
        "Reliance Industries Limited", "reliance-industries", "RELIANCE",
        "Energy", "Diversified Conglomerate", "NSE/BSE",
        ("reliance industries", "reliance"),
    ),
    CompanyHint(
        "Tata Consultancy Services Limited", "tcs", "TCS",
        "Information Technology", "IT Services & Consulting", "NSE/BSE",
        ("tata consultancy services", "tcs"),
    ),
    CompanyHint(
        "Infosys Limited", "infosys", "INFY",
        "Information Technology", "IT Services & Consulting", "NSE/BSE",
        ("infosys",),
    ),
    CompanyHint(
        "Wipro Limited", "wipro", "WIPRO",
        "Information Technology", "IT Services & Consulting", "NSE/BSE",
        ("wipro",),
    ),
    CompanyHint(
        "HDFC Bank Limited", "hdfc-bank", "HDFCBANK",
        "Financial Services", "Banking", "NSE/BSE",
        ("hdfc bank",),
    ),
    CompanyHint(
        "ICICI Bank Limited", "icici-bank", "ICICIBANK",
        "Financial Services", "Banking", "NSE/BSE",
        ("icici bank",),
    ),
    CompanyHint(
        "State Bank of India", "state-bank-of-india", "SBIN",
        "Financial Services", "Banking", "NSE/BSE",
        ("state bank of india", "sbi"),
    ),
    CompanyHint(
        "Adani Enterprises Limited", "adani-enterprises", "ADANIENT",
        "Energy", "Diversified Conglomerate", "NSE/BSE",
        ("adani enterprises",),
    ),
    CompanyHint(
        "Maruti Suzuki India Limited", "maruti-suzuki", "MARUTI",
        "Automotive", "Passenger Vehicles", "NSE/BSE",
        ("maruti suzuki",),
    ),
    CompanyHint(
        "Mahindra & Mahindra Limited", "mahindra-and-mahindra", "M&M",
        "Automotive", "Utility Vehicles", "NSE/BSE",
        ("mahindra & mahindra", "mahindra and mahindra"),
    ),
)

_LEGAL_NAME_RE = re.compile(
    r"\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5}"
    r"\s+(?:Limited|Ltd\.?|LLP|Inc\.?|Corporation|Corp\.?|PLC))\b"
)

STATEMENT_COLUMNS: frozenset[str] = frozenset(
    {
        "revenue", "cost_of_revenue", "gross_profit", "operating_expenses",
        "operating_profit", "interest_expense", "depreciation_amortization",
        "profit_before_tax", "tax_expense", "net_profit", "eps",
        "total_assets", "total_liabilities", "total_equity", "total_debt",
        "cash_and_equivalents", "current_assets", "current_liabilities",
        "inventory", "working_capital", "operating_cash_flow",
        "investing_cash_flow", "financing_cash_flow", "capex",
        "free_cash_flow", "market_cap", "dividend_payout_ratio",
    }
)

_UNIT_RE = re.compile(r"\b(cr|crore|lakh|lac|mn|million|bn|billion)\b", re.IGNORECASE)


def detect_company(document_name: str, pages: Iterable[LoadedPage]) -> DetectedCompany | None:
    """Identify the reporting company from the filename or opening pages."""
    page_list = list(pages)
    name_text = document_name.lower()
    for hint in KNOWN_COMPANIES:
        if any(_has_alias(name_text, alias) for alias in hint.aliases):
            return _hint_to_detected(hint, "filename")

    body = "\n".join(page.text for page in page_list[:15])
    lowered = body.lower()
    for hint in KNOWN_COMPANIES:
        if any(_has_alias(lowered, alias) for alias in hint.aliases):
            return _hint_to_detected(hint, "document")

    match = _LEGAL_NAME_RE.search(body)
    if match:
        name = re.sub(r"\s+", " ", match.group(1)).strip()
        return DetectedCompany(
            name=name,
            slug=_slugify(name),
            ticker=_ticker(name),
            sector=None,
            industry=None,
            exchange=None,
            detected_from="document",
        )
    return None


def infer_fiscal_year(document_name: str, pages: Iterable[LoadedPage]) -> int:
    """Infer the fiscal year the document reports on (March year-end)."""
    body = document_name + "\n" + "\n".join(p.text for p in list(pages)[:20])
    match = re.search(r"(20\d{2})\s*[-/]\s*(\d{2,4})", body)
    if match:
        start, end = int(match.group(1)), int(match.group(2))
        return start + 1 if end < 100 else end
    match = re.search(r"FY\s?(20\d{2})", body, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r"\b(20\d{2})\b", body)
    return int(match.group(1)) if match else date.today().year


def build_statement_values(
    facts: Iterable[NumericFact], fiscal_year: int
) -> dict[int, dict[str, float]]:
    """Turn extracted numeric facts into FY rows keyed by fiscal year.

    Only the report year and its immediately preceding year are accepted.
    Prose numbers without an explicit unit are ignored because annual reports
    mix millions, crores and percentages on the same page; table rows and
    explicitly-unitised prose are safe to convert.
    """
    allowed_years = {fiscal_year - 1, fiscal_year}
    candidates: dict[tuple[int, str], list[tuple[tuple[int, float], float]]] = defaultdict(list)

    for fact in facts:
        if not fact.column or fact.column not in STATEMENT_COLUMNS or fact.value is None:
            continue
        year = _resolve_year(fact, fiscal_year)
        if year not in allowed_years:
            continue
        value = _normalise_to_crore(fact)
        if value is None or (fact.column != "eps" and abs(value) > 10_000_000):
            continue
        if fact.column == "eps" and not 0 < value <= 10_000:
            continue
        if fact.column == "dividend_payout_ratio" and not 0 <= value <= 1:
            continue
        # Prefer explicitly unitised facts, then the larger consolidated figure
        # over segment/standalone repetitions of the same line item.
        score = (1 if fact.source_kind == "table" or _UNIT_RE.search(fact.raw_value) else 0, abs(value))
        candidates[(year, fact.column)].append((score, value))

    rows: dict[int, dict[str, float]] = defaultdict(dict)
    for (year, column), values in candidates.items():
        if column in {"eps", "dividend_payout_ratio"}:
            positives = [value for _, value in values if value > 0]
            chosen = min(positives) if positives else max(values, key=lambda item: item[0])[1]
        else:
            chosen = max(values, key=lambda item: item[0])[1]
        rows[year][column] = round(chosen, 2)
    return dict(rows)


async def register_company_from_document(
    session: AsyncSession,
    *,
    document_name: str,
    pages: Iterable[LoadedPage],
    facts: Iterable[NumericFact],
) -> CompanyLinkResult:
    """Upsert the detected company and any extractable FY statement rows."""
    fiscal_year = infer_fiscal_year(document_name, pages)
    detection = detect_company(document_name, pages)
    if detection is None:
        return CompanyLinkResult(fiscal_year=fiscal_year)

    company = (
        await session.execute(select(Company).where(Company.slug == detection.slug))
    ).scalar_one_or_none()
    created = False
    if company is None:
        company = Company(
            slug=await _unique_slug(session, detection.slug),
            ticker=await _unique_ticker(session, detection.ticker),
            name=detection.name,
            sector=detection.sector,
            industry=detection.industry,
            exchange=detection.exchange,
            currency="INR",
            description=f"Added automatically from uploaded document: {document_name}",
        )
        session.add(company)
        await session.flush()
        created = True
    else:
        for attr in ("sector", "industry", "exchange"):
            value = getattr(detection, attr)
            if value and not getattr(company, attr):
                setattr(company, attr, value)

    source = f"Uploaded document: {document_name} (auto-extracted; verify)"
    values_by_year = build_statement_values(facts, fiscal_year)
    statements_created = 0

    async def _statement_for(year: int) -> FinancialStatement | None:
        return (
            await session.execute(
                select(FinancialStatement).where(
                    FinancialStatement.company_id == company.id,
                    FinancialStatement.fiscal_year == year,
                    FinancialStatement.period == "FY",
                )
            )
        ).scalar_one_or_none()

    if not values_by_year:
        # Overview returns 404 when a company has no statement rows. Register an
        # empty audited-year row so the company is still browsable; values can
        # be filled later by RAG or by a richer parser.
        if await _statement_for(fiscal_year) is None:
            session.add(
                FinancialStatement(
                    company_id=company.id,
                    fiscal_year=fiscal_year,
                    period="FY",
                    as_of=date(fiscal_year, 3, 31),
                    source=source,
                )
            )
            statements_created += 1
        values_by_year = {fiscal_year: {}}

    for year, values in sorted(values_by_year.items(), reverse=True):
        existing = await _statement_for(year)
        if existing is None:
            session.add(
                FinancialStatement(
                    company_id=company.id,
                    fiscal_year=year,
                    period="FY",
                    as_of=date(year, 3, 31),
                    source=source,
                    **values,
                )
            )
            statements_created += 1
            continue
        # Never overwrite trusted seeded values; only fill null columns.
        changed = False
        for column, value in values.items():
            if getattr(existing, column) is None:
                setattr(existing, column, value)
                changed = True
        if changed and not (existing.source or "").startswith("Uploaded document:"):
            existing.source = source

    return CompanyLinkResult(
        company_slug=company.slug,
        company_name=company.name,
        company_created=created,
        statements_created=statements_created,
        fiscal_year=fiscal_year,
        years=sorted(values_by_year, reverse=True),
        detected_from=detection.detected_from,
    )


# --- helpers -----------------------------------------------------------------

def _has_alias(haystack: str, alias: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", haystack) is not None


def _hint_to_detected(hint: CompanyHint, source: str) -> DetectedCompany:
    return DetectedCompany(
        name=hint.name,
        slug=hint.slug,
        ticker=hint.ticker,
        sector=hint.sector,
        industry=hint.industry,
        exchange=hint.exchange,
        detected_from=source,
    )


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:60].rstrip("-") or "company"


def _ticker(name: str) -> str:
    words = [
        word for word in re.split(r"[^A-Za-z0-9]+", name)
        if word and word.lower() not in {"limited", "ltd", "inc", "corporation", "corp", "plc", "the"}
    ]
    ticker = "".join(word[0] for word in words[:4]).upper() or "CO"
    return ticker[:20]


def _resolve_year(fact: NumericFact, fiscal_year: int) -> int | None:
    if fact.fiscal_year and 1990 <= fact.fiscal_year <= 2100:
        return fact.fiscal_year
    if fact.year_hint == "current":
        return fiscal_year
    if fact.year_hint == "previous":
        return fiscal_year - 1
    if fact.year_hint and fact.year_hint.isdigit():
        return int(fact.year_hint)
    return fiscal_year


def _normalise_to_crore(fact: NumericFact) -> float | None:
    raw = fact.raw_value
    if "%" in raw:
        return None
    has_unit = _UNIT_RE.search(raw) is not None
    if fact.source_kind == "text" and not has_unit and fact.column not in {
        "eps", "dividend_payout_ratio"
    }:
        return None
    lowered = raw.lower()
    if re.search(r"\b(bn|billion)\b", lowered):
        factor = 100.0
    elif re.search(r"\b(mn|million)\b", lowered):
        factor = 0.1
    elif re.search(r"\b(lakh|lac)\b", lowered):
        factor = 0.01
    else:
        factor = 1.0
    return round(fact.value * factor, 2)


async def _unique_slug(session: AsyncSession, base: str) -> str:
    candidate = base
    suffix = 2
    while (
        await session.execute(select(Company.id).where(Company.slug == candidate))
    ).scalar_one_or_none() is not None:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


async def _unique_ticker(session: AsyncSession, base: str) -> str:
    candidate = base
    suffix = 2
    while (
        await session.execute(select(Company.id).where(Company.ticker == candidate))
    ).scalar_one_or_none() is not None:
        candidate = f"{base[:18]}{suffix}"
        suffix += 1
    return candidate
