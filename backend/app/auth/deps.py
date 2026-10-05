import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.models import Admin, RevokedToken, Worker

bearer = HTTPBearer(auto_error=False)


def _unauthorized(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, msg, headers={"WWW-Authenticate": "Bearer"})


def _load(creds, db: Session, token_type: str, model):
    if creds is None:
        raise _unauthorized("Not authenticated")
    try:
        payload = decode_access_token(creds.credentials, token_type)
        if payload.get("jti") and db.get(RevokedToken, payload["jti"]):
            raise _unauthorized("You have been signed out. Please sign in again.")
        obj = db.get(model, uuid.UUID(payload["sub"]))
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired. Please sign in again.")
    except (jwt.PyJWTError, ValueError):
        raise _unauthorized("Invalid authentication token")
    if obj is None or not obj.is_active:
        raise _unauthorized("Account not found or disabled")
    return obj


def get_current_admin(creds: HTTPAuthorizationCredentials | None = Depends(bearer),
                      db: Session = Depends(get_db)) -> Admin:
    return _load(creds, db, "access", Admin)


def get_current_worker(creds: HTTPAuthorizationCredentials | None = Depends(bearer),
                       db: Session = Depends(get_db)) -> Worker:
    """Android-app token (type 'worker'). Admin tokens are rejected here and vice versa."""
    return _load(creds, db, "worker", Worker)
