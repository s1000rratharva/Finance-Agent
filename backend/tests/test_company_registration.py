"""Company auto-registration helpers for uploaded documents."""

from app.services.ingestion.company import (
    build_statement_values,
    detect_company,
    infer_fiscal_year,
)
from app.services.ingestion.extractors import NumericFact
from app.services.ingestion.loaders import LoadedPage


def test_detect_company_from_document_text():
    pages = [
        LoadedPage(text="WIPRO INTEGRATED ANNUAL REPORT 2025-26", page=2),
        LoadedPage(text="Wipro Limited is a leading AI-powered technology services company.", page=4),
    ]
    detected = detect_company("Integrated-annual-report-2025-26.pdf", pages)
    assert detected is not None
    assert detected.slug == "wipro"
    assert detected.ticker == "WIPRO"
    assert detected.detected_from == "document"


def test_detect_known_company_from_filename():
    detected = detect_company("tcs_annual_report_FY25.pdf", [])
    assert detected is not None
    assert detected.slug == "tcs"
    assert detected.detected_from == "filename"


def test_infer_fiscal_year_from_report_range():
    assert infer_fiscal_year("Integrated-annual-report-2025-26.pdf", []) == 2026
    assert infer_fiscal_year("annual_report_FY2025.pdf", []) == 2025


def test_build_statement_values_normalises_millions_to_crore():
    facts = [
        NumericFact(
            label="consolidated sales", column="revenue",
            raw_value="₹926,240 Million", value=926240.0,
            source_kind="text", year_hint="current",
        ),
        NumericFact(
            label="previous year sales", column="revenue",
            raw_value="₹890,884 Million", value=890884.0,
            source_kind="text", year_hint="previous",
        ),
        NumericFact(
            label="net profit", column="net_profit",
            raw_value="₹132,655 Million", value=132655.0,
            source_kind="text", year_hint="current",
        ),
        NumericFact(
            label="unreliable note", column="total_debt",
            raw_value="97,863", value=97863.0,
            source_kind="text", year_hint=None,
        ),
        NumericFact(
            label="maturity", column="tax_expense",
            raw_value="13,092", value=13092.0,
            fiscal_year=2034, source_kind="text",
        ),
    ]
    rows = build_statement_values(facts, fiscal_year=2026)
    assert rows[2026]["revenue"] == 92624.0
    assert rows[2025]["revenue"] == 89088.4
    assert rows[2026]["net_profit"] == 13265.5
    assert 2034 not in rows
    assert "total_debt" not in rows.get(2026, {}), "unitless prose must be ignored"


def test_build_statement_values_accepts_table_rows_as_crore():
    facts = [
        NumericFact(
            label="Total Revenue", column="revenue", raw_value="964643",
            value=964643.0, fiscal_year=2025, source_kind="table",
        )
    ]
    rows = build_statement_values(facts, fiscal_year=2026)
    assert rows[2025]["revenue"] == 964643.0
