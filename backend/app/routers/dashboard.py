import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_admin
from app.database import get_db
from app.models import Admin
from app.schemas.common import PageParams
from app.services import attempts as svc
from app.services.access import effective_org
from app.services.stats import dashboard_summary, module_stats, recent_certificates, trends

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def summary(organization_id: uuid.UUID | None = None, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """pending_sync = attempts the server holds that have no sync timestamp. The server cannot see
    results still queued on devices, so those are not counted."""
    return dashboard_summary(db, effective_org(admin, organization_id))


@router.get("/activity")
def activity(limit: int = Query(10, ge=1, le=50), organization_id: uuid.UUID | None = None,
             db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    stmt = svc.attempt_stmt(org_id=effective_org(admin, organization_id))
    pp = PageParams(page=1, page_size=limit)
    return svc.page_attempts(db, stmt, pp)["items"]


@router.get("/trends")
def trend(days: int = Query(30, ge=7, le=90), organization_id: uuid.UUID | None = None,
          db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return trends(db, effective_org(admin, organization_id), days)


@router.get("/module-performance")
def module_performance(organization_id: uuid.UUID | None = None, db: Session = Depends(get_db),
                       admin: Admin = Depends(get_current_admin)):
    return [{k: m[k] for k in ("id", "name", "workers_trained", "completion_rate", "average_score", "pass_rate")}
            for m in module_stats(db, effective_org(admin, organization_id))]


@router.get("/recent-certificates")
def certs(limit: int = Query(5, ge=1, le=20), organization_id: uuid.UUID | None = None,
          db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return recent_certificates(db, effective_org(admin, organization_id), limit)
