import hashlib
import io
import re
import uuid
from typing import Literal

import segno
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import get_current_admin
from app.config import get_settings
from app.database import get_db
from app.models import Admin, AssessmentScore, Certificate, CertificateVerification, TrainingAttempt, Worker
from app.schemas.common import PageParams, page_of
from app.services import audit
from app.services.access import check_org_access, effective_org
from app.services.certificates import (DISCLAIMER, cert_item, effective_status, issue_for_attempt, status_clause,
                                       verify_url)
from app.services.ratelimit import RateLimiter
from app.utils.time import now_utc

router = APIRouter(prefix="/certificates", tags=["Certificates"])
public = APIRouter(prefix="/certificates", tags=["Public Verification"])
_ID = re.compile(r"^[A-Za-z0-9-]{6,64}$")


class CertificateCreate(BaseModel):
    attempt_id: uuid.UUID = Field(description="Server id of a PASSED attempt (the `id` field from /assessments)")


class RevokeBody(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


def _load(db: Session, admin: Admin, certificate_id: str) -> Certificate:
    c = db.scalar(select(Certificate).where(Certificate.certificate_id == certificate_id.upper())
                  .options(joinedload(Certificate.worker), joinedload(Certificate.module)))
    if not c:
        raise HTTPException(404, "Certificate not found")
    check_org_access(admin, c.worker.organization_id)
    return c


def _verif_counts(db: Session, c: Certificate):
    return db.execute(select(func.count(CertificateVerification.id), func.max(CertificateVerification.verified_at))
                      .where(CertificateVerification.certificate_pk == c.id)).one()


@router.get("")
def list_certificates(pp: PageParams = Depends(), search: str | None = Query(None, max_length=80),
                      status: Literal["valid", "revoked", "expired"] | None = None,
                      module_id: uuid.UUID | None = None, organization_id: uuid.UUID | None = None,
                      sort_order: Literal["asc", "desc"] = "desc",
                      db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    ver = (select(CertificateVerification.certificate_pk.label("cpk"), func.count().label("n"),
                  func.max(CertificateVerification.verified_at).label("last"))
           .where(CertificateVerification.certificate_pk.is_not(None)).group_by(CertificateVerification.certificate_pk).subquery())
    stmt = (select(Certificate, ver.c.n, ver.c.last).join(Worker, Worker.id == Certificate.worker_id)
            .outerjoin(ver, ver.c.cpk == Certificate.id))
    org = effective_org(admin, organization_id)
    if org:
        stmt = stmt.where(Worker.organization_id == org)
    if module_id:
        stmt = stmt.where(Certificate.module_id == module_id)
    if status:
        stmt = stmt.where(status_clause(status, now_utc()))
    if search and search.strip():
        t = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Certificate.certificate_id.ilike(f"%{t}%", escape="\\") | Worker.name.ilike(f"%{t}%", escape="\\")
                          | Worker.worker_code.ilike(f"%{t}%", escape="\\"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = Certificate.issued_at.desc() if sort_order == "desc" else Certificate.issued_at.asc()
    rows = db.execute(stmt.options(joinedload(Certificate.worker), joinedload(Certificate.module)).order_by(order, Certificate.id)
                      .offset(pp.offset).limit(pp.page_size)).unique().all()
    return page_of([cert_item(c, n, last) for c, n, last in rows], total, pp)


@router.get("/stats")
def stats(organization_id: uuid.UUID | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    org, now = effective_org(admin, organization_id), now_utc()
    def n(*cond):
        q = select(func.count(Certificate.id)).join(Worker, Worker.id == Certificate.worker_id).where(*cond)
        return db.scalar(q.where(Worker.organization_id == org) if org else q) or 0
    from datetime import timedelta
    return {"issued": n(), "active": n(status_clause("valid", now)), "revoked": n(Certificate.status == "revoked"),
            "expired": n(status_clause("expired", now)),
            "expiring_30d": n(status_clause("valid", now), Certificate.expires_at.is_not(None),
                              Certificate.expires_at <= now + timedelta(days=30))}


@router.post("", status_code=201)
def create_certificate(body: CertificateCreate, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    a = db.scalar(select(TrainingAttempt).where(TrainingAttempt.id == body.attempt_id)
                  .options(joinedload(TrainingAttempt.worker), joinedload(TrainingAttempt.score)))
    if not a:
        raise HTTPException(404, "Attempt not found")
    check_org_access(admin, a.worker.organization_id)
    if not a.score or not a.score.passed:
        raise HTTPException(422, "Certificates can only be issued for passed assessments")
    if db.scalar(select(Certificate.id).where(Certificate.attempt_pk == a.id)):
        raise HTTPException(409, "A certificate already exists for this attempt")
    c = issue_for_attempt(db, a, admin.id)
    audit.record(db, admin.id, "certificate.create", "certificate", c.certificate_id)
    db.commit()
    return cert_item(_load(db, admin, c.certificate_id))


@router.get("/{certificate_id}")
def certificate_detail(certificate_id: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    c = _load(db, admin, certificate_id)
    count, last = _verif_counts(db, c)
    attempt = db.get(TrainingAttempt, c.attempt_pk)
    return {**cert_item(c, count, last), "attempt_id": c.attempt_pk, "worker_organization": c.worker.organization.name,
            "scenario": attempt.scenario.name if attempt else None, "disclaimer": DISCLAIMER,
            "title": "Training Certificate (Prototype)"}


@router.post("/{certificate_id}/revoke")
def revoke(certificate_id: str, body: RevokeBody, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    c = _load(db, admin, certificate_id)
    if c.status == "revoked":
        raise HTTPException(409, "Certificate is already revoked")
    c.status, c.revoked_at, c.revoked_reason, c.revoked_by = "revoked", now_utc(), body.reason.strip(), admin.id
    audit.record(db, admin.id, "certificate.revoke", "certificate", c.certificate_id, {"reason": body.reason.strip()})
    db.commit()
    return cert_item(c)


@router.get("/{certificate_id}/qr.svg")
def qr(certificate_id: str, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """QR encodes only the public verification URL (which contains the certificate id)."""
    c = _load(db, admin, certificate_id)
    buf = io.BytesIO()
    segno.make(verify_url(c.certificate_id), error="m").save(buf, kind="svg", scale=6, border=2)
    return Response(buf.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=300"})


@public.get("/verify/{certificate_id}", dependencies=[Depends(RateLimiter(60))])
def verify(certificate_id: str, request: Request, db: Session = Depends(get_db)):
    """Public, no login. Always answers 200 with `status`: valid | revoked | expired | invalid.
    Exposes only the minimum needed to verify (name, training, score, dates)."""
    cid = certificate_id.strip().upper()
    c = None
    if _ID.match(cid):
        c = db.scalar(select(Certificate).where(Certificate.certificate_id == cid)
                      .options(joinedload(Certificate.worker), joinedload(Certificate.module)))
    status = effective_status(c) if c else "invalid"
    ip = request.client.host if request.client else "unknown"
    db.add(CertificateVerification(certificate_pk=c.id if c else None, certificate_id_queried=cid[:64],
                                   result=status if c else "invalid",
                                   requester_hash=hashlib.sha256((ip + get_settings().jwt_secret).encode()).hexdigest()[:32]))
    db.commit()
    body = {"valid": status == "valid", "status": status, "checked_at": now_utc(), "certificate": None,
            "disclaimer": DISCLAIMER}
    if c:
        body["certificate"] = {"certificate_id": c.certificate_id, "worker_name": c.worker.name, "training": c.module.name,
                               "score": float(c.score), "result": "PASS", "issued_at": c.issued_at,
                               "revoked_at": c.revoked_at if status == "revoked" else None}
    return body
