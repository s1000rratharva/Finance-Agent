"""Reciprocal Rank Fusion of dense + sparse results.

RRF avoids the hard problem of normalising cosine similarity against BM25
scores: rank alone is used, which is robust across query types (keyword-heavy
ticker lookups vs. semantic questions).
"""

from __future__ import annotations

RRF_K = 60


def rrf_fuse(
    rankings: list[list[dict]],
    *,
    weights: list[float] | None = None,
    k: int = RRF_K,
    top_k: int | None = None,
) -> list[dict]:
    """Fuse several ranked lists into one, keeping the best payload per id.

    Each input item needs at least an ``id``; ``score``/``metadata``/``text``
    are merged from whichever list ranks it highest.
    """
    weights = weights or [1.0] * len(rankings)
    fused: dict[str, dict] = {}
    contributions: dict[str, float] = defaultdict(float)  # type: ignore[name-defined]

    for weight, ranking in zip(weights, rankings, strict=False):
        for rank, item in enumerate(ranking, start=1):
            item_id = str(item["id"])
            contributions[item_id] += weight / (k + rank)
            existing = fused.get(item_id)
            if existing is None or item.get("score", 0) > existing.get("score", 0):
                fused[item_id] = dict(item)

    merged = [
        {**payload, "score": contributions[item_id]}
        for item_id, payload in fused.items()
    ]
    merged.sort(key=lambda x: x["score"], reverse=True)
    return merged[:top_k] if top_k else merged


from collections import defaultdict  # noqa: E402  (kept at bottom to read top-down)
