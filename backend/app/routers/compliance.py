import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_admin
from app.database import get_db
from app.models import Admin, Organization
from app.schemas.common import PageParams
from app.services.access import effective_org
from app.services.compliance import compliance_view
from sqlalchemy import select

router = APIRouter(tags=["Compliance & Organizations"])


@router.get("/compliance")
def compliance(pp: PageParams = Depends(), organization_id: uuid.UUID | None = None, module_id: uuid.UUID | None = None,
               status: Literal["COMPLIANT", "TRAINING_DUE", "FAILED", "NOT_STARTED"] | None = None,
               search: str | None = Query(None, max_length=80), db: Session = Depends(get_db),
               admin: Admin = Depends(get_current_admin)):
    return compliance_view(db, pp, org_id=effective_org(admin, organization_id), module_id=module_id,
                           status=status, search=search)


@router.get("/organizations")
def organizations(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    q = select(Organization).where(Organization.is_active.is_(True)).order_by(Organization.name)
    if admin.organization_id:
        q = q.where(Organization.id == admin.organization_id)
    return [{"id": o.id, "name": o.name, "code": o.code, "org_type": o.org_type} for o in db.scalars(q)]
