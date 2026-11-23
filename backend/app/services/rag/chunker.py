"""Text splitting tuned for financial documents.

Financial text mixes prose, tables and footnote-like fragments, so chunks keep
a small overlap and carry page/section metadata for citation rendering.
"""

from dataclasses import dataclass, field
import re


@dataclass
class Chunk:
    text: str
    index: int
    page: int | None = None
    section: str | None = None
    metadata: dict = field(default_factory=dict)

    @property
    def token_count(self) -> int:
        # Cheap approximation; swap for tiktoken if exact counts matter.
        return max(1, len(self.text.split()))


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n{2,}")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s and s.strip()]


def chunk_text(
    text: str,
    *,
    chunk_size: int = 900,
    chunk_overlap: int = 150,
    page: int | None = None,
    section: str | None = None,
    start_index: int = 0,
    metadata: dict | None = None,
) -> list[Chunk]:
    """Greedy sentence-packing splitter with overlap.

    `chunk_size`/`chunk_overlap` are word counts.
    """
    sentences = split_sentences(text)
    if not sentences:
        return []

    chunks: list[Chunk] = []
    current: list[str] = []
    current_len = 0

    def flush() -> None:
        nonlocal current, current_len
        if not current:
            return
        body = " ".join(current)
        chunks.append(
            Chunk(
                text=body,
                index=start_index + len(chunks),
                page=page,
                section=section,
                metadata=dict(metadata or {}),
            )
        )
        # Keep the tail of the previous chunk as overlap.
        overlap: list[str] = []
        overlap_len = 0
        for sentence in reversed(current):
            if overlap_len + len(sentence.split()) > chunk_overlap:
                break
            overlap.insert(0, sentence)
            overlap_len += len(sentence.split())
        current = overlap
        current_len = overlap_len

    for sentence in sentences:
        words = len(sentence.split())
        if current and current_len + words > chunk_size:
            flush()
        current.append(sentence)
        current_len += words

    flush()
    return chunks
