import os, tempfile
_db = os.path.join(tempfile.mkdtemp(), "t.db")
os.environ.update(DATABASE_URL=os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_db}"), JWT_SECRET="test-secret-test-secret-test-secret-1234",
                  SEED_ADMIN_PASSWORD="Demo@12345", SEED_WORKER_PIN="123456")
import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="session")
def client():
    from app import seed
    from app.main import app
    seed.main(reset=True)
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def admin(client):
    r = client.post("/api/v1/auth/login", json={"email": "admin@trinetra.local", "password": "Demo@12345"})
    return {"Authorization": "Bearer " + r.json()["access_token"]}

@pytest.fixture(scope="session")
def worker(client):
    r = client.post("/api/v1/worker-auth/login", json={"worker_code": "wk-001", "pin": "123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}
