"""Turn loaded pages into chunks + structured numeric facts.

Two extraction tracks run side by side:
* textual  -> chunked into the vector store for RAG
* numeric  -> normalised into statement rows for SQL analytics
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.ingestion.loaders import LoadedPage
from app.services.rag.chunker import Chunk, chunk_text

# Common Indian/US financial number forms: 1,02,592.50 / 1,234,567 / 45.6% / (1,234)
_NUMBER_RE = re.compile(
    r"\(?\s?-?\s?(?:₹|Rs\.?|\\$|\$)?\s?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?\s?\)?\s?(?:cr|crore|mn|million|bn|billion|%)?",
    re.IGNORECASE,
)

# Line-item labels we care about mapping into financial_statements columns.
LABEL_TO_COLUMN: dict[str, str] = {
    "total revenue": "revenue",
    "revenue from operations": "revenue",
    "net sales": "revenue",
    "sales": "revenue",
    "cost of revenue": "cost_of_revenue",
    "cost of goods sold": "cost_of_revenue",
    "gross profit": "gross_profit",
    "operating expenses": "operating_expenses",
    "total expenses": "operating_expenses",
    "operating profit": "operating_profit",
    "ebit": "operating_profit",
    "interest expense": "interest_expense",
    "depreciation and amortisation": "depreciation_amortization",
    "profit before tax": "profit_before_tax",
    "pbt": "profit_before_tax",
    "tax expense": "tax_expense",
    "net profit": "net_profit",
    "profit after tax": "net_profit",
    "net income": "net_profit",
    "earnings per share": "eps",
    "total assets": "total_assets",
    "total liabilities": "total_liabilities",
    "total equity": "total_equity",
    "shareholders equity": "total_equity",
    "total debt": "total_debt",
    "borrowings": "total_debt",
    "cash and cash equivalents": "cash_and_equivalents",
    "current assets": "current_assets",
    "current liabilities": "current_liabilities",
    "inventory": "inventory",
    "working capital": "working_capital",
    "cash flow from operating activities": "operating_cash_flow",
    "operating cash flow": "operating_cash_flow",
    "capital expenditure": "capex",
    "free cash flow": "free_cash_flow",
}


@dataclass
class ExtractedChunk:
    chunk: Chunk
    source_kind: str = "text"  # text | table


@dataclass
class NumericFact:
    label: str
    column: str | None
    raw_value: str
    value: float | None
    fiscal_year: int | None = None
    page: int | None = None
    context: str = ""
    source_kind: str = "text"  # text | table
    year_hint: str | None = None  # "current", "previous" or an explicit year


@dataclass
class ExtractionResult:
    chunks: list[ExtractedChunk] = field(default_factory=list)
    facts: list[NumericFact] = field(default_factory=list)
    tables_detected: int = 0


def extract(
    pages: list[LoadedPage],
    *,
    chunk_size: int = 900,
    chunk_overlap: int = 150,
    document_id: str = "",
) -> ExtractionResult:
    result = ExtractionResult()
    index = 0

    for page in pages:
        # --- textual track ---
        if page.text.strip():
            page_chunks = chunk_text(
                page.text,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                page=page.page,
                section=page.section,
                start_index=index,
                metadata={"document_id": document_id, "section": page.section or ""},
            )
            for chunk in page_chunks:
                result.chunks.append(ExtractedChunk(chunk=chunk, source_kind="text"))
            # Advance by the chunks actually produced so indices stay unique
            # across pages (citations dedupe on document_id + chunk_index).
            index += len(page_chunks)

        # --- numeric track ---
        for table in page.tables:
            result.tables_detected += 1
            result.facts.extend(_extract_from_table(table, page=page.page))
        if not page.tables:
            result.facts.extend(_extract_from_text(page.text, page=page.page))

    return result


def _extract_from_table(
    table: list[list[str]], *, page: int | None
) -> list[NumericFact]:
    """Row-oriented: first cell is the label, remaining cells are values."""
    facts: list[NumericFact] = []
    if not table:
        return facts

    header = [cell.strip().lower() for cell in table[0]]
    year_columns: dict[int, int] = {}
    for position, cell in enumerate(header):
        match = re.search(r"(20\d{2}|19\d{2})", cell)
        if match:
            year_columns[position] = int(match.group(1))

    for row in table[1:]:
        if not row:
            continue
        label = (row[0] or "").strip().lower()
        if not label:
            continue
        column = _match_label(label)
        for position, year in year_columns.items():
            if position >= len(row):
                continue
            raw = row[position].strip()
            if not raw or raw in {"-", "—", "NA", "N/A"}:
                continue
            facts.append(
                NumericFact(
                    label=row[0].strip(),
                    column=column,
                    raw_value=raw,
                    value=parse_number(raw),
                    fiscal_year=year,
                    page=page,
                    context=" | ".join(row[:4]),
                    source_kind="table",
                    year_hint=str(year),
                )
            )
    return facts


_YEAR_CUE_RE = re.compile(
    r"current\s+year|previous\s+year|FY\s?20\d{2}|\b20\d{2}\b", re.IGNORECASE
)


def _extract_from_text(text: str, *, page: int | None) -> list[NumericFact]:
    """Fallback: scan prose lines like 'Revenue from operations 1,02,592 cr'.

    Annual reports often phrase figures as "X for the current year as against
    Y in the previous year" without printing the years next to each number. We
    keep a ``year_hint`` per number so the statement builder can resolve it
    against the report's fiscal year instead of assigning both numbers to FY.
    """
    facts: list[NumericFact] = []
    lines = text.splitlines()
    for index, line in enumerate(lines):
        lowered = line.lower()
        previous = lines[index - 1].lower() if index else ""
        following = lines[index + 1].lower() if index + 1 < len(lines) else ""
        # A line such as "for the current year as against X in the previous
        # year" carries no label of its own; borrow it from the adjacent line.
        column = (
            _match_label(lowered)
            or _match_label(f"{previous} {lowered}")
            or _match_label(f"{lowered} {following}")
        )
        if column is None:
            continue

        # Year cues on the following line resolve phrases that split across
        # lines ("...sales increased to X\nfor the current year as against Y").
        cues = [
            (match.start(), match.end(), match.group(0))
            for match in _YEAR_CUE_RE.finditer(line)
        ]
        offset = len(line) + 1
        cues.extend(
            (match.start() + offset, match.end() + offset, match.group(0))
            for match in _YEAR_CUE_RE.finditer(following)
        )
        contrast_positions = []
        for part, shift in ((line, 0), (following, offset)):
            position = part.lower().find("as against")
            if position >= 0:
                contrast_positions.append(position + shift)
        for match in _NUMBER_RE.finditer(line):
            raw = match.group(0).strip()
            hint = _contrast_year_hint(match.start(), contrast_positions, cues) or _nearest_year_hint(
                match.start(), cues
            )
            digits = re.sub(r"\D", "", hint or "")[-4:]
            fiscal_year = int(digits) if len(digits) == 4 else None
            facts.append(
                NumericFact(
                    label=line.strip()[:120],
                    column=column,
                    raw_value=raw,
                    value=parse_number(raw),
                    fiscal_year=fiscal_year,
                    page=page,
                    context=line.strip()[:240],
                    source_kind="text",
                    year_hint=hint,
                )
            )
    return facts


def _nearest_year_hint(
    position: int, cues: list[tuple[int, int, str]]
) -> str | None:
    """Return the year cue closest to a number (nearest span wins)."""

    def distance(span: tuple[int, int, str]) -> int:
        start, end, _ = span
        if start >= position:
            return start - position
        if end <= position:
            return position - end
        return 0

    if not cues:
        return None
    cue = min(cues, key=distance)
    token = cue[2].lower()
    if token.startswith("current"):
        return "current"
    if token.startswith("previous"):
        return "previous"
    digits = re.sub(r"\D", "", token)
    return digits[-4:] if len(digits) >= 4 else None


def _contrast_year_hint(
    position: int,
    contrast_positions: list[int],
    cues: list[tuple[int, int, str]],
) -> str | None:
    """Resolve "X for the current year as against Y in the previous year".

    A naive nearest-cue rule assigns both numbers to "current" because that
    phrase sits closer to X. The contrast pivot tells us which side of the
    comparison each number belongs to.
    """
    tokens = {cue[2].lower() for cue in cues}
    for pivot in contrast_positions:
        if position < pivot and any(token.startswith("current") for token in tokens):
            return "current"
        if position > pivot and any(token.startswith("previous") for token in tokens):
            return "previous"
    return None


def _match_label(label: str) -> str | None:
    normalised = re.sub(r"[^a-z ]", "", label).strip()
    if normalised in LABEL_TO_COLUMN:
        return LABEL_TO_COLUMN[normalised]
    for keyword, column in LABEL_TO_COLUMN.items():
        if keyword in normalised:
            return column
    return None


def parse_number(raw: str) -> float | None:
    """Parse financial numerals incl. parentheses-as-negative and scale suffixes."""
    if not raw:
        return None
    text = raw.strip()
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()").replace("₹", "").replace("$", "")
    text = re.sub(r"(?i)\b(rs\.?|cr|crore|mn|million|bn|billion|lakh|lac)\b", "", text)
    text = text.replace(",", "").replace("%", "").strip()
    if not text or text in {"-", "—"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return -value if negative else value
