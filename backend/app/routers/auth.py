from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.deps import bearer, get_current_admin
from app.auth.security import DUMMY_HASH, create_access_token, decode_access_token, verify_password
from app.config import get_settings
from app.database import get_db
from app.models import Admin, RevokedToken
from app.schemas.auth import AdminOut, LoginRequest, TokenResponse
from app.services import audit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    s = get_settings()
    email = body.email.strip().lower()
    admin = db.scalar(select(Admin).where(Admin.email == email))
    password_ok = verify_password(body.password, admin.password_hash if admin else DUMMY_HASH)
    if not admin or not password_ok or not admin.is_active:
        audit.record(db, None, "admin.login_failed", "admin", None, {"email": email})
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password",
                            headers={"WWW-Authenticate": "Bearer"})
    admin.last_login_at = datetime.now(timezone.utc)
    audit.record(db, admin.id, "admin.login", "admin", str(admin.id))
    db.commit()
    minutes = s.remember_me_minutes if body.remember_me else s.access_token_minutes
    token, expires_in = create_access_token(str(admin.id), minutes)
    return TokenResponse(access_token=token, expires_in=expires_in, admin=AdminOut.model_validate(admin))


@router.get("/me", response_model=AdminOut)
def me(admin: Admin = Depends(get_current_admin)):
    return admin


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(admin: Admin = Depends(get_current_admin), creds: HTTPAuthorizationCredentials = Depends(bearer),
           db: Session = Depends(get_db)):
    """Revokes this token on the server (it is rejected from now on) and records the event for audit."""
    payload = decode_access_token(creds.credentials)
    now = datetime.now(timezone.utc)
    db.execute(delete(RevokedToken).where(RevokedToken.expires_at < now))  # housekeeping
    if payload.get("jti") and not db.get(RevokedToken, payload["jti"]):
        db.add(RevokedToken(jti=payload["jti"], expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc)))
    audit.record(db, admin.id, "admin.logout", "admin", str(admin.id))
    db.commit()
