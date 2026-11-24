"""Format-aware document loaders (PDF, DOCX, XLSX, CSV, TXT).

Every loader normalises to a list of ``LoadedPage`` so downstream extraction
never cares about the source format.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class LoadedPage:
    text: str
    page: int | None = None
    section: str | None = None
    tables: list[list[list[str]]] = field(default_factory=list)  # rows -> cells


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xls", ".csv", ".txt", ".md"}


def supported_extensions() -> list[str]:
    return sorted(SUPPORTED_EXTENSIONS)


def load_document(path: Path) -> list[LoadedPage]:
    """Dispatch on file extension. Raises ``ValueError`` for unsupported types."""
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}")

    if suffix == ".pdf":
        return load_pdf(path)
    if suffix == ".docx":
        return load_docx(path)
    if suffix in {".xlsx", ".xls"}:
        return load_excel(path)
    if suffix == ".csv":
        return load_csv(path)
    return load_text(path)


# --- PDF ------------------------------------------------------------------------


def load_pdf(path: Path) -> list[LoadedPage]:
    """Extract text, preferring PyMuPDF (fast C parser).

    Tabula table detection is opt-in via FINSIGHT_PDF_TABLES=1 because it
    launches a JVM per page: on a 548-page annual report that takes hours
    and floods stderr with JPEG2000 warnings. Text extraction alone is what
    the RAG index consumes and takes ~10s with PyMuPDF.
    """
    want_tables = os.getenv("FINSIGHT_PDF_TABLES", "").lower() in {"1", "true", "yes"}
    pages: list[LoadedPage] = []
    try:
        import pymupdf

        with pymupdf.open(path) as doc:
            for i, page in enumerate(doc, start=1):
                text = page.get_text("text").strip()
                tables: list[list[list[str]]] = []
                if want_tables:
                    try:
                        tables = _extract_pdf_tables(path, page_number=i)
                    except Exception:
                        tables = []
                pages.append(LoadedPage(text=text, page=i, tables=tables))
        return pages
    except ImportError:
        pass  # fall through to pypdf

    from pypdf import PdfReader

    reader = PdfReader(str(path))
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        tables = []
        if want_tables:
            try:
                tables = _extract_pdf_tables(path, page_number=i)
            except Exception:
                tables = []
        pages.append(LoadedPage(text=text, page=i, tables=tables))
    return pages


def _extract_pdf_tables(path: Path, page_number: int) -> list[list[list[str]]]:
    """Best-effort PDF table extraction via tabula (optional, needs Java)."""
    try:
        import tabula
    except ImportError:
        return []
    frames = tabula.read_pdf(str(path), pages=page_number, multiple_tables=True)
    tables = []
    for frame in frames or []:
        tables.append(
            [[("" if cell is None else str(cell)) for cell in row]
             for row in frame.astype(object).where(frame.notna(), None).values.tolist()]
        )
    return tables


# --- DOCX -----------------------------------------------------------------------


def load_docx(path: Path) -> list[LoadedPage]:
    from docx import Document as DocxDocument

    doc = DocxDocument(str(path))
    parts: list[str] = []
    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text.strip())

    tables: list[list[list[str]]] = []
    for table in doc.tables:
        rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
        tables.append(rows)

    body = "\n\n".join(parts)
    return [LoadedPage(text=body, page=1, section="document", tables=tables)]


# --- Excel / CSV ----------------------------------------------------------------


def load_excel(path: Path) -> list[LoadedPage]:
    import pandas as pd

    pages: list[LoadedPage] = []
    sheets = pd.read_excel(str(path), sheet_name=None, header=None)
    for sheet_name, frame in sheets.items():
        table = [
            ["" if cell is None else str(cell) for cell in row]
            for row in frame.astype(object).where(frame.notna(), None).values.tolist()
        ]
        pages.append(
            LoadedPage(
                text=f"Sheet: {sheet_name}\n{frame.to_csv(index=False, header=False)}",
                page=len(pages) + 1,
                section=str(sheet_name),
                tables=[table],
            )
        )
    return pages


def load_csv(path: Path) -> list[LoadedPage]:
    import pandas as pd

    frame = pd.read_csv(str(path), header=None)
    table = [
        ["" if cell is None else str(cell) for cell in row]
        for row in frame.astype(object).where(frame.notna(), None).values.tolist()
    ]
    return [
        LoadedPage(
            text=frame.to_csv(index=False, header=False),
            page=1,
            section=path.stem,
            tables=[table],
        )
    ]


# --- Plain text ------------------------------------------------------------------


def load_text(path: Path) -> list[LoadedPage]:
    content = path.read_text(encoding="utf-8", errors="replace")
    return [LoadedPage(text=content, page=1, section=path.stem)]
