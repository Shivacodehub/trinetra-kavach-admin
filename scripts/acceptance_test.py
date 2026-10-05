#!/usr/bin/env python3
"""Automated version of the acceptance checklist (README "Acceptance test").

Runs against a RUNNING backend with demo data, over real HTTP. It creates one worker, one training
record and one certificate, so run `python -m app.seed --reset` afterwards for a clean demo.

    cd backend && python ../scripts/acceptance_test.py         (needs: pip install httpx)
Env: API_BASE (default http://localhost:8000/api/v1), ADMIN_EMAIL, ADMIN_PASSWORD, FRONTEND_URL (optional)
"""
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

BASE = os.environ.get("API_BASE", "http://localhost:8000/api/v1")
EMAIL, PASSWORD = os.environ.get("ADMIN_EMAIL", "admin@trinetra.local"), os.environ.get("ADMIN_PASSWORD", "Demo@12345")
FRONTEND = os.environ.get("FRONTEND_URL")
http = httpx.Client(base_url=BASE, timeout=30)
anon = httpx.Client(base_url=BASE, timeout=30)
S: dict = {}
results: list[tuple[str, str, str, str]] = []


def step(ids: str, title: str):
    def deco(fn):
        try:
            detail = fn() or ""
            results.append((ids, title, "PASS", str(detail)))
        except SkipStep as e:
            results.append((ids, title, "SKIP", str(e)))
        except Exception as e:  # noqa: BLE001 - report every failure, keep going
            results.append((ids, title, "FAIL", f"{type(e).__name__}: {e}"))
        return fn
    return deco


class SkipStep(Exception):
    pass


def ok(r: httpx.Response, code: int = 200) -> dict:
    assert r.status_code == code, f"{r.request.method} {r.request.url.path} -> {r.status_code} {r.text[:200]}"
    return r.json() if r.content else {}


def summary() -> dict:
    return ok(http.get("/dashboard/summary"))


@step("1-3", "PostgreSQL, FastAPI (and React if FRONTEND_URL set) are running")
def _():
    h = ok(anon.get("/health"))
    assert h["backend"] == "online" and h["database"] == "connected", h
    if FRONTEND:
        assert httpx.get(FRONTEND, timeout=10).status_code == 200, "frontend not reachable"
        return "backend online, database connected, frontend reachable"
    return "backend online, database connected (frontend not checked)"


@step("4", "Login as admin")
def _():
    d = ok(anon.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}))
    S["token"] = d["access_token"]
    http.headers["Authorization"] = f"Bearer {S['token']}"
    return f"token expires in {d['expires_in']}s"


@step("5", "Dashboard loads real database data")
def _():
    s = summary()
    S["before"] = s
    workers = ok(http.get("/workers", params={"page_size": 1}))["total"]
    scored = ok(http.get("/assessments", params={"page_size": 1}))["total"]
    assert s["total_workers"] == workers > 0, (s["total_workers"], workers)
    assert s["training_completed"] == scored > 0, (s["training_completed"], scored)
    assert len(ok(http.get("/dashboard/trends"))) == 30
    return f"{s['total_workers']} workers, {s['training_completed']} completed, pass rate {s['pass_rate']}%"


@step("6-7", "Open Workers and search for a worker")
def _():
    first = ok(http.get("/workers", params={"page_size": 5}))["items"][0]
    found = ok(http.get("/workers", params={"search": first["worker_code"]}))["items"]
    assert any(w["id"] == first["id"] for w in found)
    S["worker"] = first
    return f"found {first['worker_code']} by ID"


@step("8-9", "Worker profile and training history")
def _():
    wid = S["worker"]["id"]
    p = ok(http.get(f"/workers/{wid}"))
    hist = ok(http.get("/training/attempts", params={"worker_id": wid}))
    assert hist["total"] == p["summary"]["attempts"], (hist["total"], p["summary"]["attempts"])
    return f"{hist['total']} attempts, behaviour metrics: {sorted(p['behavior_performance'])}"


@step("10-12", "Open an attempt: event timeline, score and result")
def _():
    a = ok(http.get("/assessments", params={"page_size": 1}))["items"][0]
    d = ok(http.get(f"/assessments/{a['id']}"))
    assert d["events"], "no events"
    for k in ("timestamp", "action_taken", "expected_action", "is_correct", "score_impact", "risk_level"):
        assert all(k in e for e in d["events"]), k
    possible = sum(e["points_possible"] for e in d["events"])
    derived = max(0, min(100, sum(e["score_impact"] for e in d["events"]) / possible * 100))
    assert abs(derived - d["score"]) < 0.05, (derived, d["score"])
    assert d["result"] in ("pass", "fail")
    return f"{len(d['events'])} events, score {d['score']}% = derived from events, result {d['result'].upper()}"


@step("13-14", "Open certificate and display QR")
def _():
    c = next(c for c in ok(http.get("/certificates", params={"status": "valid", "page_size": 1}))["items"])
    d = ok(http.get(f"/certificates/{c['certificate_id']}"))
    qr = http.get(f"/certificates/{c['certificate_id']}/qr.svg")
    assert qr.status_code == 200 and "<svg" in qr.text
    assert d["verify_url"].endswith("/verify/" + c["certificate_id"]) and "?" not in d["verify_url"]
    S["valid_cert"] = c["certificate_id"]
    return f"QR svg ok; encodes only {d['verify_url']}"


@step("15-17", "Public verification (no login): VALID / REVOKED / INVALID")
def _():
    v = ok(anon.get(f"/certificates/verify/{S['valid_cert']}"))
    assert v["valid"] and v["status"] == "valid"
    assert not ({"email", "phone", "worker_code", "organization"} & set(v["certificate"])), "too much personal data"
    rev = ok(http.get("/certificates", params={"status": "revoked", "page_size": 1}))["items"]
    assert rev, "seed has no revoked certificate"
    r = ok(anon.get(f"/certificates/verify/{rev[0]['certificate_id']}"))
    assert not r["valid"] and r["status"] == "revoked"
    bad = ok(anon.get("/certificates/verify/CERT-TK-2026-NOPE0000"))
    assert not bad["valid"] and bad["status"] == "invalid" and bad["certificate"] is None
    return "valid -> valid, revoked -> revoked, unknown -> invalid"


@step("18-19", "Create another worker and confirm it exists")
def _():
    orgs = ok(http.get("/organizations"))
    code = f"WK-A{uuid.uuid4().hex[:5].upper()}"
    w = ok(http.post("/workers", json={"name": "Acceptance Test Worker", "worker_code": code, "organization_id": orgs[0]["id"],
                                        "preferred_language": "hi"}), 201)
    assert ok(http.get("/workers", params={"search": code}))["total"] == 1
    S["new_worker"] = w
    return f"created {code}"


@step("20-21", "Submit a training record (Android API) and confirm dashboard statistics update")
def _():
    w = S["new_worker"]
    assert http.post(f"/workers/{w['id']}/reset-pin", json={"pin": "246810"}).status_code == 204
    t = ok(anon.post("/worker-auth/login", json={"worker_code": w["worker_code"], "pin": "246810"}))["access_token"]
    wh = {"Authorization": f"Bearer {t}"}
    mod = next(m for m in ok(anon.get("/worker/catalog", headers=wh)) if m["code"] == "GAS")
    t0 = datetime.now(timezone.utc) - timedelta(minutes=4)
    steps = ["HAZARD_ZONE_RECOGNIZED", "PPE_SELECTED", "BUDDY_SYSTEM_PROCEDURE", "SAFE_EXIT"]
    body = {"attempt_id": "accept-" + uuid.uuid4().hex[:12], "module_id": mod["id"], "scenario_id": mod["scenarios"][0]["id"],
            "started_at": t0.isoformat(), "ended_at": (t0 + timedelta(seconds=90)).isoformat(), "device_id": "acceptance-script",
            "events": [{"sequence": i + 1, "event_type": s, "category": "safety_compliance",
                        "occurred_at": (t0 + timedelta(seconds=20 * (i + 1))).isoformat(), "action_taken": s, "expected_action": s,
                        "is_correct": True, "score_impact": 25, "points_possible": 25, "risk_level": "low"} for i, s in enumerate(steps)]}
    r1 = anon.post("/training/attempts", json=body, headers=wh)
    d1 = ok(r1, 201)
    assert d1["passed"] and d1["certificate_id"], d1
    after = summary()
    b = S["before"]
    assert after["total_workers"] == b["total_workers"] + 1
    assert after["training_completed"] == b["training_completed"] + 1
    assert after["certificates_issued"] == b["certificates_issued"] + 1
    d2 = ok(anon.post("/training/attempts", json=body, headers=wh), 200)  # retry of the same attempt_id
    assert d2["status"] == "duplicate" and d2["server_id"] == d1["server_id"]
    again = summary()
    assert again["training_completed"] == after["training_completed"], "duplicate submission was counted"
    return f"completed {b['training_completed']}->{after['training_completed']}, certificates {b['certificates_issued']}->{after['certificates_issued']}, retry = duplicate"


@step("22", "Logout invalidates the session on the server")
def _():
    t = ok(anon.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}))["access_token"]
    h = {"Authorization": f"Bearer {t}"}
    assert anon.get("/auth/me", headers=h).status_code == 200
    assert anon.post("/auth/logout", headers=h).status_code == 204
    assert anon.get("/auth/me", headers=h).status_code == 401, "token still works after logout"
    return "same token rejected with 401 after logout"


@step("23", "Unauthorized access is rejected by the backend")
def _():
    codes = {
        "no token": anon.get("/workers").status_code,
        "garbage token": anon.get("/workers", headers={"Authorization": "Bearer abc.def.ghi"}).status_code,
        "dashboard": anon.get("/dashboard/summary").status_code,
        "certificates": anon.get("/certificates").status_code,
    }
    wt = ok(anon.post("/worker-auth/login", json={"worker_code": S["new_worker"]["worker_code"], "pin": "246810"}))["access_token"]
    codes["worker token on admin route"] = anon.get("/workers", headers={"Authorization": f"Bearer {wt}"}).status_code
    assert set(codes.values()) == {401}, codes
    return "all 401"


@step("24", "Invalid / malformed certificate IDs are handled")
def _():
    for cid in ("DOES-NOT-EXIST", "CERT-TK-2026-ZZZZZZZZ", "x"):
        r = ok(anon.get(f"/certificates/verify/{cid}"))
        assert r["status"] == "invalid" and not r["valid"]
    return "invalid"


@step("25", "API error handling (404 / 409 / 422, structured, no stack traces)")
def _():
    r404 = http.get(f"/workers/{uuid.uuid4()}")
    assert r404.status_code == 404 and r404.json()["error"]["message"]
    dup = http.post("/workers", json={"name": "Dup", "worker_code": S["new_worker"]["worker_code"], "organization_id": S["new_worker"]["organization"]["id"]})
    assert dup.status_code == 409
    r422 = http.post("/workers", json={"name": "x"})
    assert r422.status_code == 422 and r422.json()["error"]["details"]
    assert http.get("/workers", params={"status": "bogus"}).status_code == 422
    for r in (r404, dup, r422):
        assert "Traceback" not in r.text
    return "404, 409, 422 all return {error:{code,message,details}}"


@step("26", "Responsive layout (tablet / phone)")
def _():
    raise SkipStep("MANUAL: open the dashboard at ~1280px, ~768px and ~390px width (browser dev tools). Tables become cards under 768px.")


@step("27", "No secrets in the repository")
def _():
    root = Path(__file__).resolve().parent.parent
    git = ["git", "-C", str(root)]
    if subprocess.run(git + ["rev-parse", "--git-dir"], capture_output=True).returncode != 0:
        raise SkipStep("not a git repository yet. After `git init && git add .` re-run this script.")
    tracked = subprocess.run(git + ["ls-files"], capture_output=True, text=True).stdout.splitlines()
    bad = [f for f in tracked if re.search(r"(^|/)\.env($|\.(?!example))|\.pem$|\.key$|\.db$|\.dump$", f)]
    assert not bad, f"tracked secret-like files: {bad}"
    assert ".env.example" in tracked
    if (root / ".env").exists():
        assert subprocess.run(git + ["check-ignore", "-q", ".env"]).returncode == 0, ".env is not ignored"
    return f"{len(tracked)} tracked files, no .env / keys / databases"


if __name__ == "__main__":
    width = max(len(r[1]) for r in results)
    for ids, title, status, detail in results:
        print(f"[{status:4}] {ids:>5}  {title:<{width}}  {detail}")
    fails = [r for r in results if r[2] == "FAIL"]
    print(f"\n{sum(r[2] == 'PASS' for r in results)} passed, {len(fails)} failed, {sum(r[2] == 'SKIP' for r in results)} skipped/manual")
    sys.exit(1 if fails else 0)
