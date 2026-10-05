import uuid

from fastapi import HTTPException

from app.models import Admin


def effective_org(admin: Admin, org_id: uuid.UUID | None) -> uuid.UUID | None:
    """Admins bound to an organization can only see that organization."""
    if admin.organization_id is None:
        return org_id
    if org_id and org_id != admin.organization_id:
        raise HTTPException(403, "You do not have access to this organization")
    return admin.organization_id


def check_org_access(admin: Admin, organization_id: uuid.UUID) -> None:
    if admin.organization_id and admin.organization_id != organization_id:
        raise HTTPException(404, "Not found")  # 404, not 403: don't reveal existence
