#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Model v2: ASIN launch cohorts with equal allocation of purchase plans.

Scope and time axis come from the formal ASIN baseline: FBA-sellable first,
creation-time fallback.  Purchase plans supply only planned Q1/Q2 quantities.
When a SKU maps to multiple ASINs, each plan quantity is divided equally among
the candidate ASINs as a temporary, explicit allocation rule.
"""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql

from lingxing_base_access import dec, load_asin_baseline, load_completed_plans, mysql_env
from lingxing_model_paths import LEGACY_MODEL_ARCHIVE_ROOT


DATA_CUTOFF = "2026-06"
OUTPUT_DIR = LEGACY_MODEL_ARCHIVE_ROOT / "ASIN采购计划等额分摊_FBA周期模型_第二版_2025-04至2026-06"
DETAIL_FILE = OUTPUT_DIR / "02_基础数据" / "ASIN_Q1Q2采购计划等额分摊明细_2025-04至2026-06.csv"
REPORT_FILE = OUTPUT_DIR / "00_每批Q1Q2计划与利润总览.md"
README_FILE = OUTPUT_DIR / "00_先看这里.md"


def load_finance_daily(asins: set[str]) -> dict[tuple[str, str], list[tuple[date, Decimal]]]:
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
            cursor.execute(sql, [date(2025, 4, 1), date(2026, 6, 30), *sorted(asins)])
            for asin, currency, data_date, profit in cursor.fetchall():
                if data_date:
                    result[(str(asin), str(currency))].append((data_date, dec(profit)))
    return result


def fmt(value: Decimal | int | float | None) -> str:
    return "—" if value is None else f"{Decimal(value):,.2f}"


def main() -> None:
    asins, sku_to_asins, _owners = load_asin_baseline()
    plans = load_completed_plans()
    finance = load_finance_daily(set(asins))
    details: list[dict[str, Any]] = []
    for asin, record in sorted(asins.items()):
        start_month = str(record["model_start_month"] or "")
        if not start_month or start_month > DATA_CUTOFF:
            continue
        start_date = date.fromisoformat(f"{start_month}-01")
        q1 = Decimal(0)
        q2 = Decimal(0)
        plan_sku_count = 0
        allocation_candidates: set[str] = set()
        allocation_kind = "无已完成采购计划"
        for sku in sorted(record["skus"]):
            sku_plans = plans.get(sku, [])
            candidates = sorted(sku_to_asins.get(sku, set()))
            if not sku_plans or asin not in candidates:
                continue
            plan_sku_count += 1
            divisor = Decimal(len(candidates))
            q1 += sku_plans[0]["quantity"] / divisor
            if len(sku_plans) > 1:
                q2 += sku_plans[1]["quantity"] / divisor
            allocation_candidates.update(candidates)
            allocation_kind = "唯一SKU映射" if len(candidates) == 1 else "SKU多ASIN等额分摊"
        profits: dict[str, Decimal | str] = {}
        for currency in ("GBP", "EUR"):
            values = [profit for data_date, profit in finance.get((asin, currency), []) if data_date >= start_date]
            profits[currency] = sum(values, Decimal(0)) if values else ""
        details.append({
            "ASIN": asin, "开发人": record["developer"], "基准SKU": " | ".join(sorted(record["skus"])),
            "ASIN上架批次": start_month, "ASIN模型起算依据": record["start_basis"],
            "采购计划分摊方式": allocation_kind, "参与分摊SKU数": plan_sku_count,
            "同SKU候选ASIN": " | ".join(sorted(allocation_candidates)),
            "Q1计划量（等额分摊后）": q1 if plan_sku_count else "",
            "Q2计划量（等额分摊后）": q2 if plan_sku_count and q2 > 0 else "",
            "GBP累计结算利润（起算月至2026-06）": profits["GBP"],
            "EUR累计结算利润（起算月至2026-06）": profits["EUR"],
        })

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DETAIL_FILE.parent.mkdir(parents=True, exist_ok=True)
    headers = list(details[0]) if details else []
    with DETAIL_FILE.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=headers)
        writer.writeheader()
        writer.writerows(details)

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in details:
        grouped[str(row["ASIN上架批次"])].append(row)
    lines = [
        "# ASIN 各上架批次：Q1/Q2 采购计划与利润总览（第二版）",
        "",
        "## 模型规则",
        "",
        "- 批次时间：正式 ASIN 基础表的 `模型分析起算月`，即 FBA 可售优先、创建时间兜底。",
        "- Q1：基准 SKU 的首笔**已完成采购计划** `quantity_plan`。",
        "- Q2：同一 SKU 的第二笔**已完成采购计划** `quantity_plan`。",
        "- 同一 SKU 对多个 ASIN：Q1/Q2 计划量按候选 ASIN 数**等额分摊**。这是当前简化规则，明细保留候选 ASIN，后续可人工修正。",
        "- 不使用采购单，也不把采购计划金额当成本。利润直接使用领星财务 `gross_profit`。",
        "- GBP、EUR 不换汇、不相加。",
        "",
        "## 每批 Q1 / Q2 采购计划",
        "",
        "| ASIN上架批次 | 批次ASIN数 | FBA起算 / 创建兜底 | 有Q1计划ASIN数 | 多ASIN等额分摊数 | Q1计划平均单量 | 有Q2计划ASIN数 | Q2计划平均单量 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for month, rows in sorted(grouped.items()):
        q1_rows = [row for row in rows if row["Q1计划量（等额分摊后）"] != ""]
        q2_rows = [row for row in rows if row["Q2计划量（等额分摊后）"] != ""]
        fba = sum("FBA可售" in str(row["ASIN模型起算依据"]) for row in rows)
        fallback = len(rows) - fba
        split = sum(row["采购计划分摊方式"] == "SKU多ASIN等额分摊" for row in q1_rows)
        q1_avg = sum((dec(row["Q1计划量（等额分摊后）"]) for row in q1_rows), Decimal(0)) / len(q1_rows) if q1_rows else None
        q2_avg = sum((dec(row["Q2计划量（等额分摊后）"]) for row in q2_rows), Decimal(0)) / len(q2_rows) if q2_rows else None
        lines.append(f"| {month} | {len(rows):,} | {fba:,} / {fallback:,} | {len(q1_rows):,} | {split:,} | {fmt(q1_avg)} | {len(q2_rows):,} | {fmt(q2_avg)} |")
    for currency in ("GBP", "EUR"):
        key = f"{currency}累计结算利润（起算月至2026-06）"
        lines += [
            "",
            f"## 各批 {currency} 累计结算利润",
            "",
            f"| ASIN上架批次 | 有{currency}财务记录ASIN数 | 累计结算利润 |",
            "|---|---:|---:|",
        ]
        for month, rows in sorted(grouped.items()):
            values = [dec(row[key]) for row in rows if row[key] != ""]
            lines.append(f"| {month} | {len(values):,} | {currency} {fmt(sum(values, Decimal(0)))} |")
    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    README_FILE.write_text(
        "# 第二版模型：采购计划等额分摊 + FBA 周期\n\n"
        "先读 `00_每批Q1Q2计划与利润总览.md`；需要检查单个 ASIN 时看 `02_基础数据` 明细。\n\n"
        "本版的唯一简化：SKU 对多个 ASIN 时，采购计划量等额分摊。它用于先完整跑通模型，不把计划量硬塞给任一 ASIN。\n",
        encoding="utf-8",
    )
    print(REPORT_FILE)
    print(DETAIL_FILE)


if __name__ == "__main__":
    main()
