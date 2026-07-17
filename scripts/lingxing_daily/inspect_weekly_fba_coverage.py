#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Inspect actual coverage of weekly FBA performance facts."""

import pymysql

from build_sku_q1_first_batch_model_test import mysql_env


def main() -> None:
    overall = """
        SELECT MIN(week_start), MAX(week_end), COUNT(*), COUNT(DISTINCT asin), COUNT(DISTINCT sku)
        FROM lingxing_sku_weekly_performance
    """
    monthly = """
        SELECT `year_month`, MIN(week_start), MAX(week_end), COUNT(*),
               COUNT(DISTINCT asin), COUNT(DISTINCT sku),
               SUM(CASE WHEN COALESCE(afn_fulfillable_quantity, 0) > 0 THEN 1 ELSE 0 END)
        FROM lingxing_sku_weekly_performance
        GROUP BY `year_month`
        ORDER BY `year_month`
    """
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(overall)
            print("overall\t" + "\t".join(str(value) for value in cursor.fetchone()))
            cursor.execute(monthly)
            print("month\tmin_week\tmax_week\trows\tasins\tskus\tfba_positive_rows")
            for row in cursor.fetchall():
                print("\t".join(str(value) for value in row))


if __name__ == "__main__":
    main()
