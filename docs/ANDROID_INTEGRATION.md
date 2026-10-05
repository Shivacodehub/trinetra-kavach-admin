# Android (Unity) <-> Backend integration guide

Base URL: `http://<laptop-ip>:8000/api/v1` (see README for emulator / USB options). Interactive docs: `/docs`.
All bodies are JSON. Timestamps are ISO-8601 (send UTC, e.g. `2026-10-01T10:02:11Z`).

## 1. Log in (worker_code + PIN)
`POST /worker-auth/login`
```json
{ "worker_code": "WK-001", "pin": "123456" }
```
Returns `access_token` (valid `WORKER_TOKEN_MINUTES`, default 7 days) and `worker`. Send it on every call:
`Authorization: Bearer <access_token>`. On `401`, log in again (needs connectivity). Max 10 logins/min/IP.
Admins create workers and set PINs in the dashboard (or `POST /workers/{id}/reset-pin`).

## 2. Get module / scenario ids
`GET /worker/catalog` -> modules with `id`, `code`, `pass_mark`, and `scenarios[] {id, code, name}`. Cache it locally.

## 3. Submit a finished attempt
`POST /training/attempts`
```json
{
  "attempt_id": "3f2b8c1e-9d4a-4e7b-8a21-5c0d7e9f1a23",
  "module_id": "<uuid from catalog>",
  "scenario_id": "<uuid from catalog>",
  "started_at": "2026-10-01T10:02:00Z",
  "ended_at": "2026-10-01T10:08:42Z",
  "language": "hi",
  "device_id": "pixel-7-abc",
  "app_version": "0.3.1",
  "score": 86,
  "request_certificate": true,
  "events": [
    { "sequence": 1, "event_type": "FIRE_DETECTED", "category": "hazard_recognition",
      "occurred_at": "2026-10-01T10:02:11Z", "action_taken": "Fire hazard identified",
      "expected_action": "Identify the fire hazard", "is_correct": true,
      "score_impact": 10, "points_possible": 10, "risk_level": "low",
      "scenario_state": { "step": 1 } }
  ]
}
```
- `attempt_id` = a GUID **generated on the phone when the attempt starts**; it is the idempotency key.
- The server **derives the official score from `events`** (`sum(score_impact) / sum(points_possible)`), compares with your `score`
  (`score_mismatch` in the reply) and sets pass/fail from the module pass mark. Categories used by the dashboard:
  `hazard_recognition, procedure_adherence, decision_making, response_time, route_selection, safety_compliance`.
- Responses: `201` accepted, `200` duplicate (same `attempt_id` - safe to retry; stored result returned),
  `409` id used by another worker, `403` `worker_id` mismatch, `422` validation (`error.details` lists fields).
```json
{ "status": "accepted", "attempt_id": "...", "server_id": "...", "score": 86.0, "passed": true, "pass_mark": 70,
  "synced_at": "...", "score_mismatch": false, "certificate_id": "CERT-TK-2026-K7M2PQX9",
  "certificate_verify_url": "http://.../verify/CERT-TK-2026-K7M2PQX9" }
```
A certificate is issued automatically when the attempt passes and the worker has no valid certificate for that module.

## 4. Offline sync (queue flush)
Store finished attempts in SQLite; when online send up to 50 at once:
`POST /training/attempts/sync` with `{ "attempts": [ <same object as above>, ... ] }`.
Each item is handled independently -> `results[]` with `status` = `accepted | duplicate | rejected` (+ `error`).
Delete from the local queue on `accepted` or `duplicate`; keep / fix on `rejected`. Mark an attempt as synced
in the UI only after the server confirmed it.

## 5. Certificates
`GET /worker/certificates` -> the worker's certificates. QR code content = `certificate_verify_url`
(a URL containing only the certificate id). Public check: `GET /certificates/verify/{certificate_id}` (no login).

## Errors
Always `{ "error": { "code": 422, "message": "...", "details": [...] } }`.
