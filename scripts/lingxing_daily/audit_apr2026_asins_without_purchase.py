#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audit the 2026-04 ASIN cohort that cannot attach a completed purchase Q1.

This is a data-quality audit only. ASIN cohort time still comes entirely from
the formal FBA-sellable / creation-time model-start baseline.
"""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql

from build_sku_q1_first_batch_model_test import (
    OUTPUT_ROOT,
    dec,
    load_asin_baseline,
    load_monthly_sales,
    mysql_env,
)
from write_asin_apr2026_q1_cohort_md import load_sku_purchase_batches


COHORT_MONTH = "2026-04"
MONTHS = ("2026-04", "2026-05", "2026-06")
OUTPUT_DIR = OUTPUT_ROOT / "04_测试批次"
DETAIL_FILE = OUTPUT_DIR / "2026-04_无可关联采购Q1但有销量或财务的ASIN明细.csv"
UNMATCHED_SKU_FILE = OUTPUT_DIR / "2026-04_Q1未关联SKU_人工核查.csv"
UNMATCHED_SKU_TXT = OUTPUT_DIR / "2026-04_Q1未关联SKU_人工核查.txt"
AMBIGUOUS_MAP_FILE = OUTPUT_DIR / "2026-04_Q1_SKU多ASIN候选映射_人工核查.csv"
REPORT_FILE = OUTPUT_DIR / "2026-04_上架批次_采购缺口与销量财务审查.md"


def load_financials(asins: set[str]) -> dict[str, dict[str, Decimal]]:
    sql = """
        SELECT asin, currency_code, SUM(COALESCE(gross_profit, 0))
        FROM lingxing_profit_asin
        WHERE data_date >= %s AND data_date <= %s
          AND asin IN ({placeholders})
          AND currency_code IN ('GBP', 'EUR')
        GROUP BY asin, currency_code
    """.format(placeholders=", ".join(["%s"] * len(asins)))
    result: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, [date(2026, 4, 1), date(2026, 6, 30), *sorted(asins)])
            for asin, currency, profit in cursor.fetchall():
                result[str(asin)][str(currency)] += dec(profit)
    return result


def load_purchase_plans() -> dict[str, list[dict[str, Any]]]:
    """Load Q1-planning candidates after the historical plan backfill."""
    sql = """
        SELECT sku, plan_sn, create_time, quantity_plan, status, status_text
        FROM lingxing_purchase_plan
        WHERE sku IS NOT NULL AND sku <> ''
          AND COALESCE(quantity_plan, 0) > 0
          AND COALESCE(status_text, '') NOT LIKE '%作废%'
        ORDER BY create_time, plan_sn
    """
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            for sku, plan_sn, create_time, quantity_plan, status, status_text in cursor.fetchall():
                result[str(sku).strip()].append({
                    "plan_sn": str(plan_sn or ""), "create_time": create_time,
                    "quantity_plan": dec(quantity_plan), "status": status, "status_text": str(status_text or ""),
                })
    return result


def value_text(value: Decimal) -> str:
    return f"{value:,.2f}"


def main() -> None:
    asins, sku_to_asins, _owners = load_asin_baseline()
    load_monthly_sales(asins)
    purchases = load_sku_purchase_batches()
    plans = load_purchase_plans()
    cohort = {asin: row for asin, row in asins.items() if row["model_start_month"] == COHORT_MONTH}
    financials = load_financials(set(cohort))

    categories: Counter[str] = Counter()
    q1_plan_statuses: Counter[str] = Counter()
    details: list[dict[str, Any]] = []
    unmatched_skus: list[dict[str, Any]] = []
    ambiguous_mappings: list[dict[str, Any]] = []
    summary: dict[str, dict[str, Decimal | int]] = defaultdict(lambda: {
        "asins": 0, "sales_asins": 0, "sales_total": Decimal(0), "gbp_asins": 0,
        "gbp_profit": Decimal(0), "gbp_loss_asins": 0, "eur_asins": 0,
        "eur_profit": Decimal(0), "eur_loss_asins": 0,
    })

    for asin, record in sorted(cohort.items()):
        skus = sorted(record["skus"])
        if len(skus) != 1:
            category = "一个 ASIN 对应多个基准 SKU"
        else:
            sku = skus[0]
            candidates = sku_to_asins.get(sku, set())
            orders = purchases.get(sku, [])
            sku_plans = plans.get(sku, [])
            first_plan = None
            if candidates != {asin}:
                category = "SKU 对应多个 ASIN，采购无法唯一归属"
                candidate_rows = [asins[candidate] for candidate in sorted(candidates)]
                ambiguous_mappings.append({
                    "SKU": sku,
                    "当前2026-04批ASIN": asin,
                    "当前开发人": record["developer"],
                    "候选ASIN": " | ".join(sorted(candidates)),
                    "候选ASIN模型起算月": " | ".join(str(item["model_start_month"]) for item in candidate_rows),
                    "候选ASIN起算依据": " | ".join(str(item["start_basis"]) for item in candidate_rows),
                })
            else:
                first_plan = sku_plans[0] if sku_plans else None
                first_order = orders[0] if orders else None
                plan_before_launch = bool(first_plan and first_plan["create_time"] and first_plan["create_time"].strftime("%Y-%m") <= COHORT_MONTH)
                order_before_launch = bool(first_order and first_order["purchase_time"] and first_order["purchase_time"].strftime("%Y-%m") <= COHORT_MONTH)
                if plan_before_launch and order_before_launch:
                    category = "Q1计划+实际采购单可关联"
                elif plan_before_launch:
                    category = "Q1计划可关联，实际采购单待补/未关联"
                elif first_plan:
                    category = "首笔采购计划晚于上架批次"
                elif order_before_launch:
                    category = "实际采购单可关联，采购计划未关联"
                elif first_order:
                    category = "首笔已观察采购晚于上架批次"
                else:
                    category = "无采购计划或有效采购单"
        categories[category] += 1
        if category in {"Q1计划+实际采购单可关联", "Q1计划可关联，实际采购单待补/未关联", "实际采购单可关联，采购计划未关联"}:
            if first_plan:
                q1_plan_statuses[first_plan["status_text"] or f"状态码 {first_plan['status']}"] += 1
            continue
        unmatched_skus.append({
            "ASIN": asin, "开发人": record["developer"], "基准SKU": " | ".join(skus),
            "模型起算依据": record["start_basis"], "Q1未关联原因": category,
        })
        sales = {month: dec(record["monthly_sales"].get(month, Decimal(0))) for month in MONTHS}
        total_sales = sum(sales.values(), Decimal(0))
        profit = financials.get(asin, {})
        summary[category]["asins"] += 1
        summary[category]["sales_asins"] += int(total_sales > 0)
        summary[category]["sales_total"] += total_sales
        for currency in ("GBP", "EUR"):
            if currency not in profit:
                continue
            summary[category][f"{currency.lower()}_asins"] += 1
            summary[category][f"{currency.lower()}_profit"] += profit[currency]
            summary[category][f"{currency.lower()}_loss_asins"] += int(profit[currency] < 0)
        if total_sales > 0 or profit:
            details.append({
                "ASIN": asin, "开发人": record["developer"], "基准SKU": " | ".join(skus),
                "模型起算依据": record["start_basis"], "采购关联状态": category,
                "2026-04销量": sales["2026-04"], "2026-05销量": sales["2026-05"],
                "2026-06销量": sales["2026-06"], "三月销量合计": total_sales,
                "GBP累计结算利润": profit.get("GBP", ""), "EUR累计结算利润": profit.get("EUR", ""),
            })

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    headers = list(details[0]) if details else []
    with DETAIL_FILE.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=headers)
        writer.writeheader()
        writer.writerows(details)
    with UNMATCHED_SKU_FILE.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=["ASIN", "开发人", "基准SKU", "模型起算依据", "Q1未关联原因"])
        writer.writeheader()
        writer.writerows(unmatched_skus)
    all_skus = sorted({sku.strip() for row in unmatched_skus for sku in row["基准SKU"].split(" | ") if sku.strip()})
    UNMATCHED_SKU_TXT.write_text("\n".join(all_skus) + "\n", encoding="utf-8")
    with AMBIGUOUS_MAP_FILE.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=["SKU", "当前2026-04批ASIN", "当前开发人", "候选ASIN", "候选ASIN模型起算月", "候选ASIN起算依据"])
        writer.writeheader()
        writer.writerows(ambiguous_mappings)

    lines = [
        "# 2026-04 ASIN 上架批次：采购缺口与销量/财务审查",
        "",
        "## 审查目的",
        "",
        "确认 2026-04 上架批次中，未能关联到 Q1 采购计划/采购单的 ASIN是否已经有销量或财务结果。"
        "Q1先看采购计划，采购单用于回填实际采购量；不把采购时间用于划分 ASIN 批次。",
        "",
        "## 批次范围",
        "",
        f"- ASIN 上架批次：`模型分析起算月 = {COHORT_MONTH}`，共 {len(cohort):,} 个。",
        "- 批次起算：FBA 可售首现优先；无 FBA 可售时，商品信息创建时间兜底。",
        "- 销量/财务审查窗口：2026-04 至 2026-06。",
        "",
        "## Q1 关联结果",
        "",
        "| 结果 | ASIN 数 |",
        "|---|---:|",
    ]
    for category, count in sorted(categories.items()):
        lines.append(f"| {category} | {count:,} |")
    lines += [
        "",
        "## 已关联 Q1 采购计划的状态",
        "",
        "| 首个 Q1 采购计划状态 | ASIN 数 |",
        "|---|---:|",
    ]
    for status, count in sorted(q1_plan_statuses.items()):
        lines.append(f"| {status} | {count:,} |")
    lines += [
        "",
        "## 未能关联 Q1 的 ASIN，是否已经在卖/已有利润",
        "",
        "| 原因 | ASIN 数 | 有销量 ASIN 数 | 2026-04至06销量合计 | 有GBP财务记录 | GBP累计利润 | GBP亏损ASIN数 | 有EUR财务记录 | EUR累计利润 | EUR亏损ASIN数 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for category, item in sorted(summary.items()):
        lines.append(
            f"| {category} | {item['asins']:,} | {item['sales_asins']:,} | {value_text(item['sales_total'])} | "
            f"{item['gbp_asins']:,} | GBP {value_text(item['gbp_profit'])} | {item['gbp_loss_asins']:,} | "
            f"{item['eur_asins']:,} | EUR {value_text(item['eur_profit'])} | {item['eur_loss_asins']:,} |"
        )
    lines += [
        "",
        "## 结论怎么读",
        "",
        "- Q1采购计划已补拉至 2025-04。计划可关联但采购单未关联时，应保留“Q1计划量”，等待实际采购量/入库量回填，不能删掉该 ASIN。",
        "- “SKU 对应多个 ASIN”是映射问题，不能把该 SKU 的采购量硬分到某一个 ASIN；应待映射确认后再进入 Q1/Q2 汇总。",
        "- 明细只列出有销量或有财务记录的未关联 Q1 ASIN，便于逐项核查。",
        f"- 有经营记录的明细：`{DETAIL_FILE.name}`。",
        f"- 全部未关联 Q1 SKU（供人工核查）：`{UNMATCHED_SKU_FILE.name}` 和纯 SKU 列表 `{UNMATCHED_SKU_TXT.name}`。",
        f"- 多 ASIN 的候选归属：`{AMBIGUOUS_MAP_FILE.name}`。",
    ]
    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(REPORT_FILE)
    print(DETAIL_FILE)


if __name__ == "__main__":
    main()
