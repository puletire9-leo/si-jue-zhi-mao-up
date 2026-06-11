"""
批量分析管道 — 89小类并行AI分析 + 增量保存

架构:
1. 从 Java API 拉取品线树
2. 同步预处理所有小类 (同步, <30s for 89)
3. 并行AI分析 (ThreadPoolExecutor, 默认 3 并发)
4. 每完成一个小类立即保存 MD + DB
5. 全部完成后生成 INDEX.md + 更新批次状态

使用:
    python batch_runner.py [--concurrency N] [--dry-run] [--limit N]

环境变量:
    JAVA_BASE_URL  Java后端地址 (默认 http://java-product:8002)
    DEEPSEEK_API_KEY
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import pymysql
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any

sys.path.insert(0, os.environ.get("PYTHONPATH", "/app"))

from tools.selection.preprocess import preprocess_batch
from tools.selection.ai_analyzer import ai_analyze
from tools.selection.save_results import (
    save_sub_category_results,
    create_batch,
    update_batch_status,
    save_batch_summary_md,
    finalize_batch_json,
    get_latest_batch,
    get_data_version,
)

logger = logging.getLogger("batch_runner")

# ── 配置 ──────────────────────────────────────────────────────────

JAVA_BASE_URL = os.environ.get("JAVA_BASE_URL", "http://java-product:8002")
DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "mysql"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ.get("MYSQL_USER", "sijue"),
    "password": os.environ["MYSQL_PASSWORD"],
    "database": os.environ.get("MYSQL_DATABASE", "sijuelishi_dev"),
}
DEFAULT_CONCURRENCY = 3
DEFAULT_BASE_DIR = "/app/zheng_model_v1"


# ── 工具 ──────────────────────────────────────────────────────────

def _get_db_conn() -> pymysql.Connection:
    """创建新的数据库连接（线程安全）."""
    return pymysql.connect(**DB_CONFIG)


def _fetch_batch_data(marketplace: str, month: str) -> dict:
    """从 Java API 拉取品线聚合数据."""
    url = f"{JAVA_BASE_URL}/api/v1/product-line/aggregated-data?marketplace={marketplace}&month={month}"
    try:
        resp = urllib.request.urlopen(url, timeout=30)
        body = json.loads(resp.read())
        if body.get("code") != 200:
            raise RuntimeError(f"Java API error: {body.get('message', 'unknown')}")
        return body["data"]
    except urllib.error.URLError as e:
        raise RuntimeError(f"Cannot reach Java API at {JAVA_BASE_URL}: {e}")


# ── 单小类分析 + 保存 (在线程中执行) ──────────────────────────────

def _analyze_and_save(
    analysis,
    marketplace: str,
    month: str,
    batch_id: str,
    base_dir: str,
    idx: int,
    total: int,
) -> dict[str, Any]:
    """
    对单个小类执行 AI 分析 → 保存 MD + DB.
    在线程池中调用，每个线程创建独立 DB 连接.
    """
    node_name = analysis.node_name
    t0 = time.time()
    result: dict[str, Any] = {
        "node_name": node_name,
        "bsr_id": analysis.bsr_id,
        "node_id": analysis.node_id,
        "status": "ok",
        "error": None,
        "md_path": None,
        "db_rows": 0,
        "elapsed_s": 0,
    }

    try:
        # 1. AI 分析 (DeepSeek, 60-130s)
        ai_result = ai_analyze(analysis)
        if not ai_result or not ai_result.good_products:
            result["status"] = "failed"
            result["error"] = "AI returned no results"
            result["elapsed_s"] = time.time() - t0
            logger.warning(f"  [{idx}/{total}] {node_name}: AI无结果")
            return result

        # 2. 保存 (MD + DB, 各自独立连接)
        conn = _get_db_conn()
        try:
            summary = save_sub_category_results(
                conn, analysis, ai_result, marketplace, month, batch_id,
                base_dir=base_dir, write_files=True, write_db=True,
            )
            result["md_path"] = summary.get("md_path")
            result["db_rows"] = summary.get("db_rows", 0)
        finally:
            conn.close()

        result["elapsed_s"] = time.time() - t0
        logger.info(
            f"  [{idx}/{total}] {node_name}: {len(ai_result.good_products)}好品 "
            f"{result['db_rows']}DB {result['elapsed_s']:.0f}s"
        )

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)[:500]
        result["elapsed_s"] = time.time() - t0
        logger.error(f"  [{idx}/{total}] {node_name}: ERROR {e}")

    return result


# ── 主流程 ────────────────────────────────────────────────────────

def run_batch(
    marketplace: str = "UK",
    month: str = "202605",
    concurrency: int = DEFAULT_CONCURRENCY,
    base_dir: str = DEFAULT_BASE_DIR,
    dry_run: bool = False,
    limit: int = 0,
    force: bool = False,
) -> dict:
    """
    执行完整批量分析.

    Args:
        marketplace: UK/DE
        month: 202605
        concurrency: DeepSeek 并发数 (1-5, 默认3)
        base_dir: MD 输出根目录
        dry_run: 仅预处理，不调用 AI
        limit: 限制分析小类数 (0=全部)
        force: 强制重跑（即使已有完成批次，保持当前数据版本）

    Returns:
        汇总 dict
    """
    t_start = time.time()

    # ── Phase 1: 数据准备 ──
    logger.info("=" * 60)
    logger.info(f"批量分析开始: {marketplace}/{month} concurrency={concurrency}")
    logger.info("=" * 60)

    logger.info("[Phase 1] 拉取品线数据...")
    batch_data = _fetch_batch_data(marketplace, month)
    product_lines = batch_data.get("productLines", [])
    total_sub = sum(pl.get("subCategoryCount", 0) for pl in product_lines)
    logger.info(f"  {len(product_lines)} L1品线, {total_sub} L2小类")

    # ── Phase 2: 批量预处理 ──
    logger.info("[Phase 2] 预处理所有小类...")
    conn = _get_db_conn()
    try:
        analyses = preprocess_batch(conn, marketplace, month, batch_data)
    finally:
        conn.close()

    if limit and limit < len(analyses):
        analyses = analyses[:limit]
        logger.info(f"  限制: 仅前 {limit} 小类")

    logger.info(f"  预处理完成: {len(analyses)} 小类通过阈值")

    if not analyses:
        logger.warning("无小类通过阈值，退出")
        return {"status": "empty", "analyses": 0}

    # ── Phase 3: 版本检查 + 创建批次 ──
    # 数据版本决定模型版本 — 数据不变，版本不变
    conn = _get_db_conn()
    try:
        data_version = get_data_version(conn, marketplace, "deng_zong_shop")
        latest = get_latest_batch(conn, marketplace, month, "zheng_model")
    finally:
        conn.close()

    if latest:
        if latest["status"] == "done" and not force:
            logger.error(
                f"  ⛔ {marketplace}/{month} 已有完成批次: {latest['batch_id']}\n"
                f"  基准数据 v{data_version}，无需重复分析。如需重跑请加 --force"
            )
            return {"status": "skipped", "reason": "existing_batch_done", "existing": latest}
        elif latest["status"] == "analyzing":
            logger.error(
                f"  ⛔ {marketplace}/{month} 正在分析中: {latest['batch_id']}\n"
                f"  请等待当前批次完成后再试"
            )
            return {"status": "skipped", "reason": "batch_in_progress", "existing": latest}
        # error 状态或 --force：允许重跑，版本号不变（对齐数据版本）
        logger.info(f"  基准数据 v{data_version}, 已有批次 {latest['batch_id']} ({latest['status']}), 允许重跑")

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    batch_id = f"{marketplace}_{month}_v{data_version}_{ts}"
    logger.info(f"[Phase 3] 批次: {batch_id} (数据版本 v{data_version})")

    if not dry_run:
        conn = _get_db_conn()
        try:
            create_batch(
                conn, batch_id, "zheng_model", marketplace, month,
                source_table="deng_zong_shop",
                total_products=sum(a.stats.get("raw", 0) for a in analyses),
                total_items=len(analyses),
            )
            update_batch_status(conn, batch_id, "analyzing")
        finally:
            conn.close()

    # ── Phase 4: 并行AI分析 + 增量保存 ──
    if dry_run:
        logger.info(f"[Phase 4] DRY RUN — 跳过AI分析 ({len(analyses)} 小类)")
        return {
            "status": "dry_run",
            "batch_id": batch_id,
            "total": len(analyses),
            "analyses": analyses,
        }

    logger.info(f"[Phase 4] 并行AI分析 ({len(analyses)} 小类, {concurrency} 并发)...")
    logger.info(f"  预计耗时: ~{len(analyses) / concurrency * 90 / 60:.0f} 分钟")

    results: list[dict] = []
    completed = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {
            executor.submit(
                _analyze_and_save,
                analysis, marketplace, month, batch_id, base_dir,
                i, len(analyses),
            ): analysis
            for i, analysis in enumerate(analyses, 1)
        }

        for future in as_completed(futures):
            r = future.result()
            results.append(r)
            completed += 1
            if r["status"] != "ok":
                failed += 1

            # 进度汇总
            elapsed = time.time() - t_start
            rate = completed / elapsed * 60 if elapsed > 0 else 0
            logger.info(
                f"  >>> 进度: {completed}/{len(analyses)} "
                f"({rate:.1f}/min) 失败:{failed} 已用:{elapsed/60:.0f}min"
            )

    # ── Phase 5: 汇总 ──
    logger.info("[Phase 5] 生成汇总...")
    ok_results = [r for r in results if r["status"] == "ok"]

    if ok_results:
        save_batch_summary_md(ok_results, marketplace, month, batch_id, base_dir)

    # H1: 写入批次汇总到 data_json
    conn = _get_db_conn()
    try:
        finalize_batch_json(conn, batch_id, results)
    finally:
        conn.close()

    # 更新批次状态
    conn = _get_db_conn()
    try:
        if failed == len(analyses):
            update_batch_status(conn, batch_id, "error", "All sub-categories failed")
        elif failed > 0:
            # 部分失败：标记 done，error_message 记录失败详情
            failed_names = [r["node_name"] for r in results if r["status"] != "ok"]
            msg = f"Partial failure ({failed}/{len(analyses)}): {', '.join(failed_names[:10])}"
            update_batch_status(conn, batch_id, "done")
            # 追加 error_message
            cur = conn.cursor()
            cur.execute(
                "UPDATE analysis_batches SET error_message=%s WHERE batch_id=%s",
                (msg[:1000], batch_id),
            )
            conn.commit()
            cur.close()
        else:
            update_batch_status(conn, batch_id, "done")
    finally:
        conn.close()

    total_elapsed = time.time() - t_start
    summary = {
        "status": "done" if failed == 0 else "partial",
        "batch_id": batch_id,
        "total": len(analyses),
        "completed": completed,
        "failed": failed,
        "elapsed_min": round(total_elapsed / 60, 1),
        "results": results,
    }

    logger.info("=" * 60)
    logger.info(
        f"批量分析完成: {completed}/{len(analyses)} "
        f"成功:{completed - failed} 失败:{failed} "
        f"耗时:{total_elapsed/60:.0f}min"
    )
    logger.info(f"  MD: {base_dir}/{marketplace}/INDEX.md")
    logger.info(f"  批次: {batch_id}")
    logger.info("=" * 60)

    return summary


# ── CLI ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="郑总店铺模型 — 批量分析管道")
    parser.add_argument("--marketplace", default="UK", help="站点 (default: UK)")
    parser.add_argument("--month", default="202605", help="数据月份 (default: 202605)")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY,
                        help=f"DeepSeek 并发数 (default: {DEFAULT_CONCURRENCY})")
    parser.add_argument("--base-dir", default=DEFAULT_BASE_DIR,
                        help="MD 输出目录 (default: /app/zheng_model_v1)")
    parser.add_argument("--dry-run", action="store_true",
                        help="仅预处理，不调用 AI")
    parser.add_argument("--limit", type=int, default=0,
                        help="限制分析小类数 (0=全部)")
    parser.add_argument("--force", action="store_true",
                        help="强制重跑（即使已有完成批次，使用当前数据版本）")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    try:
        result = run_batch(
            marketplace=args.marketplace,
            month=args.month,
            concurrency=args.concurrency,
            base_dir=args.base_dir,
            dry_run=args.dry_run,
            limit=args.limit,
            force=args.force,
        )
        if result["status"] in ("done", "partial", "skipped"):
            sys.exit(0)
        else:
            sys.exit(1)
    except KeyboardInterrupt:
        logger.warning("用户中断")
        sys.exit(130)
    except Exception as e:
        logger.error(f"批量分析失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
