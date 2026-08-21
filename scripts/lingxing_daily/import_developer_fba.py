#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导入理实产品开发表 CSV 到 lingxing_developer_fba（开发人预测 FBA 配送费）。

数据源：产品数据/产品表/理实产品开发表/理实产品开发表_英德.csv
    列：国家, SKU, 开发备注, 开发计算的FBA配送费($), 开发计算的利润率(%), 开发人预估售价($), 来源文件
    同 SKU+国家 跨月多条（增量/全量快照），去重取"最新"（来源文件名靠后=月份更新）。

用法：
    python scripts/lingxing_daily/import_developer_fba.py

数据库连接复用 lingxing_base_access.mysql_env()。
"""

from __future__ import annotations

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path
import sys

import pymysql

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lingxing_base_access import mysql_env
from lingxing_model_paths import ROOT

CSV_DIR = ROOT / "产品数据" / "产品表" / "理实产品开发表"
UNIFIED_CSV = CSV_DIR / "理实产品开发表_英德.csv"
COUNTRY_MAP = {"英国": "UK", "UK": "UK", "德国": "DE", "DE": "DE"}


def to_decimal(v):
    s = str(v or "").strip()
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def load_csv(path: Path) -> dict[tuple[str, str], dict]:
    """读统一 CSV，按 (SKU, 国家) 去重取最新（来源文件名字典序最大＝月份靠后）。"""
    latest: dict[tuple[str, str], dict] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = str(row.get("SKU") or "").strip()
            country = COUNTRY_MAP.get(str(row.get("国家") or "").strip(), "")
            if not sku or country not in ("UK", "DE"):
                continue
            source = str(row.get("来源文件") or "")
            key = (sku, country)
            if key in latest and source <= latest[key]["source_file"]:
                continue
            latest[key] = {
                "sku": sku,
                "country": country,
                "dev_remark": (str(row.get("开发备注") or "").strip() or None),
                "dev_fba_fee": to_decimal(row.get("开发计算的FBA配送费($)")),
                "dev_profit_rate": to_decimal(row.get("开发计算的利润率(%)")),
                "dev_price": to_decimal(row.get("开发人预估售价($)")),
                "source_file": source,
            }
    return latest


def sql_str(v) -> str:
    """转 SQL 字面量：None→NULL，字符串转义单引号，数字原样。"""
    if v is None:
        return "NULL"
    if isinstance(v, Decimal):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"


def main():
    """默认连库导入；传 --sql <路径> 则只生成 SQL 文件（绕开宿主机连库问题，用 docker exec 导入）。"""
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--sql", type=str, help="只生成 SQL 文件到此路径，不连库")
    args = parser.parse_args()

    all_rows: list[dict] = []
    if not UNIFIED_CSV.exists():
        print(f"[WARN] 文件不存在，跳过: {UNIFIED_CSV}")
    else:
        rows = load_csv(UNIFIED_CSV)
        uk = sum(1 for r in rows.values() if r["country"] == "UK")
        de = sum(1 for r in rows.values() if r["country"] == "DE")
        print(f"{UNIFIED_CSV.name}: 去重后 {len(rows)} 个 SKU（UK={uk}, DE={de}）")
        all_rows.extend(rows.values())

    if args.sql:
        # 生成 SQL 文件模式
        lines = ["SET NAMES utf8mb4;", "TRUNCATE TABLE lingxing_developer_fba;"]
        for r in all_rows:
            lines.append(
                "INSERT INTO lingxing_developer_fba "
                "(sku, country, dev_remark, dev_fba_fee, dev_profit_rate, dev_price, source_file) VALUES ("
                + ", ".join([
                    sql_str(r["sku"]), sql_str(r["country"]), sql_str(r["dev_remark"]),
                    sql_str(r["dev_fba_fee"]), sql_str(r["dev_profit_rate"]), sql_str(r.get("dev_price")),
                    sql_str(r["source_file"]),
                ]) + ");"
            )
        Path(args.sql).write_text("\n".join(lines), encoding="utf-8")
        print(f"完成：生成 SQL {len(all_rows)} 行 → {args.sql}")
        return

    conn = pymysql.connect(**mysql_env())
    try:
        with conn.cursor() as cur:
            for r in all_rows:
                cur.execute(
                    """
                    INSERT INTO lingxing_developer_fba
                      (sku, country, dev_remark, dev_fba_fee, dev_profit_rate, dev_price, source_file)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                      dev_remark=VALUES(dev_remark),
                      dev_fba_fee=VALUES(dev_fba_fee),
                      dev_profit_rate=VALUES(dev_profit_rate),
                      dev_price=VALUES(dev_price),
                      source_file=VALUES(source_file),
                      imported_at=CURRENT_TIMESTAMP
                    """,
                    (r["sku"], r["country"], r["dev_remark"],
                     r["dev_fba_fee"], r["dev_profit_rate"], r.get("dev_price"),
                     r["source_file"]),
                )
        conn.commit()
        print(f"完成：共 upsert {len(all_rows)} 行到 lingxing_developer_fba")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
