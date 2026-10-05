"""Score derivation shared by the seed script and (Phase 2) the Android ingestion endpoint."""
from collections import defaultdict
from decimal import Decimal
from typing import Iterable, Protocol


class EventLike(Protocol):
    category: str | None
    score_impact: Decimal
    points_possible: Decimal


def derive_score(events: Iterable[EventLike]) -> tuple[Decimal, dict[str, int]]:
    """Return (score 0-100, per-behaviour-category percentages) from stored events."""
    events = list(events)
    possible = sum((Decimal(e.points_possible) for e in events), Decimal(0))
    if possible <= 0:
        return Decimal(0), {}
    total = sum((Decimal(e.score_impact) for e in events), Decimal(0))
    score = max(Decimal(0), min(Decimal(100), total / possible * 100)).quantize(Decimal("0.01"))

    earned, avail = defaultdict(Decimal), defaultdict(Decimal)
    for e in events:
        if e.category:
            earned[e.category] += max(Decimal(e.score_impact), Decimal(0))
            avail[e.category] += Decimal(e.points_possible)
    metrics = {c: int(round(earned[c] / avail[c] * 100)) for c in avail if avail[c] > 0}
    return score, metrics
