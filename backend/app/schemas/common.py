import math

from fastapi import Query


class PageParams:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
        self.page, self.page_size = page, page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_of(items: list, total: int, pp: PageParams) -> dict:
    return {"items": items, "total": total, "page": pp.page, "page_size": pp.page_size,
            "pages": max(1, math.ceil(total / pp.page_size))}
