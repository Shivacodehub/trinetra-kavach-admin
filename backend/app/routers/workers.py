import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import get_current_admin
from app.auth.security import hash_password
from app.database import get_db
from app.models import Admin, Organization, Worker
from app.schemas.common import PageParams
from app.schemas.workers import PinReset, WorkerCreate, WorkerUpdate
from app.services import audit
from app.services.access import check_org_access, effective_org
from app.services.workers import list_workers, worker_profile

router = APIRouter(prefix="/workers", tags=["Workers"])


def _get(db: Session, admin: Admin, worker_id: uuid.UUID) -> Worker:
    w = db.scalar(select(Worker).where(Worker.id == worker_id).options(joinedload(Worker.organization)))
    if not w:
        raise HTTPException(404, "Worker not found")
    check_org_access(admin, w.organization_id)
    return w


@router.get("")
def workers(pp: PageParams = Depends(), search: str | None = Query(None, max_length=80),
            organization_id: uuid.UUID | None = None, module_id: uuid.UUID | None = None,
            status: Literal["not_started", "in_progress", "completed"] | None = None,
            certificate_status: Literal["none", "partial", "certified"] | None = None,
            date_from: date | None = None, date_to: date | None = None,
            include_inactive: bool = False,
            sort_by: Literal["name", "worker_code", "last_activity", "avg_score", "modules_completed"] = "name",
            sort_order: Literal["asc", "desc"] = "asc",
            db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return list_workers(db, pp, org_id=effective_org(admin, organization_id), search=search, module_id=module_id,
                        status=status, certificate_status=certificate_status, date_from=date_from, date_to=date_to,
                        sort_by=sort_by, sort_order=sort_order, include_inactive=include_inactive)


@router.post("", status_code=201)
def create_worker(body: WorkerCreate, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    effective_org(admin, body.organization_id)
    if not db.get(Organization, body.organization_id):
        raise HTTPException(404, "Organization not found")
    w = Worker(**body.model_dump(exclude={"pin"}), pin_hash=hash_password(body.pin) if body.pin else None)
    db.add(w)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"Worker ID {body.worker_code} already exists")
    audit.record(db, admin.id, "worker.create", "worker", str(w.id), {"worker_code": w.worker_code})
    db.commit()
    return worker_profile(db, _get(db, admin, w.id))


@router.get("/{worker_id}")
def worker_detail(worker_id: uuid.UUID, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return worker_profile(db, _get(db, admin, worker_id))


@router.put("/{worker_id}")
def update_worker(worker_id: uuid.UUID, body: WorkerUpdate, db: Session = Depends(get_db),
                  admin: Admin = Depends(get_current_admin)):
    w = _get(db, admin, worker_id)
    changes = body.model_dump(exclude_unset=True)
    if "organization_id" in changes:
        effective_org(admin, changes["organization_id"])
        if not db.get(Organization, changes["organization_id"]):
            raise HTTPException(404, "Organization not found")
    for k, v in changes.items():
        setattr(w, k, v)
    audit.record(db, admin.id, "worker.update", "worker", str(w.id), {"fields": sorted(changes)})
    db.commit()
    return worker_profile(db, _get(db, admin, worker_id))


@router.delete("/{worker_id}", status_code=204)
def deactivate_worker(worker_id: uuid.UUID, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Soft delete: training and certificate history must remain verifiable."""
    w = _get(db, admin, worker_id)
    w.is_active = False
    audit.record(db, admin.id, "worker.deactivate", "worker", str(w.id))
    db.commit()
    return Response(status_code=204)


@router.post("/{worker_id}/reset-pin", status_code=204)
def reset_pin(worker_id: uuid.UUID, body: PinReset, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    w = _get(db, admin, worker_id)
    w.pin_hash = hash_password(body.pin)
    audit.record(db, admin.id, "worker.reset_pin", "worker", str(w.id))
    db.commit()
    return Response(status_code=204)
