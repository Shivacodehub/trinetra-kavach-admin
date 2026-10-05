import uuid
from collections import defaultdict
from datetime import timedelta

from sqlalchemy import and_, case, exists, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import AssessmentScore as AS
from app.models import Certificate, Module, TrainingAttempt as TA, Worker
from app.schemas.common import PageParams, page_of
from app.services.certificates import status_clause
from app.utils.time import day_start, now_utc

SORTS = {"name": Worker.name, "worker_code": Worker.worker_code, "last_activity": Worker.last_activity_at}


def total_modules(db: Session) -> int:
    return db.scalar(select(func.count(Module.id)).where(Module.is_active.is_(True))) or 0


def _rollups():
    att = (select(TA.worker_id.label("worker_id"),
                  func.count(func.distinct(case((AS.passed.is_(True), TA.module_id)))).label("modules_completed"),
                  func.avg(AS.score).label("avg_score"), func.count(TA.id).label("attempts"))
           .select_from(TA).outerjoin(AS, AS.attempt_pk == TA.id).group_by(TA.worker_id).subquery("att"))
    certs = (select(Certificate.worker_id.label("worker_id"),
                    func.count(func.distinct(Certificate.module_id)).label("valid_certs"))
             .where(status_clause("valid", now_utc())).group_by(Certificate.worker_id).subquery("certs"))
    return att, certs


def list_workers(db: Session, pp: PageParams, *, org_id=None, search=None, module_id=None, status=None,
                 certificate_status=None, date_from=None, date_to=None, sort_by="name", sort_order="asc",
                 include_inactive=False) -> dict:
    n = max(total_modules(db), 1)
    att, certs = _rollups()
    cm, at, vc = (func.coalesce(att.c.modules_completed, 0), func.coalesce(att.c.attempts, 0),
                  func.coalesce(certs.c.valid_certs, 0))
    t_status = case((cm >= n, "completed"), (at > 0, "in_progress"), else_="not_started")
    c_status = case((vc >= n, "certified"), (vc > 0, "partial"), else_="none")
    stmt = (select(Worker, cm.label("modules_completed"), att.c.avg_score, t_status.label("training_status"),
                   c_status.label("certificate_status"))
            .outerjoin(att, att.c.worker_id == Worker.id).outerjoin(certs, certs.c.worker_id == Worker.id))
    if not include_inactive:
        stmt = stmt.where(Worker.is_active.is_(True))
    if org_id:
        stmt = stmt.where(Worker.organization_id == org_id)
    if module_id:
        stmt = stmt.where(exists().where(and_(TA.worker_id == Worker.id, TA.module_id == module_id)))
    if status:
        stmt = stmt.where(t_status == status)
    if certificate_status:
        stmt = stmt.where(c_status == certificate_status)
    if date_from:
        stmt = stmt.where(Worker.last_activity_at >= day_start(date_from))
    if date_to:
        stmt = stmt.where(Worker.last_activity_at < day_start(date_to) + timedelta(days=1))
    if search and search.strip():
        t = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Worker.name.ilike(f"%{t}%", escape="\\") | Worker.worker_code.ilike(f"%{t}%", escape="\\"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    sort_col = {**SORTS, "avg_score": att.c.avg_score, "modules_completed": cm}[sort_by]
    order = sort_col.desc().nulls_last() if sort_order == "desc" else sort_col.asc().nulls_last()
    rows = db.execute(stmt.options(joinedload(Worker.organization)).order_by(order, Worker.id)
                      .offset(pp.offset).limit(pp.page_size)).unique().all()
    items = [{"id": w.id, "worker_code": w.worker_code, "name": w.name,
              "organization": {"id": w.organization.id, "name": w.organization.name},
              "department": w.department, "role_title": w.role_title, "preferred_language": w.preferred_language,
              "modules_completed": int(m), "total_modules": n,
              "average_score": round(float(avg), 1) if avg is not None else None,
              "training_status": ts, "certificate_status": cs, "last_activity_at": w.last_activity_at,
              "is_active": w.is_active, "is_demo": w.is_demo}
             for w, m, avg, ts, cs in rows]
    return page_of(items, total, pp)


def worker_profile(db: Session, w: Worker) -> dict:
    n = total_modules(db)
    scored = db.execute(select(AS.score, AS.passed, AS.behavior_metrics, TA.module_id)
                        .join(TA, TA.id == AS.attempt_pk).where(TA.worker_id == w.id)).all()
    attempts = db.scalar(select(func.count(TA.id)).where(TA.worker_id == w.id)) or 0
    passed = [r for r in scored if r.passed]
    buckets: dict[str, list[int]] = defaultdict(list)
    for r in scored:
        for k, v in (r.behavior_metrics or {}).items():
            buckets[k].append(v)
    certs = db.scalar(select(func.count(Certificate.id)).where(Certificate.worker_id == w.id,
                                                                status_clause("valid", now_utc()))) or 0
    return {
        "id": w.id, "worker_code": w.worker_code, "name": w.name, "email": w.email, "phone": w.phone,
        "organization": {"id": w.organization.id, "name": w.organization.name},
        "department": w.department, "role_title": w.role_title, "preferred_language": w.preferred_language,
        "is_active": w.is_active, "is_demo": w.is_demo, "joined_at": w.created_at,
        "last_activity_at": w.last_activity_at,
        "summary": {
            "modules_completed": len({r.module_id for r in passed}), "total_modules": n,
            "average_score": round(sum(float(r.score) for r in scored) / len(scored), 1) if scored else None,
            "pass_rate": round(100 * len(passed) / len(scored), 1) if scored else None,
            "attempts": attempts, "completed_attempts": len(scored), "certificates": certs,
        },
        "behavior_performance": {k: round(sum(v) / len(v)) for k, v in buckets.items()},
    }
