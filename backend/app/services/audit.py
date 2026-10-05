import uuid

from sqlalchemy.orm import Session

from app.models import AuditLog


def record(db: Session, admin_id: uuid.UUID | None, action: str, entity_type: str,
           entity_id: str | None = None, meta: dict | None = None) -> None:
    """Append an audit row. Caller commits. Never pass passwords/tokens in `meta`."""
    db.add(AuditLog(admin_id=admin_id, action=action, entity_type=entity_type,
                    entity_id=entity_id, meta=meta))
