"""Ingestion loaders and chunk/extract behaviour across formats."""

from pathlib import Path

import pytest

from app.services.ingestion.extractors import extract
from app.services.ingestion.loaders import (
    load_csv,
    load_document,
    load_text,
    supported_extensions,
)


def test_supported_extensions_cover_required_formats():
    exts = supported_extensions()
    for expected in (".pdf", ".xlsx", ".csv", ".docx"):
        assert expected in exts


def test_load_document_rejects_unknown_type(tmp_path: Path):
    path = tmp_path / "notes.pptx"
    path.write_text("x", encoding="utf-8")
    with pytest.raises(ValueError, match="Unsupported file type"):
        load_document(path)


def test_load_text_single_page(tmp_path: Path):
    path = tmp_path / "notes.txt"
    path.write_text("Revenue grew 12% in FY2025.", encoding="utf-8")
    pages = load_text(path)
    assert len(pages) == 1
    assert "Revenue grew" in pages[0].text


def test_load_csv_produces_table(tmp_path: Path):
    path = tmp_path / "metrics.csv"
    path.write_text("metric,FY2024,FY2025\nrevenue,100,120\nnet_profit,20,26\n", encoding="utf-8")
    pages = load_csv(path)
    assert len(pages) == 1
    assert pages[0].tables, "CSV must be surfaced as a table for numeric extraction"
    assert pages[0].tables[0][0][0] == "metric"


def test_extract_produces_text_chunks(tmp_path: Path):
    path = tmp_path / "notes.txt"
    path.write_text(
        " ".join(f"Paragraph {i} describing risk factors and covenants." for i in range(30)),
        encoding="utf-8",
    )
    pages = load_text(path)
    result = extract(pages, chunk_size=50, chunk_overlap=10, document_id="doc-1")

    assert len(result.chunks) >= 2
    assert result.chunks[0].chunk.metadata["document_id"] == "doc-1"
    assert result.tables_detected == 0


def test_extract_finds_numeric_facts_in_tables():
    from app.services.ingestion.loaders import LoadedPage

    table = [
        ["Particulars", "FY2024", "FY2025"],
        ["Total Revenue", "899041", "964643"],
        ["Net Profit", "79020", "91002"],
    ]
    pages = [LoadedPage(text="Revenue note", page=3, tables=[table])]
    result = extract(pages)

    # A table row yields one fact per year column, so key by (label, year).
    facts = {(f.label, f.fiscal_year): f for f in result.facts}
    assert facts[("Total Revenue", 2024)].value == 899041.0
    assert facts[("Total Revenue", 2025)].value == 964643.0
    assert facts[("Total Revenue", 2024)].column == "revenue"
    assert facts[("Net Profit", 2024)].column == "net_profit"
    assert result.tables_detected == 1


def test_extract_finds_facts_in_prose():
    from app.services.ingestion.loaders import LoadedPage

    pages = [LoadedPage(text="Revenue from operations 1,02,592 cr in FY2025", page=1)]
    result = extract(pages)
    assert any(f.column == "revenue" for f in result.facts)
