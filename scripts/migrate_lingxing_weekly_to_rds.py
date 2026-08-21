from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Iterable

import pymysql


ROOT = Path(__file__).resolve().parents[1]

TABLES = (
    "lingxing_seller",
    "lingxing_local_product",
    "lingxing_product_performance",
    "lingxing_sku_weekly_performance",
    "lingxing_target_sku_pool",
    "lingxing_listing",
    "lingxing_product_unified",
    "lingxing_developer_sku_prefix",
    "lingxing_data_sync_run",
    "lingxing_asin_monthly_performance",
    "lingxing_profit_asin",
    "lingxing_developer_fba",
    "lingxing_listing_fba_fee",
    "lingxing_fba_fee_compare",
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


def local_config() -> dict:
    public = read_env(ROOT / "config/public/prod.env")
    secret = read_env(ROOT / "config/secrets/prod.env")
    return {
        "host": "127.0.0.1",
        "port": int(public.get("MYSQL_PORT_EXTERNAL", "3310")),
        "user": public.get("MYSQL_USER", "sijue"),
        "password": secret["MYSQL_PASSWORD"],
        "database": public.get("MYSQL_DATABASE", "sijuelishi"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.SSCursor,
        "autocommit": True,
    }


def rds_config() -> dict:
    values = read_env(ROOT / "config/secrets/finance_rds.env")
    values.update({k: v for k, v in os.environ.items() if k.startswith("FINANCE_RDS_")})
    return {
        "host": values["FINANCE_RDS_HOST"],
        "port": int(values.get("FINANCE_RDS_PORT", "3306")),
        "user": values["FINANCE_RDS_USER"],
        "password": values["FINANCE_RDS_PASSWORD"],
        "database": values.get("FINANCE_RDS_DATABASE", "sijuelishi"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.Cursor,
        "autocommit": False,
    }


def table_columns(connection, table: str) -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = %s
            ORDER BY ordinal_position
            """,
            (table,),
        )
        return [row[0] for row in cursor.fetchall()]


def count_rows(connection, table: str) -> int:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
        return int(cursor.fetchone()[0])


def chunks(rows: Iterable[tuple], size: int) -> Iterable[list[tuple]]:
    batch: list[tuple] = []
    for row in rows:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def migrate_table(local, rds, table: str, batch_size: int) -> dict:
    source_columns = table_columns(local, table)
    target_columns = table_columns(rds, table)
    if not source_columns or source_columns != target_columns:
        raise RuntimeError(
            f"schema mismatch: {table}, local={len(source_columns)}, rds={len(target_columns)}"
        )

    quoted = ",".join(f"`{column}`" for column in source_columns)
    placeholders = ",".join(["%s"] * len(source_columns))
    updates = ",".join(
        f"`{column}`=VALUES(`{column}`)" for column in source_columns if column != "id"
    )
    sql = (
        f"INSERT INTO `{table}` ({quoted}) VALUES ({placeholders}) "
        f"ON DUPLICATE KEY UPDATE {updates}"
    )

    source_count = count_rows(local, table)
    started = time.monotonic()
    written = 0
    with local.cursor() as source:
        source.execute(f"SELECT {quoted} FROM `{table}` ORDER BY 1")
        for batch in chunks(source, batch_size):
            with rds.cursor() as target:
                target.executemany(sql, batch)
            rds.commit()
            written += len(batch)
            if written % max(batch_size * 20, 1) == 0 or written == source_count:
                print(json.dumps({
                    "event": "progress",
                    "table": table,
                    "written": written,
                    "source": source_count,
                    "elapsedSeconds": round(time.monotonic() - started, 2),
                }))

    target_count = count_rows(rds, table)
    return {
        "table": table,
        "sourceRows": source_count,
        "writtenRows": written,
        "targetRows": target_count,
        "elapsedSeconds": round(time.monotonic() - started, 2),
        "verified": target_count >= source_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tables", nargs="*", choices=TABLES, default=list(TABLES))
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()

    results = []
    with pymysql.connect(**local_config()) as local, pymysql.connect(**rds_config()) as rds:
        for table in args.tables:
            if args.verify_only:
                source = count_rows(local, table)
                target = count_rows(rds, table)
                results.append({
                    "table": table,
                    "sourceRows": source,
                    "targetRows": target,
                    "verified": target >= source,
                })
            else:
                results.append(migrate_table(local, rds, table, max(1, args.batch_size)))
                print(json.dumps({"event": "tableComplete", **results[-1]}))

    print(json.dumps({"event": "complete", "results": results}))


if __name__ == "__main__":
    main()
