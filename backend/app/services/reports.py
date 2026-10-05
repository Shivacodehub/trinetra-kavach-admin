import csv
import io
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import AssessmentScore as AS
from app.models import Certificate, TrainingAttempt as TA, Worker
from app.services.certificates import effective_status

METRICS = ["hazard_recognition", "procedure_adherence", "decision_making", "response_time", "route_selection", "safety_compliance"]
KINDS = ("training", "assessment", "workers", "modules", "certificates")
MAX_ROWS = 50_000


def _attempts(db, org_id, start, end, scored_only=False):
    q = (select(TA).join(Worker, Worker.id == TA.worker_id)
         .options(joinedload(TA.worker).joinedload(Worker.organization), joinedload(TA.module),
                  joinedload(TA.scenario), joinedload(TA.score)).order_by(TA.started_at.desc()).limit(MAX_ROWS))
    if org_id:
        q = q.where(Worker.organization_id == org_id)
    if start:
        q = q.where(TA.started_at >= start)
    if end:
        q = q.where(TA.started_at < end)
    rows = db.scalars(q).unique().all()
    return [a for a in rows if a.score] if scored_only else rows


def _res(a):
    return "" if not a.score else ("PASS" if a.score.passed else "FAIL")


def build_report(db: Session, kind: str, org_id, start, end) -> tuple[list[str], list[list]]:
    if kind == "training":
        cols = ["Attempt ID", "Worker ID", "Worker", "Organization", "Module", "Scenario", "Status", "Started", "Duration (s)", "Score", "Result"]
        return cols, [[a.attempt_id, a.worker.worker_code, a.worker.name, a.worker.organization.name, a.module.name,
                       a.scenario.name, a.status, a.started_at.isoformat(), a.duration_seconds,
                       float(a.score.score) if a.score else "", _res(a)] for a in _attempts(db, org_id, start, end)]
    if kind == "assessment":
        cols = ["Attempt ID", "Worker ID", "Worker", "Module", "Scenario", "Date", "Score", "Pass mark", "Result"] + METRICS
        return cols, [[a.attempt_id, a.worker.worker_code, a.worker.name, a.module.name, a.scenario.name,
                       a.started_at.isoformat(), float(a.score.score), a.score.pass_mark_used, _res(a)]
                      + [(a.score.behavior_metrics or {}).get(k, "") for k in METRICS]
                      for a in _attempts(db, org_id, start, end, scored_only=True)]
    if kind in ("workers", "modules"):
        groups = defaultdict(list)
        for a in _attempts(db, org_id, start, end, scored_only=True):
            groups[(a.worker if kind == "workers" else a.module)].append(a)
        def stats(items):
            sc = [float(a.score.score) for a in items]
            return [len(items), round(sum(sc) / len(sc), 1), round(100 * sum(a.score.passed for a in items) / len(items), 1)]
        if kind == "workers":
            cols = ["Worker ID", "Worker", "Organization", "Assessments", "Average score", "Pass rate %", "Modules passed"]
            return cols, [[w.worker_code, w.name, w.organization.name, *stats(i),
                           len({a.module_id for a in i if a.score.passed})] for w, i in sorted(groups.items(), key=lambda x: x[0].worker_code)]
        cols = ["Module", "Assessments", "Average score", "Pass rate %", "Workers"]
        return cols, [[m.name, *stats(i), len({a.worker_id for a in i})] for m, i in sorted(groups.items(), key=lambda x: x[0].name)]
    q = (select(Certificate).join(Worker, Worker.id == Certificate.worker_id)
         .options(joinedload(Certificate.worker), joinedload(Certificate.module)).order_by(Certificate.issued_at.desc()).limit(MAX_ROWS))
    if org_id:
        q = q.where(Worker.organization_id == org_id)
    if start:
        q = q.where(Certificate.issued_at >= start)
    if end:
        q = q.where(Certificate.issued_at < end)
    cols = ["Certificate ID", "Worker ID", "Worker", "Module", "Score", "Issued", "Expires", "Status"]
    return cols, [[c.certificate_id, c.worker.worker_code, c.worker.name, c.module.name, float(c.score), c.issued_at.isoformat(),
                   c.expires_at.isoformat() if c.expires_at else "", effective_status(c).upper()]
                  for c in db.scalars(q).unique().all()]


def _safe(v):
    """Neutralise spreadsheet formula injection in exported CSV."""
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") and not _is_number(s) else s


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


def to_csv(cols, rows) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for r in rows:
        w.writerow([_safe(v) for v in r])
    return buf.getvalue()
