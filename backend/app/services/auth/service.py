"""Registration, login and current-user resolution."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.models.user import User
from app.db.models.workspace import Workspace


async def register_user(
    session: AsyncSession, *, email: str, name: str, password: str
) -> tuple[User, str]:
    existing = (
        await session.execute(select(User).where(User.email == email.lower().strip()))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("An account with this email already exists")

    user = User(
        email=email.lower().strip(),
        name=name.strip(),
        hashed_password=hash_password(password),
    )
    session.add(user)
    await session.flush()

    # Every account gets a default workspace so uploads work immediately.
    slug = _unique_slug(email)
    session.add(
        Workspace(
            name=f"{name.split()[0]}'s workspace",
            slug=slug,
            owner_id=user.id,
            description="Default workspace created at signup",
        )
    )
    await session.flush()

    token = create_access_token(str(user.id), extra_claims={"email": user.email})
    return user, token


async def login_user(session: AsyncSession, *, email: str, password: str) -> tuple[User, str]:
    user = (
        await session.execute(select(User).where(User.email == email.lower().strip()))
    ).scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        # Uniform error: never reveal whether the email exists.
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")

    token = create_access_token(str(user.id), extra_claims={"email": user.email})
    return user, token


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User:
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise UnauthorizedError("Account no longer exists")
    return user


def resolve_token(token: str) -> UUID:
    payload = decode_access_token(token)
    sub = payload.get("sub")
    if not sub:
        raise UnauthorizedError("Token missing subject")
    try:
        return UUID(str(sub))
    except ValueError as exc:
        raise UnauthorizedError("Token subject is not a valid id") from exc


def _unique_slug(email: str) -> str:
    local = email.split("@")[0]
    cleaned = "".join(c if c.isalnum() or c in "-_" else "-" for c in local.lower())
    return f"ws-{cleaned or 'workspace'}"
