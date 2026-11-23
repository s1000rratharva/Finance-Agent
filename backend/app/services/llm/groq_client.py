"""Groq chat-completion client with JSON mode + retries."""

from __future__ import annotations

import asyncio
import json
import re
from functools import lru_cache

from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError
from app.core.logging import get_logger

log = get_logger("llm.groq")

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class GroqClient:
    """Thin wrapper so the rest of the code never touches the SDK directly."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or settings.groq_api_key
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if not self._api_key:
                raise ServiceUnavailableError(
                    "GROQ_API_KEY is not configured", code="llm_not_configured"
                )
            from groq import Groq

            self._client = Groq(api_key=self._api_key)
        return self._client

    def available(self) -> bool:
        return bool(self._api_key)

    async def chat(
        self,
        *,
        system: str,
        user: str,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> str:
        model = model or settings.groq_chat_model

        async for attempt in AsyncRetrying(
            retry=retry_if_exception_type(Exception),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
            stop=stop_after_attempt(3),
            reraise=True,
        ):
            with attempt:
                try:
                    return await asyncio.to_thread(
                        self._chat_sync,
                        system,
                        user,
                        model,
                        temperature,
                        max_tokens,
                    )
                except Exception as exc:
                    log.warning("llm.chat_retry", error=str(exc)[:200])
                    raise

        raise ServiceUnavailableError("LLM call failed", code="llm_error")

    def _chat_sync(
        self, system: str, user: str, model: str, temperature: float, max_tokens: int
    ) -> str:
        response = self.client.chat.completions.create(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content or ""

    async def chat_messages(
        self,
        messages: list[dict],
        *,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> str:
        """Chat from a full message list (used by the orchestrator for history)."""
        model = model or settings.groq_chat_model

        def _call() -> str:
            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                messages=messages,
            )
            return response.choices[0].message.content or ""

        return await asyncio.to_thread(_call)

    async def chat_json(self, *, system: str, user: str, model: str | None = None,
                        temperature: float = 0.0) -> str:
        """JSON-mode chat; returns a raw JSON string (fences stripped)."""
        model = model or settings.groq_chat_model

        def _call() -> str:
            response = self.client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            return response.choices[0].message.content or "{}"

        raw = await asyncio.to_thread(_call)
        return _JSON_FENCE.sub("", raw).strip()

    async def chat_json_object(self, **kwargs) -> dict:
        raw = await self.chat_json(**kwargs)
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            log.warning("llm.invalid_json", raw=raw[:200])
            return {}


@lru_cache
def get_groq_client() -> GroqClient:
    return GroqClient()
