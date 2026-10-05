import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.deps import get_current_admin
from app.database import get_db
from app.models import Admin, Module, TrainingAttempt, Worker
from app.schemas.common import PageParams
from app.services import attempts as svc
from app.services.access import check_org_access, effective_org
from app.services.stats import module_analytics, module_stats

router = APIRouter(tags=["Training & Assessments"])


@router.get("/modules")
def modules(organization_id: uuid.UUID | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """Completion rate = completed attempts / started attempts. Pass rate = passed / scored attempts."""
    return module_stats(db, effective_org(admin, organization_id))


@router.get("/modules/{module_id}")
def module_detail(module_id: uuid.UUID, organization_id: uuid.UUID | None = None, db: Session = Depends(get_db),
                  admin: Admin = Depends(get_current_admin)):
    m = db.get(Module, module_id)
    if not m:
        raise HTTPException(404, "Module not found")
    return module_analytics(db, m, effective_org(admin, organization_id))


@router.get("/training/attempts")
def attempts(pp: PageParams = Depends(), worker_id: uuid.UUID | None = None, module_id: uuid.UUID | None = None,
             organization_id: uuid.UUID | None = None, status: Literal["in_progress", "completed", "abandoned"] | None = None,
             result: Literal["pass", "fail"] | None = None, search: str | None = Query(None, max_length=80),
             date_from: date | None = None, date_to: date | None = None,
             sort_by: Literal["started_at", "score", "duration"] = "started_at",
             sort_order: Literal["asc", "desc"] = "desc",
             db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    stmt = svc.attempt_stmt(org_id=effective_org(admin, organization_id), worker_id=worker_id, module_id=module_id,
                            status=status, result=result, search=search, date_from=date_from, date_to=date_to)
    return svc.page_attempts(db, stmt, pp, sort_by, sort_order)


@router.get("/assessments")
def assessments(pp: PageParams = Depends(), worker_id: uuid.UUID | None = None, module_id: uuid.UUID | None = None,
                organization_id: uuid.UUID | None = None, result: Literal["pass", "fail"] | None = None,
                search: str | None = Query(None, max_length=80), date_from: date | None = None, date_to: date | None = None,
                sort_by: Literal["started_at", "score", "duration"] = "started_at",
                sort_order: Literal["asc", "desc"] = "desc",
                db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    stmt = svc.attempt_stmt(org_id=effective_org(admin, organization_id), worker_id=worker_id, module_id=module_id,
                            result=result, search=search, date_from=date_from, date_to=date_to, scored_only=True)
    return svc.page_attempts(db, stmt, pp, sort_by, sort_order)


@router.get("/assessments/{attempt_id}")
def assessment(attempt_id: uuid.UUID, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    a = db.scalar(select(TrainingAttempt).where(TrainingAttempt.id == attempt_id).options(
        joinedload(TrainingAttempt.worker).joinedload(Worker.organization), joinedload(TrainingAttempt.module),
        joinedload(TrainingAttempt.scenario), joinedload(TrainingAttempt.score), joinedload(TrainingAttempt.events)))
    if not a:
        raise HTTPException(404, "Assessment not found")
    check_org_access(admin, a.worker.organization_id)
    return svc.assessment_detail(db, a)
