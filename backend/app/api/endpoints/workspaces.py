"""Workspace CRUD + stats (tenant isolation boundary)."""

from fastapi import APIRouter, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, CurrentWorkspace, DbSession
from app.core.exceptions import ConflictError, NotFoundError
from app.db.models.document import Conversation, Document, DocumentChunk
from app.db.models.workspace import Workspace
from app.schemas.common import OkResponse
from app.schemas.workspace import WorkspaceCreate, WorkspaceOut, WorkspaceStats

router = APIRouter()


def _slugify(name: str) -> str:
    import re

    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "workspace"
    return base[:120]


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(user: CurrentUser, session: DbSession) -> list[WorkspaceOut]:
    result = await session.execute(
        select(Workspace).where(Workspace.owner_id == user.id).order_by(Workspace.created_at)
    )
    return [WorkspaceOut.model_validate(w) for w in result.scalars().all()]


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate, user: CurrentUser, session: DbSession
) -> WorkspaceOut:
    slug = _slugify(payload.name)
    existing = (
        await session.execute(select(Workspace.id).where(Workspace.slug == slug))
    ).first()
    if existing:
        slug = f"{slug}-{user.id.hex[:6]}"

    workspace = Workspace(
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
        owner_id=user.id,
    )
    session.add(workspace)
    await session.flush()
    return WorkspaceOut.model_validate(workspace)


@router.get("/current", response_model=WorkspaceOut)
async def current_workspace(workspace: CurrentWorkspace) -> WorkspaceOut:
    return WorkspaceOut.model_validate(workspace)


@router.get("/current/stats", response_model=WorkspaceStats)
async def workspace_stats(
    workspace: CurrentWorkspace, session: DbSession
) -> WorkspaceStats:
    doc_count = (
        await session.execute(
            select(func.count(Document.id)).where(Document.workspace_id == workspace.id)
        )
    ).scalar() or 0
    chunk_count = (
        await session.execute(
            select(func.count(DocumentChunk.id)).where(
                DocumentChunk.workspace_id == workspace.id
            )
        )
    ).scalar() or 0
    convo_count = (
        await session.execute(
            select(func.count(Conversation.id)).where(
                Conversation.workspace_id == workspace.id
            )
        )
    ).scalar() or 0
    return WorkspaceStats(documents=doc_count, chunks=chunk_count, conversations=convo_count)


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: str, user: CurrentUser, session: DbSession
) -> WorkspaceOut:
    import uuid as uuid_lib

    try:
        parsed = uuid_lib.UUID(workspace_id)
    except ValueError as exc:
        raise NotFoundError("Workspace not found") from exc

    workspace = (
        await session.execute(
            select(Workspace).where(Workspace.id == parsed, Workspace.owner_id == user.id)
        )
    ).scalar_one_or_none()
    if workspace is None:
        raise NotFoundError("Workspace not found")
    return WorkspaceOut.model_validate(workspace)


@router.delete("/{workspace_id}", response_model=OkResponse)
async def delete_workspace(
    workspace_id: str, user: CurrentUser, session: DbSession
) -> OkResponse:
    import uuid as uuid_lib

    try:
        parsed = uuid_lib.UUID(workspace_id)
    except ValueError as exc:
        raise NotFoundError("Workspace not found") from exc

    workspace = (
        await session.execute(
            select(Workspace).where(Workspace.id == parsed, Workspace.owner_id == user.id)
        )
    ).scalar_one_or_none()
    if workspace is None:
        raise NotFoundError("Workspace not found")
    if workspace.slug == "default":
        raise ConflictError("The default workspace cannot be deleted")

    await session.delete(workspace)
    await session.flush()
    return OkResponse(message="Workspace deleted")
