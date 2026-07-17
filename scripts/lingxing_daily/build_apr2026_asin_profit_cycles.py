#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the per-ASIN finance-cycle ledger for the 2026-04 launch cohort.

The ASIN model-start month defines Cycle 1.  Q1/Q2 are attached purchase
quantities only.  All batch-level conclusions must be aggregated from these
ASIN-level cycles, never the other way round.
"""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql
from python_calamine import load_workbook

from build_sku_q1_first_batch_model_test import (
    OUTPUT_ROOT,
    MONTHLY_SOURCE,
    dec,
    load_asin_baseline,
    load_monthly_sales,
    mysql_env,
)
from write_asin_apr2026_q1_cohort_md import load_sku_purchase_batches


COHORT_MONTH = "2026-04"
CYCLES = ("2026-04", "2026-05", "2026-06")
OUTPUT_DIR = OUTPUT_ROOT / "04_测试批次" / "2026-04_ASIN逐周期财务"


def query_monthly_profit(asins: set[str]) -> dict[tuple[str, str, str], Decimal]:
    sql = """
        SELECT asin, currency_code, DATE_FORMAT(data_date, '%%Y-%%m') AS profit_month,
               SUM(COALESCE(gross_profit, 0))
        FROM lingxing_profit_asin
        WHERE data_date >= %s AND data_date <= %s
          AND asin IN ({placeholders})
          AND currency_code IN ('GBP', 'EUR')
        GROUP BY asin, currency_code, DATE_FORMAT(data_date, '%%Y-%%m')
    """.format(placeholders=", ".join(["%s"] * len(asins)))
    result: dict[tuple[str, str, str], Decimal] = defaultdict(Decimal)
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, [date(2026, 4, 1), date(2026, 6, 30), *sorted(asins)])
            for asin, currency, month, profit in cursor.fetchall():
                result[(str(asin), str(currency), str(month))] += dec(profit)
    return result


def load_monthly_fba_available(asins: set[str]) -> dict[tuple[str, str], Decimal]:
    """Aggregate the monthly FBA-sellable snapshots for the selected ASINs."""
    result: dict[tuple[str, str], Decimal] = defaultdict(Decimal)
    for path in sorted(MONTHLY_SOURCE.glob("*.xlsx")):
        match = re.search(r"(20\d{2}-\d{2})-\d{2}~", path.name)
        if not match or match.group(1) not in CYCLES:
            continue
        month = match.group(1)
        rows = load_workbook(path).get_sheet_by_index(0).iter_rows()
        headers = [str(value or "").strip() for value in next(rows)]
        asin_index, available_index = headers.index("ASIN"), headers.index("FBA-可售")
        for row in rows:
            asin = str(row[asin_index] or "").strip()
            if asin in asins:
                result[(asin, month)] += dec(row[available_index])
    return result


def second_fba_event(available: dict[str, Decimal]) -> tuple[str, str]:
    """Return a conservative second-FBA candidate after a zero-availability gap."""
    if not any(available[month] > 0 for month in CYCLES):
        return "", "未观察到 FBA 可售"
    for previous, current in zip(CYCLES, CYCLES[1:]):
        if available[previous] <= 0 < available[current]:
            return current, "断货后再次 FBA 可售（可作为二批候选）"
    return "", "FBA 可售连续/未见断货后恢复，不能据此确认二批"


def purchase_status(asin: str, record: dict[str, Any], sku_to_asins: dict[str, set[str]], purchases: dict[str, list[dict[str, Any]]]) -> tuple[str, str, Decimal | str, Decimal | str]:
    skus = sorted(record["skus"])
    if len(skus) != 1:
        return "一个 ASIN 对应多个基准 SKU", " | ".join(skus), "", ""
    sku = skus[0]
    if sku_to_asins.get(sku, set()) != {asin}:
        return "SKU 对应多个 ASIN，采购无法唯一归属", sku, "", ""
    orders = purchases.get(sku, [])
    if not orders:
        return "没有有效完成采购单", sku, "", ""
    q1 = orders[0]
    if not q1["purchase_time"] or q1["purchase_time"].strftime("%Y-%m") > COHORT_MONTH:
        return "首笔已观察采购晚于上架批次", sku, q1["quantity"], ""
    q2 = orders[1]["quantity"] if len(orders) > 1 else ""
    return "Q1 可关联", sku, q1["quantity"], q2


def sign(value: Decimal | str) -> str:
    if value == "":
        return "无财务记录"
    if value > 0:
        return "盈利"
    if value < 0:
        return "亏损"
    return "持平"


def money(value: Decimal | str) -> str:
    return "" if value == "" else f"{value:,.2f}"


def output_currency(rows: list[dict[str, Any]], currency: str) -> tuple[Path, list[list[str]]]:
    path = OUTPUT_DIR / f"2026-04_ASIN逐周期经营_{currency}.csv"
    headers = [
        "ASIN", "开发人", "基准SKU", "模型起算依据", "首批经营起点", "第二次FBA可售月", "FBA二批识别状态", "Q1/Q2采购关联状态", "Q1首批量", "Q2二批量",
        "周期1销量(2026-04)", f"周期1{currency}利润", "周期1利润状态",
        "周期2销量(2026-05)", f"周期2{currency}利润", "周期2利润状态",
        "周期3销量(2026-06)", f"周期3{currency}利润", "周期3利润状态",
        f"三周期累计{currency}利润", "累计利润状态",
    ]
    output: list[dict[str, Any]] = []
    for row in rows:
        profits = [row[f"{currency.lower()}_{month}"] for month in CYCLES]
        cumulative = sum((value for value in profits if value != ""), Decimal(0)) if any(value != "" for value in profits) else ""
        output.append({
            "ASIN": row["asin"], "开发人": row["developer"], "基准SKU": row["sku"],
            "模型起算依据": row["start_basis"], "首批经营起点": COHORT_MONTH,
            "第二次FBA可售月": row["second_fba_month"], "FBA二批识别状态": row["fba_second_status"],
            "Q1/Q2采购关联状态": row["purchase_status"],
            "Q1首批量": row["q1"], "Q2二批量": row["q2"],
            "周期1销量(2026-04)": row["sales_2026-04"], f"周期1{currency}利润": money(profits[0]), "周期1利润状态": sign(profits[0]),
            "周期2销量(2026-05)": row["sales_2026-05"], f"周期2{currency}利润": money(profits[1]), "周期2利润状态": sign(profits[1]),
            "周期3销量(2026-06)": row["sales_2026-06"], f"周期3{currency}利润": money(profits[2]), "周期3利润状态": sign(profits[2]),
            f"三周期累计{currency}利润": money(cumulative), "累计利润状态": sign(cumulative),
        })
    with path.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=headers)
        writer.writeheader()
        writer.writerows(output)
    return path, []


def summary_rows(rows: list[dict[str, Any]], currency: str) -> tuple[list[list[str]], list[list[str]]]:
    periods: list[list[str]] = []
    for index, month in enumerate(CYCLES, start=1):
        values = [row[f"{currency.lower()}_{month}"] for row in rows if row[f"{currency.lower()}_{month}"] != ""]
        periods.append([
            f"周期{index}", month, str(len(values)), str(sum(value < 0 for value in values)),
            str(sum(value > 0 for value in values)), f"{sum(values, Decimal(0)):,.2f}" if values else "—",
        ])
    cycle_one_losses = [row for row in rows if row[f"{currency.lower()}_{CYCLES[0]}"] != "" and row[f"{currency.lower()}_{CYCLES[0]}"] < 0]
    next_values = [row[f"{currency.lower()}_{CYCLES[1]}"] for row in cycle_one_losses if row[f"{currency.lower()}_{CYCLES[1]}"] != ""]
    transitions = [[
        "周期1亏损 ASIN", str(len(cycle_one_losses)),
        "其中周期2仍亏损", str(sum(value < 0 for value in next_values)),
        "其中周期2盈利", str(sum(value > 0 for value in next_values)),
    ]]
    return periods, transitions


def main() -> None:
    asins, sku_to_asins, _owners = load_asin_baseline()
    load_monthly_sales(asins)
    cohort = {asin: record for asin, record in asins.items() if record["model_start_month"] == COHORT_MONTH}
    purchases = load_sku_purchase_batches()
    profit = query_monthly_profit(set(cohort))
    fba_available = load_monthly_fba_available(set(cohort))
    rows: list[dict[str, Any]] = []
    for asin, record in sorted(cohort.items()):
        status, sku, q1, q2 = purchase_status(asin, record, sku_to_asins, purchases)
        item: dict[str, Any] = {
            "asin": asin, "developer": str(record["developer"]), "sku": sku,
            "start_basis": str(record["start_basis"]), "purchase_status": status, "q1": q1, "q2": q2,
        }
        available = {month: fba_available[(asin, month)] for month in CYCLES}
        item["second_fba_month"], item["fba_second_status"] = second_fba_event(available)
        for month in CYCLES:
            item[f"sales_{month}"] = dec(record["monthly_sales"].get(month, Decimal(0)))
            item[f"fba_{month}"] = available[month]
            for currency in ("GBP", "EUR"):
                key = (asin, currency, month)
                item[f"{currency.lower()}_{month}"] = profit[key] if key in profit else ""
        rows.append(item)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    gbp_file, _ = output_currency(rows, "GBP")
    eur_file, _ = output_currency(rows, "EUR")
    q1_statuses = Counter(str(row["purchase_status"]) for row in rows)
    fba_statuses = Counter(str(row["fba_second_status"]) for row in rows)
    lines = [
        "# 2026-04 ASIN 上架批次：逐 ASIN 周期利润审查",
        "",
        "## 周期定义",
        "",
        "- 本批 ASIN：正式基础对照表中 `模型分析起算月 = 2026-04` 的 725 个 ASIN。",
        "- 周期1 = 2026-04；周期2 = 2026-05；周期3 = 2026-06。",
        "- 每个 ASIN 在自己的起算月进入周期1；首次 FBA 可售就是首批经营起点。",
        "- 二批 FBA 只在“FBA 可售先为 0、之后再次大于 0”时标为二批候选；连续有货不能误当第二批。",
        "- Q1/Q2采购量只附在该 ASIN 上，不定义周期时间，也不作为成本。",
        "- GBP、EUR 分开观察和汇总。",
        "",
        "## Q1/Q2 关联状态",
        "",
        "| 状态 | ASIN 数 |",
        "|---|---:|",
    ]
    for name, count in sorted(q1_statuses.items()):
        lines.append(f"| {name} | {count:,} |")
    lines += [
        "",
        "## FBA 首批 / 二批识别",
        "",
        "| FBA 识别结果 | ASIN 数 |",
        "|---|---:|",
    ]
    for name, count in sorted(fba_statuses.items()):
        lines.append(f"| {name} | {count:,} |")
    for currency, detail_file in (("GBP", gbp_file), ("EUR", eur_file)):
        periods, transitions = summary_rows(rows, currency)
        lines += [
            "",
            f"## {currency}：每个经营周期的利润状态",
            "",
            "| 周期 | 月份 | 有财务记录 ASIN 数 | 亏损 ASIN 数 | 盈利 ASIN 数 | 本周期利润合计 |",
            "|---|---|---:|---:|---:|---:|",
        ]
        for row in periods:
            lines.append("| " + " | ".join(row) + " |")
        lines += [
            "",
            "| 观察对象 | ASIN 数 | 下一个周期状态 | ASIN 数 | 下一个周期状态 | ASIN 数 |",
            "|---|---:|---|---:|---|---:|",
        ]
        for row in transitions:
            lines.append("| " + " | ".join(row) + " |")
        lines += ["", f"- 逐 ASIN 明细：`{detail_file.name}`。"]
    lines += [
        "",
        "## 使用顺序",
        "",
        "1. 先在 GBP 或 EUR 明细中筛选“周期1利润状态=亏损”。",
        "2. 看同一 ASIN 的周期2、周期3利润状态和累计利润状态，判断是否继续亏损、改善或转正。",
        "3. 之后再按 Q1/Q2 关联状态、Q1量级汇总；不能先把不同 ASIN 的周期混在一起。",
    ]
    report = OUTPUT_DIR / "2026-04_ASIN逐周期利润审查.md"
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(report)
    print(gbp_file)
    print(eur_file)


if __name__ == "__main__":
    main()
