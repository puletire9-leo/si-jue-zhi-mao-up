"""
品线模型 JSON API — 为前端品线选品页提供模型数据

端点:
  GET /api/v1/product-line/model/{nodeId}?marketplace=UK[&bsrId=kitchen]
  → 返回 zheng_model_v1/{marketplace}/{bsrId}/by_node_id/{nodeId}.json
  GET /api/v1/product-line/model/{nodeId}/md?marketplace=UK[&bsrId=kitchen]
  → 返回 Markdown 报告
  GET /api/v1/product-line/batches?marketplace=UK&batchType=zheng_model
  → 返回可用批次列表 + 当前数据版本

启动:
  uvicorn api_server:app --host 0.0.0.0 --port 8011
"""

import json
import logging
import os
import re
from pathlib import Path

import pymysql
try:  # FIXED: CRIT-4 pooled connection
    from dbutils.pooled_db import PooledDB
    _HAS_POOL = True
except ImportError:
    _HAS_POOL = False
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger("api_server")

# ── 配置 ──────────────────────────────────────────────────────────

MODEL_BASE_DIR = os.environ.get("MODEL_BASE_DIR", "/app/zheng_model_v1")
_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+$")

DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "mysql"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ.get("MYSQL_USER", "sijue"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "sijuelishi_dev"),
}

# 批次下拉列表最大返回条数。超过 50 条后版本切换下拉框会缺失选项，故提高上限。
# 可通过环境变量 MAX_BATCHES 覆盖，默认 200。
MAX_BATCHES = int(os.environ.get("MAX_BATCHES", "200"))


def _validate_path_param(value: str, name: str) -> str:
    """校验路径参数，防路径遍历."""
    if not value or not _ID_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"无效参数: {name}")
    return value


# FIXED: CRIT-4 connection pool
_pool = None  # type: ignore


def _get_db_conn() -> pymysql.Connection:
    """创建数据库连接（带连接池）.  # FIXED: CRIT-4"""
    global _pool
    if _HAS_POOL:
        if _pool is None:
            _pool = PooledDB(pymysql, mincached=2, maxcached=10, **DB_CONFIG)
        return _pool.connection()
    return pymysql.connect(**DB_CONFIG)


app = FastAPI(title="品线模型 API", version="1.0")

# FIXED: CRIT-5 CORS origins from env
origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
# 模型 JSON 端点
# ══════════════════════════════════════════════════════════════════

def _find_model_file(marketplace: str, node_id: int, bsr_id: str | None = None) -> Path | None:
    """
    查找模型 JSON 文件.

    策略:
    1. 如果提供了 bsr_id → 直接路径查找 (最快)
    2. 否则 → 遍历 marketplace 下所有 bsr_id 目录查找
    """
    if bsr_id:
        file_path = Path(MODEL_BASE_DIR) / marketplace / bsr_id / "by_node_id" / f"{node_id}.json"
        return file_path if file_path.exists() else None

    # 无 bsr_id: 遍历所有 L1 品线目录
    base = Path(MODEL_BASE_DIR) / marketplace
    if not base.exists():
        return None
    for bsr_dir in base.iterdir():
        if not bsr_dir.is_dir():
            continue
        candidate = bsr_dir / "by_node_id" / f"{node_id}.json"
        if candidate.exists():
            return candidate
    return None


@app.get("/api/v1/product-line/model/{node_id}")
async def get_product_line_model(
    node_id: int,
    marketplace: str = Query(..., description="站点 UK/DE"),
    bsr_id: str | None = Query(None, description="品线 bsrId (可选，不提供时自动查找)"),
):
    """
    获取指定小类的品线模型 JSON.

    文件路径: {MODEL_BASE_DIR}/{marketplace}/{bsrId}/by_node_id/{nodeId}.json
    bsr_id 可选: 不提供时遍历 marketplace 下所有目录查找。
    """
    marketplace = _validate_path_param(marketplace, "marketplace")
    if bsr_id is not None:
        bsr_id = _validate_path_param(bsr_id, "bsr_id")

    file_path = _find_model_file(marketplace, node_id, bsr_id)

    if file_path is None:
        detail = f"模型数据不存在: {marketplace}/node={node_id}"
        if bsr_id:
            detail += f" bsr_id={bsr_id}"
        raise HTTPException(status_code=404, detail=detail)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"code": 200, "message": "ok", "data": data}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="模型数据格式错误")
    except Exception as e:
        logger.exception(f"读取模型失败: {file_path}")
        raise HTTPException(status_code=500, detail="内部服务器错误")


# ══════════════════════════════════════════════════════════════════
# Markdown 报告端点
# ══════════════════════════════════════════════════════════════════

@app.get("/api/v1/product-line/model/{node_id}/md")
async def get_product_line_model_md(
    node_id: int,
    marketplace: str = Query(..., description="站点 UK/DE"),
    bsr_id: str | None = Query(None, description="品线 bsrId (可选，不提供时自动查找)"),
):
    """
    获取指定小类的品线模型 Markdown 报告.

    用于前端展示完整报告.
    """
    marketplace = _validate_path_param(marketplace, "marketplace")
    if bsr_id is not None:
        bsr_id = _validate_path_param(bsr_id, "bsr_id")

    # 先从 JSON 中获取 nodeName 来定位 MD 文件
    json_path = _find_model_file(marketplace, node_id, bsr_id)

    if json_path is not None:
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            raise HTTPException(status_code=500, detail="模型数据读取失败")

        node_name = data.get("nodeName", "")
        if node_name:
            safe_name = node_name.replace(" ", "_").replace("&", "and").replace("/", "_")
            md_path = json_path.parent.parent / f"{safe_name}.md"
            if md_path.exists():
                try:
                    with open(md_path, "r", encoding="utf-8") as f:
                        return {"code": 200, "message": "ok", "data": {"markdown": f.read()}}
                except OSError:
                    raise HTTPException(status_code=500, detail="MD 文件读取失败")

    raise HTTPException(status_code=404, detail="MD 报告不存在")


# ══════════════════════════════════════════════════════════════════
# 批次列表端点 (C1: P5 前端版本切换下拉框)
# ══════════════════════════════════════════════════════════════════


# FIXED: HIGH-5 extracted helper
def _extract_version(batch_id: str) -> int:
    """从 batch_id 提取版本号: UK_202605_v2_20260610 → 2"""
    m = re.search(r"_v(\d+)_", batch_id)
    if m:
        return int(m.group(1))
    logger.warning(f"Cannot extract version from batch_id: {batch_id}, defaulting to 1")
    return 1


@app.get("/api/v1/product-line/batches")
async def get_batches(
    marketplace: str = Query(..., description="站点 UK/DE"),
    batch_type: str = Query("zheng_model", description="批次类型"),
):
    """
    获取可用批次列表 + 当前数据版本.

    前端用于版本切换下拉框.
    """
    marketplace = _validate_path_param(marketplace, "marketplace")
    batch_type = _validate_path_param(batch_type, "batch_type")

    conn = _get_db_conn()
    cur = None  # FIXED: CRIT-1
    try:
        cur = conn.cursor()
        # 查询已完成和进行中的批次
        cur.execute(
            """SELECT batch_id, status, analyzed_at
               FROM analysis_batches
               WHERE marketplace = %s AND batch_type = %s
               ORDER BY id DESC
               LIMIT %s""",
            (marketplace, batch_type, MAX_BATCHES),
        )
        rows = cur.fetchall()

        batches = []
        for row in rows:
            batch_id = row[0]
            # FIXED: HIGH-5 extracted _extract_version
            version = _extract_version(batch_id)

            analyzed_at = row[2].strftime("%Y-%m-%d %H:%M") if row[2] else None
            batches.append({
                "batchId": batch_id,
                "status": row[1],
                "dataVersion": version,
                "analyzedAt": analyzed_at,
            })

        # 查询当前数据版本
        cur.execute(
            """SELECT data_version FROM reference_data_versions
               WHERE source_table = 'deng_zong_shop' AND marketplace = %s""",
            (marketplace,),
        )
        ver_row = cur.fetchone()
        current_data_version = ver_row[0] if ver_row else 0

        return {
            "code": 200,
            "message": "ok",
            "data": {
                "batches": batches,
                "currentDataVersion": current_data_version,
            },
        }
    except pymysql.Error as e:
        logger.error(f"查询批次失败: {e}")
        raise HTTPException(status_code=500, detail="查询批次数据失败")
    finally:
        if cur:  # FIXED: CRIT-1
            cur.close()
        conn.close()


# ══════════════════════════════════════════════════════════════════
# 匹配商品列表端点
# ══════════════════════════════════════════════════════════════════


# FIXED: HIGH-5 extracted helper
def _format_element_row(row: tuple, columns: list[str]) -> dict:
    """格式化 product_line_elements 单行记录."""
    record = dict(zip(columns, row))

    for field in ("signal_tags", "elements", "carriers", "scenes"):
        val = record.get(field)
        if isinstance(val, str):
            try:
                record[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                record[field] = []
        elif val is None:
            record[field] = []

    ai_kw = record.get("ai_keywords")
    if isinstance(ai_kw, str):
        try:
            ai_kw = json.loads(ai_kw)
        except (json.JSONDecodeError, TypeError):
            ai_kw = {}
    elif ai_kw is None:
        ai_kw = {}
    record["en_keywords"] = ai_kw.get("en", []) if isinstance(ai_kw, dict) else []
    record["cn_keywords"] = ai_kw.get("cn", []) if isinstance(ai_kw, dict) else []
    del record["ai_keywords"]

    for field in ("listing_days", "variations", "bsr"):
        record[field] = record.get(field) or 0
    price_val = record.get("price")
    record["price"] = float(price_val) if price_val else 0

    for field in ("bsr_id", "analysis_batch_id", "created_at", "month"):
        record.pop(field, None)

    return record


@app.get("/api/v1/product-line/elements")
async def get_product_line_elements(
    node_id: int | None = Query(None, description="小类节点ID"),
    marketplace: str = Query(..., description="站点 UK/DE"),
    month: str | None = Query(None, description="数据月份 202605"),
    limit: int = Query(50, ge=1, le=500, description="返回条数"),
    is_winner: int = Query(1, description="只返回好品"),
):
    """
    查询匹配商品列表 (product_line_elements 表).

    同一 ASIN 多条记录去重，取 units 最大的那条。
    """
    if marketplace not in ("UK", "DE"):
        raise HTTPException(status_code=400, detail="marketplace 必须为 UK 或 DE")
    if month and not re.match(r"^\d{6}$", month):
        raise HTTPException(status_code=400, detail="month 格式错误，应为 YYYYMM")

    conn = _get_db_conn()
    cur = None  # FIXED: CRIT-1
    try:
        cur = conn.cursor()

        where_clauses = ["ple.marketplace = %s", "ple.is_winner = %s"]
        params: list = [marketplace, is_winner]

        if node_id is not None:
            where_clauses.append("ple.node_id = %s")
            params.append(node_id)
        if month:
            where_clauses.append("ple.month = %s")
            params.append(month)

        where_sql = " AND ".join(where_clauses)
        where_sql_inner = where_sql.replace("ple.", "")

        count_sql = f"""
            SELECT COUNT(DISTINCT asin)
            FROM product_line_elements ple
            WHERE {where_sql}
        """
        cur.execute(count_sql, params)
        total = cur.fetchone()[0]

        query_sql = f"""
            SELECT ple.*
            FROM product_line_elements ple
            INNER JOIN (
                SELECT MAX(id) AS max_id
                FROM product_line_elements
                WHERE {where_sql_inner}
                GROUP BY asin
            ) latest ON ple.id = latest.max_id
            ORDER BY ple.units DESC
            LIMIT %s
        """
        cur.execute(query_sql, params + [limit])
        rows = cur.fetchall()

        columns = [desc[0] for desc in cur.description]
        items = []
        for row in rows:
            record = dict(zip(columns, row))

            for field in ("signal_tags", "elements", "carriers", "scenes"):
                val = record.get(field)
                if isinstance(val, str):
                    try:
                        record[field] = json.loads(val)
                    except (json.JSONDecodeError, TypeError):
                        record[field] = []
                elif val is None:
                    record[field] = []

            ai_kw = record.get("ai_keywords")
            if isinstance(ai_kw, str):
                try:
                    ai_kw = json.loads(ai_kw)
                except (json.JSONDecodeError, TypeError):
                    ai_kw = {}
            elif ai_kw is None:
                ai_kw = {}
            record["en_keywords"] = ai_kw.get("en", []) if isinstance(ai_kw, dict) else []
            record["cn_keywords"] = ai_kw.get("cn", []) if isinstance(ai_kw, dict) else []
            del record["ai_keywords"]

            for field in ("listing_days", "variations", "bsr"):
                record[field] = record.get(field) or 0
            price_val = record.get("price")
            record["price"] = float(price_val) if price_val else 0

            for field in ("bsr_id", "analysis_batch_id", "created_at", "month"):
                record.pop(field, None)

            items.append(record)

        return {
            "code": 200,
            "data": {
                "total": total,
                "items": items,
            },
        }
    except pymysql.Error as e:
        logger.error(f"查询匹配商品失败: {e}")
        raise HTTPException(status_code=500, detail="查询匹配商品失败")
    finally:
        if cur:
            cur.close()
        conn.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── 启动 ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    logger.info(f"模型目录: {MODEL_BASE_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8011)
