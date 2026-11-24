"""Agentic orchestrator: plan -> act -> observe -> answer.

Flow
----
1. **Route**   - LLM classifies the request (rag | sql | python | chart |
                 compare | risk | general) and emits a tool plan as JSON.
2. **Act**     - each planned tool runs; failures are recorded, never fatal.
3. **Observe** - results are folded into the prompt context.
4. **Answer**  - Groq generates a cited, analyst-grade response.

Every step appends a ``TraceStep`` so the UI can show the reasoning trail.
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.chat import ChartSpec, Citation, TraceStep
from app.services.agents.tools import ToolContext, get_tool, tool_specs
from app.services.llm.groq_client import get_groq_client
from app.services.llm.prompts import ANSWER_SYSTEM, ROUTE_SYSTEM
from app.services.rag.retriever import get_retriever

log = get_logger("agents.orchestrator")

_ROUTE_FALLBACK = "rag"


@dataclass
class OrchestratorResult:
    answer: str
    citations: list[Citation] = field(default_factory=list)
    trace: list[TraceStep] = field(default_factory=list)
    charts: list[ChartSpec] = field(default_factory=list)
    sql: str | None = None


class Orchestrator:
    async def run(
        self,
        query: str,
        *,
        session: AsyncSession,
        workspace_id: str,
        company_slugs: list[str] | None = None,
        history: list[dict] | None = None,
        top_k: int | None = None,
    ) -> OrchestratorResult:
        trace: list[TraceStep] = []
        ctx = ToolContext(
            session=session, workspace_id=workspace_id, company_slugs=company_slugs or []
        )
        client = get_groq_client()

        # 1. Route ------------------------------------------------------------
        t0 = time.perf_counter()
        route, plan, route_skipped = await self._route(query, company_slugs or [], client)
        trace.append(
            TraceStep(
                name="route",
                status="skipped" if route_skipped else "ok",
                detail=route,
                duration_ms=round((time.perf_counter() - t0) * 1000, 1),
                payload={"plan": [p.get("tool") for p in plan]},
            )
        )

        # 2. Act --------------------------------------------------------------
        observations: list[str] = []
        citations: list[Citation] = []
        charts: list[ChartSpec] = []
        sql: str | None = None

        for step in plan:
            tool_name = str(step.get("tool") or "").strip()
            params = step.get("params") or {}
            params.setdefault("company_slugs", ctx.company_slugs)
            params.setdefault("query", query)
            if tool_name == "rag":
                params.setdefault("query", query)

            t0 = time.perf_counter()
            try:
                tool = get_tool(tool_name)
                result = await tool.run(params, ctx)
                trace.append(
                    TraceStep(
                        name=f"tool.{tool_name}",
                        status="ok",
                        duration_ms=round((time.perf_counter() - t0) * 1000, 1),
                        payload={"keys": list(result.keys())},
                    )
                )
                observations.append(self._render(tool_name, result))
                if tool_name == "rag" and result.get("citations"):
                    citations = [Citation(**c) for c in result["citations"]]
                if tool_name == "chart" and result.get("chart"):
                    charts.append(ChartSpec(**result["chart"]))
                if tool_name == "sql" and result.get("sql"):
                    sql = result["sql"]
            except Exception as exc:
                log.warning("tool.failed", tool=tool_name, error=str(exc))
                trace.append(
                    TraceStep(
                        name=f"tool.{tool_name}",
                        status="error",
                        detail=str(exc)[:300],
                        duration_ms=round((time.perf_counter() - t0) * 1000, 1),
                    )
                )

        # 3. Fallback: always retrieve so the answer has grounding ------------
        if not any(step.get("tool") == "rag" for step in plan):
            t0 = time.perf_counter()
            try:
                retriever = get_retriever()
                rag_citations, passages, _ = await retriever.retrieve(
                    query,
                    workspace_id=workspace_id,
                    company_slugs=ctx.company_slugs,
                    history=history,
                    top_k=top_k,
                    trace=trace,
                )
                citations = rag_citations or citations
                if passages:
                    observations.append(
                        "DOCUMENT CONTEXT\n" + "\n\n".join(passages)
                    )
                trace.append(
                    TraceStep(
                        name="retrieve.fallback",
                        status="ok" if passages else "skipped",
                        detail=f"{len(passages)} passage(s)",
                        duration_ms=round((time.perf_counter() - t0) * 1000, 1),
                    )
                )
            except Exception as exc:
                trace.append(TraceStep(name="retrieve.fallback", status="error", detail=str(exc)))

        # 4. Generate ----------------------------------------------------------
        answer = await self._generate(
            query, observations, citations, client, history=history, trace=trace
        )

        return OrchestratorResult(
            answer=answer, citations=citations, trace=trace, charts=charts, sql=sql
        )

    # --- internals -------------------------------------------------------------

    async def _route(
        self, query: str, company_slugs: list[str], client
    ) -> tuple[str, list[dict], bool]:
        if not client.available():
            return _ROUTE_FALLBACK, [{"tool": "rag", "params": {}}], True
        try:
            data = await client.chat_json_object(
                system=ROUTE_SYSTEM,
                user=(
                    f"Known companies: {', '.join(company_slugs) or 'none'}\n"
                    f"Available tools: {json.dumps(tool_specs())}\n\n"
                    f"User request: {query}"
                ),
                temperature=0.0,
            )
            route = str(data.get("route") or _ROUTE_FALLBACK)
            plan = data.get("plan") or self._default_plan(route, data)
            plan = self._normalize_plan(plan, data, company_slugs)
            return route, plan, False
        except Exception as exc:
            log.warning("route.failed", error=str(exc))
            return _ROUTE_FALLBACK, [{"tool": "rag", "params": {}}], True

    @staticmethod
    def _normalize_plan(plan: object, data: dict, company_slugs: list[str]) -> list[dict]:
        """Coerce the LLM plan into well-formed steps.

        Models sometimes emit plan entries without ``params``, or with a
        ``metric`` only at the top level - fill the gaps instead of letting
        the sql tool fail downstream.
        """
        metric = data.get("metric")
        slugs = list(data.get("company_slugs") or company_slugs or [])
        cleaned: list[dict] = []
        if not isinstance(plan, list):
            return [{"tool": "rag", "params": {}}]
        for step in plan:
            if not isinstance(step, dict):
                continue
            tool_name = str(step.get("tool") or "").strip()
            if not tool_name:
                continue
            params = step.get("params")
            params = dict(params) if isinstance(params, dict) else {}
            if slugs:
                params.setdefault("company_slugs", slugs)
            if metric and not params.get("metric") and not params.get("sql"):
                params["metric"] = metric
            if tool_name == "rag" and not params.get("query"):
                params["query"] = data.get("rewritten_query") or ""
            cleaned.append({"tool": tool_name, "params": params})
        return cleaned or [{"tool": "rag", "params": {}}]

    def _default_plan(self, route: str, data: dict) -> list[dict]:
        """Build a sensible plan when the router omits explicit steps."""
        metric = data.get("metric")
        slugs = data.get("company_slugs") or []
        base: dict = {"company_slugs": slugs} if slugs else {}
        mapping: dict[str, list[dict]] = {
            "rag": [{"tool": "rag", "params": {"query": data.get("rewritten_query") or ""}}],
            "sql": [{"tool": "sql", "params": {**base, "metric": metric}},
                    {"tool": "rag", "params": {}}],
            "python": [{"tool": "python", "params": {"expression": data.get("expression") or ""}},
                       {"tool": "rag", "params": {}}],
            "chart": [{"tool": "chart", "params": {**base, "metric": metric}},
                      {"tool": "insight", "params": {"kpis": {"metric": metric}}}],
            "compare": [{"tool": "compare", "params": {**base, "metric": metric}},
                        {"tool": "chart", "params": {**base, "metric": metric}}],
            "risk": [{"tool": "risk", "params": base}, {"tool": "rag", "params": {}}],
            "general": [{"tool": "rag", "params": {}}],
        }
        return mapping.get(route, mapping["rag"])

    @staticmethod
    def _render(tool_name: str, result: dict) -> str:
        if tool_name == "rag":
            return "DOCUMENT CONTEXT\n" + "\n\n".join(result.get("passages") or [])
        return f"TOOL RESULT [{tool_name}]\n{json.dumps(result, default=str, ensure_ascii=False)}"

    async def _generate(
        self,
        query: str,
        observations: list[str],
        citations: list[Citation],
        client,
        *,
        history: list[dict] | None,
        trace: list[TraceStep],
    ) -> str:
        context = "\n\n---\n\n".join(o for o in observations if o) or "No context retrieved."

        if not client.available():
            trace.append(TraceStep(name="generate", status="skipped",
                                   detail="GROQ_API_KEY not configured"))
            return (
                "LLM is not configured. Set GROQ_API_KEY to enable generated answers.\n\n"
                f"Retrieved context ({len(citations)} citation(s)):\n{context[:1500]}"
            )

        messages = [{"role": "system", "content": ANSWER_SYSTEM}]
        for item in (history or [])[-6:]:
            if item.get("role") in {"user", "assistant"} and item.get("content"):
                messages.append(
                    {"role": item["role"], "content": str(item["content"])[:2000]}
                )
        messages.append(
            {
                "role": "user",
                "content": (
                    f"Numbered source passages:\n{context}\n\n"
                    f"Citation index:\n"
                    f"{json.dumps([c.model_dump(mode='json') for c in citations], ensure_ascii=False)}\n\n"
                    f"Analyst question: {query}"
                ),
            }
        )

        t0 = time.perf_counter()
        try:
            answer = await client.chat_messages(
                messages, temperature=0.2, max_tokens=1800
            )
            trace.append(
                TraceStep(name="generate", status="ok",
                          duration_ms=round((time.perf_counter() - t0) * 1000, 1),
                          payload={"citations": len(citations)})
            )
            return answer.strip()
        except Exception as exc:
            trace.append(TraceStep(name="generate", status="error", detail=str(exc)[:300]))
            return f"Generation failed: {exc}"


_orchestrator: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator
