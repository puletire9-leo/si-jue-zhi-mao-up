"""Find team SKUs with financial losses but no current local product detail."""

from __future__ import annotations

import os
import argparse
from pathlib import Path

import pymysql


ROOT = Path(__file__).resolve().parents[2]
SECRETS_FILE = ROOT / "config" / "secrets" / "dev.env"
TARGET_PREFIX_PATTERN = "^(225|252|253|254|265|255|256|258|259|260|257|261|262|263|630|264|266)[0-9]+$"
REFERENCE_SKU_QUERIES = {
    "product-performance-latest": """
        SELECT DISTINCT sku
        FROM lingxing_product_performance
        WHERE end_date = (SELECT MAX(end_date) FROM lingxing_product_performance)
          AND sku IS NOT NULL AND sku <> ''
    """,
    "product-performance-any": """
        SELECT DISTINCT sku
        FROM lingxing_product_performance
        WHERE sku IS NOT NULL AND sku <> ''
    """,
    "local-product": """
        SELECT DISTINCT sku
        FROM lingxing_local_product
        WHERE sku IS NOT NULL AND sku <> ''
    """,
}


def secret_value(key: str) -> str:
    value = os.getenv(key)
    if value:
        return value
    for line in SECRETS_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    raise RuntimeError(f"Missing {key} in environment and {SECRETS_FILE}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", choices=REFERENCE_SKU_QUERIES, default="product-performance-latest")
    args = parser.parse_args()
    reference_skus = REFERENCE_SKU_QUERIES[args.reference]
    connection = pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "13338")),
        user=os.getenv("MYSQL_USERNAME", "sijue"),
        password=secret_value("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE", "sijuelishi_dev"),
        charset="utf8mb4",
    )
    query = """
        SELECT
            p.local_sku,
            p.currency_code,
            MIN(p.data_date) AS first_date,
            MAX(p.data_date) AS last_date,
            COUNT(*) AS days,
            SUM(COALESCE(p.total_sales_quantity, 0)) AS sales_qty,
            ROUND(SUM(COALESCE(p.total_sales_amount, 0)), 2) AS sales_amount,
            ROUND(SUM(COALESCE(p.total_ads_cost, 0)), 2) AS ads_cost,
            ROUND(SUM(COALESCE(p.total_cost, 0)), 2) AS total_cost,
            ROUND(SUM(COALESCE(p.gross_profit, 0)), 2) AS gross_profit,
            SUM(CASE WHEN COALESCE(p.gross_profit, 0) > 0 THEN 1 ELSE 0 END) AS profit_days
        FROM lingxing_profit_asin p
        WHERE p.data_date BETWEEN '2026-01-01' AND '2026-07-12'
          AND p.local_sku REGEXP %s
          AND NOT EXISTS (
              SELECT 1 FROM (__REFERENCE_SKUS__) current_product
              WHERE current_product.sku = p.local_sku
          )
        GROUP BY p.local_sku, p.currency_code
        HAVING SUM(COALESCE(p.gross_profit, 0)) < 0
           AND SUM(CASE WHEN COALESCE(p.gross_profit, 0) > 0 THEN 1 ELSE 0 END) = 0
        ORDER BY SUM(COALESCE(p.gross_profit, 0)) ASC
    """.replace("__REFERENCE_SKUS__", reference_skus)
    summary_query = """
        SELECT
            COUNT(*) AS missing_detail_sku_currency_rows,
            SUM(CASE WHEN gross_profit < 0 THEN 1 ELSE 0 END) AS net_loss_rows,
            SUM(CASE WHEN gross_profit < 0 AND profit_days = 0 THEN 1 ELSE 0 END) AS only_loss_rows
        FROM (
            SELECT
                p.local_sku,
                p.currency_code,
                SUM(COALESCE(p.gross_profit, 0)) AS gross_profit,
                SUM(CASE WHEN COALESCE(p.gross_profit, 0) > 0 THEN 1 ELSE 0 END) AS profit_days
            FROM lingxing_profit_asin p
            WHERE p.data_date BETWEEN '2026-01-01' AND '2026-07-12'
              AND p.local_sku REGEXP %s
              AND NOT EXISTS (
                  SELECT 1 FROM (__REFERENCE_SKUS__) current_product
                  WHERE current_product.sku = p.local_sku
              )
            GROUP BY p.local_sku, p.currency_code
        ) candidates
    """.replace("__REFERENCE_SKUS__", reference_skus)
    missing_detail_query = """
        SELECT
            p.local_sku,
            p.currency_code,
            MIN(p.data_date) AS first_date,
            MAX(p.data_date) AS last_date,
            COUNT(*) AS days,
            SUM(COALESCE(p.total_sales_quantity, 0)) AS sales_qty,
            ROUND(SUM(COALESCE(p.total_sales_amount, 0)), 2) AS sales_amount,
            ROUND(SUM(COALESCE(p.total_ads_cost, 0)), 2) AS ads_cost,
            ROUND(SUM(COALESCE(p.total_cost, 0)), 2) AS total_cost,
            ROUND(SUM(COALESCE(p.gross_profit, 0)), 2) AS gross_profit,
            SUM(CASE WHEN COALESCE(p.gross_profit, 0) > 0 THEN 1 ELSE 0 END) AS profit_days
        FROM lingxing_profit_asin p
        WHERE p.data_date BETWEEN '2026-01-01' AND '2026-07-12'
          AND p.local_sku REGEXP %s
          AND NOT EXISTS (
              SELECT 1 FROM (__REFERENCE_SKUS__) current_product
              WHERE current_product.sku = p.local_sku
          )
        GROUP BY p.local_sku, p.currency_code
        ORDER BY SUM(COALESCE(p.gross_profit, 0)) ASC
    """.replace("__REFERENCE_SKUS__", reference_skus)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*), MAX(end_date) FROM lingxing_product_performance")
            performance_count, performance_end_date = cursor.fetchone()
            cursor.execute(summary_query, (TARGET_PREFIX_PATTERN,))
            missing_detail_rows, net_loss_rows, only_loss_rows = cursor.fetchone()
            cursor.execute(missing_detail_query, (TARGET_PREFIX_PATTERN,))
            missing_detail_rows_data = cursor.fetchall()
            cursor.execute(query, (TARGET_PREFIX_PATTERN,))
            rows = cursor.fetchall()
    finally:
        connection.close()

    print(f"reference={args.reference}")
    print(f"product_performance_rows={performance_count} latest_end_date={performance_end_date}")
    print(f"missing_detail_sku_currency_rows={missing_detail_rows}")
    print(f"net_loss_missing_current_product={net_loss_rows}")
    print(f"only_loss_missing_current_product={len(rows)}")
    print("missing_detail_skus")
    for row in missing_detail_rows_data:
        print("\t".join(str(value) for value in row))
    print("sku\tcurrency\tfirst_date\tlast_date\tdays\tsales_qty\tsales_amount\tads_cost\ttotal_cost\tgross_profit\tprofit_days")
    for row in rows:
        print("\t".join(str(value) for value in row))


if __name__ == "__main__":
    main()
