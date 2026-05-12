#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查特定 ASIN 在指定日期范围内的销量数据
"""
import pyarrow.parquet as pq
import pandas as pd
from datetime import datetime

# 配置
PARQUET_PATH = r"E:\project\sjzm\产品数据\压缩数据\product_data_final.parquet"
TARGET_ASIN = "B08BZLTFPX"
START_DATE = "2026-02-23"
END_DATE = "2026-03-01"

print(f"检查 ASIN: {TARGET_ASIN}")
print(f"日期范围: {START_DATE} ~ {END_DATE}")
print("=" * 60)

# 读取 Parquet 文件
parquet_file = pq.ParquetFile(PARQUET_PATH)
columns = parquet_file.schema_arrow.names
print(f"文件列名: {columns}")
print("=" * 60)

# 检查日期列名
date_col = None
for col in ['日期', 'date', 'Date', '时间', 'time']:
    if col in columns:
        date_col = col
        break

if not date_col:
    print("错误: 未找到日期列")
    exit(1)

print(f"使用日期列: {date_col}")

# 流式读取并过滤
total_sales = 0
weekly_sales = {}

for batch in parquet_file.iter_batches(batch_size=10000):
    df = batch.to_pandas()
    
    # ASIN 过滤
    if 'ASIN' not in df.columns:
        continue
    
    df = df[df['ASIN'].astype(str).str.upper() == TARGET_ASIN]
    
    if df.empty:
        continue
    
    # 显示找到的数据
    print(f"\n找到 {len(df)} 条记录:")
    for _, row in df.iterrows():
        date_val = str(row.get(date_col, ''))
        sales_val = row.get('销量', 0)
        revenue_val = row.get('销售额', 0)
        shop_val = row.get('店铺', '未知')
        
        print(f"  日期: {date_val}, 销量: {sales_val}, 销售额: {revenue_val}, 店铺: {shop_val}")
        
        # 检查日期是否在范围内
        try:
            row_date = datetime.strptime(date_val, '%Y-%m-%d')
            start_dt = datetime.strptime(START_DATE, '%Y-%m-%d')
            end_dt = datetime.strptime(END_DATE, '%Y-%m-%d')
            
            if start_dt <= row_date <= end_dt:
                total_sales += int(float(sales_val))
                
                # 按周统计
                week_start = row_date - pd.Timedelta(days=row_date.weekday())
                week_key = week_start.strftime('%Y-%m-%d')
                if week_key not in weekly_sales:
                    weekly_sales[week_key] = 0
                weekly_sales[week_key] += int(float(sales_val))
                
        except Exception as e:
            print(f"  日期解析错误: {e}")

print("\n" + "=" * 60)
print(f"指定日期范围内总销量: {total_sales}")
print("\n按周统计:")
for week, sales in sorted(weekly_sales.items()):
    print(f"  周开始 {week}: {sales} 销量")
