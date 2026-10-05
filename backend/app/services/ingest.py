"""Accepts attempts from the Unity app. Idempotent on attempt_id."""
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (AssessmentEvent, AssessmentScore, Module, Scenario, SyncLog, TrainingAttempt, Worker, Certificate)
from app.schemas.training import AttemptSubmit
from app.services.assessment import derive_score
from app.services.certificates import has_effective_certificate, issue_for_attempt, verify_url
from app.utils.time import as_utc, now_utc


class IngestError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


def _log(db: Session, worker: Worker, payload_attempt_id: str, device: str | None, status: str, detail: str | None = None):
    db.add(SyncLog(worker_id=worker.id, attempt_id=payload_attempt_id[:64], device_id=device, status=status, detail=detail))


def result_dict(db: Session, a: TrainingAttempt, status: str) -> dict:
    cid = db.scalar(select(Certificate.certificate_id).where(Certificate.attempt_pk == a.id))
    s = a.score
    mismatch = bool(s.client_reported_score is not None and abs(s.client_reported_score - s.score) > 1)
    return {"status": status, "attempt_id": a.attempt_id, "server_id": a.id, "score": float(s.score),
            "passed": s.passed, "pass_mark": s.pass_mark_used, "synced_at": a.synced_at,
            "score_mismatch": mismatch, "certificate_id": cid,
            "certificate_verify_url": verify_url(cid) if cid else None}


def ingest_attempt(db: Session, worker: Worker, p: AttemptSubmit) -> tuple[str, dict]:
    if p.worker_id and p.worker_id not in (str(worker.id), worker.worker_code):
        raise IngestError(403, "worker_id does not match the authenticated worker")

    existing = db.scalar(select(TrainingAttempt).where(TrainingAttempt.attempt_id == p.attempt_id))
    if existing:
        if existing.worker_id != worker.id:
            raise IngestError(409, "attempt_id already belongs to another worker")
        _log(db, worker, p.attempt_id, p.device_id, "duplicate")
        db.commit()
        return "duplicate", result_dict(db, existing, "duplicate")

    module = db.get(Module, p.module_id)
    scenario = db.get(Scenario, p.scenario_id)
    if not module or not module.is_active:
        raise IngestError(422, "Unknown module_id")
    if not scenario or scenario.module_id != module.id:
        raise IngestError(422, "scenario_id does not belong to module_id")

    now = now_utc()
    started, ended = as_utc(p.started_at), as_utc(p.ended_at)
    attempt = TrainingAttempt(
        attempt_id=p.attempt_id, worker_id=worker.id, module_id=module.id, scenario_id=scenario.id,
        status="completed", started_at=started, ended_at=ended,
        duration_seconds=p.duration_seconds if p.duration_seconds is not None else int((ended - started).total_seconds()),
        language=p.language or worker.preferred_language, device_id=p.device_id, app_version=p.app_version,
        client_created_at=as_utc(p.client_created_at), synced_at=now)
    attempt.events = [AssessmentEvent(
        sequence=e.sequence, event_type=e.event_type, category=e.category, occurred_at=as_utc(e.occurred_at),
        action_taken=e.action_taken, expected_action=e.expected_action, is_correct=e.is_correct,
        score_impact=e.score_impact, points_possible=e.points_possible, risk_level=e.risk_level,
        scenario_state=e.scenario_state) for e in p.events]
    score, metrics = derive_score(attempt.events)
    if sum(Decimal(e.points_possible) for e in attempt.events) <= 0:
        raise IngestError(422, "Events must include points_possible greater than 0")
    attempt.score = AssessmentScore(score=score, passed=score >= module.pass_mark, pass_mark_used=module.pass_mark,
                                    score_source="derived_from_events", client_reported_score=p.score,
                                    behavior_metrics=metrics)
    try:
        with db.begin_nested():
            db.add(attempt)
            db.flush()
    except IntegrityError:  # concurrent duplicate of the same attempt_id
        existing = db.scalar(select(TrainingAttempt).where(TrainingAttempt.attempt_id == p.attempt_id))
        if existing and existing.worker_id == worker.id:
            _log(db, worker, p.attempt_id, p.device_id, "duplicate")
            db.commit()
            return "duplicate", result_dict(db, existing, "duplicate")
        raise IngestError(409, "attempt_id conflict")

    worker.last_activity_at = max(filter(None, [as_utc(worker.last_activity_at), ended]))
    if attempt.score.passed and p.request_certificate and not has_effective_certificate(db, worker.id, module.id):
        issue_for_attempt(db, attempt)
    _log(db, worker, p.attempt_id, p.device_id, "accepted")
    db.commit()
    return "accepted", result_dict(db, attempt, "accepted")


def log_rejected(db: Session, worker: Worker, attempt_id: str, detail: str) -> None:
    _log(db, worker, attempt_id or "unknown", None, "rejected", detail[:300])
    db.commit()
