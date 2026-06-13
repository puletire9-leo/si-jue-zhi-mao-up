"""
结果保存模块 — MD报告 + product_line_elements DB写入 + analysis_batches状态更新

职责:
1. 生成品线模型 MD 报告 (12章节)
2. 写入 product_line_elements 表 (AI判定的好品, is_winner=1)
3. 更新 analysis_batches 状态 (ready → analyzing → done/error)

使用:
    from tools.selection.save_results import save_sub_category_results
    summary = save_sub_category_results(conn, analysis, ai_result, marketplace, month, batch_id)
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

from .preprocess import SubCategoryAnalysis, ProductRow
from .ai_analyzer import AIResult

logger = logging.getLogger(__name__)

# ── 常量 ──────────────────────────────────────────────────────────

DEFAULT_BASE_DIR = "/app/zheng_model_v1"
MD_SECTIONS = 12  # MD 报告章节数


# ══════════════════════════════════════════════════════════════════
# 1. MD 报告生成
# ══════════════════════════════════════════════════════════════════

def generate_md_report(analysis: SubCategoryAnalysis, ai_result: AIResult, marketplace: str = "UK") -> str:
    """生成品线模型 Markdown 报告（12章节）."""
    ctx = analysis.to_ai_context()
    kw = ai_result.search_keywords
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines: list[str] = []

    # ── 标题 ──
    lines.append(f"# {analysis.node_name} — 品线模型")
    lines.append("")
    lines.append(
        f"> **品线**: {analysis.bsr_id} | **站点**: {marketplace} | **路径**: {ctx['nodeFullPath']}"
    )
    lines.append(f"> **分析时间**: {now}")
    lines.append(
        f"> **数据**: {analysis.stats['raw']}品 → 去重{analysis.stats['total']}品 "
        f"→ 采样{len(analysis.sampled_products)}品"
    )
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── 1. 品类健康度 ──
    lines.append(f"## 1. 品类健康度: {ai_result.overall_health}")
    lines.append("")
    lines.append(ai_result.health_reason)
    lines.append("")

    # ── 2. 质量基准 ──
    qb = ctx["qualityBenchmark"]
    lines.append("## 2. 质量基准")
    lines.append("")
    lines.append("| 指标 | 值 | 说明 |")
    lines.append("|------|-----|------|")
    lines.append(f"| BSR 中位数 | {qb['bsr_p50']:,} | 50%好品在此之下 |")
    lines.append(f"| BSR P90 | {qb['bsr_p90']:,} | 90%好品在此之下 |")
    lines.append(f"| 评分下限 | {qb['rating_min']} | 好品最低评分 |")
    lines.append(f"| 重量中位数 | {qb['weight_g_median']}g | 轻小件基准 |")
    lines.append(f"| 重量上限 | {qb['weight_g_max']}g | 超过不推荐 |")
    lines.append(f"| FBA 中位数 | £{qb['fba_median']} | FBA成本基准 |")
    lines.append(f"| 上架天数中位数 | {qb['listing_days_median']}天 | 参考上架时长 |")
    lines.append("")

    # ── 3. 价格带 ──
    pb = ctx["priceBand"]
    lines.append("## 3. 价格带")
    lines.append("")
    lines.append(f"- 范围: £{pb['min']} - £{pb['max']}")
    lines.append(f"- 均价: £{pb['avg']}")
    lines.append(
        f"- 甜点区: £{pb['sweet_spot_min']}-£{pb['sweet_spot_max']} "
        f"({pb['sweet_spot_ratio']:.0%}产品在此区间)"
    )
    lines.append("")

    # ── 4. 载体画像 ──
    lines.append("## 4. 载体画像")
    lines.append("")
    lines.append("| 载体 | 数量 | 均价 | 重量 | FBA | 变体 | 策略 | 轻小件 |")
    lines.append("|------|------|------|------|-----|------|------|--------|")
    for cd in ai_result.carrier_detail:
        if isinstance(cd, str):
            lines.append(f"| {cd} | - | - | - | - | - | - | - |")
        else:
            lines.append(
                f"| {cd.get('name', '')} | {cd.get('count', '')} | "
                f"£{cd.get('avg_price', '')} | {cd.get('avg_weight_g', '')}g | "
                f"£{cd.get('avg_fba', '')} | {cd.get('avg_variants', '')} | "
                f"{cd.get('variant_strategy', '')} | {cd.get('lightweight', '')} |"
            )
    lines.append("")

    # ── 5. 已验证元素 ──
    lines.append(f"## 5. 已验证元素 ({len(ai_result.proven_elements)})")
    lines.append("")
    for e in ai_result.proven_elements:
        lines.append(f"### {e.name} (×{e.frequency})")
        lines.append(f"> {e.insight}")
        lines.append("")
        lines.append(f"- 载体: {', '.join(e.carriers)}")
        lines.append(f"- 信号: {', '.join(e.signal_tags)}")
        lines.append("")

    # ── 6. 元素饱和度 ──
    lines.append(f"## 6. 元素饱和度 ({len(ai_result.element_saturation)})")
    lines.append("")
    lines.append("| 元素 | 频次 | 饱和度 | 策略建议 |")
    lines.append("|------|------|--------|----------|")
    for es in ai_result.element_saturation:
        if isinstance(es, str):
            lines.append(f"| {es} | - | - | - |")
        else:
            lines.append(
                f"| {es.get('element', '')} | ×{es.get('frequency', '')} | "
                f"{es.get('saturation', '')} | {es.get('insight', '')} |"
            )
    lines.append("")

    # ── 7. 新兴元素 ──
    lines.append(f"## 7. 新兴元素 ({len(ai_result.emerging_elements)})")
    lines.append("")
    for ee in ai_result.emerging_elements:
        if isinstance(ee, str):
            lines.append(f"- **{ee}** — (ASIN: ?)")
        else:
            lines.append(
                f"- **{ee.get('element', '')}** [{ee.get('signal', '')}] — "
                f"{ee.get('opportunity', '')} (ASIN: {ee.get('asin', '')})"
            )
    lines.append("")

    # ── 8. 推荐组合 ──
    lines.append(f"## 8. 推荐组合 ({len(ai_result.recommended_combos)})")
    lines.append("")
    for i, rc in enumerate(ai_result.recommended_combos, 1):
        heat_icon = "🔥" if rc.heat == "已验证" else "⭐" if rc.heat == "新兴" else "👀"
        lines.append(
            f"### {i}. {heat_icon} [{rc.heat}] {' + '.join(rc.elements)} "
            f"× {' + '.join(rc.carriers)}"
        )
        lines.append(f"> {rc.reason}")
        lines.append("")
        lines.append(f"- 场景: {', '.join(rc.scenes)}")
        lines.append(f"- 英文搜索: `{'`, `'.join(rc.keywords_en)}`")
        lines.append(f"- 中文搜索: {' / '.join(rc.keywords_cn)}")
        lines.append("")

    # ── 9. 搜索关键词 ──
    lines.append("## 9. 搜索关键词")
    lines.append("")
    lines.append("### Amazon 英文搜索词")
    lines.append("")
    for k in kw.get("en", [])[:15]:
        lines.append(f"- `{k}`")
    lines.append("")
    lines.append("### 中文搜索词")
    lines.append("")
    for k in kw.get("cn", []):
        lines.append(f"- {k}")
    lines.append("")

    # ── 10. 价格空白 ──
    lines.append(f"## 10. 价格空白 ({len(ai_result.price_gaps)})")
    lines.append("")
    for pg in ai_result.price_gaps:
        if isinstance(pg, str):
            lines.append(f"- **{pg}**: -")
        else:
            lines.append(f"- **{pg.get('range', '')}**: {pg.get('opportunity', '')}")
    lines.append("")

    # ── 11. 轻小件总结 ──
    lines.append("## 11. 轻小件总结")
    lines.append("")
    lines.append(ai_result.lightweight_summary)
    lines.append("")

    # ── 12. 好品清单 ──
    lines.append(f"## 12. 好品清单 ({len(ai_result.good_products)})")
    lines.append("")
    lines.append(
        "| ASIN | 元素 | 载体 | 场景 | EN 关键词 | CN 关键词 | 轻小 |"
    )
    lines.append(
        "|------|------|------|------|-----------|-----------|------|"
    )
    for g in ai_result.good_products[:20]:
        lines.append(
            f"| {g.asin} | {', '.join(g.elements[:3])} | "
            f"{', '.join(g.carriers[:2])} | {', '.join(g.scenes[:2])} | "
            f"{', '.join(g.keywords_en[:2])} | {', '.join(g.keywords_cn[:2])} | "
            f"{g.lightweight} |"
        )
    lines.append("")

    # ── 页脚 ──
    lines.append("---")
    lines.append("")
    lines.append("> 郑总选品模型 v3 | AI 分析完成")
    lines.append("")

    return "\n".join(lines)


def save_md_file(
    content: str,
    marketplace: str,
    bsr_id: str,
    node_name: str,
    base_dir: str = DEFAULT_BASE_DIR,
) -> str:
    """
    保存 MD 报告到文件系统.

    Returns:
        写入的文件路径
    """
    safe_name = node_name.replace(" ", "_").replace("&", "and").replace("/", "_")
    dir_path = os.path.join(base_dir, marketplace, bsr_id)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{safe_name}.md")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    logger.info(f"  MD saved: {file_path} ({len(content):,} chars)")
    return file_path


# ══════════════════════════════════════════════════════════════════
# 1b. 模型 JSON 生成 + 保存 (供前端 API 读取)
# ══════════════════════════════════════════════════════════════════

def generate_model_json(analysis: SubCategoryAnalysis, ai_result: AIResult) -> dict:
    """生成结构化模型 JSON — 前端品线选品页直接使用."""
    ctx = analysis.to_ai_context()

    return {
        "nodeId": analysis.node_id,
        "nodeName": analysis.node_name,
        "nodeFullPath": ctx.get("nodeFullPath", ""),
        "bsrId": analysis.bsr_id,
        "stats": {
            "raw": analysis.stats.get("raw", 0),
            "total": analysis.stats.get("total", 0),
            "sampled": len(analysis.sampled_products),
        },
        # 1. 品类健康度
        "overallHealth": ai_result.overall_health,
        "healthReason": ai_result.health_reason,
        # 2. 质量基准 (脚本预计算)
        "qualityBenchmark": ctx.get("qualityBenchmark", {}),
        # 3. 价格带 (脚本预计算)
        "priceBand": ctx.get("priceBand", {}),
        # 4. 载体画像
        "carrierDetail": ai_result.carrier_detail,
        # 5. 已验证元素
        "provenElements": [
            {
                "name": e.name,
                "frequency": e.frequency,
                "carriers": e.carriers,
                "signalTags": e.signal_tags,
                "insight": e.insight,
            }
            for e in ai_result.proven_elements
        ],
        # 6. 元素饱和度
        "elementSaturation": ai_result.element_saturation,
        # 7. 新兴元素
        "emergingElements": ai_result.emerging_elements,
        # 8. 推荐组合
        "recommendedCombos": [
            {
                "elements": rc.elements,
                "carriers": rc.carriers,
                "scenes": rc.scenes,
                "keywordsEn": rc.keywords_en,
                "keywordsCn": rc.keywords_cn,
                "heat": rc.heat,
                "reason": rc.reason,
            }
            for rc in ai_result.recommended_combos
        ],
        # 9. 搜索关键词
        "searchKeywords": ai_result.search_keywords,
        # 10. 价格空白
        "priceGaps": ai_result.price_gaps,
        # 11. 轻小件总结
        "lightweightSummary": ai_result.lightweight_summary,
        # 12. 好品清单 (前20)
        "goodProducts": [
            {
                "asin": g.asin,
                "elements": g.elements,
                "carriers": g.carriers,
                "scenes": g.scenes,
                "keywordsEn": g.keywords_en,
                "keywordsCn": g.keywords_cn,
                "lightweight": g.lightweight,
            }
            for g in ai_result.good_products[:20]
        ],
    }


def save_model_json(
    data: dict,
    marketplace: str,
    bsr_id: str,
    node_name: str,
    node_id: int,
    base_dir: str = DEFAULT_BASE_DIR,
) -> str:
    """
    保存模型 JSON 到文件系统，双路径:
    1. human-readable: {bsr_id}/{node_name}.json
    2. machine-lookup: {bsr_id}/by_node_id/{node_id}.json

    Returns:
        写入的文件路径 (human-readable)
    """
    safe_name = node_name.replace(" ", "_").replace("&", "and").replace("/", "_")
    content = json.dumps(data, ensure_ascii=False, indent=2)

    # Human-readable path
    dir_path = os.path.join(base_dir, marketplace, bsr_id)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, f"{safe_name}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    # Machine-lookup by node_id
    node_dir = os.path.join(dir_path, "by_node_id")
    os.makedirs(node_dir, exist_ok=True)
    node_path = os.path.join(node_dir, f"{node_id}.json")
    with open(node_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"  JSON saved: {file_path} + by_node_id/{node_id}.json ({len(content):,} chars)")
    return file_path


# ══════════════════════════════════════════════════════════════════
# 2. product_line_elements DB 写入
# ══════════════════════════════════════════════════════════════════

def _build_asin_index(analysis: SubCategoryAnalysis) -> dict[str, ProductRow]:
    """构建 ASIN → ProductRow 索引，用于回填数值字段."""
    idx: dict[str, ProductRow] = {}
    for p in analysis.sampled_products:
        idx[p.asin] = p
    return idx


def save_product_line_elements(
    db_conn,
    analysis: SubCategoryAnalysis,
    ai_result: AIResult,
    marketplace: str,
    month: str,
    batch_id: str,
) -> int:
    """
    将 AI 判定的好品写入 product_line_elements 表.

    只写 is_winner=1 的商品 (good_products 中 is_good=True).
    使用 executemany 批量写入, 单事务保证原子性.

    Returns:
        写入的行数
    """
    asin_index = _build_asin_index(analysis)
    cur = db_conn.cursor()

    sql = """
        INSERT INTO product_line_elements
        (marketplace, month, bsr_id, node_id, node_name, asin, title,
         listing_days, units, bsr, price, variations,
         signal_tags, elements, carriers, scenes,
         is_winner, ai_keywords, analysis_batch_id)
    VALUES (%s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        signal_tags = VALUES(signal_tags),
        elements = VALUES(elements),
        carriers = VALUES(carriers),
        scenes = VALUES(scenes),
        is_winner = VALUES(is_winner),
        ai_keywords = VALUES(ai_keywords),
        analysis_batch_id = VALUES(analysis_batch_id)
    """

    # 构建参数列表
    params_list = []
    for gp in ai_result.good_products:
        if not gp.is_good:
            continue

        product = asin_index.get(gp.asin)
        if not product:
            logger.warning(f"  ASIN {gp.asin} not found in sampled products, skipping")
            continue

        params_list.append((
            marketplace,
            month,
            analysis.bsr_id,
            analysis.node_id,
            analysis.node_name,
            gp.asin,
            product.title,
            product.listing_days,
            product.units,
            product.bsr if product.bsr else None,
            product.price if product.price else None,
            product.variations,
            json.dumps(getattr(product, "signals", []), ensure_ascii=False),
            json.dumps(gp.elements, ensure_ascii=False),
            json.dumps(gp.carriers, ensure_ascii=False),
            json.dumps(gp.scenes, ensure_ascii=False),
            1,  # is_winner
            json.dumps({"en": gp.keywords_en, "cn": gp.keywords_cn}, ensure_ascii=False),
            batch_id,
        ))

    inserted = 0
    try:
        if params_list:
            cur.executemany(sql, params_list)
            inserted = len(params_list)
            db_conn.commit()
    except Exception as e:
        db_conn.rollback()
        logger.error(f"  product_line_elements 写入失败: {e}")
        raise
    finally:
        cur.close()

    logger.info(f"  product_line_elements: {inserted} rows written (batch={batch_id})")
    return inserted


# ══════════════════════════════════════════════════════════════════
# 3. analysis_batches 状态更新
# ══════════════════════════════════════════════════════════════════

def update_batch_status(
    db_conn,
    batch_id: str,
    status: str,
    error_message: str | None = None,
) -> bool:
    """
    更新 analysis_batches 状态.

    Args:
        status: ready / analyzing / done / error
        error_message: 仅 status=error 时填写

    Returns:
        True if updated, False if batch_id not found
    """
    cur = db_conn.cursor()
    try:
        if status == "done":
            cur.execute(
                """UPDATE analysis_batches
                   SET status = %s, analyzed_at = NOW()
                   WHERE batch_id = %s""",
                (status, batch_id),
            )
        elif status == "error":
            cur.execute(
                """UPDATE analysis_batches
                   SET status = %s, error_message = %s
                   WHERE batch_id = %s""",
                (status, error_message or "", batch_id),
            )
        else:
            cur.execute(
                "UPDATE analysis_batches SET status = %s WHERE batch_id = %s",
                (status, batch_id),
            )

        affected = cur.rowcount
        db_conn.commit()
    finally:
        cur.close()

    if affected:
        logger.info(f"  analysis_batches: {batch_id} → {status}")
    else:
        logger.warning(f"  analysis_batches: {batch_id} not found, status not updated")
    return affected > 0


def create_batch(
    db_conn,
    batch_id: str,
    batch_type: str,
    marketplace: str,
    month: str,
    source_table: str = "deng_zong_shop",
    total_products: int = 0,
    total_items: int = 0,
) -> bool:
    """
    创建 analysis_batches 记录 (状态=ready).

    如果 batch_id 已存在则跳过 (UNIQUE KEY uk_batch).
    """
    cur = db_conn.cursor()
    try:
        cur.execute(
            """INSERT IGNORE INTO analysis_batches
               (batch_id, batch_type, marketplace, month,
                source_table, total_products, total_items, data_json, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'ready')""",
            (
                batch_id,
                batch_type,
                marketplace,
                month,
                source_table,
                total_products,
                total_items,
                "{}",  # data_json 后续由 batch_runner 填充
            ),
        )
        db_conn.commit()
        created = cur.rowcount > 0
        if created:
            logger.info(f"  analysis_batches: created {batch_id}")
        return created
    finally:
        cur.close()


def get_latest_batch(
    db_conn,
    marketplace: str,
    month: str,
    batch_type: str = "zheng_model",
) -> dict | None:
    """
    查询同 marketplace+month+batch_type 的最新批次.

    Returns:
        {"batch_id": str, "status": str, "version": int} or None
    """
    cur = db_conn.cursor()
    try:
        cur.execute(
            """SELECT batch_id, status
               FROM analysis_batches
               WHERE marketplace = %s AND month = %s AND batch_type = %s
               ORDER BY id DESC
               LIMIT 1""",
            (marketplace, month, batch_type),
        )
        row = cur.fetchone()
    finally:
        cur.close()

    if not row:
        return None

    batch_id = row[0]
    # 从 batch_id 提取版本号: UK_202605_v2_20260610
    version = 1
    m = re.search(r"_v(\d+)_", batch_id)
    if m:
        version = int(m.group(1))
    else:
        logger.warning(f"Cannot extract version from batch_id: {batch_id}, defaulting to 1")
    return {"batch_id": batch_id, "status": row[1], "version": version}


def get_data_version(
    db_conn,
    marketplace: str,
    source_table: str = "deng_zong_shop",
) -> int:
    """
    查询当前基准数据版本.

    数据版本由数据导入流程维护 (INSERT/UPDATE reference_data_versions).
    模型版本对齐数据版本 — 数据不变，版本不变.

    Returns:
        当前数据版本号 (无记录返回0，首次导入后为1)
    """
    cur = db_conn.cursor()
    try:
        cur.execute(
            """SELECT data_version FROM reference_data_versions
               WHERE source_table = %s AND marketplace = %s""",
            (source_table, marketplace),
        )
        row = cur.fetchone()
        return row[0] if row else 0
    finally:
        cur.close()


def bump_data_version(
    db_conn,
    marketplace: str,
    source_table: str = "deng_zong_shop",
    data_month: str = "",
    record_count: int = 0,
    notes: str = "",
) -> int:
    """
    数据导入完成后调用 — 原子升级基准数据版本号.

    使用 INSERT...ON DUPLICATE KEY UPDATE data_version = data_version + 1
    消除 SELECT-then-UPDATE 竞态条件.
    """
    cur = db_conn.cursor()
    try:
        # 原子操作: 不存在则插入v1, 存在则版本+1
        cur.execute(
            """INSERT INTO reference_data_versions
                   (source_table, marketplace, data_version, data_month, record_count, notes)
               VALUES (%s, %s, 1, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                   data_version = data_version + 1,
                   data_month = VALUES(data_month),
                   record_count = VALUES(record_count),
                   notes = VALUES(notes),
                   imported_at = NOW()""",
            (source_table, marketplace, data_month, record_count, notes),
        )
        db_conn.commit()

        # 读取新版本号
        cur.execute(
            """SELECT data_version FROM reference_data_versions
               WHERE source_table = %s AND marketplace = %s""",
            (source_table, marketplace),
        )
        new_version = cur.fetchone()[0]
        logger.info(f"  数据版本: {source_table}/{marketplace} → v{new_version}")
        return new_version
    finally:
        cur.close()


# ══════════════════════════════════════════════════════════════════
# 4. 主入口 — 单小类完整保存
# ══════════════════════════════════════════════════════════════════

def save_sub_category_results(
    db_conn,
    analysis: SubCategoryAnalysis,
    ai_result: AIResult,
    marketplace: str,
    month: str,
    batch_id: str,
    base_dir: str = DEFAULT_BASE_DIR,
    write_files: bool = True,
    write_db: bool = True,
) -> dict[str, Any]:
    """
    保存单个小类的完整分析结果.

    执行:
    1. 生成并保存 MD 报告 + JSON 模型文件
    2. 写入 product_line_elements 表
    3. (不在此处更新 batch status — 由 P4 batch_runner 统一管理)

    Args:
        db_conn: pymysql connection
        analysis: 预处理后的子品类数据
        ai_result: AI 分析结果
        marketplace: UK/DE
        month: 202605
        batch_id: 批次ID (如 UK_202605_v1_20260610)
        base_dir: MD 文件根目录
        write_files: 是否生成 MD + JSON 文件（默认 True）
        write_db: 是否写入 DB（默认 True）

    Returns:
        summary dict with keys: md_path, db_rows, node_name, bsr_id
    """
    summary = {
        "node_name": analysis.node_name,
        "bsr_id": analysis.bsr_id,
        "node_id": analysis.node_id,
        "md_path": None,
        "md_size": 0,
        "db_rows": 0,
    }

    # 1. MD 报告 + JSON 模型
    if write_files:
        md_content = generate_md_report(analysis, ai_result, marketplace)
        md_path = save_md_file(
            md_content, marketplace, analysis.bsr_id, analysis.node_name, base_dir
        )
        summary["md_path"] = md_path
        summary["md_size"] = len(md_content)

        # 同时保存结构化 JSON 供前端 API 读取
        model_json = generate_model_json(analysis, ai_result)
        save_model_json(
            model_json, marketplace, analysis.bsr_id,
            analysis.node_name, analysis.node_id, base_dir,
        )

    # 2. DB 写入
    if write_db:
        rows = save_product_line_elements(
            db_conn, analysis, ai_result, marketplace, month, batch_id
        )
        summary["db_rows"] = rows

    return summary


# ══════════════════════════════════════════════════════════════════
# 5. 批次汇总 JSON 写入 (H1: data_json 字段实际使用)
# ══════════════════════════════════════════════════════════════════

def finalize_batch_json(
    db_conn,
    batch_id: str,
    summaries: list[dict],
) -> bool:
    """
    批次完成后写入汇总 JSON 到 analysis_batches.data_json.

    Args:
        db_conn: pymysql connection
        batch_id: 批次ID
        summaries: _analyze_and_save 返回的结果列表

    Returns:
        True if updated
    """
    ok_count = sum(1 for s in summaries if s.get("status") == "ok")
    failed_count = sum(1 for s in summaries if s.get("status") != "ok")

    data = {
        "total_categories": len(summaries),
        "completed": ok_count,
        "failed": failed_count,
        "category_list": [
            {
                "node_name": s.get("node_name", ""),
                "bsr_id": s.get("bsr_id", ""),
                "node_id": s.get("node_id"),
                "status": s.get("status"),
                "db_rows": s.get("db_rows", 0),
                "elapsed_s": round(s.get("elapsed_s", 0), 1),
            }
            for s in sorted(summaries, key=lambda x: (x.get("bsr_id", ""), x.get("node_name", "")))
        ],
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    cur = db_conn.cursor()
    try:
        cur.execute(
            "UPDATE analysis_batches SET data_json = %s WHERE batch_id = %s",
            (json.dumps(data, ensure_ascii=False), batch_id),
        )
        db_conn.commit()
        logger.info(f"  analysis_batches.data_json updated: {len(summaries)} categories ({ok_count} ok)")
        return True
    except Exception as e:
        logger.error(f"  analysis_batches.data_json 写入失败: {e}")
        return False
    finally:
        cur.close()


# ══════════════════════════════════════════════════════════════════
# 6. 批量汇总 MD (P4 batch_runner 使用)
# ══════════════════════════════════════════════════════════════════

def save_batch_summary_md(
    summaries: list[dict],
    marketplace: str,
    month: str,
    batch_id: str,
    base_dir: str = DEFAULT_BASE_DIR,
) -> str:
    """
    生成批量的汇总 INDEX.md，列出所有已分析小类及链接.

    Args:
        summaries: save_sub_category_results 返回的 summary dict 列表
        marketplace: UK/DE
        month: 202605
        batch_id: 批次ID
        base_dir: MD 文件根目录

    Returns:
        写入的 INDEX.md 路径
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines: list[str] = []

    lines.append(f"# 郑总店铺模型 — 批量分析汇总")
    lines.append("")
    lines.append(f"> **批次**: {batch_id}")
    lines.append(f"> **站点**: {marketplace} | **月份**: {month}")
    lines.append(f"> **生成时间**: {now}")
    lines.append(f"> **已分析**: {len(summaries)} 小类")
    lines.append("")
    lines.append("---")
    lines.append("")

    # 按 bsr_id 分组
    grouped: dict[str, list[dict]] = defaultdict(list)
    for s in summaries:
        grouped[s["bsr_id"]].append(s)

    for bsr_id in sorted(grouped.keys()):
        items = grouped[bsr_id]
        lines.append(f"## {bsr_id} ({len(items)} 小类)")
        lines.append("")
        lines.append("| 小类 | 好品数 | MD 报告 |")
        lines.append("|------|--------|---------|")
        for s in items:
            safe_name = s["node_name"].replace(" ", "_").replace("&", "and").replace("/", "_")
            md_link = f"[查看](./{bsr_id}/{safe_name}.md)"
            lines.append(f"| {s['node_name']} | {s['db_rows']} | {md_link} |")
        lines.append("")

    lines.append("---")
    lines.append(f"> 郑总选品模型 v3 | 批量分析完成 | {now}")

    dir_path = os.path.join(base_dir, marketplace)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, "INDEX.md")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    logger.info(f"  INDEX.md saved: {file_path}")
    return file_path
