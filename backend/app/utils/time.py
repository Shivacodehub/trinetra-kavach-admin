from datetime import date, datetime, time, timedelta, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def resolve_range(key: str, date_from: date | None, date_to: date | None):
    """today | 7d | 30d | custom | all  ->  (start, end) as aware datetimes (None = open)."""
    now = now_utc()
    if key == "today":
        return day_start(now.date()), now
    if key == "7d":
        return now - timedelta(days=7), now
    if key == "30d":
        return now - timedelta(days=30), now
    if key == "custom":
        start = day_start(date_from) if date_from else None
        end = day_start(date_to) + timedelta(days=1) if date_to else None
        return start, end
    return None, None
