"""Turn retrieved chunks into citation objects + a citable context block."""

from __future__ import annotations

from uuid import UUID

from app.schemas.chat import Citation


def build_citations(results: list[dict], *, max_snippet: int = 400) -> tuple[list[Citation], list[str]]:
    """Convert reranked results into numbered citations and context passages.

    Chunk metadata carries ``document_name``, ``page`` and ``section`` written
    during ingestion. Returns ``(citations, passages)`` where ``passages[i]``
    corresponds to ``citations[i]`` and is already wrapped as ``[n] ...``.
    """
    citations: list[Citation] = []
    passages: list[str] = []
    seen: set[str] = set()

    for item in results:
        metadata = item.get("metadata") or {}
        document_id = metadata.get("document_id")
        document_name = metadata.get("document_name") or metadata.get("source") or "Unknown source"
        dedupe_key = f"{document_id}:{metadata.get('chunk_index')}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        text = (item.get("text") or "").strip()
        if not text:
            continue

        page = metadata.get("page")
        citation = Citation(
            index=len(citations) + 1,
            document_id=UUID(document_id) if document_id else None,
            document_name=document_name,
            page=None if page in (None, -1) else int(page),
            section=metadata.get("section") or None,
            snippet=text[:max_snippet] + ("…" if len(text) > max_snippet else ""),
            score=round(float(item.get("score") or 0.0), 4),
        )
        citations.append(citation)

        source_label = document_name
        if citation.page is not None:
            source_label += f", p.{citation.page}"
        if citation.section:
            source_label += f" — {citation.section}"
        passages.append(f"[{citation.index}] ({source_label})\n{text}")

    return citations, passages
