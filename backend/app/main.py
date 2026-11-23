"""FinSight AI API entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.db.session import dispose_engine

log = get_logger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    log.info("finsight.startup", version=__version__, env=settings.environment)
    yield
    await dispose_engine()
    log.info("finsight.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Production-oriented financial research platform: hybrid RAG over "
            "filings and uploaded documents, SQL/Python financial analytics, "
            "agentic task routing and interactive charting."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {"service": settings.app_name, "version": __version__, "docs": "/docs"}

    return app


app = create_app()
