#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Inspect one SKU across Lingxing purchase-plan and purchase-order facts."""

from __future__ import annotations

import sys

import pymysql

from build_sku_q1_first_batch_model_test import mysql_env


def print_rows(title: str, headers: list[str], rows: list[tuple[object, ...]]) -> None:
    print(title)
    print("\t".join(headers))
    for row in rows:
        print("\t".join("" if value is None else str(value) for value in row))


def main() -> None:
    sku = sys.argv[1] if len(sys.argv) > 1 else "2600461"
    plans_sql = """
        SELECT plan_sn, ppg_sn, status, status_text, sku, quantity_plan,
               create_time, expect_arrive_time, sid, warehouse_name, purchaser_name
        FROM lingxing_purchase_plan
        WHERE sku = %s
        ORDER BY create_time, plan_sn
    """
    orders_sql = """
        SELECT i.order_sn, i.plan_sn, i.sku, i.quantity_plan, i.quantity_real,
               i.quantity_entry, i.quantity_receive, i.is_delete,
               COALESCE(o.order_time, o.create_time), o.status, o.status_text,
               o.status_shipped, o.status_shipped_text, o.purchase_currency
        FROM lingxing_purchase_order_item i
        LEFT JOIN lingxing_purchase_order o ON o.order_sn = i.order_sn
        WHERE i.sku = %s
        ORDER BY COALESCE(o.order_time, o.create_time), i.order_sn, i.item_id
    """
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*), MIN(create_time), MAX(create_time) FROM lingxing_purchase_plan")
            plan_count, plan_min, plan_max = cursor.fetchone()
            cursor.execute("SELECT COUNT(*), MIN(COALESCE(order_time, create_time)), MAX(COALESCE(order_time, create_time)) FROM lingxing_purchase_order")
            order_count, order_min, order_max = cursor.fetchone()
            cursor.execute(plans_sql, (sku,))
            plans = cursor.fetchall()
            cursor.execute(orders_sql, (sku,))
            orders = cursor.fetchall()
    print(f"SKU={sku}")
    print(f"采购计划表总量={plan_count}，创建时间范围={plan_min} 至 {plan_max}")
    print(f"采购单表总量={order_count}，采购时间范围={order_min} 至 {order_max}")
    print_rows("采购计划", ["计划单号", "计划批次", "状态", "状态文本", "SKU", "计划量", "创建时间", "预计到货", "SID", "仓库", "采购员"], plans)
    print_rows("采购单", ["采购单号", "关联计划", "SKU", "计划量", "实际采购量", "实际入库量", "待到货量", "已删除", "采购时间", "采购状态", "采购状态文本", "到货状态", "到货状态文本", "采购币种"], orders)


if __name__ == "__main__":
    main()
