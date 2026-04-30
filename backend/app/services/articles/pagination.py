from __future__ import annotations

import math
from typing import Any

from app.schemas.article import PaginationMeta


def build_pagination_meta(
    *,
    total: int,
    page: int,
    page_size: int,
    all_items: bool,
) -> PaginationMeta:
    if all_items:
        return PaginationMeta(
            page=1,
            page_size=total,
            total=total,
            total_pages=1 if total > 0 else 0,
        )

    total_pages = math.ceil(total / page_size) if total > 0 else 0
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


def apply_pagination_sql(
    *,
    params: dict[str, Any],
    page: int,
    page_size: int,
    all_items: bool,
) -> str:
    if all_items:
        return ""

    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size
    return "LIMIT :limit OFFSET :offset"
