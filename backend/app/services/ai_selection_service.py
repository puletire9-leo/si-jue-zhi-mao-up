"""AI 选品查询与投递会话服务。"""

import logging
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from ..repositories import MySQLRepository
from ..schemas.ai_selection import (
    AiSelectionProduct,
    AsinLookupResponse,
    PushBatch,
    PushResponse,
)

logger = logging.getLogger(__name__)

ASIN_RE = re.compile(r"^[A-Z0-9]{10}$")
SESSION_KEY_PREFIX = "ai_selection:session:v2:"
SESSION_TTL = 24 * 3600
SESSION_MAX_BATCHES = 50

# Redis 不可用时的进程内兜底，仍按用户隔离。
_memory_sessions: Dict[str, List[dict]] = {}

BASE_COLUMNS = [
    "asin", "title", "image_url", "price", "marketplace", "bsr", "units",
    "units_gr", "seller_name", "node_label_path", "available_date",
    "created_at", "symbol", "rating", "ratings", "fulfillment",
    "product_url", "listing_days",
]
COLUMNS_SQL = ", ".join(BASE_COLUMNS)


def normalize_asins(raw: List[str]) -> tuple[List[str], List[str]]:
    """去空格、转大写、去重并校验，保留输入顺序。"""
    seen: set[str] = set()
    valid: List[str] = []
    invalid: List[str] = []
    for item in raw:
        normalized = (item or "").strip().upper()
        if not normalized:
            continue
        if not ASIN_RE.match(normalized):
            invalid.append(item)
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        valid.append(normalized)
    return valid, invalid


def build_source_query(
    table: str,
    order_expression: str,
    with_marketplace: bool,
) -> str:
    """单表按 marketplace + asin 取最新记录。"""
    where = "asin IN ({placeholders})"
    if with_marketplace:
        where += " AND marketplace = %s"
    return f"""
        SELECT {COLUMNS_SQL}, '{table}' AS source_table
        FROM (
            SELECT {COLUMNS_SQL},
                   ROW_NUMBER() OVER (
                       PARTITION BY marketplace, asin
                       ORDER BY {order_expression}
                   ) AS rn
            FROM {table}
            WHERE {where}
        ) source_rows
        WHERE rn = 1
    """


def build_lookup_sql(asin_count: int, with_marketplace: bool) -> str:
    """两源分别去重后，再跨来源按 marketplace + asin 取最新记录。"""
    placeholders = ", ".join(["%s"] * asin_count)
    shop = build_source_query(
        "shop_products", "created_at DESC, id DESC", with_marketplace
    ).format(placeholders=placeholders)
    clean = build_source_query(
        "competitor_products_clean",
        "is_current DESC, created_at DESC, id DESC",
        with_marketplace,
    ).format(placeholders=placeholders)

    return f"""
        SELECT {COLUMNS_SQL}, source_table
        FROM (
            SELECT merged.*,
                   ROW_NUMBER() OVER (
                       PARTITION BY marketplace, asin
                       ORDER BY created_at DESC,
                                (source_table = 'competitor_products_clean') DESC
                   ) AS source_rn
            FROM (
                {shop}
                UNION ALL
                {clean}
            ) merged
        ) deduped
        WHERE source_rn = 1
        ORDER BY marketplace, asin
    """


def build_lookup_params(
    asins: List[str], marketplace: Optional[str]
) -> tuple:
    segment = list(asins) + ([marketplace] if marketplace else [])
    return tuple(segment + segment)


def row_to_product(row: dict) -> AiSelectionProduct:
    created = row.get("created_at")
    created_at = (
        created.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(created, datetime)
        else (str(created) if created else None)
    )
    return AiSelectionProduct(
        asin=row.get("asin") or "",
        productTitle=row.get("title") or "",
        imageUrl=row.get("image_url") or "",
        price=row.get("price"),
        marketplace=row.get("marketplace") or "",
        bsr=row.get("bsr"),
        units=row.get("units"),
        unitsGr=row.get("units_gr"),
        sellerName=row.get("seller_name") or "",
        mainCategoryName=row.get("node_label_path") or "",
        availableDate=row.get("available_date"),
        createdAt=created_at,
        symbol=row.get("symbol") or "",
        rating=row.get("rating"),
        ratings=row.get("ratings"),
        fulfillment=row.get("fulfillment") or "",
        sourceTable=row.get("source_table") or "",
        productUrl=row.get("product_url") or "",
        listingDays=row.get("listing_days"),
    )


class AiSelectionService:
    """市场数据查询与按用户隔离的 AI 投递会话。"""

    def __init__(self, mysql: MySQLRepository, redis=None):
        self.mysql = mysql
        self.redis = redis

    @staticmethod
    def session_key(user_id: str) -> str:
        return f"{SESSION_KEY_PREFIX}{user_id}"

    async def lookup(
        self,
        raw_asins: List[str],
        marketplace: Optional[str] = None,
    ) -> AsinLookupResponse:
        valid, invalid = normalize_asins(raw_asins)
        if not valid:
            raise ValueError("没有合法的 ASIN（需 10 位大写字母/数字）")

        sql = build_lookup_sql(len(valid), marketplace is not None)
        params = build_lookup_params(valid, marketplace)
        rows = await self.mysql.execute_query(sql, params=params)
        products = [row_to_product(row) for row in (rows or [])]
        return AsinLookupResponse(
            total=len(products),
            requested=len(valid),
            invalidAsins=invalid,
            products=products,
        )

    async def push(
        self,
        user_id: str,
        raw_asins: List[str],
        marketplace: Optional[str] = None,
        message: Optional[str] = None,
    ) -> PushResponse:
        lookup = await self.lookup(raw_asins, marketplace)
        batch = PushBatch(
            id=f"push_{uuid.uuid4().hex}",
            message=message or f"投递 {lookup.requested} 个 ASIN",
            pushedAt=datetime.now().isoformat(),
            total=lookup.total,
            requested=lookup.requested,
            invalidAsins=lookup.invalidAsins,
            products=lookup.products,
        )
        await self.append_batch(user_id, batch.model_dump())
        logger.info(
            "AI投递: user=%s msg=%s requested=%d found=%d invalid=%d",
            user_id,
            message,
            lookup.requested,
            lookup.total,
            len(lookup.invalidAsins),
        )
        return PushResponse(
            batchId=batch.id,
            total=batch.total,
            requested=batch.requested,
            invalidAsins=batch.invalidAsins,
            products=batch.products,
            message="投递成功，前端将自动展示",
        )

    async def get_batches(
        self,
        user_id: str,
        after_batch_id: Optional[str] = None,
        limit: int = 10,
    ) -> List[PushBatch]:
        fetch_limit = SESSION_MAX_BATCHES if after_batch_id else limit
        rows: List[dict] = []
        if self.redis is not None:
            try:
                rows = await self.redis.lrange(
                    self.session_key(user_id), 0, fetch_limit - 1
                )
            except Exception as exc:
                logger.warning("读取会话失败(降级内存): %s", exc)

        if not rows:
            rows = list(_memory_sessions.get(user_id, []))[:fetch_limit]

        if after_batch_id:
            known_index = next(
                (
                    index for index, row in enumerate(rows)
                    if row.get("id") == after_batch_id
                ),
                None,
            )
            if known_index is not None:
                rows = rows[:known_index]
            else:
                rows = rows[:limit]
        else:
            rows = rows[:limit]
        return [PushBatch(**row) for row in rows]

    async def append_batch(self, user_id: str, batch: dict) -> None:
        memory = _memory_sessions.setdefault(user_id, [])
        memory.insert(0, batch)
        del memory[SESSION_MAX_BATCHES:]

        if self.redis is not None:
            try:
                result = await self.redis.lpush_capped(
                    self.session_key(user_id),
                    batch,
                    SESSION_MAX_BATCHES,
                    expire=SESSION_TTL,
                )
                if result <= 0:
                    logger.warning("写入会话失败(仅内存): user=%s", user_id)
            except Exception as exc:
                logger.warning("写入会话失败(仅内存): %s", exc)

    async def clear_batches(self, user_id: str) -> None:
        _memory_sessions.pop(user_id, None)
        if self.redis is not None:
            try:
                await self.redis.delete(self.session_key(user_id))
            except Exception as exc:
                logger.warning("清空会话失败: %s", exc)
