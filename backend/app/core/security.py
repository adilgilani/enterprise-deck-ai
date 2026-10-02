"""Password hashing (Argon2id) and signed tokens (JWT, HS256).

Token types:
  access  — API bearer token for a user session (session id embedded so it can be revoked)
  ws      — very short-lived ticket used to open a meeting WebSocket (avoids long-lived tokens in URLs)
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_token(subject: uuid.UUID, token_type: str, ttl: timedelta, **claims: Any) -> str:
    now = datetime.now(UTC)
    payload = {"sub": str(subject), "type": token_type, "iat": now, "exp": now + ttl, **claims}
    return jwt.encode(payload, get_settings().secret_key.get_secret_value(), algorithm=ALGORITHM)


def create_access_token(user_id: uuid.UUID, session_id: uuid.UUID) -> str:
    ttl = timedelta(minutes=get_settings().access_token_ttl_minutes)
    return create_token(user_id, "access", ttl, sid=str(session_id))


def create_ws_ticket(user_id: uuid.UUID, org_id: uuid.UUID, meeting_id: uuid.UUID) -> str:
    return create_token(user_id, "ws", timedelta(seconds=60), org=str(org_id), mid=str(meeting_id))


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    payload = jwt.decode(token, get_settings().secret_key.get_secret_value(), algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def generate_api_key() -> tuple[str, str, str]:
    """Returns (plaintext, prefix, sha256 hash). Only the hash is stored."""
    raw = "eai_" + secrets.token_urlsafe(32)
    return raw, raw[:10], hashlib.sha256(raw.encode()).hexdigest()


def generate_share_token() -> str:
    return secrets.token_urlsafe(24)
