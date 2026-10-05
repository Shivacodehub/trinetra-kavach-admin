import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AssessmentScore, Certificate, TrainingAttempt
from app.utils.time import as_utc, now_utc

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I
DISCLAIMER = ("Prototype training record from the TRINETRA KAVACH assessment workflow. "
              "Not a government-approved or legally recognised certification.")


def new_certificate_id() -> str:
    return "CERT-TK-2026-" + "".join(secrets.choice(ALPHABET) for _ in range(8))


def verify_url(certificate_id: str) -> str:
    return f"{get_settings().public_base_url.rstrip('/')}/verify/{certificate_id}"


def effective_status(c: Certificate, now: datetime | None = None) -> str:
    now = now or now_utc()
    if c.status == "revoked":
        return "revoked"
    if c.expires_at and as_utc(c.expires_at) <= now:
        return "expired"
    return "valid"


def status_clause(status: str, now: datetime):
    if status == "revoked":
        return Certificate.status == "revoked"
    live = and_(Certificate.status == "valid")
    if status == "expired":
        return and_(live, Certificate.expires_at.is_not(None), Certificate.expires_at <= now)
    return and_(live, or_(Certificate.expires_at.is_(None), Certificate.expires_at > now))


def has_effective_certificate(db: Session, worker_id: uuid.UUID, module_id: uuid.UUID) -> bool:
    q = select(Certificate.id).where(Certificate.worker_id == worker_id, Certificate.module_id == module_id,
                                     status_clause("valid", now_utc())).limit(1)
    return db.scalar(q) is not None


def issue_for_attempt(db: Session, attempt: TrainingAttempt, admin_id=None) -> Certificate:
    """Caller must have checked the attempt passed. Caller commits."""
    score = attempt.score
    for _ in range(5):
        cid = new_certificate_id()
        if not db.scalar(select(Certificate.id).where(Certificate.certificate_id == cid)):
            break
    days = get_settings().certificate_validity_days
    issued = as_utc(attempt.ended_at) or now_utc()
    cert = Certificate(certificate_id=cid, attempt_pk=attempt.id, worker_id=attempt.worker_id,
                       module_id=attempt.module_id, score=score.score, issued_at=issued,
                       expires_at=issued + timedelta(days=days) if days > 0 else None,
                       is_demo=attempt.is_demo)
    db.add(cert)
    db.flush()
    return cert


def cert_item(c: Certificate, count: int | None = None, last: datetime | None = None) -> dict:
    return {
        "certificate_id": c.certificate_id,
        "worker": {"id": c.worker.id, "worker_code": c.worker.worker_code, "name": c.worker.name},
        "module": {"id": c.module.id, "name": c.module.name},
        "score": float(c.score), "result": "pass",
        "issued_at": c.issued_at, "expires_at": c.expires_at,
        "status": effective_status(c), "revoked_at": c.revoked_at, "revoked_reason": c.revoked_reason,
        "verify_url": verify_url(c.certificate_id),
        "verification_count": count or 0, "last_verified_at": last, "is_demo": c.is_demo,
    }
