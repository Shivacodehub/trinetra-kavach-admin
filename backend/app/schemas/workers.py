import re
import uuid
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Lang = Literal["en", "hi", "sat"]
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE = re.compile(r"^\+?[0-9 \-]{7,18}$")


def _clean(v: str | None) -> str | None:
    v = v.strip() if isinstance(v, str) else v
    return v or None


class _Contact(BaseModel):
    @field_validator("email", check_fields=False)
    @classmethod
    def _email(cls, v):
        v = _clean(v)
        if v and not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v.lower() if v else v

    @field_validator("phone", check_fields=False)
    @classmethod
    def _phone(cls, v):
        v = _clean(v)
        if v and not _PHONE.match(v):
            raise ValueError("Enter a valid phone number")
        return v


class WorkerCreate(_Contact):
    name: str = Field(min_length=2, max_length=120)
    worker_code: str = Field(pattern=r"^[A-Za-z0-9_-]{2,32}$")
    email: str | None = None
    phone: str | None = None
    organization_id: uuid.UUID
    department: str | None = Field(None, max_length=80)
    role_title: str | None = Field(None, max_length=80)
    preferred_language: Lang = "en"
    pin: str | None = Field(None, pattern=r"^[0-9]{4,8}$", description="Optional PIN for the Android app login")

    @field_validator("worker_code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


class WorkerUpdate(_Contact):
    name: str | None = Field(None, min_length=2, max_length=120)
    email: str | None = None
    phone: str | None = None
    organization_id: uuid.UUID | None = None
    department: str | None = Field(None, max_length=80)
    role_title: str | None = Field(None, max_length=80)
    preferred_language: Lang | None = None
    is_active: bool | None = None


class PinReset(BaseModel):
    pin: str = Field(pattern=r"^[0-9]{4,8}$")
