import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.deps import get_current_admin
from app.database import get_db
from app.models import Admin
from app.services import audit
from app.services.access import effective_org
from app.services.reports import KINDS, build_report, to_csv
from app.utils.time import resolve_range

router = APIRouter(prefix="/reports", tags=["Reports"])
PREVIEW_ROWS = 500


@router.get("/{kind}")
def report(kind: Literal["training", "assessment", "workers", "modules", "certificates"],
           range: Literal["today", "7d", "30d", "custom", "all"] = "30d",
           date_from: date | None = None, date_to: date | None = None, organization_id: uuid.UUID | None = None,
           format: Literal["json", "csv"] = "json", db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    """kinds: training, assessment, workers (worker performance), modules (module performance), certificates."""
    if range == "custom" and not (date_from or date_to):
        raise HTTPException(422, "Custom range needs date_from and/or date_to")
    start, end = resolve_range(range, date_from, date_to)
    cols, rows = build_report(db, kind, effective_org(admin, organization_id), start, end)
    if format == "csv":
        audit.record(db, admin.id, "report.export", "report", kind, {"rows": len(rows), "range": range})
        db.commit()
        return Response(to_csv(cols, rows), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="trinetra-{kind}-report.csv"'})
    return {"kind": kind, "range": range, "columns": cols, "rows": rows[:PREVIEW_ROWS], "total": len(rows),
            "truncated": len(rows) > PREVIEW_ROWS, "note": "Prototype / demo data"}
