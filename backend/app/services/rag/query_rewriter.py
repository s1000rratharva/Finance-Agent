"""Query rewriting with conversational context.

Bare follow-ups ("what about the debt?") are unsearchable on their own. A
cheap Groq call rewrites them into self-contained queries, keeping the
original untouched for the audit trail.
"""

from __future__ import annotations

import json

from app.core.config import settings
from app.core.logging import get_logger
from app.services.llm.groq_client import get_groq_client
from app.services.llm.prompts import QUERY_REWRITE_SYSTEM

log = get_logger("rag.query_rewriter")

_REWRITE_JSON_KEYS = ("rewritten_query", "company_hints", "metric_hints")


async def rewrite_query(
    query: str,
    *,
    history: list[dict] | None = None,
    company_slugs: list[str] | None = None,
    enabled: bool = True,
) -> dict:
    """Return ``{"rewritten_query": str, "company_hints": [...], "skipped": bool}``."""
    history = history or []
    if not enabled or not history:
        return {
            "rewritten_query": query,
            "company_hints": company_slugs or [],
            "skipped": True,
        }

    client = get_groq_client()
    transcript = "\n".join(
        f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-6:]
    )
    user_prompt = (
        f"Conversation so far:\n{transcript}\n\n"
        f"Follow-up question: {query}\n"
        f"Known companies: {', '.join(company_slugs or []) or 'none'}"
    )

    try:
        raw = await client.chat_json(
            system=QUERY_REWRITE_SYSTEM,
            user=user_prompt,
            model=settings.groq_chat_model,
            temperature=0.0,
        )
        data = json.loads(raw) if isinstance(raw, str) else raw
        rewritten = str(data.get("rewritten_query") or query).strip()
        hints = [str(h) for h in (data.get("company_hints") or company_slugs or [])]
        return {"rewritten_query": rewritten or query, "company_hints": hints, "skipped": False}
    except Exception as exc:  # never let a rewrite failure break the answer
        log.warning("query_rewrite.failed", error=str(exc))
        return {
            "rewritten_query": query,
            "company_hints": company_slugs or [],
            "skipped": True,
        }
