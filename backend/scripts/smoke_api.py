"""End-to-end API smoke test against a live uvicorn instance.

Exercises the full request path a browser would take: auth -> workspace ->
companies -> analytics -> document upload -> chat -> evaluations.

Usage: python smoke_api.py [base_url]
"""

from __future__ import annotations

import io
import sys
import uuid

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
PASS: list[str] = []
FAIL: list[tuple[str, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASS.append(name)
        print(f"  PASS  {name}")
    else:
        FAIL.append((name, detail))
        print(f"  FAIL  {name} :: {detail}")


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=30.0)

    print("\n== health ==")
    health = client.get("/api/v1/health")
    check("health 200", health.status_code == 200, str(health.status_code))
    check("health has checks", {"postgres", "chroma", "groq"} <= set(health.json().get("checks", {})))

    print("\n== auth ==")
    # Unique per run so the test is re-runnable against a persistent DB.
    email = f"analyst-{uuid.uuid4().hex[:10]}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "Test Analyst", "password": "password123"},
    )
    check("register 201", reg.status_code == 201, reg.text[:200])
    check("register sets cookie", "finsight_token" in client.cookies)

    me = client.get("/api/v1/auth/me")
    check("me 200", me.status_code == 200, me.text[:200])
    check("me email matches", me.json().get("email") == email, me.text[:200])

    dup = client.post(
        "/api/v1/auth/register",
        json={"email": email, "name": "Dup", "password": "password123"},
    )
    check("duplicate register 409", dup.status_code == 409, str(dup.status_code))

    bad = httpx.Client(base_url=BASE, timeout=30.0).post(
        "/api/v1/auth/login", json={"email": email, "password": "wrong-password"}
    )
    check("bad login 401", bad.status_code == 401, str(bad.status_code))

    print("\n== workspace ==")
    ws = client.get("/api/v1/workspaces").json()
    check("default workspace created", len(ws) >= 1, str(ws))
    workspace_id = ws[0]["id"]
    client.headers["X-Workspace-Id"] = workspace_id

    stats = client.get("/api/v1/workspaces/current/stats")
    check("workspace stats 200", stats.status_code == 200, stats.text[:200])
    check("stats shape", set(stats.json()) == {"documents", "chunks", "conversations"}, stats.text)

    print("\n== companies ==")
    companies = client.get("/api/v1/companies")
    check("companies 200", companies.status_code == 200, companies.text[:200])
    names = {c["slug"] for c in companies.json()}
    check(
        "seeded slugs present",
        {"reliance-industries", "tcs", "infosys"} <= names,
        str(names),
    )

    detail = client.get("/api/v1/companies/reliance-industries")
    check("company detail 200", detail.status_code == 200, detail.text[:200])
    check("company has 5 statements", len(detail.json().get("statements", [])) == 5,
          str(len(detail.json().get("statements", []))))

    missing = client.get("/api/v1/companies/does-not-exist")
    check("unknown company 404", missing.status_code == 404, str(missing.status_code))

    cmp_ = client.get(
        "/api/v1/companies/compare/revenue",
        params={"slugs": "reliance-industries,tcs,infosys"},
    )
    check("compare 200", cmp_.status_code == 200, cmp_.text[:200])
    body = cmp_.json()
    check("compare has 3 companies", len(body.get("companies", [])) == 3, cmp_.text[:200])
    check("compare has 5 years", len(body.get("series", [])) == 5, str(len(body.get("series", []))))

    print("\n== analytics ==")
    overview = client.get("/api/v1/analytics/tcs/overview")
    check("overview 200", overview.status_code == 200, overview.text[:200])
    check("overview has KPIs", len(overview.json().get("kpis", [])) >= 5, overview.text[:200])
    kpi = next((k for k in overview.json()["kpis"] if k["key"] == "revenue"), None)
    check("revenue KPI has value", bool(kpi and kpi["value"]), str(kpi))

    trends = client.get("/api/v1/analytics/tcs/trends", params={"metrics": "revenue,net_profit"})
    check("trends 200", trends.status_code == 200, trends.text[:200])
    check("trends 2 series", len(trends.json()) == 2, trends.text[:200])
    check("trends 5 points", all(len(t["points"]) == 5 for t in trends.json()), trends.text[:200])

    ratios = client.get("/api/v1/analytics/tcs/ratios")
    check("ratios 200", ratios.status_code == 200, ratios.text[:200])
    first_ratio = ratios.json()[0]
    check("ratio keys present", "debt_to_equity" in first_ratio["ratios"], str(first_ratio))

    risks = client.get("/api/v1/analytics/reliance-industries/risks")
    check("risks 200", risks.status_code == 200, risks.text[:200])
    check("risk flags returned", len(risks.json().get("flags", [])) >= 2, risks.text[:300])
    check("risk summary present", bool(risks.json().get("summary")), risks.text[:200])

    print("\n== document upload + ingestion ==")
    csv_bytes = b"metric,FY2024,FY2025\nTotal Revenue,899041,964643\nNet Profit,79020,91002\n"
    up = client.post(
        "/api/v1/documents",
        files={"file": ("reliance_financials.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"sync": "true"},
    )
    check("upload 201", up.status_code == 201, up.text[:400])
    doc = up.json().get("document", {})
    check("document ready", doc.get("status") == "ready", up.text[:400])
    check("chunks created", doc.get("chunk_count", 0) >= 1, str(doc.get("chunk_count")))

    ingest = up.json().get("ingestion") or {}
    check("tables detected", ingest.get("tables_detected", 0) >= 1, str(ingest))

    docs = client.get("/api/v1/documents")
    check("documents list 200", docs.status_code == 200, docs.text[:200])
    check("documents has 1 item", len(docs.json()) == 1, str(len(docs.json())))

    chunks = client.get(f"/api/v1/documents/{doc['id']}/chunks")
    check("chunks 200", chunks.status_code == 200, chunks.text[:200])
    check("chunk text non-empty", all(c["text"].strip() for c in chunks.json()), chunks.text[:200])

    stats2 = client.get("/api/v1/workspaces/current/stats").json()
    check("stats counted chunks", stats2["chunks"] >= 1, str(stats2))

    print("\n== chat (graceful degradation) ==")
    chat = client.post(
        "/api/v1/chat",
        json={
            "message": "What was Reliance revenue in FY2025?",
            "workspace_id": workspace_id,
            "company_slugs": ["reliance-industries"],
        },
    )
    check("chat 200", chat.status_code == 200, chat.text[:400])
    chat_body = chat.json()
    check("chat has answer", bool(chat_body.get("answer")), chat.text[:400])
    check("chat has conversation id", bool(chat_body.get("conversation_id")), chat.text[:200])
    check("chat has trace steps", len(chat_body.get("trace", [])) >= 2, str(chat_body.get("trace"))[:300])
    # BM25 must still retrieve a grounded citation without Chroma/Groq.
    check("chat has citations", len(chat_body.get("citations", [])) >= 1, chat.text[:300])

    convs = client.get("/api/v1/chat/conversations")
    check("conversations 200", convs.status_code == 200, convs.text[:200])
    check("conversation persisted", len(convs.json()) == 1, str(len(convs.json())))

    if chat_body.get("conversation_id"):
        msgs = client.get(
            f"/api/v1/chat/conversations/{chat_body['conversation_id']}/messages"
        )
        check("messages 200", msgs.status_code == 200, msgs.text[:200])
        check("user+assistant persisted", len(msgs.json()) == 2, str(len(msgs.json())))

    print("\n== evaluations ==")
    datasets = client.get("/api/v1/evaluations/datasets")
    check("datasets 200", datasets.status_code == 200, datasets.text[:200])
    check("default dataset listed", "default" in datasets.json(), str(datasets.json()))

    run = client.post("/api/v1/evaluations/run", json={"dataset_name": "default", "limit": 3})
    check("eval run accepted", run.status_code == 202, run.text[:400])
    check("eval run has scores", bool(run.json().get("scores")), run.text[:400])

    runs = client.get("/api/v1/evaluations/runs")
    check("eval runs listed", runs.status_code == 200 and len(runs.json()) >= 1, runs.text[:200])

    print("\n== tenancy isolation ==")
    other = httpx.Client(base_url=BASE, timeout=30.0)
    other.post(
        "/api/v1/auth/register",
        json={"email": f"other-{uuid.uuid4().hex[:10]}@example.com", "name": "Other User", "password": "password123"},
    )
    other_ws = other.get("/api/v1/workspaces").json()[0]["id"]

    # Tenant B must not see tenant A's document, even with its id.
    leak = other.get(f"/api/v1/documents/{doc['id']}", headers={"X-Workspace-Id": other_ws})
    check("cross-tenant document 404", leak.status_code == 404, str(leak.status_code))

    docs_b = other.get("/api/v1/documents", headers={"X-Workspace-Id": other_ws})
    check("tenant B sees no documents", docs_b.json() == [], str(docs_b.json()))

    # Tenant B must not be able to use tenant A's workspace id.
    forged = other.get(
        "/api/v1/workspaces/current/stats", headers={"X-Workspace-Id": workspace_id}
    )
    check("forged workspace id rejected", forged.status_code == 403, str(forged.status_code))

    print("\n== auth guards ==")
    anon = httpx.Client(base_url=BASE, timeout=30.0)
    check("anon chat 401", anon.post("/api/v1/chat", json={"message": "hi", "workspace_id": "x"}).status_code == 401)
    check("anon companies 401", anon.get("/api/v1/companies").status_code == 401)

    print(f"\n{'=' * 60}")
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    for name, detail in FAIL:
        print(f"  - {name}: {detail}")
    print("=" * 60)
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
