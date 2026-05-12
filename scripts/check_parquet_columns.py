#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查Parquet文件中的所有列名，寻找利润、广告、退款相关字段
"""
import pyarrow.parquet as pq

PARQUET_PATH = r"E:\project\sjzm\产品数据\压缩数据\product_data_final.parquet"

print("正在检查Parquet文件列名...")
print("=" * 80)

parquet_file = pq.ParquetFile(PARQUET_PATH)
columns = parquet_file.schema_arrow.names

print(f"\n总共有 {len(columns)} 个列:\n")

# 分类显示
sales_cols = [c for c in columns if any(k in c.lower() for k in ['销量', '销售', '订单', '订单量', '销售额', 'revenue', 'sales', 'orders'])]
profit_cols = [c for c in columns if any(k in c.lower() for k in ['利润', '毛利', '结算', 'profit', 'margin', 'gross'])]
ad_cols = [c for c in columns if any(k in c.lower() for k in ['广告', 'ad', 'acos', 'roas', 'spend'])]
refund_cols = [c for c in columns if any(k in c.lower() for k in ['退款', '退货', 'refund', 'return'])]
other_cols = [c for c in columns if c not in sales_cols + profit_cols + ad_cols + refund_cols]

print("【销售相关】")
for c in sales_cols:
    print(f"  - {c}")

print("\n【利润相关】")
for c in profit_cols:
    print(f"  - {c}")

print("\n【广告相关】")
for c in ad_cols:
    print(f"  - {c}")

print("\n【退款相关】")
for c in refund_cols:
    print(f"  - {c}")

print("\n【其他列】")
for i, c in enumerate(other_cols):
    print(f"  - {c}")
