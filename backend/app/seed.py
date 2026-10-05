"""Demo data. Run:  python -m app.seed [--reset]
Everything created here is fictional and flagged is_demo=True."""
import argparse
import random
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, text

from app import models as m
from app.auth.security import hash_password
from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.services.assessment import derive_score
from app.services.certificates import new_certificate_id

# step key: (category, label, expected action, weight, risk if wrong)
# Wording is generic on purpose: "Demo Training Configuration", not real safety procedure.
STEPS = {
    "FIRE_DETECTED": ("hazard_recognition", "Fire hazard identified", "Identify the fire hazard", 10, "high"),
    "SITUATION_ASSESSED": ("decision_making", "Situation assessed", "Assess whether fire is controllable", 10, "medium"),
    "ALARM_RAISED": ("response_time", "Alarm raised", "Raise the alarm promptly", 15, "high"),
    "CORRECT_EXTINGUISHER_SELECTED": ("procedure_adherence", "Extinguisher selected", "Select extinguisher per scenario configuration", 15, "high"),
    "SAFE_APPROACH": ("safety_compliance", "Approached from safe position", "Approach per scenario configuration", 10, "medium"),
    "EXTINGUISHER_USED": ("procedure_adherence", "Extinguisher used", "Use extinguisher per scenario configuration", 10, "medium"),
    "FIRE_CONTROLLED": ("decision_making", "Fire controlled", "Confirm fire is controlled", 5, "low"),
    "EVACUATION_STARTED": ("decision_making", "Evacuation started", "Start evacuation when required", 10, "critical"),
    "EXIT_SELECTED": ("route_selection", "Exit selected", "Select an unblocked exit", 10, "critical"),
    "ASSEMBLY_POINT_REACHED": ("safety_compliance", "Assembly point reached", "Reach the designated assembly point", 10, "medium"),
    "HAZARD_ZONE_RECOGNIZED": ("hazard_recognition", "Hazard zone recognised", "Recognise the marked hazard zone", 25, "critical"),
    "PPE_SELECTED": ("safety_compliance", "PPE selected", "Select PPE listed in scenario configuration", 25, "high"),
    "BUDDY_SYSTEM_PROCEDURE": ("procedure_adherence", "Buddy-system followed", "Follow buddy-system step", 25, "high"),
    "SAFE_EXIT": ("route_selection", "Safe exit taken", "Exit via the safe route", 25, "critical"),
    "TAG_IN": ("procedure_adherence", "Tag-in completed", "Complete tag-in step", 25, "high"),
    "LOCKOUT_TAGOUT_APPLIED": ("procedure_adherence", "Lockout/Tagout applied", "Apply lockout/tagout step", 30, "critical"),
    "DANGER_ZONE_RECOGNIZED": ("hazard_recognition", "Danger zone recognised", "Recognise the marked danger zone", 25, "critical"),
    "MACHINE_EXIT_SELECTED": ("route_selection", "Exit selected", "Select the exit route", 20, "medium"),
}
FIRE_FULL = list(STEPS)[:10]
MODULES = [
    ("FIRE", "Fire & Explosion Response", "Behavioural assessment of fire detection, alarm, extinguisher use and evacuation.", [
        ("ELECTRICAL_FIRE", "Electrical Fire", FIRE_FULL),
        ("CONTROLLABLE_FIRE", "Controllable Fire", FIRE_FULL),
        ("UNCONTROLLABLE_FIRE", "Uncontrollable Fire", ["FIRE_DETECTED", "SITUATION_ASSESSED", "ALARM_RAISED", "EVACUATION_STARTED", "EXIT_SELECTED", "ASSEMBLY_POINT_REACHED"]),
        ("BLOCKED_EXIT", "Blocked Exit", ["FIRE_DETECTED", "ALARM_RAISED", "EVACUATION_STARTED", "EXIT_SELECTED", "ASSEMBLY_POINT_REACHED"]),
        ("EMERGENCY_EVACUATION", "Emergency Evacuation", ["ALARM_RAISED", "EVACUATION_STARTED", "EXIT_SELECTED", "ASSEMBLY_POINT_REACHED"]),
    ]),
    ("GAS", "Gas Leak & Confined Space Protocol", "Hazard-zone recognition, PPE selection, buddy-system procedure and safe exit.", [
        ("GAS_LEAK_CONFINED", "Gas Leak in Confined Space", ["HAZARD_ZONE_RECOGNIZED", "PPE_SELECTED", "BUDDY_SYSTEM_PROCEDURE", "SAFE_EXIT"]),
        ("CONFINED_ENTRY", "Confined Space Entry", ["HAZARD_ZONE_RECOGNIZED", "PPE_SELECTED", "BUDDY_SYSTEM_PROCEDURE", "SAFE_EXIT"]),
    ]),
    ("MACH", "Machinery Safety", "Tag-in, lockout/tagout, danger-zone recognition and exit selection.", [
        ("LOTO_MAINTENANCE", "Maintenance Lockout/Tagout", ["TAG_IN", "LOCKOUT_TAGOUT_APPLIED", "DANGER_ZONE_RECOGNIZED", "MACHINE_EXIT_SELECTED"]),
        ("CONVEYOR_DANGER_ZONE", "Conveyor Danger Zone", ["DANGER_ZONE_RECOGNIZED", "LOCKOUT_TAGOUT_APPLIED", "MACHINE_EXIT_SELECTED"]),
    ]),
]
ORGS = [("Jamshedpur Steel Plant (Demo)", "JSP", "steel_plant"),
        ("Koderma Mica Mining Division (Demo)", "KMD", "mining"),
        ("Regional Training Center (Demo)", "RTC", "training_center")]
WORKERS = [("Ramesh Kumar", "Operator", "hi"), ("Suresh Yadav", "Fitter", "hi"), ("Amit Kumar", "Electrician", "en"),
           ("Pankaj Singh", "Supervisor", "hi"), ("Sunita Devi", "Sorting Operator", "hi"), ("Mangal Hembrom", "Miner", "sat"),
           ("Budhan Murmu", "Miner", "sat"), ("Rakesh Oraon", "Crane Operator", "hi"), ("Anita Kumari", "Quality Inspector", "en"),
           ("Dinesh Mahto", "Furnace Helper", "hi"), ("Sanjay Prasad", "Maintenance Tech", "en"), ("Lakhi Tudu", "Miner", "sat"),
           ("Vikram Sharma", "Warehouse Staff", "en"), ("Geeta Soren", "Sorting Operator", "sat"), ("Mohit Verma", "Trainee", "en")]

def build_attempt(rng, now, worker, skill, mod, sc, steps, in_progress=False):
    start = now - timedelta(days=rng.randint(0, 29), hours=rng.randint(0, 9), minutes=rng.randint(15, 59))
    total_w = sum(STEPS[k][3] for k in steps)
    attempt = m.TrainingAttempt(
        attempt_id=f"demo-{secrets.token_hex(8)}", worker_id=worker.id, module_id=mod.id, scenario_id=sc.id,
        status="in_progress" if in_progress else "completed", started_at=start, language=worker.preferred_language,
        device_id=f"demo-device-{rng.randint(1, 4)}", app_version="0.0.0-demo", client_created_at=start, is_demo=True)
    t, events = start, []
    run = steps[: len(steps) // 2] if in_progress else steps
    for i, key in enumerate(run, 1):
        cat, label, expected, w, risk = STEPS[key]
        t += timedelta(seconds=rng.randint(8, 45) + (rng.randint(20, 70) if key in ("ASSEMBLY_POINT_REACHED", "SAFE_EXIT") else 0))
        ok = rng.random() < skill
        pts = Decimal(w) / total_w * 100
        pts = pts.quantize(Decimal("0.01"))
        penalty = (-(pts * Decimal("0.25"))).quantize(Decimal("0.01")) if (not ok and risk == "critical") else Decimal(0)
        events.append(m.AssessmentEvent(
            sequence=i, event_type=key, category=cat, occurred_at=t,
            action_taken=label if ok else f"Incorrect or missed action at step {key}", expected_action=expected,
            is_correct=ok, score_impact=pts if ok else penalty, points_possible=pts,
            risk_level="low" if ok else risk, scenario_state={"scenario": sc.code, "step": i}, is_demo=True))
    attempt.events = events
    if not in_progress:
        attempt.ended_at = t + timedelta(seconds=rng.randint(3, 12))
        attempt.duration_seconds = int((attempt.ended_at - start).total_seconds())
        attempt.synced_at = min(attempt.ended_at + timedelta(minutes=rng.randint(1, 20)), now - timedelta(minutes=2))
    return attempt


def main(reset: bool) -> None:
    s = get_settings()
    if not s.seed_admin_password:
        raise SystemExit("Set SEED_ADMIN_PASSWORD in .env first.")
    if reset:
        Base.metadata.drop_all(engine)
        with engine.begin() as c:
            c.execute(text("DROP TABLE IF EXISTS alembic_version"))
    Base.metadata.create_all(engine)
    rng, now = random.Random(2026), datetime.now(timezone.utc)
    with SessionLocal() as db:
        if db.scalar(select(m.Admin).limit(1)) or db.scalar(select(m.Worker).limit(1)):
            raise SystemExit("Database already has data. Re-run with --reset to rebuild demo data.")
        orgs = [m.Organization(name=n, code=c, org_type=t) for n, c, t in ORGS]
        db.add_all(orgs)
        db.add(m.Admin(email=s.seed_admin_email.lower(), full_name="Demo Safety Administrator",
                       password_hash=hash_password(s.seed_admin_password)))
        mods = []
        for code, name, desc, scs in MODULES:
            mod = m.Module(code=code, name=name, description=desc, pass_mark=70)
            mod.scenarios = [m.Scenario(code=c, name=n, description=f"Demo scenario: {n}") for c, n, _ in scs]
            mods.append((mod, scs))
        db.add_all([x for x, _ in mods])
        workers = []
        for i, (name, role, lang) in enumerate(WORKERS, 1):
            org = orgs[(i - 1) % 3] if i > 3 else orgs[i % 3]
            workers.append(m.Worker(worker_code=f"WK-{i:03d}", name=name, role_title=role, preferred_language=lang,
                                    organization=org, department="Operations" if i % 2 else "Maintenance",
                                    phone=None, email=None, is_demo=True))
        pin_hash = hash_password(s.seed_worker_pin) if s.seed_worker_pin else None
        for w in workers:
            w.pin_hash = pin_hash
        db.add_all(workers)
        db.flush()

        skills = {w.id: rng.choice([0.55, 0.7, 0.8, 0.88, 0.95]) for w in workers}
        attempts = []
        for w in workers:
            for _ in range(rng.randint(2, 4)):
                mod, scs = rng.choice(mods)
                code, _, steps = rng.choice(scs)
                sc = next(x for x in mod.scenarios if x.code == code)
                attempts.append(build_attempt(rng, now, w, skills[w.id], mod, sc, steps))
        for w in workers[:2]:  # currently training
            mod, scs = mods[0]
            sc = mod.scenarios[0]
            attempts.append(build_attempt(rng, now, w, 0.9, mod, sc, scs[0][2], in_progress=True))
        for a in attempts:
            a.started_at = min(a.started_at, now - timedelta(minutes=30)) if a.status == "in_progress" else a.started_at
        db.add_all(attempts)
        db.flush()

        by_mod = {mod.id: mod for mod, _ in mods}
        certified, cert_ids = set(), []
        for a in sorted(attempts, key=lambda x: x.started_at):
            w = next(x for x in workers if x.id == a.worker_id)
            w.last_activity_at = max(w.last_activity_at or a.started_at, a.started_at)
            if a.status != "completed":
                continue
            score, metrics = derive_score(a.events)
            mod = by_mod[a.module_id]
            passed = score >= mod.pass_mark
            db.add(m.AssessmentScore(attempt_pk=a.id, score=score, passed=passed, pass_mark_used=mod.pass_mark,
                                     behavior_metrics=metrics))
            db.add(m.SyncLog(device_id=a.device_id, worker_id=a.worker_id, attempt_id=a.attempt_id,
                             status="accepted", received_at=a.synced_at))
            if passed and (a.worker_id, a.module_id) not in certified:
                certified.add((a.worker_id, a.module_id))
                cid = new_certificate_id()
                cert_ids.append(cid)
                db.add(m.Certificate(certificate_id=cid, attempt_pk=a.id, worker_id=a.worker_id, module_id=a.module_id,
                                     score=score, issued_at=a.ended_at, is_demo=True))
        db.flush()
        revoked = db.scalar(select(m.Certificate).order_by(m.Certificate.issued_at).limit(1))
        revoked.status, revoked.revoked_at = "revoked", now
        revoked.revoked_reason = "Demo: issued in error"
        db.commit()
        print(f"Seeded: {len(orgs)} orgs, {len(workers)} workers, {len(mods)} modules, "
              f"{len(attempts)} attempts, {len(cert_ids)} certificates (1 revoked).")
        print(f"Admin login: {s.seed_admin_email}")
        print("Worker app login: worker_code WK-001 + SEED_WORKER_PIN" if pin_hash else
              "No SEED_WORKER_PIN set: use POST /workers/{id}/reset-pin to give workers an app PIN")
        print(f"Demo VALID certificate id:   {cert_ids[-1]}")
        print(f"Demo REVOKED certificate id: {revoked.certificate_id}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="drop all tables and re-seed")
    main(ap.parse_args().reset)
