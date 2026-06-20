"""
Vishleshan Auth Utilities
─────────────────────────
API-key generation, bcrypt hashing/verification, and short-lived JWT creation
for the dashboard_login flow.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Tuple

from passlib.context import CryptContext
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "change-me-in-production"))
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── API Key helpers ─────────────────────────────────────────────────────────

def generate_api_key() -> Tuple[str, str]:
    """
    Generate a new API key.

    Returns
    -------
    (raw_key, bcrypt_hash)
        raw_key  – prefixed with "vsh_", show to user ONCE
        bcrypt_hash – store in DB
    """
    raw_key = "vsh_" + secrets.token_urlsafe(32)       # ~43 chars after prefix
    hashed  = _pwd_ctx.hash(raw_key)
    return raw_key, hashed


def verify_api_key(raw_key: str, hashed: str) -> bool:
    """
    Constant-time bcrypt comparison of the raw key against the stored hash.
    """
    try:
        return _pwd_ctx.verify(raw_key, hashed)
    except Exception:
        return False


# ── JWT helpers ─────────────────────────────────────────────────────────────

def create_short_jwt(user_id: str, email: str) -> str:
    """
    Create a 15-minute JWT with purpose="dashboard_login".

    The token is signed with SECRET_KEY using HS256.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub":     str(user_id),
        "email":   email,
        "purpose": "dashboard_login",
        "iat":     now,
        "exp":     now + timedelta(minutes=15),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt(token: str) -> dict:
    """
    Decode and validate a JWT.

    Returns the full payload dict on success.
    Raises jose.JWTError on invalid / expired tokens.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
