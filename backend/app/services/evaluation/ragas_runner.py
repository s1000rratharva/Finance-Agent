"""RAGAS evaluation harness.

Datasets live in ``data/eval/*.json`` (or Postgres rows later). Each run
scores the CURRENT pipeline end-to-end so prompt/retriever changes can be
compared before they ship.

Metrics: faithfulness, answer_relevancy, context_precision, context_recall.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.evaluation import EvalScores
from app.services.rag.retriever import get_retriever

log = get_logger("evaluation")

EVAL_DIR = Path(__file__).resolve().parents[4] / "data" / "eval"

# In-memory run log; replace with an `evaluation_runs` table in phase 2.
_RUNS: dict[str, dict] = {}


def list_datasets() -> list[str]:
    if not EVAL_DIR.exists():
        return []
    return sorted(p.stem for p in EVAL_DIR.glob("*.json"))


def load_dataset(name: str) -> list[dict]:
    path = EVAL_DIR / f"{name}.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else data.get("rows", [])
    except (OSError, json.JSONDecodeError) as exc:
        log.warning("eval.dataset_unreadable", name=name, error=str(exc))
        return []


async def run_evaluation(
    session: AsyncSession,
    *,
    dataset_name: str = "default",
    limit: int = 20,
    workspace_id: str | None = None,
) -> dict:
    run_id = str(uuid.uuid4())
    rows = load_dataset(dataset_name)[:limit]
    if not rows:
        _RUNS[run_id] = {
            "id": run_id,
            "workspace_id": workspace_id,
            "dataset_name": dataset_name,
            "status": "failed",
            "scores": {},
            "sample_count": 0,
            "created_at": datetime.now(timezone.utc),
            "error": f"Dataset '{dataset_name}' not found or empty (expected {EVAL_DIR})",
        }
        return _RUNS[run_id]

    _RUNS[run_id] = {
        "id": run_id,
        "workspace_id": workspace_id,
        "dataset_name": dataset_name,
        "status": "running",
        "scores": {},
        "sample_count": len(rows),
        "created_at": datetime.now(timezone.utc),
        "error": None,
    }

    try:
        scores = await _score_rows(rows, workspace_id=workspace_id)
        _RUNS[run_id].update(status="completed", scores=scores)
        log.info("eval.completed", run=run_id, scores=scores)
    except Exception as exc:
        _RUNS[run_id].update(status="failed", error=str(exc)[:500])
        log.exception("eval.failed", run=run_id)

    return _RUNS[run_id]


async def _score_rows(rows: list[dict], *, workspace_id: str | None) -> dict:
    """Score with RAGAS when available, else fall back to retrieval-only metrics."""
    try:
        return await _score_with_ragas(rows, workspace_id)
    except ImportError:
        log.info("eval.ragas_unavailable - using retrieval-only metrics")
        return await _score_retrieval_only(rows, workspace_id)
    except Exception as exc:
        log.warning("eval.ragas_failed", error=str(exc))
        return await _score_retrieval_only(rows, workspace_id)


async def _score_with_ragas(rows: list[dict], workspace_id: str | None) -> dict:
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import (
        context_precision,
        context_recall,
        answer_relevancy,
        faithfulness,
    )

    retriever = get_retriever()
    contexts: list[list[str]] = []
    answers: list[str] = []

    for row in rows:
        _, passages, _ = await retriever.retrieve(
            row["question"], workspace_id=workspace_id or ""
        )
        contexts.append(passages)
        answers.append(row.get("answer") or "")

    dataset = Dataset.from_dict(
        {
            "question": [r["question"] for r in rows],
            "answer": answers,
            "contexts": contexts,
            "reference": [r.get("reference", "") for r in rows],
        }
    )
    result = evaluate(
        dataset,
        metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    )
    scores = EvalScores(
        faithfulness=_num(result.get("faithfulness")),
        answer_relevancy=_num(result.get("answer_relevancy")),
        context_precision=_num(result.get("context_precision")),
        context_recall=_num(result.get("context_recall")),
    )
    return scores.model_dump()


async def _score_retrieval_only(rows: list[dict], workspace_id: str | None) -> dict:
    """Cheap proxy: does the reference answer appear in retrieved context?"""
    retriever = get_retriever()
    hits = 0
    total = 0
    for row in rows:
        reference = (row.get("reference") or "").lower()
        if not reference:
            continue
        total += 1
        _, passages, _ = await retriever.retrieve(
            row["question"], workspace_id=workspace_id or ""
        )
        blob = " ".join(passages).lower()
        # token-overlap proxy for context_recall
        tokens = {t for t in reference.split() if len(t) > 3}
        if tokens and len(tokens & set(blob.split())) / len(tokens) >= 0.4:
            hits += 1

    recall = round(hits / total, 4) if total else None
    return EvalScores(context_recall=recall).model_dump()


def _num(value) -> float | None:
    try:
        return round(float(value), 4) if value is not None else None
    except (TypeError, ValueError):
        return None


def get_run(run_id: str, *, workspace_id: str) -> dict | None:
    """Fetch a run only if it belongs to ``workspace_id`` (tenant isolation)."""
    run = _RUNS.get(run_id)
    if run is None or run.get("workspace_id") != workspace_id:
        return None
    return run


def list_runs(*, workspace_id: str) -> list[dict]:
    """Runs for one workspace only — never the global run log."""
    return sorted(
        (r for r in _RUNS.values() if r.get("workspace_id") == workspace_id),
        key=lambda r: r["created_at"],
        reverse=True,
    )
