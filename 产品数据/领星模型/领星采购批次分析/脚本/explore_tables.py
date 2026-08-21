# -*- coding: utf-8 -*-
"""
领星表结构探索工具

用途: 查看领星相关表的结构、字段、样本数据, 理解数据口径
用法: python explore_tables.py [表名]
      不带参数列出所有领星表; 带表名显示该表字段+样本
"""
import sys
from query_database import q

LINGXING_TABLES = [
    "lingxing_purchase_plan",      # 采购计划(PPG批次, 决策层)
    "lingxing_purchase_order",     # 采购单(PO, 执行层, 已弃用做批次)
    "lingxing_purchase_order_item",# 采购单明细
    "lingxing_local_product",      # 本地产品(SKU基本信息)
    "lingxing_listing",            # Listing(SKU→ASIN映射)
    "lingxing_sku_weekly_performance",  # 周表(每周销售/毛利)
    "lingxing_profit_asin",        # 利润-ASIN(逐日, 覆盖差)
]


def show_structure(table):
    print(f"\n=== {table} 字段结构 ===")
    for row in q(f"SHOW COLUMNS FROM `{table}`"):
        print(f"  {row[0]:<40} {row[1]:<20} key={row[3]}")
    print(f"\n=== {table} 样本(前5行) ===")
    for row in q(f"SELECT * FROM `{table}` LIMIT 5"):
        print(f"  {row}")


def show_tables():
    print("=== 领星相关表 ===")
    all_tables = [t[0] for t in q("SHOW TABLES")]
    for t in LINGXING_TABLES:
        exists = "✓" if t in all_tables else "✗"
        print(f"  {exists} {t}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        show_structure(sys.argv[1])
    else:
        show_tables()
        print("\n用法: python explore_tables.py lingxing_purchase_plan")
