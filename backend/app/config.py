from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    environment: str = "development"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    remember_me_minutes: int = 10080
    cors_origins: str = "http://localhost:5173"
    seed_admin_email: str = "admin@trinetra.local"
    seed_admin_password: str = ""
    seed_worker_pin: str = ""
    auto_create_tables: bool = True   # dev convenience; set false when schema is managed by Alembic
    public_base_url: str = "http://localhost:5173"   # encoded into certificate QR codes
    worker_token_minutes: int = 10080
    certificate_validity_days: int = 0               # 0 = certificates do not expire

    @field_validator("jwt_secret")
    @classmethod
    def _secret_long_enough(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def assert_production_safe(self) -> None:
        if self.environment == "production" and self.jwt_secret.startswith("dev-only"):
            raise RuntimeError("Refusing to start in production with the example JWT_SECRET")


@lru_cache
def get_settings() -> Settings:
    return Settings()
