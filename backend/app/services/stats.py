from datetime import timedelta

from sqlalchemy import Date, and_, case, cast, func, or_, select
from sqlalchemy.orm import Session

from app.models import AssessmentEvent as AE
from app.models import AssessmentScore as AS
from app.models import (Certificate, Module, Organization, SyncLog, TrainingAttempt as TA, Worker)
from app.services.certificates import cert_item, status_clause
from app.utils.time import now_utc

PASSED = case((AS.passed.is_(True), 1), else_=0)


def _pct(num, den) -> float:
    return round(100 * (num or 0) / den, 1) if den else 0.0


def _scope(stmt, org_id):
    return stmt.where(Worker.organization_id == org_id) if org_id else stmt


def dashboard_summary(db: Session, org_id=None) -> dict:
    now = now_utc()
    att = lambda *c: db.scalar(_scope(select(func.count(TA.id)).join(Worker, Worker.id == TA.worker_id).where(*c), org_id)) or 0
    scored, passed = db.execute(_scope(select(func.count(AS.id), func.coalesce(func.sum(PASSED), 0))
                                       .select_from(AS).join(TA, TA.id == AS.attempt_pk)
                                       .join(Worker, Worker.id == TA.worker_id), org_id)).one()
    cert = lambda *c: db.scalar(_scope(select(func.count(Certificate.id)).join(Worker, Worker.id == Certificate.worker_id).where(*c), org_id)) or 0
    done = _scope(select(TA.worker_id, TA.module_id).select_from(TA).join(AS, AS.attempt_pk == TA.id)
                  .join(Worker, Worker.id == TA.worker_id).where(AS.passed.is_(True)), org_id).distinct().subquery()
    last_sync = db.scalar(_scope(select(func.max(TA.synced_at)).join(Worker, Worker.id == TA.worker_id), org_id))
    since = now - timedelta(hours=24)
    sync_counts = dict(db.execute(select(SyncLog.status, func.count()).where(SyncLog.received_at >= since)
                                  .group_by(SyncLog.status)).all())
    return {
        "total_workers": db.scalar(_scope(select(func.count(Worker.id)).where(Worker.is_active.is_(True)), org_id)) or 0,
        "training_completed": att(TA.status == "completed"),
        "pass_rate": _pct(passed, scored),
        "certificates_issued": cert(),
        "certificates_active": cert(status_clause("valid", now)),
        "certificates_revoked": cert(Certificate.status == "revoked"),
        "active_training": att(TA.status == "in_progress"),
        "failed_assessments": (scored or 0) - int(passed or 0),
        "modules_completed": db.scalar(select(func.count()).select_from(done)) or 0,
        "pending_sync": att(TA.synced_at.is_(None)),
        "system": {"backend": "online", "database": "connected", "last_sync_at": last_sync,
                   "sync_last_24h": {k: sync_counts.get(k, 0) for k in ("accepted", "duplicate", "rejected")},
                   "environment_note": "Prototype - demo data"},
    }


def trends(db: Session, org_id=None, days: int = 30) -> list[dict]:
    today = now_utc().date()
    since = today - timedelta(days=days - 1)
    day = cast(TA.ended_at, Date)
    rows = db.execute(_scope(
        select(day, func.count(TA.id), func.coalesce(func.sum(PASSED), 0))
        .select_from(TA).join(AS, AS.attempt_pk == TA.id).join(Worker, Worker.id == TA.worker_id)
        .where(TA.status == "completed", day >= since), org_id).group_by(day)).all()
    by_day = {str(d): (int(c), int(p)) for d, c, p in rows}
    out = []
    for i in range(days):
        d = str(since + timedelta(days=i))
        c, p = by_day.get(d, (0, 0))
        out.append({"date": d, "completed": c, "passed": p, "failed": c - p})
    return out


def module_stats(db: Session, org_id=None) -> list[dict]:
    q = (select(TA.module_id, func.count(TA.id),
                func.sum(case((TA.status == "completed", 1), else_=0)),
                func.count(func.distinct(case((TA.status == "completed", TA.worker_id)))),
                func.avg(AS.score), func.coalesce(func.sum(PASSED), 0), func.count(AS.id),
                func.avg(case((TA.status == "completed", TA.duration_seconds))))
         .select_from(TA).join(Worker, Worker.id == TA.worker_id).outerjoin(AS, AS.attempt_pk == TA.id)
         .group_by(TA.module_id))
    stats = {r[0]: r for r in db.execute(_scope(q, org_id)).all()}
    out = []
    for m in db.scalars(select(Module).where(Module.is_active.is_(True)).order_by(Module.name)).all():
        r = stats.get(m.id)
        started, completed, workers, avg, passed, scored, dur = (r[1:] if r else (0, 0, 0, None, 0, 0, None))
        out.append({
            "id": m.id, "code": m.code, "name": m.name, "description": m.description,
            "pass_mark": m.pass_mark, "config_label": m.config_label, "content_version": m.content_version,
            "scenarios": [{"id": s.id, "name": s.name} for s in m.scenarios],
            "workers_trained": int(workers or 0), "attempts_started": int(started or 0),
            "completed_attempts": int(completed or 0),
            "completion_rate": _pct(completed, started), "average_score": round(float(avg), 1) if avg is not None else None,
            "pass_rate": _pct(passed, scored), "average_duration_seconds": round(float(dur)) if dur is not None else None,
        })
    return out


def module_analytics(db: Session, module: Module, org_id=None) -> dict:
    base = stats = next(m for m in module_stats(db, org_id) if m["id"] == module.id)
    scoped = lambda s: _scope(s.join(Worker, Worker.id == TA.worker_id), org_id)
    scores = db.execute(scoped(select(AS.score, AS.passed).select_from(AS).join(TA, TA.id == AS.attempt_pk))
                        .where(TA.module_id == module.id)).all()
    dist = [{"range": f"{i * 10}-{i * 10 + 9 if i < 9 else 100}", "passed": 0, "failed": 0} for i in range(10)]
    for sc, ok in scores:
        dist[min(int(sc) // 10, 9)]["passed" if ok else "failed"] += 1
    fails = db.execute(scoped(
        select(AE.event_type, func.max(AE.expected_action), func.max(AE.category), func.count(AE.id),
               func.sum(case((AE.is_correct.is_(False), 1), else_=0)).label("bad"))
        .select_from(AE).join(TA, TA.id == AE.attempt_pk)).where(TA.module_id == module.id)
        .group_by(AE.event_type).having(func.sum(case((AE.is_correct.is_(False), 1), else_=0)) > 0)
        .order_by(func.sum(case((AE.is_correct.is_(False), 1), else_=0)).desc()).limit(5)).all()
    grouped = lambda *cols: scoped(select(*cols, func.count(TA.id), func.avg(AS.score), func.coalesce(func.sum(PASSED), 0))
                                   .select_from(TA).join(AS, AS.attempt_pk == TA.id)).where(
        TA.module_id == module.id, TA.status == "completed")
    by_org = grouped(Organization.name).join(Organization, Organization.id == Worker.organization_id).group_by(Organization.id, Organization.name)
    by_worker = (grouped(Worker.worker_code, Worker.name).group_by(Worker.id, Worker.worker_code, Worker.name)
                 .order_by(func.avg(AS.score).desc()).limit(20))
    day = cast(TA.ended_at, Date)
    over_time = grouped(day).where(day >= now_utc().date() - timedelta(days=29)).group_by(day).order_by(day)
    return {
        **base,
        "total_attempts": stats["attempts_started"],
        "common_failure_areas": [{"event_type": e, "expected_action": x, "category": c, "occurrences": int(n),
                                  "incorrect": int(b), "failure_rate": _pct(b, n)} for e, x, c, n, b in fails],
        "score_distribution": dist,
        "pass_fail": {"passed": sum(1 for _, ok in scores if ok), "failed": sum(1 for _, ok in scores if not ok)},
        "by_organization": [{"organization": o, "attempts": int(n), "average_score": round(float(a), 1), "pass_rate": _pct(p, n)}
                            for o, n, a, p in db.execute(by_org).all()],
        "by_worker": [{"worker_code": c, "name": nm, "attempts": int(n), "average_score": round(float(a), 1), "pass_rate": _pct(p, n)}
                      for c, nm, n, a, p in db.execute(by_worker).all()],
        "over_time": [{"date": str(d), "attempts": int(n), "average_score": round(float(a), 1)}
                      for d, n, a, _ in db.execute(over_time).all()],
    }


def recent_certificates(db: Session, org_id=None, limit: int = 5) -> list[dict]:
    from sqlalchemy.orm import joinedload
    q = _scope(select(Certificate).join(Worker, Worker.id == Certificate.worker_id), org_id)
    rows = db.scalars(q.options(joinedload(Certificate.worker), joinedload(Certificate.module))
                      .order_by(Certificate.issued_at.desc()).limit(limit)).unique().all()
    return [cert_item(c) for c in rows]
