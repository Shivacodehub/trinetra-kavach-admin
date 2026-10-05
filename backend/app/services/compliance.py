"""Prototype compliance-monitoring view. Required modules = all active modules (no legal rules implied)."""
from collections import Counter

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import AssessmentScore as AS
from app.models import Certificate, Module, TrainingAttempt as TA, Worker
from app.schemas.common import PageParams, page_of
from app.services.certificates import effective_status


def compliance_view(db: Session, pp: PageParams, *, org_id=None, module_id=None, status=None, search=None) -> dict:
    wq = select(Worker).where(Worker.is_active.is_(True)).options(joinedload(Worker.organization))
    if org_id:
        wq = wq.where(Worker.organization_id == org_id)
    if search and search.strip():
        t = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        wq = wq.where(Worker.name.ilike(f"%{t}%", escape="\\") | Worker.worker_code.ilike(f"%{t}%", escape="\\"))
    workers = db.scalars(wq.order_by(Worker.worker_code)).unique().all()
    mq = select(Module).where(Module.is_active.is_(True)).order_by(Module.name)
    if module_id:
        mq = mq.where(Module.id == module_id)
    modules = db.scalars(mq).all()

    ids = [w.id for w in workers]
    agg = {(r.worker_id, r.module_id): r for r in db.execute(
        select(TA.worker_id, TA.module_id, func.count(AS.id).label("completed"),
               func.sum(case((AS.passed.is_(True), 1), else_=0)).label("passed"),
               func.max(AS.score).label("best"), func.max(TA.ended_at).label("last"))
        .select_from(TA).join(AS, AS.attempt_pk == TA.id).where(TA.worker_id.in_(ids)).group_by(TA.worker_id, TA.module_id)
    ).all()} if ids else {}
    certs: dict = {}
    if ids:
        for c in db.scalars(select(Certificate).where(Certificate.worker_id.in_(ids)).order_by(Certificate.issued_at)):
            certs.setdefault((c.worker_id, c.module_id), []).append(c)

    rows = []
    for w in workers:
        for m in modules:
            a, cs = agg.get((w.id, m.id)), certs.get((w.id, m.id), [])
            live = next((c for c in reversed(cs) if effective_status(c) == "valid"), None)
            passed = bool(a and a.passed)
            st = ("COMPLIANT" if live or (passed and not cs) else "TRAINING_DUE" if passed
                  else "FAILED" if a else "NOT_STARTED")
            shown = live or (cs[-1] if cs else None)
            rows.append({"worker": {"id": w.id, "worker_code": w.worker_code, "name": w.name, "organization": w.organization.name},
                         "module": {"id": m.id, "name": m.name}, "status": st,
                         "completed": passed, "best_score": float(a.best) if a else None,
                         "certificate_id": shown.certificate_id if shown else None,
                         "certificate_status": effective_status(shown) if shown else None,
                         "last_training_at": a.last if a else None})
    counts = Counter(r["status"] for r in rows)
    if status:
        rows = [r for r in rows if r["status"] == status]
    page = rows[pp.offset: pp.offset + pp.page_size]
    return {**page_of(page, len(rows), pp),
            "summary": {k: counts.get(k, 0) for k in ("COMPLIANT", "TRAINING_DUE", "FAILED", "NOT_STARTED")},
            "note": "Prototype monitoring view. Required modules = all active modules. Not a statement of legal compliance."}
