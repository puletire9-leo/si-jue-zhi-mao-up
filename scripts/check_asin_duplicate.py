#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查 ASIN 数据是否有重复（按日期和店铺分组）
"""
import pyarrow.parquet as pq
import pandas as pd
from datetime import datetime
from collections import defaultdict

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

# 收集所有数据
all_data = []

for batch in parquet_file.iter_batches(batch_size=10000):
    df = batch.to_pandas()
    
    if 'ASIN' not in df.columns:
        continue
    
    # ASIN 过滤
    df = df[df['ASIN'].astype(str).str.upper() == TARGET_ASIN]
    
    if df.empty:
        continue
    
    all_data.append(df)

if not all_data:
    print("未找到数据")
    exit(0)

# 合并所有数据
full_df = pd.concat(all_data, ignore_index=True)

print(f"总共 {len(full_df)} 条记录")
print("\n数据列:", full_df.columns.tolist())
print("\n前10条数据:")
print(full_df.head(10).to_string())

# 按日期统计
print("\n" + "=" * 60)
print("按日期统计（原始数据）:")
date_stats = full_df.groupby('日期').agg({
    '销量': 'sum',
    '销售额': 'sum',
    '店铺': lambda x: list(x.unique())
}).reset_index()

for _, row in date_stats.iterrows():
    date_val = row['日期']
    sales = row['销量']
    revenue = row['销售额']
    shops = row['店铺']
    
    # 检查日期是否在范围内
    try:
        row_date = datetime.strptime(str(date_val), '%Y-%m-%d')
        start_dt = datetime.strptime(START_DATE, '%Y-%m-%d')
        end_dt = datetime.strptime(END_DATE, '%Y-%m-%d')
        
        if start_dt <= row_date <= end_dt:
            print(f"  {date_val}: 销量={sales}, 销售额={revenue}, 店铺={shops}")
    except:
        pass

# 按日期和店铺分组，检查重复
print("\n" + "=" * 60)
print("按日期和店铺详细统计:")
detail_stats = full_df.groupby(['日期', '店铺']).agg({
    '销量': ['count', 'sum'],
    '销售额': 'sum'
}).reset_index()
detail_stats.columns = ['日期', '店铺', '记录数', '总销量', '总销售额']

for _, row in detail_stats.iterrows():
    date_val = row['日期']
    shop = row['店铺']
    count = row['记录数']
    sales = row['总销量']
    revenue = row['总销售额']
    
    try:
        row_date = datetime.strptime(str(date_val), '%Y-%m-%d')
        start_dt = datetime.strptime(START_DATE, '%Y-%m-%d')
        end_dt = datetime.strptime(END_DATE, '%Y-%m-%d')
        
        if start_dt <= row_date <= end_dt:
            if count > 1:
                print(f"  ⚠️ {date_val} [{shop}]: {count}条记录, 销量={sales}, 销售额={revenue}")
            else:
                print(f"  {date_val} [{shop}]: 销量={sales}, 销售额={revenue}")
    except:
        pass

# 计算正确的总销量（去重后）
print("\n" + "=" * 60)
print("按店铺去重后的销量统计:")
for shop in full_df['店铺'].unique():
    shop_df = full_df[full_df['店铺'] == shop]
    
    # 过滤日期范围
    shop_df = shop_df[
        (shop_df['日期'] >= START_DATE) & 
        (shop_df['日期'] <= END_DATE)
    ]
    
    if len(shop_df) > 0:
        total_sales = shop_df['销量'].sum()
        print(f"  {shop}: {total_sales} 销量")
