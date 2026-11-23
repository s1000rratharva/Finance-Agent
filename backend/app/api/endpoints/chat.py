"""Conversational RAG endpoint (single-turn + threaded history)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.deps import CurrentUser, CurrentWorkspace, DbSession
from app.core.exceptions import NotFoundError
from app.db.models.document import Conversation, Message
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationOut,
    MessageOut,
)
from app.schemas.common import OkResponse
from app.services.agents.orchestrator import get_orchestrator

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest, workspace: CurrentWorkspace, user: CurrentUser, session: DbSession
) -> ChatResponse:
    """Run the full agentic RAG pipeline and persist the exchange."""
    if payload.workspace_id != workspace.id:
        # Workspace is resolved + authorised via header; body must agree.
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("workspace_id does not match the active workspace")

    conversation: Conversation | None = None
    history: list[dict] = []

    if payload.conversation_id:
        conversation = (
            await session.execute(
                select(Conversation).where(
                    Conversation.id == payload.conversation_id,
                    Conversation.workspace_id == workspace.id,
                    Conversation.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if conversation is None:
            raise NotFoundError("Conversation not found")

        messages = (
            await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at)
            )
        ).scalars().all()
        history = [{"role": m.role, "content": m.content} for m in messages]
    else:
        conversation = Conversation(
            workspace_id=workspace.id,
            user_id=user.id,
            title=payload.message[:80],
        )
        session.add(conversation)
        await session.flush()

    result = await get_orchestrator().run(
        payload.message,
        session=session,
        workspace_id=str(workspace.id),
        company_slugs=payload.company_slugs,
        history=history,
        top_k=payload.top_k,
    )

    user_message = Message(
        conversation_id=conversation.id, role="user", content=payload.message
    )
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result.answer,
        citations_json=[c.model_dump(mode="json") for c in result.citations],
        trace_json=[t.model_dump(mode="json") for t in result.trace],
    )
    session.add_all([user_message, assistant_message])
    await session.flush()

    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        answer=result.answer,
        citations=result.citations,
        trace=result.trace,
        charts=result.charts,
        sql=result.sql,
        created_at=assistant_message.created_at,
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    workspace: CurrentWorkspace, user: CurrentUser, session: DbSession
) -> list[ConversationOut]:
    result = await session.execute(
        select(Conversation)
        .where(Conversation.workspace_id == workspace.id, Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    return [ConversationOut.model_validate(c) for c in result.scalars().all()]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: uuid.UUID,
    workspace: CurrentWorkspace,
    user: CurrentUser,
    session: DbSession,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[MessageOut]:
    conversation = (
        await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == workspace.id,
                Conversation.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if conversation is None:
        raise NotFoundError("Conversation not found")

    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
        .limit(limit)
    )
    return [MessageOut.model_validate(m) for m in result.scalars().all()]


@router.delete("/conversations/{conversation_id}", response_model=OkResponse)
async def delete_conversation(
    conversation_id: uuid.UUID,
    workspace: CurrentWorkspace,
    user: CurrentUser,
    session: DbSession,
) -> OkResponse:
    conversation = (
        await session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == workspace.id,
                Conversation.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if conversation is None:
        raise NotFoundError("Conversation not found")

    await session.delete(conversation)
    await session.flush()
    return OkResponse(message="Conversation deleted")
