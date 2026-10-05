import uuid
from datetime import datetime, timedelta, timezone

A = "/api/v1"

def test_protected_routes_require_auth(client):
    for path in ("/workers", "/modules", "/assessments", "/dashboard/summary", "/certificates", "/reports/training", "/compliance"):
        assert client.get(A + path).status_code == 401

def test_worker_token_cannot_access_admin_and_vice_versa(client, admin, worker):
    assert client.get(A + "/workers", headers=worker).status_code == 401
    assert client.get(A + "/worker/me", headers=admin).status_code == 401

def test_dashboard(client, admin):
    s = client.get(A + "/dashboard/summary", headers=admin).json()
    assert s["total_workers"] == 15 and s["training_completed"] > 30 and s["active_training"] == 2
    assert 0 < s["pass_rate"] < 100 and s["certificates_revoked"] == 1
    assert len(client.get(A + "/dashboard/trends", headers=admin).json()) == 30
    assert len(client.get(A + "/dashboard/activity", headers=admin).json()) == 10
    assert len(client.get(A + "/dashboard/module-performance", headers=admin).json()) == 3
    assert len(client.get(A + "/dashboard/recent-certificates", headers=admin).json()) == 5

def test_workers_list_search_filter_sort(client, admin):
    r = client.get(A + "/workers?page_size=5&sort_by=avg_score&sort_order=desc", headers=admin).json()
    assert r["total"] == 15 and len(r["items"]) == 5 and r["pages"] == 3
    r = client.get(A + "/workers?search=ramesh", headers=admin).json()
    assert [w["worker_code"] for w in r["items"]] == ["WK-001"]
    assert client.get(A + "/workers?search=%25", headers=admin).json()["total"] == 0  # wildcard escaped
    assert client.get(A + "/workers?status=bogus", headers=admin).status_code == 422
    assert client.get(A + "/workers?status=in_progress", headers=admin).json()["total"] >= 1

def test_worker_crud_and_audit(client, admin):
    org = client.get(A + "/organizations", headers=admin).json()[0]["id"]
    body = {"name": "Test Worker", "worker_code": "wk-900", "organization_id": org, "preferred_language": "sat", "phone": "+91 98765 43210"}
    r = client.post(A + "/workers", json=body, headers=admin)
    assert r.status_code == 201 and r.json()["worker_code"] == "WK-900"
    assert client.post(A + "/workers", json=body, headers=admin).status_code == 409
    wid = r.json()["id"]
    assert client.put(f"{A}/workers/{wid}", json={"role_title": "Welder"}, headers=admin).json()["role_title"] == "Welder"
    assert client.post(A + "/workers", json={**body, "worker_code": "x", "email": "bad"}, headers=admin).status_code == 422
    assert client.post(f"{A}/workers/{wid}/reset-pin", json={"pin": "4321"}, headers=admin).status_code == 204
    assert client.post(A + "/worker-auth/login", json={"worker_code": "WK-900", "pin": "4321"}).status_code == 200
    assert client.delete(f"{A}/workers/{wid}", headers=admin).status_code == 204
    assert client.post(A + "/worker-auth/login", json={"worker_code": "WK-900", "pin": "4321"}).status_code == 401
    assert client.get(f"{A}/workers/{uuid.uuid4()}", headers=admin).status_code == 404

def test_profile_history_and_timeline(client, admin):
    w = client.get(A + "/workers?search=WK-001", headers=admin).json()["items"][0]
    p = client.get(f"{A}/workers/{w['id']}", headers=admin).json()
    assert p["summary"]["attempts"] >= 2 and "hazard_recognition" in str(p["behavior_performance"]) or p["behavior_performance"]
    hist = client.get(f"{A}/training/attempts?worker_id={w['id']}", headers=admin).json()
    assert hist["total"] == p["summary"]["attempts"]
    done = next(a for a in hist["items"] if a["status"] == "completed")
    d = client.get(f"{A}/assessments/{done['id']}", headers=admin).json()
    assert d["events_total"] == len(d["events"]) > 0 and d["result"] in ("pass", "fail")
    assert d["events"][0]["elapsed_seconds"] >= 0 and {"expected_action", "risk_level", "score_impact"} <= d["events"][0].keys()
    assert abs(sum(max(e["score_impact"], 0) for e in d["events"]) / sum(e["points_possible"] for e in d["events"]) * 100 - d["score"]) < 15

def test_modules_and_analytics(client, admin):
    mods = client.get(A + "/modules", headers=admin).json()
    assert len(mods) == 3 and all("pass_rate" in m for m in mods)
    d = client.get(f"{A}/modules/{mods[0]['id']}", headers=admin).json()
    assert len(d["score_distribution"]) == 10 and d["by_organization"] and d["by_worker"] is not None
    assert d["common_failure_areas"] is not None and d["pass_fail"]["passed"] + d["pass_fail"]["failed"] == sum(
        b["passed"] + b["failed"] for b in d["score_distribution"])

def test_assessments_filters(client, admin):
    p = client.get(A + "/assessments?result=pass&page_size=100", headers=admin).json()
    f = client.get(A + "/assessments?result=fail&page_size=100", headers=admin).json()
    assert p["total"] > 0 and f["total"] > 0 and all(a["result"] == "pass" for a in p["items"])
    assert client.get(A + "/assessments?date_from=2999-01-01", headers=admin).json()["total"] == 0

def test_certificates_verify_flow(client, admin):
    certs = client.get(A + "/certificates?page_size=100", headers=admin).json()
    assert certs["total"] >= 20
    valid = next(c for c in certs["items"] if c["status"] == "valid")
    revoked = next(c for c in certs["items"] if c["status"] == "revoked")
    st = client.get(A + "/certificates/stats", headers=admin).json()
    assert st["issued"] == certs["total"] and st["revoked"] == 1
    d = client.get(f"{A}/certificates/{valid['certificate_id']}", headers=admin).json()
    assert d["verify_url"].endswith("/verify/" + valid["certificate_id"]) and "Prototype" in d["disclaimer"]
    qr = client.get(f"{A}/certificates/{valid['certificate_id']}/qr.svg", headers=admin)
    assert qr.status_code == 200 and qr.text.lstrip().startswith(("<?xml", "<svg"))
    # public verification: no auth
    v = client.get(f"{A}/certificates/verify/{valid['certificate_id'].lower()}").json()
    assert v["valid"] and v["status"] == "valid" and v["certificate"]["worker_name"]
    assert not ({"email", "phone", "worker_code", "organization"} & set(v["certificate"]))
    r = client.get(f"{A}/certificates/verify/{revoked['certificate_id']}").json()
    assert not r["valid"] and r["status"] == "revoked"
    bad = client.get(f"{A}/certificates/verify/CERT-TK-2026-NOPE0000").json()
    assert not bad["valid"] and bad["status"] == "invalid" and bad["certificate"] is None
    assert client.get(f"{A}/certificates/{valid['certificate_id']}", headers=admin).json()["verification_count"] >= 1
    # revoke -> verification changes
    assert client.post(f"{A}/certificates/{valid['certificate_id']}/revoke", json={"reason": "test"}, headers=admin).json()["status"] == "revoked"
    assert client.get(f"{A}/certificates/verify/{valid['certificate_id']}").json()["status"] == "revoked"
    assert client.post(f"{A}/certificates/{valid['certificate_id']}/revoke", json={"reason": "again"}, headers=admin).status_code == 409

def _payload(client, worker, attempt_id, correct=True, **over):
    cat = client.get(A + "/worker/catalog", headers=worker).json()
    mod = next(m for m in cat if m["code"] == "GAS")
    t0 = datetime.now(timezone.utc) - timedelta(minutes=5)
    steps = ["HAZARD_ZONE_RECOGNIZED", "PPE_SELECTED", "BUDDY_SYSTEM_PROCEDURE", "SAFE_EXIT"]
    ev = [{"sequence": i + 1, "event_type": s, "category": "safety_compliance", "occurred_at": (t0 + timedelta(seconds=20 * (i + 1))).isoformat(),
           "action_taken": s, "expected_action": s, "is_correct": correct, "score_impact": 25 if correct else 0,
           "points_possible": 25, "risk_level": "low" if correct else "high"} for i, s in enumerate(steps)]
    return {"attempt_id": attempt_id, "module_id": mod["id"], "scenario_id": mod["scenarios"][0]["id"],
            "started_at": t0.isoformat(), "ended_at": (t0 + timedelta(seconds=100)).isoformat(), "score": 100,
            "device_id": "test-device", "events": ev, **over}

def test_unity_submit_is_idempotent(client, admin, worker):
    aid = "unit-test-" + uuid.uuid4().hex[:10]
    p = _payload(client, worker, aid)
    r1 = client.post(A + "/training/attempts", json=p, headers=worker)
    assert r1.status_code == 201 and r1.json()["status"] == "accepted" and r1.json()["passed"] and r1.json()["score"] == 100
    r2 = client.post(A + "/training/attempts", json=p, headers=worker)
    assert r2.status_code == 200 and r2.json()["status"] == "duplicate" and r2.json()["server_id"] == r1.json()["server_id"]
    n = client.get(f"{A}/training/attempts?search={aid}", headers=admin).json()
    assert n["total"] == 1  # no duplicate row
    # another worker cannot reuse the id
    other = client.post(A + "/worker-auth/login", json={"worker_code": "WK-002", "pin": "123456"}).json()["access_token"]
    assert client.post(A + "/training/attempts", json=p, headers={"Authorization": "Bearer " + other}).status_code == 409
    # spoofing another worker's id is refused
    assert client.post(A + "/training/attempts", json=_payload(client, worker, "spoof-" + uuid.uuid4().hex[:8], worker_id="WK-002"), headers=worker).status_code == 403

def test_server_derives_score_not_client(client, worker):
    r = client.post(A + "/training/attempts", json=_payload(client, worker, "cheat-" + uuid.uuid4().hex[:8], correct=False), headers=worker).json()
    assert r["score"] == 0 and r["passed"] is False and r["score_mismatch"] is True and r["certificate_id"] is None

def test_sync_batch_partial_failure(client, worker):
    good = _payload(client, worker, "batch-ok-" + uuid.uuid4().hex[:8])
    bad = {**_payload(client, worker, "batch-bad-" + uuid.uuid4().hex[:8]), "events": []}
    r = client.post(A + "/training/attempts/sync", json={"attempts": [good, bad, good]}, headers=worker).json()["results"]
    assert [x["status"] for x in r] == ["accepted", "rejected", "duplicate"]

def test_validation_errors(client, worker):
    p = _payload(client, worker, "val-" + uuid.uuid4().hex[:8])
    p["ended_at"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    r = client.post(A + "/training/attempts", json=p, headers=worker)
    assert r.status_code == 422 and r.json()["error"]["details"]

def test_reports_and_csv_safety(client, admin):
    for kind in ("training", "assessment", "workers", "modules", "certificates"):
        r = client.get(f"{A}/reports/{kind}?range=all", headers=admin).json()
        assert r["total"] > 0 and len(r["columns"]) == len(r["rows"][0])
    csv_ = client.get(f"{A}/reports/certificates?range=30d&format=csv", headers=admin)
    assert csv_.headers["content-type"].startswith("text/csv") and csv_.text.startswith("Certificate ID")
    assert client.get(A + "/reports/training?range=custom", headers=admin).status_code == 422
    from app.services.reports import _safe
    assert _safe("=cmd()") == "'=cmd()" and _safe(-5) == "-5" and _safe("ok") == "ok"

def test_compliance(client, admin):
    r = client.get(A + "/compliance?page_size=100", headers=admin).json()
    assert r["total"] == 45 and sum(r["summary"].values()) == 45
    assert client.get(A + "/compliance?status=COMPLIANT", headers=admin).json()["total"] == r["summary"]["COMPLIANT"]


def test_logout_revokes_token_on_server(client):
    t = client.post(A + "/auth/login", json={"email": "admin@trinetra.local", "password": "Demo@12345"}).json()["access_token"]
    h = {"Authorization": "Bearer " + t}
    assert client.get(A + "/auth/me", headers=h).status_code == 200
    assert client.post(A + "/auth/logout", headers=h).status_code == 204
    r = client.get(A + "/auth/me", headers=h)
    assert r.status_code == 401 and "signed out" in r.json()["error"]["message"]
    assert client.get(A + "/workers", headers=h).status_code == 401


def test_unexpected_errors_do_not_leak_details(client):
    from fastapi.testclient import TestClient
    from app.main import app
    @app.get("/api/v1/_boom")
    def boom():
        raise RuntimeError("secret internal detail /etc/passwd")
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/api/v1/_boom")
    assert r.status_code == 500 and r.json()["error"]["message"] == "Internal server error"
    assert "secret" not in r.text and "Traceback" not in r.text
