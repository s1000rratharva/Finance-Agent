"""Liveness/readiness probes."""

import socket

from fastapi import APIRouter
from sqlalchemy import text

from app import __version__
from app.core.config import settings
from app.db.session import get_session_factory
from app.schemas.common import HealthStatus

router = APIRouter()


def _tcp_reachable(host: str, port: int, timeout: float = 0.75) -> bool:
    """Cheap reachability probe that never touches the event loop."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _db_host() -> str:
    """Host parsed from DATABASE_URL (asyncpg URL without the driver suffix)."""
    from urllib.parse import urlparse

    parsed = urlparse(settings.database_url.replace("+asyncpg", ""))
    return parsed.hostname or "localhost"


def _db_port() -> int:
    from urllib.parse import urlparse

    parsed = urlparse(settings.database_url.replace("+asyncpg", ""))
    return parsed.port or 5432


@router.get("/health", response_model=HealthStatus, summary="Health check")
async def health() -> HealthStatus:
    checks: dict[str, str] = {}

    # Postgres - asyncpg raises bare ConnectionRefusedError (an OSError), so
    # probe the socket first rather than relying on SQLAlchemyError alone.
    if not _tcp_reachable(_db_host(), _db_port()):
        checks["postgres"] = "unreachable"
    else:
        try:
            async with get_session_factory()() as session:
                await session.execute(text("SELECT 1"))
            checks["postgres"] = "ok"
        except Exception:
            checks["postgres"] = "error"

    # Chroma - probe the socket first so a down server can't surface an
    # exception from Chroma's async client outside our error boundary, then
    # run the heartbeat in a thread so a slow/unreachable store never blocks
    # the event loop.
    if not _tcp_reachable(settings.chroma_host, settings.chroma_port):
        checks["chroma"] = "unreachable"
    else:
        try:
            import asyncio

            from app.services.rag.vector_store import get_vector_store

            await asyncio.to_thread(get_vector_store().client.heartbeat)
            checks["chroma"] = "ok"
        except Exception:
            checks["chroma"] = "error"

    # Groq key present (not a live call - keeps /health dependency-free)
    checks["groq"] = "configured" if settings.groq_api_key else "missing"

    degraded = checks["postgres"] != "ok"
    return HealthStatus(
        status="degraded" if degraded else "ok",
        version=__version__,
        environment=settings.environment,
        checks=checks,
    )


@router.get("/ready", include_in_schema=False)
async def ready() -> dict:
    return {"ready": True}
