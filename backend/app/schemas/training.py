import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Risk = Literal["low", "medium", "high", "critical"]


class EventIn(BaseModel):
    sequence: int = Field(ge=1, le=1000, description="1-based order of the event within the attempt")
    event_type: str = Field(min_length=1, max_length=64, examples=["ALARM_RAISED"])
    category: str | None = Field(None, max_length=40, examples=["response_time"])
    occurred_at: datetime
    action_taken: str = Field(max_length=200)
    expected_action: str = Field(max_length=200)
    is_correct: bool
    score_impact: Decimal = Field(ge=-100, le=100, description="Points awarded (or deducted) by the assessment engine")
    points_possible: Decimal = Field(ge=0, le=100, description="Maximum points this step could award")
    risk_level: Risk = "low"
    scenario_state: dict[str, Any] | None = None


class AttemptSubmit(BaseModel):
    attempt_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9._-]+$",
                            description="Unique id generated on the phone (e.g. a GUID). Idempotency key.",
                            examples=["3f2b8c1e-9d4a-4e7b-8a21-5c0d7e9f1a23"])
    worker_id: str | None = Field(None, description="Optional; must match the logged-in worker (UUID or worker_code)")
    module_id: uuid.UUID
    scenario_id: uuid.UUID
    started_at: datetime
    ended_at: datetime
    duration_seconds: int | None = Field(None, ge=0, le=86400)
    language: Literal["en", "hi", "sat"] | None = None
    device_id: str | None = Field(None, max_length=64)
    app_version: str | None = Field(None, max_length=20)
    client_created_at: datetime | None = None
    score: Decimal | None = Field(None, ge=0, le=100, description="Client-calculated score; stored for comparison only. "
                                                                 "The server derives the official score from events.")
    passed: bool | None = None
    request_certificate: bool = True
    events: list[EventIn] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def _checks(self):
        if self.ended_at < self.started_at:
            raise ValueError("ended_at must not be before started_at")
        seqs = [e.sequence for e in self.events]
        if len(set(seqs)) != len(seqs):
            raise ValueError("events must have unique sequence numbers")
        limit = datetime.now(timezone.utc) + timedelta(days=1)
        for dt in (self.started_at, self.ended_at):
            if (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)) > limit:
                raise ValueError("timestamps cannot be in the future")
        return self


class AttemptResult(BaseModel):
    status: Literal["accepted", "duplicate"]
    attempt_id: str
    server_id: uuid.UUID
    score: float
    passed: bool
    pass_mark: int
    synced_at: datetime | None
    score_mismatch: bool = Field(description="True if the client-reported score differs from the server-derived score")
    certificate_id: str | None
    certificate_verify_url: str | None


class SyncRequest(BaseModel):
    attempts: list[dict[str, Any]] = Field(min_length=1, max_length=50,
                                           description="Each item has the same shape as POST /training/attempts")


class SyncItemResult(BaseModel):
    attempt_id: str | None
    status: Literal["accepted", "duplicate", "rejected"]
    result: AttemptResult | None = None
    error: str | None = None


class SyncResponse(BaseModel):
    results: list[SyncItemResult]


class WorkerLogin(BaseModel):
    worker_code: str = Field(min_length=2, max_length=32)
    pin: str = Field(min_length=4, max_length=8)


class WorkerToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    worker: dict[str, Any]
