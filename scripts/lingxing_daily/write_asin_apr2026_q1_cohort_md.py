#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Write one compact, reviewable Q1 test report for the 2026-04 ASIN cohort.

The ASIN model-start month defines the cohort. Purchase facts are deliberately
used only for Q1/Q2 quantity, never as a cohort time axis or financial cost.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql

from build_sku_q1_first_batch_model_test import (
    DATA_CUTOFF,
    OUTPUT_ROOT,
    dec,
    load_asin_baseline,
    mysql_env,
    q1_bucket,
)


COHORT_MONTH = "2026-04"
OUTPUT_FILE = OUTPUT_ROOT / "04_测试批次" / "2026-04_ASIN上架批次_Q1采购量_利润_二批测试.md"
CUTOFF_END = date(2026, 6, 30)


def load_sku_purchase_batches() -> dict[str, list[dict[str, Any]]]:
    """Return first/second observed completed purchase batches by SKU.

    Dates are used only to order Q1 and Q2. They never define a cohort or
    appear as a business time axis in the generated report.
    """
    sql = """
        SELECT o.order_sn, COALESCE(o.order_time, o.create_time) AS purchase_time,
               o.purchase_currency, i.sku, i.quantity_real, i.quantity_entry,
               i.amount, i.item_id
        FROM lingxing_purchase_order_item i
        JOIN lingxing_purchase_order o ON o.order_sn = i.order_sn
        WHERE o.status = 9
          AND o.status_shipped = 3
          AND COALESCE(i.is_delete, 0) = 0
          AND COALESCE(i.quantity_real, 0) > 0
        ORDER BY COALESCE(o.order_time, o.create_time), o.order_sn, i.item_id
    """
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            for order_sn, purchase_time, currency, sku, quantity_real, quantity_entry, amount, _item_id in cursor.fetchall():
                sku = str(sku or "").strip()
                if not sku:
                    continue
                key = (sku, str(order_sn))
                row = grouped.setdefault(key, {
                    "sku": sku, "order_sn": str(order_sn), "purchase_time": purchase_time,
                    "quantity": Decimal(0), "entry": Decimal(0), "cost": Decimal(0),
                    "cost_currency": str(currency or "未填写"),
                })
                row["quantity"] += dec(quantity_real)
                row["entry"] += dec(quantity_entry)
                row["cost"] += dec(amount)
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in grouped.values():
        result[str(row["sku"])].append(row)
    for rows in result.values():
        rows.sort(key=lambda item: (item["purchase_time"] or datetime.max, item["order_sn"]))
    return result


def load_cumulative_profit(asins: set[str]) -> dict[tuple[str, str], Decimal]:
    sql = """
        SELECT asin, currency_code, SUM(COALESCE(gross_profit, 0))
        FROM lingxing_profit_asin
        WHERE data_date >= %s AND data_date <= %s
          AND asin IN ({placeholders})
          AND currency_code IN ('GBP', 'EUR')
        GROUP BY asin, currency_code
    """.format(placeholders=", ".join(["%s"] * len(asins)))
    result: dict[tuple[str, str], Decimal] = defaultdict(Decimal)
    if not asins:
        return result
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, [date(2026, 4, 1), CUTOFF_END, *sorted(asins)])
            for asin, currency, profit in cursor.fetchall():
                result[(str(asin), str(currency))] += dec(profit)
    return result


def currency_label(values: set[str]) -> str:
    values = {item for item in values if item}
    return "、".join(sorted(values)) if values else "未填写"


def build_rows() -> tuple[list[dict[str, Any]], dict[str, int]]:
    asins, sku_to_asins, _owners = load_asin_baseline()
    purchases = load_sku_purchase_batches()
    cohort = {asin: record for asin, record in asins.items() if record["model_start_month"] == COHORT_MONTH}
    profits = load_cumulative_profit(set(cohort))
    rows: list[dict[str, Any]] = []
    stats = defaultdict(int)
    stats["cohort_asins"] = len(cohort)
    for asin, record in sorted(cohort.items()):
        stats["fba_start"] += int("FBA可售" in str(record["start_basis"]))
        stats["create_fallback"] += int("创建时间" in str(record["start_basis"]))
        skus = sorted(record["skus"])
        if len(skus) != 1:
            stats["multi_base_sku"] += 1
            continue
        sku = skus[0]
        candidates = sku_to_asins.get(sku, set())
        if candidates != {asin}:
            stats["ambiguous_sku_asin"] += 1
            continue
        orders = purchases.get(sku, [])
        if not orders:
            stats["no_purchase"] += 1
            continue
        q1, q2 = orders[0], orders[1] if len(orders) > 1 else None
        # Only a chronology validation. It is not reported as a batch date.
        if not q1["purchase_time"] or q1["purchase_time"].strftime("%Y-%m") > COHORT_MONTH:
            stats["q1_after_launch"] += 1
            continue
        stats["usable"] += 1
        rows.append({
            "asin": asin, "developer": str(record["developer"]), "sku": sku,
            "start_basis": str(record["start_basis"]), "q1_qty": q1["quantity"],
            "bucket": q1_bucket(q1["quantity"]), "q2_qty": q2["quantity"] if q2 else None,
            "has_q2": q2 is not None,
            "gbp_profit": profits.get((asin, "GBP"), Decimal(0)),
            "eur_profit": profits.get((asin, "EUR"), Decimal(0)),
            "has_gbp": (asin, "GBP") in profits, "has_eur": (asin, "EUR") in profits,
        })
    return rows, stats


def fmt(value: Decimal | int | float) -> str:
    return f"{Decimal(value):,.2f}"


def build_purchase_summary(rows: list[dict[str, Any]]) -> list[list[str]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[str(row["bucket"])].append(row)
    result: list[list[str]] = []
    for bucket in ("1-10", "11-15", "16-20", "21-30", ">30"):
        group = groups[bucket]
        count = len(group)
        total_q1 = sum((row["q1_qty"] for row in group), Decimal(0))
        q2_count = sum(bool(row["has_q2"]) for row in group)
        result.append([
            bucket, str(count), fmt(total_q1 / count) if count else "—", str(q2_count),
            f"{q2_count / count:.2%}" if count else "—",
        ])
    return result


def build_profit_summary(rows: list[dict[str, Any]], currency: str) -> list[list[str]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row[f"has_{currency.lower()}"]:
            groups[str(row["bucket"])].append(row)
    result: list[list[str]] = []
    for bucket in ("1-10", "11-15", "16-20", "21-30", ">30"):
        group = groups[bucket]
        total_profit = sum((row[f"{currency.lower()}_profit"] for row in group), Decimal(0))
        result.append([bucket, str(len(group)), f"{currency} {fmt(total_profit)}"])
    return result


def main() -> None:
    rows, stats = build_rows()
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 2026-04 ASIN 上架批次：Q1 采购量、逐周期利润与二批测试",
        "",
        "## 这是什么批次",
        "",
        "- **批次时间：2026-04**。只取正式 ASIN 月度基础对照表中 `模型分析起算月 = 2026-04` 的 ASIN。",
        "- **起算规则：**首次 `FBA-可售 > 0` 的月份优先；全期未观察到 FBA 可售时，使用商品信息创建时间所在月兜底。",
        "- **利润观察范围：**2026-04-01 至 2026-06-30 的累计领星结算利润。GBP 与 EUR 完全分开。",
        "- **采购数据的作用：**只为 ASIN 的基准 SKU 补 Q1 首批采购量和 Q2 是否存在；采购金额不作为成本或回本依据。",
        "",
        "## 本批样本范围",
        "",
        f"- 2026-04 上架批次 ASIN：{stats['cohort_asins']:,} 个",
        f"- 其中按 FBA 可售起算：{stats['fba_start']:,} 个；按创建时间兜底：{stats['create_fallback']:,} 个",
        f"- 可用于本次 Q1 测试：{stats['usable']:,} 个（SKU 唯一映射 ASIN、存在首批采购，且首批采购不晚于上架批次）",
        f"- 暂不进入测试：无采购 {stats['no_purchase']:,} 个；SKU 对应多个 ASIN {stats['ambiguous_sku_asin']:,} 个；首批采购晚于上架批次 {stats['q1_after_launch']:,} 个；一个 ASIN 多个基准 SKU {stats['multi_base_sku']:,} 个。",
        "",
        "## 首批采购与二批：按 Q1 首批量分类",
        "",
        "| Q1 分类 | 测试 ASIN 数 | 首批平均单量 | 有二批 ASIN 数 | 二批率 |",
        "|---|---:|---:|---:|---:|",
    ]
    for row in build_purchase_summary(rows):
        lines.append("| " + " | ".join(row) + " |")
    lines += [
        "",
        "## GBP：本批累计结算利润",
        "",
        "| Q1 分类 | 有 GBP 财务记录 ASIN 数 | 2026-04 至 2026-06 累计结算利润 |",
        "|---|---:|---:|",
    ]
    for row in build_profit_summary(rows, "GBP"):
        lines.append("| " + " | ".join(row) + " |")
    lines += [
        "",
        "## EUR：本批累计结算利润",
        "",
        "| Q1 分类 | 有 EUR 财务记录 ASIN 数 | 2026-04 至 2026-06 累计结算利润 |",
        "|---|---:|---:|",
    ]
    for row in build_profit_summary(rows, "EUR"):
        lines.append("| " + " | ".join(row) + " |")
    lines += [
        "",
        "## 字段只保留这些意思",
        "",
        "- **首批平均单量** = 本分类 Q1 实际下单量合计 ÷ ASIN 数。不是日单量，也不是销量。",
        "- **本批累计结算利润** = 该币种下，从 2026-04 起截至 2026-06 的 `gross_profit` 合计。它是领星结算利润，不称为资金回本。",
        "- **二批** = 同一基准 SKU 存在第二个有效完成采购单。",
        "",
        "## 当前限制",
        "",
        "- 采购事实从 2026-01 开始；此处 Q1 是数据库中首笔已观察到的有效采购，补齐 2025 采购后才能确认历史 SKU 的真实首批。",
        "- SKU 对应多个 ASIN 的记录不强行归并，单列为待核查，不进入本测试。",
    ]
    OUTPUT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUTPUT_FILE)
    print(f"usable={stats['usable']}")


if __name__ == "__main__":
    main()
