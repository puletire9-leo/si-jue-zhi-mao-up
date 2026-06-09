"""APScheduler 进程内定时任务调度器。

注册的定时任务:
  - monthly_verify:     每月2号凌晨3点 → 验证上月决策
  - quarterly_calib:    每季度首月1号凌晨4点 → 校准权重
  - monthly_blue_ocean: 每月1号凌晨3点 → 全品类蓝海扫描
  - monthly_seller_scan: 每月1号凌晨5点 → 卖家行为画像全量扫描

启动方式: FastAPI startup 事件中调用 init_scheduler()。
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def init_scheduler():
    """初始化并启动定时任务调度器。"""
    # ── 月度决策验证（每月2号凌晨3点） ──
    scheduler.add_job(
        _run_verification_wrapper,
        CronTrigger(day=2, hour=3, minute=0),
        id="monthly_verify",
        name="月度决策验证",
        replace_existing=True,
    )
    logger.info("[scheduler] 注册: monthly_verify (每月2号 03:00)")

    # ── 季度权重校准（1/4/7/10月1号凌晨4点） ──
    scheduler.add_job(
        _run_calibration_wrapper,
        CronTrigger(month="1,4,7,10", day=1, hour=4, minute=0),
        id="quarterly_calib",
        name="季度权重校准",
        replace_existing=True,
    )
    logger.info("[scheduler] 注册: quarterly_calib (每季度首月1号 04:00)")

    # ── 月度蓝海全品类扫描（每月1号凌晨3点） ──
    scheduler.add_job(
        _run_blue_ocean_wrapper,
        CronTrigger(day=1, hour=3, minute=0),
        id="monthly_blue_ocean",
        name="月度蓝海全品类扫描",
        replace_existing=True,
    )
    logger.info("[scheduler] 注册: monthly_blue_ocean (每月1号 03:00)")

    # ── 月度卖家行为画像全量扫描（每月1号凌晨5点） ──
    scheduler.add_job(
        _run_seller_scan_wrapper,
        CronTrigger(day=1, hour=5, minute=0),
        id="monthly_seller_scan",
        name="月度卖家行为画像扫描",
        replace_existing=True,
    )
    logger.info("[scheduler] 注册: monthly_seller_scan (每月1号 05:00)")

    scheduler.start()
    logger.info("[scheduler] APScheduler 已启动")


async def _run_verification_wrapper():
    """定时任务包装器 — 捕获异常避免静默失败。"""
    logger.info("[scheduler] 触发: monthly_verify")
    try:
        from selection.tasks.verification_task import run_verification
        result = await run_verification(marketplace="UK")
        logger.info(f"[scheduler] monthly_verify 完成: {result.get('status')}")
    except Exception as e:
        logger.error(f"[scheduler] monthly_verify 失败: {e}", exc_info=True)


async def _run_calibration_wrapper():
    """定时任务包装器 — 捕获异常避免静默失败。"""
    logger.info("[scheduler] 触发: quarterly_calib")
    try:
        from selection.tasks.calibration_task import run_calibration
        result = await run_calibration()
        logger.info(
            f"[scheduler] quarterly_calib 完成: "
            f"{result.get('calibrated_count', 0)}/{result.get('total_archetypes', 0)}"
        )
    except Exception as e:
        logger.error(f"[scheduler] quarterly_calib 失败: {e}", exc_info=True)


async def _run_blue_ocean_wrapper():
    """定时任务包装器 — 月度蓝海全品类扫描。"""
    logger.info("[scheduler] 触发: monthly_blue_ocean")
    try:
        from selection.category_scan_pipeline import run_full_category_scan
        result = await run_full_category_scan(marketplace="UK", call_llm=True)
        logger.info(
            f"[scheduler] monthly_blue_ocean 完成: "
            f"{result.get('total_categories', 0)} 品类, "
            f"status={result.get('status')}"
        )
    except Exception as e:
        logger.error(f"[scheduler] monthly_blue_ocean 失败: {e}", exc_info=True)


async def _run_seller_scan_wrapper():
    """定时任务包装器 — 月度卖家行为画像全量扫描。"""
    logger.info("[scheduler] 触发: monthly_seller_scan")
    try:
        from selection.tasks.seller_scan import run_seller_scan
        result = await run_seller_scan(marketplace="UK")
        logger.info(
            f"[scheduler] monthly_seller_scan 完成: "
            f"{result.get('profiled_count', 0)} 卖家, "
            f"status={result.get('status')}"
        )
    except Exception as e:
        logger.error(f"[scheduler] monthly_seller_scan 失败: {e}", exc_info=True)
