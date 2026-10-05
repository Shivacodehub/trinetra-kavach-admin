"""Endpoints used by the Unity Android app. Auth: worker_code + PIN -> worker JWT."""
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import get_current_worker
from app.auth.security import DUMMY_HASH, create_access_token, verify_password
from app.config import get_settings
from app.database import get_db
from app.models import Certificate, Module, Worker
from app.schemas.training import (AttemptResult, AttemptSubmit, SyncItemResult, SyncRequest, SyncResponse,
                                  WorkerLogin, WorkerToken)
from app.services.certificates import cert_item
from app.services.ingest import IngestError, ingest_attempt, log_rejected
from app.services.ratelimit import RateLimiter

router = APIRouter(tags=["Android App (Unity)"])


@router.post("/worker-auth/login", response_model=WorkerToken, dependencies=[Depends(RateLimiter(10))])
def worker_login(body: WorkerLogin, db: Session = Depends(get_db)):
    w = db.scalar(select(Worker).where(Worker.worker_code == body.worker_code.strip().upper()))
    ok = verify_password(body.pin, w.pin_hash if (w and w.pin_hash) else DUMMY_HASH)
    if not w or not w.pin_hash or not ok or not w.is_active:
        raise HTTPException(401, "Invalid worker ID or PIN", headers={"WWW-Authenticate": "Bearer"})
    token, exp = create_access_token(str(w.id), get_settings().worker_token_minutes, "worker")
    return WorkerToken(access_token=token, expires_in=exp, worker=_me(w))


def _me(w: Worker) -> dict:
    return {"id": str(w.id), "worker_code": w.worker_code, "name": w.name, "preferred_language": w.preferred_language}


@router.get("/worker/me")
def me(worker: Worker = Depends(get_current_worker)):
    return _me(worker)


@router.get("/worker/catalog")
def catalog(db: Session = Depends(get_db), worker: Worker = Depends(get_current_worker)):
    """Module and scenario ids to use when submitting attempts."""
    mods = db.scalars(select(Module).where(Module.is_active.is_(True)).order_by(Module.name)).all()
    return [{"id": m.id, "code": m.code, "name": m.name, "pass_mark": m.pass_mark, "config_label": m.config_label,
             "scenarios": [{"id": s.id, "code": s.code, "name": s.name} for s in m.scenarios]} for m in mods]


@router.get("/worker/certificates")
def my_certificates(db: Session = Depends(get_db), worker: Worker = Depends(get_current_worker)):
    rows = db.scalars(select(Certificate).where(Certificate.worker_id == worker.id)
                      .options(joinedload(Certificate.worker), joinedload(Certificate.module))
                      .order_by(Certificate.issued_at.desc())).unique().all()
    return [cert_item(c) for c in rows]


@router.post("/training/attempts", response_model=AttemptResult, status_code=201,
             responses={200: {"description": "Duplicate attempt_id: previously stored result returned"},
                        409: {"description": "attempt_id belongs to another worker"}})
def submit_attempt(body: AttemptSubmit, response: Response, db: Session = Depends(get_db),
                   worker: Worker = Depends(get_current_worker)):
    """Submit one finished attempt. Safe to retry: re-sending the same attempt_id returns 200 with the stored result."""
    try:
        status, result = ingest_attempt(db, worker, body)
    except IngestError as e:
        raise HTTPException(e.status, e.message)
    if status == "duplicate":
        response.status_code = 200
    return result


@router.post("/training/attempts/sync", response_model=SyncResponse)
def sync_attempts(body: SyncRequest, db: Session = Depends(get_db), worker: Worker = Depends(get_current_worker)):
    """Flush the offline queue. Each item is processed independently; one bad item never blocks the rest."""
    results = []
    for raw in body.attempts:
        aid = raw.get("attempt_id") if isinstance(raw.get("attempt_id"), str) else None
        try:
            status, result = ingest_attempt(db, worker, AttemptSubmit.model_validate(raw))
            results.append(SyncItemResult(attempt_id=aid, status=status, result=result))
        except ValidationError as e:
            db.rollback()
            msg = "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors()[:3])
            log_rejected(db, worker, aid or "unknown", msg)
            results.append(SyncItemResult(attempt_id=aid, status="rejected", error=msg))
        except IngestError as e:
            db.rollback()
            log_rejected(db, worker, aid or "unknown", e.message)
            results.append(SyncItemResult(attempt_id=aid, status="rejected", error=e.message))
    return SyncResponse(results=results)
