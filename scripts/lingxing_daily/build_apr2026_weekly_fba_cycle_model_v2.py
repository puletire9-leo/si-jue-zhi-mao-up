#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Second-model test: weekly FBA cycles for the 2026-04 ASIN launch cohort.

Q1/Q2 are completed purchase-plan quantities, equally allocated when a SKU
maps to multiple ASINs.  Operating periods are independently determined by
weekly FBA-sellable states: first >0 is cycle 1; an explicit 0 followed by >0
is a cycle-2 candidate.
"""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql

from lingxing_base_access import dec, load_asin_baseline, load_completed_plans, mysql_env
from lingxing_model_paths import LEGACY_MODEL_ARCHIVE_ROOT


COHORT_MONTH = "2026-04"
SCAN_START = date(2026, 1, 1)
CUTOFF = date(2026, 6, 30)
OUTPUT_DIR = LEGACY_MODEL_ARCHIVE_ROOT / "ASIN采购计划等额分摊_FBA周期模型_第二版_2025-04至2026-06" / "03_2026-04周级FBA周期"
REPORT_FILE = OUTPUT_DIR / "00_2026-04_ASIN周级FBA首批二批周期审查.md"


def load_weekly_rows(asins: set[str]) -> tuple[dict[str, list[dict[str, Any]]], date | None, date | None]:
    """Use explicit weekly records only; missing weeks are never treated as zero."""
    sql = """
        SELECT asin, week_start, week_end,
               MAX(COALESCE(afn_fulfillable_quantity, 0)) AS fba_available,
               SUM(COALESCE(volume, 0)) AS sales_volume
        FROM lingxing_sku_weekly_performance
        WHERE asin IN ({placeholders})
          AND week_start <= %s AND week_end >= %s
        GROUP BY asin, week_start, week_end
        ORDER BY asin, week_start, week_end
    """.format(placeholders=", ".join(["%s"] * len(asins)))
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    min_week: date | None = None
    max_week: date | None = None
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, [*sorted(asins), CUTOFF, SCAN_START])
            for asin, week_start, week_end, available, volume in cursor.fetchall():
                if not week_start or not week_end:
                    continue
                result[str(asin)].append({
                    "start": week_start, "end": week_end,
                    "available": dec(available), "volume": dec(volume),
                })
                min_week = week_start if min_week is None or week_start < min_week else min_week
                max_week = week_end if max_week is None or week_end > max_week else max_week
    return result, min_week, max_week


def load_finance_metrics(asins: set[str]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    """Read all model financial metrics from the financial fact table."""
    sql = """
        SELECT asin, currency_code, data_date,
               total_sales_quantity, total_sales_amount, total_ads_cost, total_cost, gross_profit
        FROM lingxing_profit_asin
        WHERE data_date >= %s AND data_date <= %s
          AND asin IN ({placeholders})
          AND currency_code IN ('GBP', 'EUR')
        ORDER BY asin, currency_code, data_date
    """.format(placeholders=", ".join(["%s"] * len(asins)))
    result: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, [SCAN_START, CUTOFF, *sorted(asins)])
            for asin, currency, data_date, quantity, sales, ads, cost, profit in cursor.fetchall():
                if data_date:
                    result[(str(asin), str(currency))].append({
                        "date": data_date, "quantity": dec(quantity), "sales": dec(sales),
                        "ads": dec(ads), "cost": dec(cost), "profit": dec(profit),
                    })
    return result


def allocate_plans(asin: str, record: dict[str, Any], sku_to_asins: dict[str, set[str]], plans: dict[str, list[dict[str, Any]]]) -> tuple[Decimal | str, Decimal | str, str]:
    q1 = Decimal(0)
    q2 = Decimal(0)
    used = False
    split = False
    for sku in sorted(record["skus"]):
        sku_plans = plans.get(sku, [])
        candidates = sku_to_asins.get(sku, set())
        if not sku_plans or asin not in candidates:
            continue
        used = True
        split = split or len(candidates) > 1
        q1 += sku_plans[0]["quantity"] / Decimal(len(candidates))
        if len(sku_plans) > 1:
            q2 += sku_plans[1]["quantity"] / Decimal(len(candidates))
    if not used:
        return "", "", "无已完成采购计划"
    return q1, q2 if q2 > 0 else "", "SKU多ASIN等额分摊" if split else "唯一SKU映射"


def fba_cycles(rows: list[dict[str, Any]], fallback_month: str) -> dict[str, Any]:
    positive = [row for row in rows if row["available"] > 0]
    if positive:
        first = positive[0]["start"]
        first_source = "周级FBA首次可售"
    else:
        first = date.fromisoformat(f"{fallback_month}-01")
        first_source = "创建时间兜底（未观察到周级FBA可售）"
    zero_seen = False
    zero_week: date | None = None
    second: date | None = None
    for row in rows:
        if row["start"] < first:
            continue
        if row["available"] <= 0:
            zero_seen = True
            zero_week = row["start"]
        elif zero_seen:
            second = row["start"]
            break
    state = "断货后再次FBA可售（二批候选）" if second else (
        "未观察到FBA可售" if not positive else "FBA连续有货/未观察到断货后恢复"
    )
    first_end = second - timedelta(days=1) if second else CUTOFF
    return {"first_start": first, "first_source": first_source, "zero_week": zero_week or "", "second_start": second or "", "state": state, "first_end": first_end}


def within_cycle(rows: list[dict[str, Any]], start: date, end: date) -> tuple[Decimal, int]:
    selected = [row for row in rows if row["start"] >= start and row["start"] <= end]
    return sum((row["volume"] for row in selected), Decimal(0)), sum(row["available"] > 0 for row in selected)


def finance_in_cycle(rows: list[dict[str, Any]], start: date, end: date) -> dict[str, Decimal] | str:
    values = [row for row in rows if start <= row["date"] <= end]
    if not values:
        return ""
    return {
        key: sum((row[key] for row in values), Decimal(0))
        for key in ("quantity", "sales", "ads", "cost", "profit")
    }


def text(value: Decimal | str | date) -> str:
    if value == "":
        return ""
    if isinstance(value, Decimal):
        return f"{value:,.2f}"
    return str(value)


def metric_value(metrics: dict[str, Decimal] | str, key: str) -> Decimal | str:
    return "" if metrics == "" else metrics[key]


def expense(value: Decimal | str) -> Decimal | str:
    """Present financial expense fields as positive expenditure amounts."""
    if value == "":
        return ""
    return -value if value < 0 else value


def settlement_adjustment(metrics: dict[str, Decimal] | str) -> Decimal | str:
    """Residual financial settlement items after sales, ads and product cost."""
    if metrics == "":
        return ""
    return metrics["profit"] - metrics["sales"] - metrics["ads"] - metrics["cost"]


def profit_status(metrics: dict[str, Decimal] | str) -> str:
    if metrics == "":
        return "无财务记录"
    value = metrics["profit"]
    if value < 0:
        return "亏损"
    if value > 0:
        return "盈利"
    return "持平"


def write_currency(rows: list[dict[str, Any]], currency: str) -> Path:
    path = OUTPUT_DIR / f"2026-04_ASIN周级FBA周期_{currency}.csv"
    headers = [
        "ASIN", "开发人", "基准SKU", "Q1计划量（分摊后）", "Q2计划量（分摊后）", "计划分摊方式",
        "首批经营起点", "首批起点来源", "首批结束", "首批周表销量", "首批FBA可售周数", "首批财务销量", f"首批{currency}销售额", f"首批{currency}广告费支出", f"首批{currency}财务总成本支出", f"首批{currency}其他结算支出/调整", f"首批{currency}结算毛利润(gross_profit)", "首批毛利润状态",
        "断货周", "二批FBA可售周", "二批识别状态", "二批结束", "二批周表销量", "二批FBA可售周数", "二批财务销量", f"二批{currency}销售额", f"二批{currency}广告费支出", f"二批{currency}财务总成本支出", f"二批{currency}其他结算支出/调整", f"二批{currency}结算毛利润(gross_profit)", "二批毛利润状态",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            first_finance = row[f"first_{currency.lower()}"]
            second_finance = row[f"second_{currency.lower()}"]
            writer.writerow({
                "ASIN": row["asin"], "开发人": row["developer"], "基准SKU": row["sku"],
                "Q1计划量（分摊后）": text(row["q1"]), "Q2计划量（分摊后）": text(row["q2"]), "计划分摊方式": row["allocation"],
                "首批经营起点": text(row["first_start"]), "首批起点来源": row["first_source"], "首批结束": text(row["first_end"]),
                "首批周表销量": text(row["first_sales"]), "首批FBA可售周数": row["first_active_weeks"],
                "首批财务销量": text(metric_value(first_finance, "quantity")), f"首批{currency}销售额": text(metric_value(first_finance, "sales")), f"首批{currency}广告费支出": text(expense(metric_value(first_finance, "ads"))), f"首批{currency}财务总成本支出": text(expense(metric_value(first_finance, "cost"))), f"首批{currency}其他结算支出/调整": text(expense(settlement_adjustment(first_finance))), f"首批{currency}结算毛利润(gross_profit)": text(metric_value(first_finance, "profit")), "首批毛利润状态": profit_status(first_finance),
                "断货周": text(row["zero_week"]), "二批FBA可售周": text(row["second_start"]), "二批识别状态": row["second_state"], "二批结束": text(row["second_end"]),
                "二批周表销量": text(row["second_sales"]), "二批FBA可售周数": row["second_active_weeks"],
                "二批财务销量": text(metric_value(second_finance, "quantity")), f"二批{currency}销售额": text(metric_value(second_finance, "sales")), f"二批{currency}广告费支出": text(expense(metric_value(second_finance, "ads"))), f"二批{currency}财务总成本支出": text(expense(metric_value(second_finance, "cost"))), f"二批{currency}其他结算支出/调整": text(expense(settlement_adjustment(second_finance))), f"二批{currency}结算毛利润(gross_profit)": text(metric_value(second_finance, "profit")), "二批毛利润状态": profit_status(second_finance),
            })
    return path


def main() -> None:
    asins, sku_to_asins, _owners = load_asin_baseline()
    cohort = {asin: record for asin, record in asins.items() if record["model_start_month"] == COHORT_MONTH}
    plans = load_completed_plans()
    weekly, min_week, max_week = load_weekly_rows(set(cohort))
    finance = load_finance_metrics(set(cohort))
    rows: list[dict[str, Any]] = []
    for asin, record in sorted(cohort.items()):
        q1, q2, allocation = allocate_plans(asin, record, sku_to_asins, plans)
        cycle = fba_cycles(weekly.get(asin, []), COHORT_MONTH)
        first_sales, first_active = within_cycle(weekly.get(asin, []), cycle["first_start"], cycle["first_end"])
        if cycle["second_start"]:
            second_sales, second_active = within_cycle(weekly.get(asin, []), cycle["second_start"], CUTOFF)
            second_end: date | str = CUTOFF
        else:
            second_sales, second_active, second_end = Decimal(0), 0, ""
        item: dict[str, Any] = {
            "asin": asin, "developer": record["developer"], "sku": " | ".join(sorted(record["skus"])), "q1": q1, "q2": q2, "allocation": allocation,
            "first_start": cycle["first_start"], "first_source": cycle["first_source"], "first_end": cycle["first_end"],
            "first_sales": first_sales, "first_active_weeks": first_active, "zero_week": cycle["zero_week"],
            "second_start": cycle["second_start"], "second_state": cycle["state"], "second_end": second_end,
            "second_sales": second_sales, "second_active_weeks": second_active,
        }
        for currency in ("GBP", "EUR"):
            values = finance.get((asin, currency), [])
            item[f"first_{currency.lower()}"] = finance_in_cycle(values, cycle["first_start"], cycle["first_end"])
            item[f"second_{currency.lower()}"] = finance_in_cycle(values, cycle["second_start"], CUTOFF) if cycle["second_start"] else ""
        rows.append(item)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    gbp_file, eur_file = write_currency(rows, "GBP"), write_currency(rows, "EUR")
    states = Counter(str(row["second_state"]) for row in rows)
    q1_count = sum(row["q1"] != "" for row in rows)
    q1_average = sum((dec(row["q1"]) for row in rows if row["q1"] != ""), Decimal(0)) / q1_count if q1_count else Decimal(0)
    lines = [
        "# 2026-04 ASIN 上架批次：周级 FBA 首批/二批周期（第二版模型）",
        "",
        "## 模型口径",
        "",
        "- ASIN 范围：正式基础表中 `模型分析起算月=2026-04` 的 725 个 ASIN。",
        "- Q1/Q2：已完成采购计划的第一/第二笔计划量；SKU 多 ASIN 时等额分摊。",
        "- 首批周期：周表中首次 `FBA可售>0` 的周开始。无周级 FBA 时保留创建时间兜底。",
        "- 二批候选：出现明确 `FBA可售=0` 后，下一次 `FBA可售>0` 的周开始。连续有货不判二批。",
        "- 周级 FBA 数据仅用于经营周期；财务板块“利润统计-ASIN”接口返回的逐日 `gross_profit` 按每个 ASIN 的实际周期累计。",
        "",
        "## 数据覆盖与识别结果",
        "",
        f"- 周表查询覆盖：{min_week or '无'} 至 {max_week or '无'}。",
        f"- 有 Q1 计划的 ASIN：{q1_count:,}；Q1 计划平均单量：{q1_average:,.2f}。",
        "",
        "| FBA 周级识别状态 | ASIN 数 |",
        "|---|---:|",
    ]
    for state, count in sorted(states.items()):
        lines.append(f"| {state} | {count:,} |")
    for currency in ("GBP", "EUR"):
        first_values = [row[f"first_{currency.lower()}"] for row in rows if row[f"first_{currency.lower()}"] != ""]
        second_rows = [row for row in rows if row["second_start"]]
        second_values = [row[f"second_{currency.lower()}"] for row in second_rows if row[f"second_{currency.lower()}"] != ""]
        def metric_summary(values: list[dict[str, Decimal]]) -> dict[str, Decimal | int]:
            profits = [item["profit"] for item in values]
            losses = [item for item in profits if item < 0]
            gains = [item for item in profits if item > 0]
            return {
                "count": len(values), "quantity": sum((item["quantity"] for item in values), Decimal(0)), "sales": sum((item["sales"] for item in values), Decimal(0)), "ads": sum((item["ads"] for item in values), Decimal(0)), "cost": sum((item["cost"] for item in values), Decimal(0)), "other": sum((settlement_adjustment(item) for item in values), Decimal(0)),
                "loss_count": len(losses), "loss_amount": sum(losses, Decimal(0)), "gain_count": len(gains), "gain_amount": sum(gains, Decimal(0)), "balanced_count": sum(item == 0 for item in profits), "profit": sum(profits, Decimal(0)),
            }
        first_summary, second_summary = metric_summary(first_values), metric_summary(second_values)
        lines += [
            "",
            f"## {currency}：按 FBA 周期汇总",
            "",
            "| FBA周期 | 有财务记录 ASIN数 | 财务销量 | 销售额 | 广告费支出 | 财务总成本支出 | 其他结算支出/调整 | 亏损ASIN数 | 亏损金额 | 盈利ASIN数 | 盈利金额 | 持平ASIN数 | 领星结算毛利润 |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
            f"| 首批FBA周期 | {first_summary['count']:,} | {first_summary['quantity']:,.2f} | {currency} {first_summary['sales']:,.2f} | {currency} {expense(first_summary['ads']):,.2f} | {currency} {expense(first_summary['cost']):,.2f} | {currency} {expense(first_summary['other']):,.2f} | {first_summary['loss_count']:,} | {currency} {expense(first_summary['loss_amount']):,.2f} | {first_summary['gain_count']:,} | {currency} {first_summary['gain_amount']:,.2f} | {first_summary['balanced_count']:,} | {currency} {first_summary['profit']:,.2f} |",
            f"| 二批FBA候选周期 | {second_summary['count']:,} | {second_summary['quantity']:,.2f} | {currency} {second_summary['sales']:,.2f} | {currency} {expense(second_summary['ads']):,.2f} | {currency} {expense(second_summary['cost']):,.2f} | {currency} {expense(second_summary['other']):,.2f} | {second_summary['loss_count']:,} | {currency} {expense(second_summary['loss_amount']):,.2f} | {second_summary['gain_count']:,} | {currency} {second_summary['gain_amount']:,.2f} | {second_summary['balanced_count']:,} | {currency} {second_summary['profit']:,.2f} |",
            "",
            f"- 逐 ASIN 明细：`{gbp_file.name if currency == 'GBP' else eur_file.name}`。",
        ]
    lines += [
        "",
        "## 财务字段说明",
        "",
        "- 广告费支出、财务总成本支出和亏损金额按绝对值展示，便于阅读；领星原始流水中支出通常以负号记账。",
        "- 其他结算支出/调整 = 结算利润 − 销售额 − 广告费（原始符号）− 财务总成本（原始符号）；其中汇集平台费、FBA配送/仓储、退款、税费等财务表未单列展示的结算项。",
        "- 领星结算毛利润直接取财务板块的逐日 `gross_profit`，保留正负号；它只表示已售订单在该周期的结算结果，不包含未售首批库存的现金占用，因此不能称为首批资金回本或首批现金利润。",
    ]
    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(REPORT_FILE)
    print(gbp_file)
    print(eur_file)


if __name__ == "__main__":
    main()
