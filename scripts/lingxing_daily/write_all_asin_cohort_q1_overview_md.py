#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Write one-row-per-ASIN-launch-cohort Q1 / profit / Q2 overview.

The cohort is *only* the formal ASIN model-start month (FBA sellable first,
creation-time fallback). Purchase data only supplies Q1/Q2 quantity; its dates
are used internally to identify Q1/Q2, never as cohorts.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql

from build_sku_q1_first_batch_model_test import OUTPUT_ROOT, dec, load_asin_baseline, mysql_env
from write_asin_apr2026_q1_cohort_md import CUTOFF_END, load_sku_purchase_batches


OUTPUT_FILE = OUTPUT_ROOT / "04_测试批次" / "ASIN各上架批次_Q1平均单量_利润_二批总览.md"
DATA_CUTOFF = "2026-06"


def average_classification(value: Decimal | None) -> str:
    """Coarse classification only; this is deliberately not a five-bin table."""
    if value is None:
        return "无 Q1 样本"
    if value <= 10:
        return "小批（≤10）"
    if value <= 20:
        return "中批（11–20）"
    return "大批（>20）"


def load_profit_rows(asins: set[str]) -> dict[tuple[str, str], list[tuple[date, Decimal]]]:
    if not asins:
        return {}
    sql = """
        SELECT asin, currency_code, data_date, gross_profit
        FROM lingxing_profit_asin
        WHERE data_date >= %s AND data_date <= %s
          AND asin IN ({placeholders})
          AND currency_code IN ('GBP', 'EUR')
        ORDER BY asin, currency_code, data_date
    """.format(placeholders=", ".join(["%s"] * len(asins)))
    result: dict[tuple[str, str], list[tuple[date, Decimal]]] = defaultdict(list)
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, [date(2025, 4, 1), CUTOFF_END, *sorted(asins)])
            for asin, currency, data_date, profit in cursor.fetchall():
                if data_date:
                    result[(str(asin), str(currency))].append((data_date, dec(profit)))
    return result


def fmt(value: Decimal | int | float | None) -> str:
    return "—" if value is None else f"{Decimal(value):,.2f}"


def main() -> None:
    asins, sku_to_asins, _owners = load_asin_baseline()
    purchases = load_sku_purchase_batches()
    profit_rows = load_profit_rows(set(asins))

    summaries: dict[str, dict[str, Any]] = defaultdict(lambda: {
        "batch_asins": 0, "fba_starts": 0, "creation_fallbacks": 0,
        "q1_asins": 0, "q1_qty": Decimal(0),
        "q2_asins": 0, "gbp_profit": Decimal(0), "eur_profit": Decimal(0),
        "gbp_asins": set(), "eur_asins": set(), "not_usable": 0,
    })

    for asin, record in asins.items():
        month = str(record["model_start_month"] or "")
        if not month or month > DATA_CUTOFF:
            continue
        summary = summaries[month]
        summary["batch_asins"] += 1
        summary["fba_starts"] += int("FBA可售" in str(record["start_basis"]))
        summary["creation_fallbacks"] += int("创建时间" in str(record["start_basis"]))
        skus = sorted(record["skus"])
        if len(skus) != 1 or sku_to_asins.get(skus[0], set()) != {asin}:
            summary["not_usable"] += 1
            continue
        orders = purchases.get(skus[0], [])
        if not orders:
            summary["not_usable"] += 1
            continue
        q1 = orders[0]
        # Sequencing validation only. Purchase date does not define the batch.
        if not q1["purchase_time"] or q1["purchase_time"].strftime("%Y-%m") > month:
            summary["not_usable"] += 1
            continue
        q2 = orders[1] if len(orders) > 1 else None
        summary["q1_asins"] += 1
        summary["q1_qty"] += q1["quantity"]
        summary["q2_asins"] += int(q2 is not None)
        start_date = date.fromisoformat(f"{month}-01")
        for currency in ("GBP", "EUR"):
            values = [profit for data_date, profit in profit_rows.get((asin, currency), []) if data_date >= start_date]
            if values:
                summary[f"{currency.lower()}_asins"].add(asin)
                summary[f"{currency.lower()}_profit"] += sum(values, Decimal(0))

    lines = [
        "# ASIN 各上架批次：Q1 平均单量、逐周期利润与二批总览",
        "",
        "## 先确认批次口径",
        "",
        "- **一行就是一个 ASIN 上架批次**：正式 ASIN 基础对照表的 `模型分析起算月`。",
        "- **起算月规则**：首次 `FBA-可售 > 0` 优先；没有 FBA 可售时，商品信息创建月兜底。",
        "- **采购不定义批次时间**：采购事实只提供 Q1 首批量和是否进入 Q2；采购单金额不作为模型成本。",
        "- **Q1 平均分类只有三档**：小批（≤10）、中批（11–20）、大批（>20）。不再做细碎分桶。",
        "- **利润观察截止**：各批从自己的 ASIN 起算月累计至 2026-06-30；GBP、EUR 不相加。",
        "",
        "## 每批 Q1 与二批（采购口径）",
        "",
        "| ASIN 上架批次 | 利润观察范围 | 批次 ASIN 数 | FBA起算 / 创建兜底 | 可测 Q1 ASIN 数 | Q1 平均单量 | Q1 平均分类 | 有二批 ASIN 数 | 二批率 |",
        "|---|---|---:|---:|---:|---:|---|---:|---:|",
    ]
    for month, item in sorted(summaries.items()):
        count = item["q1_asins"]
        average = item["q1_qty"] / count if count else None
        lines.append(
            f"| {month} | {month} 至 {DATA_CUTOFF} | {item['batch_asins']:,} | {item['fba_starts']:,} / {item['creation_fallbacks']:,} | "
            f"{count:,} | {fmt(average)} | {average_classification(average)} | "
            f"{item['q2_asins']:,} | {item['q2_asins'] / count:.2%} |" if count else
            f"| {month} | {month} 至 {DATA_CUTOFF} | {item['batch_asins']:,} | {item['fba_starts']:,} / {item['creation_fallbacks']:,} | "
            f"0 | — | 无 Q1 样本 | 0 | — |"
        )
    lines += [
        "",
        "## 各批 GBP 累计结算利润",
        "",
        "| ASIN 上架批次 | 有 GBP 财务记录的 Q1 ASIN 数 | 累计结算利润（起算月起至2026-06） |",
        "|---|---:|---:|",
    ]
    for month, item in sorted(summaries.items()):
        lines.append(f"| {month} | {len(item['gbp_asins']):,} | GBP {fmt(item['gbp_profit'])} |")
    lines += [
        "",
        "## 各批 EUR 累计结算利润",
        "",
        "| ASIN 上架批次 | 有 EUR 财务记录的 Q1 ASIN 数 | 累计结算利润（起算月起至2026-06） |",
        "|---|---:|---:|",
    ]
    for month, item in sorted(summaries.items()):
        lines.append(f"| {month} | {len(item['eur_asins']):,} | EUR {fmt(item['eur_profit'])} |")
    lines += [
        "",
        "## 字段说明",
        "",
        "- **可测 Q1 ASIN 数**：SKU 唯一映射该 ASIN，存在首笔有效完成采购，且该首笔采购不晚于 ASIN 上架批次。",
        "- **Q1 平均单量**：该批可测 Q1 的实际下单量合计 ÷ 可测 Q1 ASIN 数；不是日单量、也不是销量。",
        "- **二批**：同一基准 SKU 存在第二个有效完成采购单。",
        "- **累计结算利润**：领星 `gross_profit` 的累计值，不称为资金回本。",
        "- 当前采购事实始于 2026-01，因此 Q1 是数据库中首笔已观察采购；补齐 2025 后可进一步确认历史 ASIN 的真实 Q1。",
    ]
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUTPUT_FILE)


if __name__ == "__main__":
    main()
