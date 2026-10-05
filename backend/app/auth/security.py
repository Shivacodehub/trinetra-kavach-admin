import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings


def _b(password: str) -> bytes:
    return password.encode("utf-8")[:72]  # bcrypt input limit


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_b(password), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_b(password), password_hash.encode())
    except ValueError:
        return False


# Used so a login for an unknown email costs the same as a real one.
DUMMY_HASH = hash_password("not-a-real-password")


def create_access_token(subject: str, minutes: int, token_type: str = "access") -> tuple[str, int]:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "type": token_type, "jti": uuid.uuid4().hex, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), minutes * 60


def decode_access_token(token: str, expected_type: str = "access") -> dict:
    s = get_settings()
    payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], options={"require": ["exp", "sub"]})
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
