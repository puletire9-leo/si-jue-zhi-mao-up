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

import asyncio
import json
import logging
import os
import re
from collections.abc import AsyncGenerator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from queue import Queue

import pymysql
try:  # FIXED: CRIT-4 pooled connection
    from dbutils.pooled_db import PooledDB
    _HAS_POOL = True
except ImportError:
    _HAS_POOL = False
from fastapi import FastAPI, HTTPException, Query, Body, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

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
    allow_methods=["GET", "POST", "OPTIONS"],
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


# ══════════════════════════════════════════════════════════════════
# Phase 3 — 选品 Agent 对话端点（流式 SSE）
# ══════════════════════════════════════════════════════════════════

_SELECTION_SYSTEM_PROMPT = """你是一个专业的亚马逊选品分析助手（品线选品 Agent）。
你的任务是对指定小类执行标准选品分析流程，并向用户展示结果。

## 标准流程
1. **获取品线数据** — 调用 `sel_fetch_product_line` 了解品线结构
2. **预处理目标小类** — 调用 `sel_preprocess` 进行去重/取样/打标
3. **深度分析+保存** — 调用 `sel_analyze` 并传入 batch_id 参数，自动分析并保存结果到数据库
4. **展示报告** — 向用户展示分析摘要：健康度、质量基准、已验证元素、载体画像、推荐组合、价格空白等

## 重要约束
- 始终使用 `sel_` 开头的工具执行分析，不要臆测数据
- 分析完成后用清晰易懂的格式向用户展示结果
- 如果模型已缓存，告知用户这是缓存结果
- 用户可以追问细节（如「为什么这个品线机会分高」「再深入看价格带」）
"""

_AGENT_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="selection-agent")
_BATCH_SEQ: int = 0


def _format_cached_summary(data: dict) -> str:
    """Format cached model JSON into a readable summary for SSE streaming."""
    lines: list[str] = []
    node_name = data.get("nodeName", "未知")
    health = data.get("overallHealth", "unknown")
    reason = data.get("healthReason", "")

    lines.append(f"## 📊 {node_name} — 模型分析报告（缓存）\n")
    lines.append(f"**品类健康度**: {health}")
    if reason:
        lines.append(f"> {reason}")
    lines.append("")

    qb = data.get("qualityBenchmark", {})
    if qb:
        lines.append("### 质量基准")
        lines.append(f"- BSR 中位数: {qb.get('bsr_p50', '?')} | P90: {qb.get('bsr_p90', '?')}")
        lines.append(f"- 重量中位数: {qb.get('weight_g_median', '?')}g | FBA 中位数: £{qb.get('fba_median', '?')}")
        lines.append(f"- 上架天数中位数: {qb.get('listing_days_median', '?')}天")
        lines.append("")

    pb = data.get("priceBand", {})
    if pb:
        lines.append("### 价格带")
        lines.append(f"- 范围: £{pb.get('min', '?')} - £{pb.get('max', '?')} | 均价: £{pb.get('avg', '?')}")
        lines.append(f"- 甜点区: £{pb.get('sweet_spot_min', '?')} - £{pb.get('sweet_spot_max', '?')}")
        lines.append("")

    proven = data.get("provenElements", [])
    if proven:
        lines.append(f"### 已验证元素 ({len(proven)})")
        for pe in proven[:8]:
            lines.append(f"- **{pe.get('name', '')}** (×{pe.get('frequency', 0)}) — {pe.get('insight', '')}")
        lines.append("")

    combos = data.get("recommendedCombos", [])
    if combos:
        lines.append(f"### 推荐组合 ({len(combos)})")
        for rc in combos[:5]:
            elements = " + ".join(rc.get("elements", []))
            carriers = " + ".join(rc.get("carriers", []))
            lines.append(f"- [{rc.get('heat', '')}] {elements} × {carriers}")
            lines.append(f"  > {rc.get('reason', '')}")
        if len(combos) > 5:
            lines.append(f"  …还有 {len(combos) - 5} 个推荐组合")
        lines.append("")

    price_gaps = data.get("priceGaps", [])
    if price_gaps:
        lines.append("### 价格空白")
        for pg in price_gaps:
            lines.append(f"- **{pg.get('range', '')}**: {pg.get('opportunity', '')}")
        lines.append("")

    filter_rules = data.get("filterRules", [])
    if filter_rules:
        lines.append("### 自动筛选规则")
        for i, rule in enumerate(filter_rules, 1):
            conds = rule.get("conditions", [])
            cond_strs = [f"{c['field']} {c['op']} {c['value']}" for c in conds]
            lines.append(f"- 规则 {i}: {' 且 '.join(cond_strs)}")
        lines.append("")

    return "\n".join(lines)


def _verify_jwt(authorization: str | None) -> dict:
    """Verify JWT Bearer token. Returns decoded payload or raises 401."""
    if not authorization:
        raise HTTPException(status_code=401, detail="缺少 Authorization 头")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Authorization 格式错误，需 Bearer <token>")
    try:
        import jwt
        secret = os.environ.get("JWT_SECRET", "sjzm-dev-jwt-secret-change-in-production")
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except Exception as e:
        logger.warning(f"JWT 验证失败: {e}")
        raise HTTPException(status_code=401, detail="Token 无效")


async def _selection_chat_stream(
    node_id: int,
    marketplace: str,
    messages: list[dict],
) -> AsyncGenerator[str, None]:
    """SSE event generator for selection agent chat.

    Yields ``data: {...}\\n\\n`` SSE frames.
    """
    # 1. Cache: 仅在首次请求（messages <= 1）时命中
    #    追问场景（messages > 1）跳过缓存走 AIAgent
    is_follow_up = len(messages) > 1
    model_path = _find_model_file(marketplace, node_id) if not is_follow_up else None
    if model_path:
        try:
            data = json.loads(model_path.read_text(encoding="utf-8"))
            summary = _format_cached_summary(data)
            yield f"data: {json.dumps({'type': 'delta', 'content': summary})}\n\n"
            yield f"data: {json.dumps({'type': 'result', 'model': data, 'filter_rules': data.get('filterRules', [])})}\n\n"
            return
        except Exception as e:
            logger.warning(f"Cache read failed, falling back to agent: {e}")

    # 2. Cache miss or error — run AIAgent
    _import_selection_agent()
    from run_agent import AIAgent

    delta_queue: Queue = Queue()
    _SENTINEL = object()

    def _on_delta(text: str) -> None:
        delta_queue.put(text)

    def _run_agent() -> str:
        global _BATCH_SEQ
        _BATCH_SEQ += 1
        from datetime import datetime
        batch_id = f"{marketplace}_chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{_BATCH_SEQ}"

        agent = AIAgent(
            model=os.environ.get("HERMES_MODEL", "deepseek-v4-flash"),
            provider=os.environ.get("HERMES_PROVIDER", "deepseek"),
            api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com",
            enabled_toolsets=["selection"],
            ephemeral_system_prompt=_SELECTION_SYSTEM_PROMPT,
            quiet_mode=True,
            skip_memory=True,
            max_iterations=30,
        )
        # Inject batch_id + node context into user message so the agent
        # can pass batch_id to sel_analyze for automatic DB save
        month_hint = datetime.now().strftime("%Y%m")
        context_inject = (
            f"\n\n[上下文] node_id={node_id}, marketplace={marketplace}, "
            f"month={month_hint}, batch_id={batch_id}"
        )
        last_msg = (messages[-1]["content"] if messages else "") + context_inject
        try:
            return agent.chat(last_msg, stream_callback=_on_delta)
        finally:
            # 哨兵：无论成功/异常都标记 agent 结束，确保消费循环能退出
            delta_queue.put(_SENTINEL)

    loop = asyncio.get_running_loop()
    future = loop.run_in_executor(_AGENT_EXECUTOR, _run_agent)

    # 消费循环：把阻塞 get 丢进默认线程池，不堵事件循环；
    # 见到哨兵即停（哨兵由 _run_agent 的 finally 保证一定入队）
    while True:
        delta = await loop.run_in_executor(None, delta_queue.get)
        if delta is _SENTINEL:
            break
        yield f"data: {json.dumps({'type': 'delta', 'content': delta})}\n\n"

    # Agent 已结束（哨兵到达）。取结果 / 捕获异常
    try:
        final_response = await future
    except Exception as exc:
        logger.error(f"Agent execution failed: {exc}")
        err_msg = f"\n\n❌ Agent 执行出错: {exc}"
        yield f"data: {json.dumps({'type': 'delta', 'content': err_msg})}\n\n"
        yield f"data: {json.dumps({'type': 'result', 'model': None, 'filter_rules': []})}\n\n"
        return

    # Try to extract filter_rules from model on disk after agent saves
    filter_rules: list = []
    model_json: dict | None = None
    saved_path = _find_model_file(marketplace, node_id)
    if saved_path:
        try:
            model_json = json.loads(saved_path.read_text(encoding="utf-8"))
            filter_rules = model_json.get("filterRules", [])
        except Exception:
            pass

    yield f"data: {json.dumps({'type': 'result', 'model': model_json, 'filter_rules': filter_rules})}\n\n"


_agent_imported: bool = False


def _import_selection_agent() -> None:
    """Lazy-import heavy agent dependencies, once."""
    global _agent_imported
    if _agent_imported:
        return
    try:
        import model_tools  # noqa: F401 — triggers tool discovery
        _agent_imported = True
    except Exception as e:
        logger.warning(f"model_tools import failed: {e}")


@app.post("/api/v1/product-line/agent-chat")
async def product_line_agent_chat(
    body: dict = Body(...),
    authorization: str | None = Header(None),
):
    """
    品线选品 Agent 对话端点（流式 SSE）.

    请求体:
    ```json
    {
      "nodeId": 12345,
      "marketplace": "UK",
      "messages": [{"role": "user", "content": "分析这个品线"}]
    }
    ```

    响应: ``text/event-stream``，每个 ``data:`` 帧为 JSON。
    - ``{"type": "delta", "content": "..."}`` — 流式文本增量
    - ``{"type": "result", "model": {...}, "filter_rules": [...]}`` — 最终结果

    缓存: 首次分析时（messages=1）如果该 node_id 已有模型，直接回放摘要（不调 LLM）。
    追问: 第二条消息起跳过缓存，走 AIAgent 执行 DeepSeek 推理。
    鉴权: 依赖网关 JWT（生产经网关转发）或前端直传 Bearer token。
    """
    _verify_jwt(authorization)

    node_id = body.get("nodeId")
    marketplace = body.get("marketplace", "UK")
    messages = body.get("messages", [])

    if not node_id:
        raise HTTPException(status_code=400, detail="nodeId 必填")
    if not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="messages 必须为数组")

    return StreamingResponse(
        _selection_chat_stream(node_id, marketplace, messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── 启动 ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    logger.info(f"模型目录: {MODEL_BASE_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8011)
