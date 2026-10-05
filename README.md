# TRINETRA KAVACH - Admin / Safety Management Platform (Prototype)

Web/admin side of the TRINETRA KAVACH ecosystem. It **monitors results** produced by the Unity
Android AR training app; it does not run AR, YOLO or ARCore.
All data is **demo data**. Certificates are *training records from a prototype workflow*, not
government-approved or legally recognised certification. Safety content is a
*Demo Training Configuration* until supplied by qualified safety experts.

```
Unity Android app -> HTTP REST (LAN) -> FastAPI -> PostgreSQL -> React admin dashboard
```

**Cost: zero.** Docker (free), PostgreSQL, FastAPI, React/Vite, PyJWT, bcrypt, open-source QR library.
No cloud, no external APIs, no accounts, no credit card.

## Status
| Phase | Scope | State |
|---|---|---|
| 1 | Structure, Docker, DB schema, FastAPI core, JWT auth, seed data | Done |
| 2 | Workers, dashboard, modules, assessments, certificates + QR, public verify, reports/CSV, compliance, Android ingestion + sync | Done (15 automated tests) |
| 3 | React foundation: login, layout, API client, dashboard with charts | Done (typecheck, build and proxy test pass; not visually reviewed in a browser) |
| 4 | React pages: workers, training, assessments timeline, certificates + QR, verify, reports, compliance, settings | Next |
| 5 | Polish, Alembic, acceptance test | Planned |

## Run it (exact commands)
Prerequisite: Docker Desktop (free). Run from the project root.

```bash
# 0. One-time setup
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env

# 1. Start PostgreSQL (+ backend)
docker compose up -d postgres   # PostgreSQL only
docker compose up -d --build    # PostgreSQL + FastAPI (http://localhost:8000)

# 2. FastAPI without Docker (optional, for development)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. React admin dashboard (needs Node.js LTS; backend must be running on :8000)
cd frontend
npm install
npm run dev                     # -> http://localhost:5173   (proxies /api to http://localhost:8000)

# 4. Seed demo data (prints a VALID and a REVOKED demo certificate ID)
docker compose exec backend python -m app.seed
docker compose exec backend python -m app.seed --reset   # wipe + reseed

# 5. Open the admin dashboard   -> http://localhost:5173   (login: admin@trinetra.local / Demo@12345)
#    Interactive API docs (works now) -> http://localhost:8000/docs

# 6. Test the API
curl http://localhost:8000/api/v1/health
curl -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@trinetra.local","password":"Demo@12345"}'
curl http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer <access_token>"

# 7. Stop
docker compose down             # stop, keep data
docker compose down -v          # stop and DELETE database volume
```

Demo login (from `.env`, demo only): `admin@trinetra.local` / `Demo@12345`.
Change `JWT_SECRET` for anything beyond your own laptop:
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Connecting the Unity Android developer (local, no cloud)
Backend listens on `0.0.0.0:8000`. Base URL: `http://<URL>/api/v1`.

| Where Unity runs | Base URL |
|---|---|
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Physical phone, same Wi-Fi/hotspot | `http://<laptop-LAN-IP>:8000/api/v1` (`ipconfig` / `ifconfig`) |
| Physical phone over USB | run `adb reverse tcp:8000 tcp:8000`, then `http://localhost:8000/api/v1` |

Notes: allow port 8000 in the laptop firewall; Android blocks plain HTTP by default, so enable
cleartext for dev (Unity: Player Settings -> *Allow downloads over HTTP*); use HTTPS only if you
later deploy. The worker-facing endpoints (attempt submission, offline sync) arrive in Phase 2.

## API overview (`/api/v1`, full detail at `/docs`)
| Area | Endpoints |
|---|---|
| Admin auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Workers | `GET/POST /workers`, `GET/PUT/DELETE /workers/{id}` (delete = deactivate), `POST /workers/{id}/reset-pin` |
| Training | `GET /modules`, `GET /modules/{id}` (analytics), `GET /training/attempts` |
| Assessments | `GET /assessments`, `GET /assessments/{id}` (event timeline + behaviour metrics) |
| Dashboard | `GET /dashboard/summary \| activity \| trends \| module-performance \| recent-certificates` |
| Certificates | `GET/POST /certificates`, `GET /certificates/stats`, `GET /certificates/{id}`, `POST /certificates/{id}/revoke`, `GET /certificates/{id}/qr.svg` |
| **Public** verify | `GET /certificates/verify/{certificate_id}` (no login) |
| Reports | `GET /reports/{training\|assessment\|workers\|modules\|certificates}?range=today\|7d\|30d\|custom&format=json\|csv` |
| Compliance | `GET /compliance`, `GET /organizations` |
| Unity app | `POST /worker-auth/login`, `GET /worker/catalog`, `POST /training/attempts`, `POST /training/attempts/sync`, `GET /worker/certificates` - see `docs/ANDROID_INTEGRATION.md` |

List endpoints support `page`, `page_size`, search/filter/sort and an `organization_id` filter. Admins bound to an
organization (`admins.organization_id`) are restricted to it server-side.

Run the tests: `cd backend && pip install -r requirements-dev.txt && pytest -q` (uses a throwaway SQLite file).

## Design decisions
- API is versioned under `/api/v1`; OpenAPI at `/docs`.
- Public IDs are UUIDs; certificate IDs are **random** (not sequential) to avoid guessing.
- `training_attempts.attempt_id` (generated on the phone) is unique -> idempotent offline sync.
  `synced_at` is set only when the server stores the record.
- Assessment events are stored separately; the score is **derived** from them (`services/assessment.py`).
- `audit_logs` records admin login/logout/failed login now; worker/certificate actions follow in Phase 2.
- Certificate QR = `PUBLIC_BASE_URL/verify/<certificate_id>`. For a phone to scan it during the demo, set `PUBLIC_BASE_URL` to `http://<laptop-LAN-IP>:5173`.
- Public verification returns only name, training, score, dates and status; every lookup is logged (IP stored hashed).
- Certificates do not expire unless `CERTIFICATE_VALIDITY_DAYS` is set; compliance rules are the prototype rules in `services/compliance.py`.
- Errors always return `{"error": {"code", "message", "details"}}`, never stack traces.

## Frontend (Phase 3)
React 19 + TypeScript + Vite + Tailwind 4 + React Router + TanStack Query + Recharts + lucide-react.
- `npm run dev` / `npm run build` / `npm run typecheck`. The dev server proxies `/api` to the backend (`VITE_BACKEND_URL` to change), so no CORS setup is needed locally.
- Built so far: login (real JWT), protected routes, sidebar/header layout (drawer on mobile), organization filter, dashboard (8 KPIs, 3 charts, recent activity, recent certificates, system status). Other pages show a "planned for Phase 4" screen; their APIs already work.
- The token is kept in sessionStorage (localStorage if "Remember me"); application data is never stored in the browser.
- To open the dashboard from another device, browse to `http://<laptop-ip>:5173` (the dev script already uses `--host`).

## Structure
```
backend/app/{main,config,database}.py  models/ schemas/ routers/ services/ auth/
backend/app/seed.py                    demo data (python -m app.seed)
frontend/                              React + TS + Vite + Tailwind
database/                              reserved for migrations
docker-compose.yml  .env.example
```
