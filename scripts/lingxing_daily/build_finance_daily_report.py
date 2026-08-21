#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the finance daily report from remote daily facts and local history.

Sources:
- Remote RDS: lingxing_product_performance_daily for the target date.
- Local production MySQL: completed weekly history through the prior Sunday and
  lingxing_product_unified metadata.
- A positive-sales ASIN artifact for the gap between that Sunday and target-1.

The output is a Feishu-ready long table keyed by 日期 + 维度 + 维度值.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import pymysql

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
TEAM_DEVELOPERS = ("蒋舒", "陈杨", "宋凤莉", "刘淼", "龙梦临", "周沁仪", "黄雨珊", "夏浩宇")
OPERATORS = ("阳姣", "张奋奋", "尹心如", "余江燕", "李微微")
METRICS = (
    "淘汰SKU", "季节性SKU", "SKU总数量", "动销90天SKU", "未上架SKU", "断货SKU",
    "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额",
    "广告花费", "可用库存", "退款金额",
)


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#") and "=" in text:
            key, value = text.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def local_mysql_config() -> dict[str, Any]:
    values = read_env(ROOT / "config" / "public" / "prod.env")
    values.update(read_env(ROOT / "config" / "secrets" / "prod.env"))
    return {
        "host": os.getenv("FINANCE_LOCAL_DB_HOST", "127.0.0.1"),
        "port": int(os.getenv("FINANCE_LOCAL_DB_PORT", "3310")),
        "user": os.getenv("FINANCE_LOCAL_DB_USER", values.get("MYSQL_USERNAME", "sijue")),
        "password": os.getenv("FINANCE_LOCAL_DB_PASSWORD", values["MYSQL_PASSWORD"]),
        "database": os.getenv("FINANCE_LOCAL_DB_NAME", "sijuelishi"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def remote_mysql_config() -> dict[str, Any]:
    values = read_env(ROOT / "config" / "secrets" / "finance_rds.env")
    values.update({key: value for key, value in os.environ.items() if key.startswith("FINANCE_RDS_")})
    required = {
        "host": values.get("FINANCE_RDS_HOST"),
        "user": values.get("FINANCE_RDS_USER"),
        "password": values.get("FINANCE_RDS_PASSWORD"),
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"Missing remote RDS environment variables: {', '.join(missing)}")
    return {
        **required,
        "port": int(values.get("FINANCE_RDS_PORT", "3306")),
        "database": values.get("FINANCE_RDS_DATABASE", "sijuelishi"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
    }


def decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)


def integer(value: Any) -> int:
    return int(decimal(value))


def split_names(value: Any) -> set[str]:
    return {part.strip() for part in str(value or "").replace("，", ",").split(",") if part.strip()}


def parse_date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def choose_owner(remote_value: Any, local_value: Any, allowed: tuple[str, ...]) -> str | None:
    allowed_set = set(allowed)
    local = split_names(local_value) & allowed_set
    if len(local) == 1:
        return next(iter(local))
    remote = split_names(remote_value) & allowed_set
    return next(iter(remote)) if len(remote) == 1 else None


def load_daily(target: date) -> list[dict[str, Any]]:
    sql = """
        SELECT asin, currency_code, developer_names, principal_names, store_names, tag_names,
               product_create_time, volume, order_items, amount, clicks, impressions,
               ad_order_quantity, ad_sales_amount, spend, afn_fulfillable_quantity,
               available_inventory, return_amount
        FROM lingxing_product_performance_daily
        WHERE data_date=%s
    """
    with pymysql.connect(**remote_mysql_config()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, (target,))
            return list(cursor.fetchall())


def load_local_history(asins: set[str], history_cutoff: date) -> tuple[set[str], dict[str, dict[str, Any]]]:
    positive: set[str] = set()
    metadata: dict[str, dict[str, Any]] = {}
    sorted_asins = sorted(asins)
    with pymysql.connect(**local_mysql_config()) as connection:
        with connection.cursor() as cursor:
            for offset in range(0, len(sorted_asins), 1000):
                batch = sorted_asins[offset:offset + 1000]
                placeholders = ",".join(["%s"] * len(batch))
                cursor.execute(
                    f"""
                    SELECT DISTINCT asin
                    FROM lingxing_sku_weekly_performance
                    WHERE week_end <= %s AND COALESCE(volume,0) > 0
                      AND asin IN ({placeholders})
                    """,
                    [history_cutoff, *batch],
                )
                positive.update(row["asin"] for row in cursor.fetchall())
                cursor.execute(
                    f"""
                    SELECT asin, developer, principal, listing_date, product_create_time, listing_tags
                    FROM lingxing_product_unified
                    WHERE asin IN ({placeholders})
                    """,
                    batch,
                )
                for row in cursor.fetchall():
                    metadata[row["asin"]] = row
    return positive, metadata


def load_gap_positive(path: Path) -> set[str]:
    if not path.exists():
        raise RuntimeError(f"Missing gap-sales artifact: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {str(asin).strip() for asin in payload.get("asins", []) if str(asin).strip()}


def empty_metrics() -> dict[str, Decimal]:
    return {metric: Decimal(0) for metric in METRICS}


def row_metrics(row: dict[str, Any], target: date, historical_sales: bool, created: date | None) -> dict[str, Decimal]:
    fba = integer(row.get("afn_fulfillable_quantity"))
    sales = integer(row.get("volume"))
    created_by_target = created is not None and target >= created
    cumulative_positive = historical_sales or sales > 0
    out_of_stock = fba == 0 and cumulative_positive
    tags = {part.strip() for part in str(row.get("tag_names") or "").replace("，", ",").split(",") if part.strip()}
    return {
        # 参考表中“淘汰”和“待淘汰”是独立标签；飞书只输出真正的淘汰。
        "淘汰SKU": Decimal(int(any("淘汰" in tag and "待淘汰" not in tag for tag in tags))),
        "季节性SKU": Decimal(int(any("季节性" in tag for tag in tags))),
        "SKU总数量": Decimal(int(created_by_target)),
        "动销90天SKU": Decimal(int(fba > 0 and sales == 0)),
        "未上架SKU": Decimal(int(fba == 0 and not out_of_stock and created_by_target)),
        "断货SKU": Decimal(int(out_of_stock)),
        "销量": decimal(row.get("volume")),
        "订单量": decimal(row.get("order_items")),
        "销售额": decimal(row.get("amount")),
        "展示": decimal(row.get("impressions")),
        "点击": decimal(row.get("clicks")),
        "广告订单量": decimal(row.get("ad_order_quantity")),
        "广告销售额": decimal(row.get("ad_sales_amount")),
        "广告花费": decimal(row.get("spend")),
        "可用库存": decimal(row.get("available_inventory")),
        "退款金额": decimal(row.get("return_amount")),
    }


def add_metrics(target: dict[str, Decimal], source: dict[str, Decimal]) -> None:
    for metric in METRICS:
        target[metric] += source[metric]


def cell_number(value: Decimal, integer_field: bool) -> int | float:
    if integer_field:
        return int(value)
    return float(value.quantize(Decimal("0.01")))


def report_record(target: date, dimension: str, dimension_value: str, metrics: dict[str, Decimal], blank_fields: set[str] | None = None) -> dict[str, Any]:
    blank_fields = blank_fields or set()
    result: dict[str, Any] = {
        "文本": f"{target.isoformat()}|{dimension}|{dimension_value}",
        "日期": f"{target.isoformat()} 00:00",
        "维度": [dimension],
        "维度值": dimension_value,
    }
    decimal_fields = {"销售额", "广告销售额", "广告花费", "退款金额"}
    for metric in METRICS:
        if metric in blank_fields:
            continue
        result[metric] = cell_number(metrics[metric], metric not in decimal_fields)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--history-cutoff", default="2026-08-09")
    parser.add_argument("--gap-sales-json")
    args = parser.parse_args()

    target = date.fromisoformat(args.date)
    history_cutoff = date.fromisoformat(args.history_cutoff)
    gap_path = Path(args.gap_sales_json) if args.gap_sales_json else SCRIPT_DIR / f"_positive_sales_2026-08-10_2026-08-13_lishi.json"

    daily = load_daily(target)
    if not daily:
        raise RuntimeError(f"No remote daily records found for {target}")
    asins = {str(row.get("asin") or "").strip() for row in daily if row.get("asin")}
    completed_history, metadata = load_local_history(asins, history_cutoff)
    gap_positive = load_gap_positive(gap_path)
    historical_positive = completed_history | gap_positive

    total = empty_metrics()
    nonstandard = empty_metrics()
    shelf = defaultdict(empty_metrics)
    developer = defaultdict(empty_metrics)
    operator = defaultdict(empty_metrics)
    quality = Counter()

    for row in daily:
        asin = str(row.get("asin") or "").strip()
        local = metadata.get(asin, {})
        created = parse_date(row.get("product_create_time")) or parse_date(local.get("listing_date")) or parse_date(local.get("product_create_time"))
        if not created:
            quality["missing_created_date"] += 1
        if asin in metadata:
            quality["local_metadata_match"] += 1
        if asin in historical_positive:
            quality["historical_positive"] += 1
        metrics = row_metrics(row, target, asin in historical_positive, created)
        add_metrics(total, metrics)

        tags = {
            part.strip()
            for part in f"{row.get('tag_names') or ''},{local.get('listing_tags') or ''}".replace("，", ",").split(",")
            if part.strip()
        }
        if any("非标品" in tag for tag in tags):
            add_metrics(nonstandard, metrics)

        if created:
            bucket = "5月及以后上架" if created >= date(2026, 5, 1) else "5月以前上架"
            add_metrics(shelf[bucket], metrics)

        dev = choose_owner(row.get("developer_names"), local.get("developer"), TEAM_DEVELOPERS)
        if dev:
            add_metrics(developer[dev], metrics)
        else:
            quality["unassigned_developer_rows"] += 1

        owner = choose_owner(row.get("principal_names"), local.get("principal"), OPERATORS)
        if owner:
            add_metrics(operator[owner], metrics)
        else:
            quality["rows_outside_report_operators"] += 1

    records = [report_record(target, "总", "", total)]
    records.append(report_record(target, "非标品", "", nonstandard))
    for value in ("5月以前上架", "5月及以后上架"):
        records.append(report_record(target, "上架时间", value, shelf[value]))
    for value in OPERATORS:
        records.append(report_record(target, "运营", value, operator[value], {"淘汰SKU", "季节性SKU"}))
    for value in TEAM_DEVELOPERS:
        records.append(report_record(target, "开发", value, developer[value], {"淘汰SKU", "季节性SKU", "SKU总数量", "动销90天SKU", "未上架SKU", "断货SKU"}))

    output = SCRIPT_DIR / f"_finance_report_{target.isoformat()}.json"
    output.write_text(json.dumps({"create_records": records}, ensure_ascii=False, indent=2), encoding="utf-8")
    audit = {
        "target_date": target.isoformat(),
        "remote_daily_rows": len(daily),
        "distinct_asins": len(asins),
        "completed_history_cutoff": history_cutoff.isoformat(),
        "completed_history_positive_asins": len(completed_history),
        "gap_positive_asins": len(gap_positive),
        "combined_historical_positive_asins": len(historical_positive),
        "local_metadata_asins": len(metadata),
        "quality": dict(quality),
        "record_count": len(records),
        "dimension_counts": dict(Counter(record["维度"][0] for record in records)),
        "total": {metric: cell_number(value, metric not in {"销售额", "广告销售额", "广告花费", "退款金额"}) for metric, value in total.items()},
        "output": str(output),
    }
    audit_path = SCRIPT_DIR / f"_finance_report_{target.isoformat()}_audit.json"
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
