from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import AssessmentScore as AS
from app.models import Certificate, TrainingAttempt as TA, Worker
from app.schemas.common import PageParams, page_of
from app.utils.time import as_utc, day_start
from datetime import timedelta

SORTS = {"started_at": TA.started_at, "score": AS.score, "duration": TA.duration_seconds}


def attempt_stmt(*, org_id=None, worker_id=None, module_id=None, scenario_id=None, status=None,
                 result=None, search=None, date_from=None, date_to=None, scored_only=False):
    stmt = select(TA).join(Worker, Worker.id == TA.worker_id).outerjoin(AS, AS.attempt_pk == TA.id)
    if org_id:
        stmt = stmt.where(Worker.organization_id == org_id)
    if worker_id:
        stmt = stmt.where(TA.worker_id == worker_id)
    if module_id:
        stmt = stmt.where(TA.module_id == module_id)
    if scenario_id:
        stmt = stmt.where(TA.scenario_id == scenario_id)
    if status:
        stmt = stmt.where(TA.status == status)
    if result:
        stmt = stmt.where(AS.passed.is_(result == "pass"))
    if scored_only:
        stmt = stmt.where(AS.id.is_not(None))
    if date_from:
        stmt = stmt.where(TA.started_at >= day_start(date_from))
    if date_to:
        stmt = stmt.where(TA.started_at < day_start(date_to) + timedelta(days=1))
    if search and search.strip():
        t = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{t}%"
        stmt = stmt.where(or_(Worker.name.ilike(like, escape="\\"), Worker.worker_code.ilike(like, escape="\\"),
                              TA.attempt_id.ilike(like, escape="\\")))
    return stmt


def _eager():
    return (joinedload(TA.worker).joinedload(Worker.organization), joinedload(TA.module),
            joinedload(TA.scenario), joinedload(TA.score))


def serialize_attempt(a: TA) -> dict:
    s = a.score
    return {
        "id": a.id, "attempt_id": a.attempt_id,
        "worker": {"id": a.worker.id, "worker_code": a.worker.worker_code, "name": a.worker.name,
                   "organization": a.worker.organization.name},
        "module": {"id": a.module.id, "code": a.module.code, "name": a.module.name},
        "scenario": {"id": a.scenario.id, "name": a.scenario.name},
        "status": a.status, "started_at": a.started_at, "ended_at": a.ended_at,
        "duration_seconds": a.duration_seconds, "language": a.language,
        "score": float(s.score) if s else None,
        "result": ("pass" if s.passed else "fail") if s else None,
        "synced_at": a.synced_at, "is_demo": a.is_demo,
    }


def page_attempts(db: Session, stmt, pp: PageParams, sort_by="started_at", sort_order="desc") -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    col = SORTS[sort_by]
    order = col.desc().nulls_last() if sort_order == "desc" else col.asc().nulls_last()
    rows = db.scalars(stmt.options(*_eager()).order_by(order, TA.id).offset(pp.offset).limit(pp.page_size)).unique().all()
    return page_of([serialize_attempt(a) for a in rows], total, pp)


def assessment_detail(db: Session, a: TA) -> dict:
    s = a.score
    start = as_utc(a.started_at)
    events = [{
        "sequence": e.sequence, "timestamp": e.occurred_at,
        "elapsed_seconds": round((as_utc(e.occurred_at) - start).total_seconds()),
        "event_type": e.event_type, "category": e.category, "action_taken": e.action_taken,
        "expected_action": e.expected_action, "is_correct": e.is_correct,
        "score_impact": float(e.score_impact), "points_possible": float(e.points_possible),
        "risk_level": e.risk_level, "scenario_state": e.scenario_state,
    } for e in a.events]
    cert = db.scalar(select(Certificate.certificate_id).where(Certificate.attempt_pk == a.id))
    return {
        **serialize_attempt(a),
        "pass_mark": s.pass_mark_used if s else a.module.pass_mark,
        "score_source": s.score_source if s else None,
        "client_reported_score": float(s.client_reported_score) if s and s.client_reported_score is not None else None,
        "behavior_metrics": s.behavior_metrics if s else None,
        "certificate_id": cert,
        "events_total": len(events), "events_correct": sum(1 for e in events if e["is_correct"]),
        "events": events,
        "config_label": a.module.config_label,
    }
