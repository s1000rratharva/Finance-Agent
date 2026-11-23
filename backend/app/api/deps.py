"""Shared FastAPI dependencies: auth, sessions, workspace scoping."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.db.models.user import User
from app.db.models.workspace import Workspace, WorkspaceMember
from app.db.session import get_db
from app.services.auth.service import get_user_by_id, resolve_token

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    session: DbSession,
    authorization: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Cookie(alias=settings.cookie_name)] = None,
) -> User:
    """Resolve the caller from the ``Authorization: Bearer`` header or auth cookie."""
    candidate = token
    if authorization and authorization.lower().startswith("bearer "):
        candidate = authorization.split(" ", 1)[1].strip()

    if not candidate:
        raise UnauthorizedError("Not authenticated")

    try:
        user_id = resolve_token(candidate)
    except UnauthorizedError:
        raise
    except Exception as exc:  # malformed token of any kind
        raise UnauthorizedError("Invalid or expired token") from exc

    return await get_user_by_id(session, user_id)


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_workspace(
    session: DbSession,
    user: CurrentUser,
    x_workspace_id: Annotated[str | None, Header()] = None,
) -> Workspace:
    """Resolve the active workspace from the ``X-Workspace-Id`` header.

    Falls back to the user's first workspace; membership is always verified so
    one tenant can never read another tenant's data.
    """
    if x_workspace_id:
        try:
            workspace_uuid = UUID(x_workspace_id)
        except ValueError as exc:
            raise ForbiddenError("Malformed workspace id") from exc

        workspace = (
            await session.execute(select(Workspace).where(Workspace.id == workspace_uuid))
        ).scalar_one_or_none()
        if workspace is None:
            raise ForbiddenError("Workspace not found")

        if workspace.owner_id != user.id:
            member = (
                await session.execute(
                    select(WorkspaceMember).where(
                        WorkspaceMember.workspace_id == workspace.id,
                        WorkspaceMember.user_id == user.id,
                    )
                )
            ).scalar_one_or_none()
            if member is None:
                raise ForbiddenError("You are not a member of this workspace")
        return workspace

    # Default: first owned workspace, then first membership
    owned = (
        await session.execute(
            select(Workspace)
            .where(Workspace.owner_id == user.id)
            .order_by(Workspace.created_at)
            .limit(1)
        )
    ).scalar_one_or_none()
    if owned:
        return owned

    member_row = (
        await session.execute(
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(WorkspaceMember.user_id == user.id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if member_row:
        return member_row

    raise ForbiddenError("No workspace available for this account")


CurrentWorkspace = Annotated[Workspace, Depends(get_current_workspace)]


async def get_optional_workspace(
    session: DbSession, user: CurrentUser, x_workspace_id: Annotated[str | None, Header()] = None
) -> Workspace | None:
    try:
        return await get_current_workspace(session, user, x_workspace_id)
    except ForbiddenError:
        return None


async def open_session() -> AsyncGenerator[AsyncSession, None]:
    """Loose session for background tasks (no request scope)."""
    from app.db.session import get_session_factory

    async with get_session_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
