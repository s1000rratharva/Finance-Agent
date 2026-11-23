"""API v1 router aggregation."""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.endpoints import (
    analytics,
    auth,
    chat,
    companies,
    documents,
    evaluations,
    health,
    workspaces,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["workspaces"])

# Catalogue / analytics / evaluation data requires an authenticated caller.
# Applied router-level so any endpoint added here is private by default.
_auth = [Depends(get_current_user)]
api_router.include_router(
    companies.router, prefix="/companies", tags=["companies"], dependencies=_auth
)
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(
    analytics.router, prefix="/analytics", tags=["analytics"], dependencies=_auth
)
api_router.include_router(
    evaluations.router, prefix="/evaluations", tags=["evaluations"], dependencies=_auth
)
