"""Auth primitives: hashing, JWT round-trip, service-level guards."""

import uuid

import pytest

from app.core.exceptions import UnauthorizedError
from app.core.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("s3cure-Passw0rd!")
    assert hashed != "s3cure-Passw0rd!"
    assert verify_password("s3cure-Passw0rd!", hashed)
    assert not verify_password("wrong-password", hashed)


def test_password_hashes_are_salted():
    a = hash_password("same-password")
    b = hash_password("same-password")
    assert a != b  # bcrypt salt differs per hash


def test_jwt_roundtrip():
    user_id = str(uuid.uuid4())
    token = create_access_token(user_id, extra_claims={"email": "a@b.com"})
    payload = decode_access_token(token)
    assert payload["sub"] == user_id
    assert payload["email"] == "a@b.com"
    assert payload["type"] == "access"


def test_expired_token_rejected():
    token = create_access_token("someone", expires_minutes=-1)
    with pytest.raises(TokenError):
        decode_access_token(token)


def test_tampered_token_rejected():
    token = create_access_token("someone")
    with pytest.raises(TokenError):
        decode_access_token(token + "x")


def test_login_service_rejects_unknown_user():
    """Unknown email must fail identically to a wrong password."""
    from app.services.auth import service as auth_service

    class _FakeSession:
        async def execute(self, *_args, **_kwargs):
            class _Result:
                def scalar_one_or_none(self):
                    return None

            return _Result()

    with pytest.raises(UnauthorizedError):
        # asyncio.run keeps this a plain sync test
        import asyncio

        asyncio.run(
            auth_service.login_user(_FakeSession(), email="ghost@x.com", password="whatever")
        )
