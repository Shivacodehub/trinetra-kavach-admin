import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import models  # noqa: F401  (registers tables)
from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, certificates, compliance, dashboard, health, reports, training, worker_app, workers

log = logging.getLogger("trinetra")
settings = get_settings()
settings.assert_production_safe()


def _wait_for_db(attempts: int = 30) -> None:
    for i in range(attempts):
        try:
            with engine.connect() as c:
                c.execute(text("SELECT 1"))
            return
        except Exception:
            log.warning("Waiting for database (%d/%d)...", i + 1, attempts)
            time.sleep(1)
    raise RuntimeError("Database not reachable")


@asynccontextmanager
async def lifespan(_: FastAPI):
    _wait_for_db()
    if settings.auto_create_tables:
        Base.metadata.create_all(engine)  # dev convenience; production-style setups run `alembic upgrade head`
    yield


app = FastAPI(
    title="TRINETRA KAVACH Admin API",
    version="0.1.0",
    description="Backend for the safety-management dashboard and the Unity Android training app. "
                "PROTOTYPE - demo data only; certificates are training records, not official certification.",
    docs_url="/docs", openapi_url="/api/v1/openapi.json", lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"],
)


def _err(status_code: int, message: str, details=None, headers=None) -> JSONResponse:
    return JSONResponse({"error": {"code": status_code, "message": message, "details": details}},
                        status_code=status_code, headers=headers)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return _err(exc.status_code, str(exc.detail), headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]}
               for e in exc.errors()]
    return _err(422, "Validation failed", details)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", type(exc).__name__)  # no request bodies/tokens logged
    return _err(500, "Internal server error")


API = "/api/v1"
app.include_router(health.router, prefix=API)
app.include_router(auth.router, prefix=API)
for r in (workers.router, training.router, dashboard.router, compliance.router, certificates.router,
          certificates.public, reports.router, worker_app.router):
    app.include_router(r, prefix=API)
