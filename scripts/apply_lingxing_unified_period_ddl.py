#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create lingxing_product_unified_period on RDS without renaming the live daily table.

Old Java still reads lingxing_product_unified_daily during image build. Creating the
new table first keeps the running containers alive until deploy_prod recreates them.
"""
from __future__ import annotations

from pathlib import Path

import pymysql

from config_env import load_project_env

ROOT = Path(__file__).resolve().parents[1]
CREATE_SQL = ROOT / "java-backend/sql/create_lingxing_product_unified_period.sql"


def rds_config() -> dict:
    values = load_project_env()
    host = values.get("RDS_HOST") or values.get("FINANCE_RDS_HOST") or ""
    user = values.get("RDS_USERNAME") or values.get("FINANCE_RDS_USER") or ""
    password = values.get("RDS_PASSWORD") or values.get("FINANCE_RDS_PASSWORD") or ""
    if not host or not user or not password:
        raise RuntimeError("缺少 RDS_HOST / RDS_USERNAME / RDS_PASSWORD")
    return {
        "host": host,
        "port": int(values.get("RDS_PORT") or values.get("FINANCE_RDS_PORT") or "3306"),
        "user": user,
        "password": password,
        "database": values.get("RDS_DATABASE") or values.get("FINANCE_RDS_DATABASE") or "sijuelishi",
        "charset": "utf8mb4",
        "autocommit": True,
    }


def table_names(connection) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_name IN (
                    'lingxing_product_unified_period',
                    'lingxing_product_unified_daily'
              )
            """
        )
        return {row[0] for row in cursor.fetchall()}


def column_names(connection, table: str) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = %s
            """,
            (table,),
        )
        return {row[0] for row in cursor.fetchall()}


def main() -> None:
    sql = CREATE_SQL.read_text(encoding="utf-8")
    connection = pymysql.connect(**rds_config())
    try:
        names = table_names(connection)
        if "lingxing_product_unified_period" in names:
            columns = column_names(connection, "lingxing_product_unified_period")
            if "period_start" in columns and "period_end" in columns:
                print("ok period table already present")
                if "lingxing_product_unified_daily" in names:
                    print("note leftover table lingxing_product_unified_daily still exists")
                return
            raise RuntimeError("lingxing_product_unified_period exists but missing period_start/period_end")
        with connection.cursor() as cursor:
            for statement in sql.split(";"):
                text = statement.strip()
                if text:
                    cursor.execute(text)
        print("ok created lingxing_product_unified_period")
        if "lingxing_product_unified_daily" in names:
            print("note leftover table lingxing_product_unified_daily still exists")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
