"""Tool registry for the agentic orchestrator.

Each tool is a small, typed unit of work with:
  * a JSON schema the router LLM can target
  * an async ``run`` implementation
  * a ``trace`` name shown to the user as "what the agent did"

Tools are the ONLY way the agent touches data - the LLM never executes raw
code or unbounded SQL directly.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnprocessableError
from app.core.logging import get_logger
from app.db.models.financial import Company
from app.schemas.chat import ChartSpec
from app.services.financials import calculator as calc
from app.services.financials import queries as fin_queries
from app.services.financials.risk import assess_risk
from app.services.llm.groq_client import get_groq_client
from app.services.llm.prompts import CHART_SYSTEM, FINANCIAL_INSIGHT_SYSTEM
from app.services.rag.retriever import get_retriever

log = get_logger("agents.tools")


@dataclass
class ToolContext:
    session: AsyncSession
    workspace_id: str
    company_slugs: list[str] = field(default_factory=list)
    trace: list[Any] = field(default_factory=list)


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    run: Callable[[dict, ToolContext], Awaitable[dict]]


# --- 1. RAG -------------------------------------------------------------------


async def rag_tool(params: dict, ctx: ToolContext) -> dict:
    query = params.get("query") or ""
    retriever = get_retriever()
    citations, passages, _ = await retriever.retrieve(
        query,
        workspace_id=ctx.workspace_id,
        company_slugs=ctx.company_slugs or params.get("company_slugs"),
        trace=ctx.trace,
    )
    return {
        "citations": [c.model_dump(mode="json") for c in citations],
        "passages": passages,
        "hit_count": len(passages),
    }


# --- 2. SQL -------------------------------------------------------------------


ALLOWED_TABLES = {"financial_statements", "companies", "metric_definitions"}
_SELECT_ONLY = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)
_FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|truncate|grant|create|attach)\b",
                        re.IGNORECASE)


async def run_readonly_sql(session: AsyncSession, sql: str) -> list[dict]:
    """Execute a read-only SELECT after static safety checks."""
    if not _SELECT_ONLY.match(sql) or _FORBIDDEN.search(sql):
        raise UnprocessableError("Only SELECT statements are permitted", code="sql_blocked")
    referenced = set(re.findall(r"\b(?:from|join)\s+([a-z_][a-z0-9_]*)", sql, re.IGNORECASE))
    unknown = {t for t in referenced if t not in ALLOWED_TABLES}
    if unknown:
        raise UnprocessableError(
            f"Table(s) not exposed to the agent: {', '.join(sorted(unknown))}",
            code="sql_blocked",
        )
    result = await session.execute(text(sql))
    if result.returns_rows is None or not result.returns_rows:
        return []
    columns = result.keys()
    return [dict(zip(columns, row)) for row in result.fetchall()]


async def sql_tool(params: dict, ctx: ToolContext) -> dict:
    """Numeric questions: either a whitelisted SELECT or a built-in comparison."""
    metric = params.get("metric")
    slugs = params.get("company_slugs") or ctx.company_slugs

    if params.get("sql"):
        rows = await run_readonly_sql(ctx.session, params["sql"])
        return {"rows": rows, "sql": params["sql"]}

    if metric and slugs:
        column = _metric_to_column(metric)
        data = await fin_queries.compare_metric(
            ctx.session, slugs, column,
            year_from=params.get("year_from"), year_to=params.get("year_to"),
        )
        sql_preview = (
            f"SELECT fiscal_year, {column} FROM financial_statements "
            f"WHERE company_id IN (SELECT id FROM companies WHERE slug IN "
            f"({', '.join(repr(s) for s in slugs)})) ORDER BY fiscal_year"
        )
        return {"series": data, "sql": sql_preview, "metric": metric}

    raise UnprocessableError("sql tool needs either `sql` or `metric` + `company_slugs`")


_METRIC_ALIASES = {
    "revenue": "revenue", "sales": "revenue", "net_sales": "revenue",
    "profit": "net_profit", "net_profit": "net_profit", "net_income": "net_profit",
    "pat": "net_profit", "margin": "net_margin_placeholder",
    "expenses": "operating_expenses", "opex": "operating_expenses",
    "debt": "total_debt", "borrowings": "total_debt",
    "cash": "cash_and_equivalents", "assets": "total_assets",
    "equity": "total_equity", "eps": "eps",
    "capex": "capex", "fcf": "free_cash_flow",
}


def _metric_to_column(metric: str) -> str:
    key = metric.strip().lower().replace(" ", "_")
    column = _METRIC_ALIASES.get(key, key)
    if column.endswith("_placeholder"):
        raise UnprocessableError(
            f"Metric '{metric}' must be computed in Python, not SQL", code="derive_in_python"
        )
    from app.db.models.financial import FinancialStatement

    if not hasattr(FinancialStatement, column):
        raise UnprocessableError(f"Unknown metric '{metric}'", code="unknown_metric")
    return column


# --- 3. Python ----------------------------------------------------------------


_SAFE_NAMES = {name for name in dir(calc) if not name.startswith("_")}
_SAFE_NAMES.update({"abs": abs, "min": min, "max": max, "round": round, "len": len})


async def python_tool(params: dict, ctx: ToolContext) -> dict:
    """Evaluate a derived-metric expression in a locked-down namespace."""
    expression = (params.get("expression") or "").strip()
    if not expression:
        raise UnprocessableError("python tool requires an `expression`")

    _assert_safe_ast(expression)
    namespace = {name: getattr(calc, name) for name in _SAFE_NAMES if name in dir(calc)}
    namespace.update({name: getattr(calc, name) for name in dir(calc) if not name.startswith("_")})
    try:
        value = eval(expression, {"__builtins__": {}}, namespace)  # noqa: S307 - guarded AST
    except Exception as exc:
        raise UnprocessableError(f"Calculation failed: {exc}", code="python_error") from exc

    return {"expression": expression, "result": value}


def _assert_safe_ast(expression: str) -> None:
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise UnprocessableError(f"Invalid expression: {exc}") from exc

    banned = (ast.Import, ast.ImportFrom, ast.Attribute, ast.Lambda, ast.Await, ast.NamedExpr)
    for node in ast.walk(tree):
        if isinstance(node, banned):
            raise UnprocessableError(
                f"{type(node).__name__} is not allowed in expressions", code="python_blocked"
            )
        if isinstance(node, ast.Name) and node.id in {"__import__", "open", "eval", "exec", "globals"}:
            raise UnprocessableError(f"'{node.id}' is not allowed", code="python_blocked")


# --- 4. Chart -----------------------------------------------------------------


async def chart_tool(params: dict, ctx: ToolContext) -> dict:
    """Render a declarative ChartSpec the frontend draws with Recharts."""
    metric = params.get("metric") or "revenue"
    slugs = params.get("company_slugs") or ctx.company_slugs
    if not slugs:
        raise UnprocessableError("chart tool needs `company_slugs`")

    column = _metric_to_column(metric)
    data = await fin_queries.compare_metric(ctx.session, slugs, column)

    series = []
    for slug in slugs:
        series.append(
            {
                "key": slug,
                "label": slug.upper(),
                "data": [
                    {"x": year, "y": data["values"].get(year, {}).get(slug)}
                    for year in data["years"]
                ],
            }
        )

    spec = ChartSpec(
        chart_type=params.get("chart_type") or "line",
        title=params.get("title") or f"{metric.title()} by fiscal year",
        unit="INR cr",
        x_key="fiscal_year",
        series=series,
    )
    return {"chart": spec.model_dump(mode="json")}


# --- 5. Compare / risk / insight ----------------------------------------------


async def compare_tool(params: dict, ctx: ToolContext) -> dict:
    slugs = params.get("company_slugs") or ctx.company_slugs
    if len(slugs) < 2:
        raise UnprocessableError("compare tool needs at least two companies")
    metric = params.get("metric") or "revenue"
    column = _metric_to_column(metric)
    data = await fin_queries.compare_metric(ctx.session, slugs, column)
    return {"metric": metric, "series": data, "companies": slugs}


async def risk_tool(params: dict, ctx: ToolContext) -> dict:
    slugs = params.get("company_slugs") or ctx.company_slugs
    if not slugs:
        raise UnprocessableError("risk tool needs `company_slugs`")

    out = []
    for slug in slugs:
        company, statements = await fin_queries.get_statements_by_slug(ctx.session, slug)
        latest = statements[-1] if statements else None
        previous = statements[-2] if len(statements) > 1 else None
        flags, summary = assess_risk(company.name, latest, previous)
        out.append(
            {
                "company": company.slug,
                "fiscal_year": latest.fiscal_year if latest else None,
                "flags": [f.model_dump(mode="json") for f in flags],
                "summary": summary,
            }
        )
    return {"risks": out}


async def insight_tool(params: dict, ctx: ToolContext) -> dict:
    """AI narrative over the KPI block (Groq)."""
    kpis = params.get("kpis") or {}
    if not kpis:
        raise UnprocessableError("insight tool needs a `kpis` payload")
    client = get_groq_client()
    if not client.available():
        return {"insight": None, "note": "GROQ_API_KEY not configured"}
    text_out = await client.chat(
        system=FINANCIAL_INSIGHT_SYSTEM,
        user=f"Company: {params.get('company', 'unknown')}\nKPIs:\n{kpis}",
        temperature=0.3,
        max_tokens=700,
    )
    return {"insight": text_out}


# --- Registry ------------------------------------------------------------------


TOOLS: list[Tool] = [
    Tool("rag", "Retrieve passages from workspace documents and cite them.",
         {"query": "string"}, rag_tool),
    Tool("sql", "Read-only SQL / built-in metric queries over financial statements.",
         {"metric": "string?", "company_slugs": "array?", "sql": "string?",
          "year_from": "int?", "year_to": "int?"}, sql_tool),
    Tool("python", "Evaluate a derived-metric expression (CAGR, ratios, growth).",
         {"expression": "string"}, python_tool),
    Tool("chart", "Produce a ChartSpec for the frontend.",
         {"metric": "string", "chart_type": "line|bar|area|pie|kpi?",
          "company_slugs": "array?", "title": "string?"}, chart_tool),
    Tool("compare", "Compare one metric across companies/years.",
         {"metric": "string", "company_slugs": "array"}, compare_tool),
    Tool("risk", "Leverage / liquidity / coverage risk assessment.",
         {"company_slugs": "array"}, risk_tool),
    Tool("insight", "Generate an AI narrative from KPI data.",
         {"kpis": "object", "company": "string?"}, insight_tool),
]


def tool_specs() -> list[dict]:
    return [{"name": t.name, "description": t.description, "parameters": t.parameters}
            for t in TOOLS]


def get_tool(name: str) -> Tool:
    for tool in TOOLS:
        if tool.name == name:
            return tool
    raise UnprocessableError(f"Unknown tool '{name}'", code="unknown_tool")
