#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
检查 Parquet 文件最近时间的 10 条数据（流式读取，适合大文件）
"""

import pyarrow.parquet as pq
import pyarrow as pa
from datetime import datetime

# 文件路径
PARQUET_FILE = r"E:\project\sjzm\产品数据\压缩数据\product_data_merged.parquet"

def check_recent_data():
    """读取并显示最近时间的 10 条数据"""
    print("=" * 80)
    print("Parquet 文件数据检查")
    print("=" * 80)
    print(f"文件路径: {PARQUET_FILE}")
    print(f"检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    try:
        # 读取 Parquet 文件元数据
        parquet_file = pq.ParquetFile(PARQUET_FILE)
        total_rows = parquet_file.metadata.num_rows
        columns = parquet_file.schema_arrow.names
        
        print(f"总行数: {total_rows:,}")
        print(f"总列数: {len(columns)}")
        print("")
        
        # 查找日期/时间列
        date_columns = []
        for col in columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ['date', 'time', '日期', '时间', 'create', 'update', 'created', 'updated']):
                date_columns.append(col)
        
        print(f"检测到可能的日期列: {date_columns}")
        print("")
        
        # 确定排序列
        sort_column = None
        for col in ['日期', '创建时间', 'update_time', 'updated_at', 'date', 'time']:
            if col in columns:
                sort_column = col
                break
        
        if sort_column:
            print(f"将按 '{sort_column}' 列读取数据...")
        else:
            print("未找到日期列，将读取最后 10 条数据...")
        
        # 流式读取所有数据并收集
        print("\n正在流式读取数据...")
        all_data = []
        
        for batch in parquet_file.iter_batches(batch_size=100000):
            table = pa.Table.from_batches([batch])
            # 转换为字典列表
            batch_data = table.to_pydict()
            
            # 将每行转换为字典
            num_rows = len(list(batch_data.values())[0])
            for i in range(num_rows):
                row = {col: batch_data[col][i] for col in columns}
                all_data.append(row)
            
            print(f"  已读取 {len(all_data):,} 行...")
        
        print(f"\n总共读取 {len(all_data):,} 行")
        
        # 排序并取最近 10 条
        if sort_column and sort_column in columns:
            try:
                # 尝试按日期排序
                sorted_data = sorted(
                    all_data, 
                    key=lambda x: x.get(sort_column, ''), 
                    reverse=True
                )
                recent_data = sorted_data[:10]
                print(f"\n最近 10 条数据（按 '{sort_column}' 排序）:")
            except Exception as e:
                print(f"排序失败: {e}，显示最后 10 条")
                recent_data = all_data[-10:]
        else:
            recent_data = all_data[-10:]
            print("\n最后 10 条数据:")
        
        print("=" * 80)
        
        # 显示数据
        for idx, row in enumerate(recent_data, 1):
            print(f"\n【记录 {idx}】")
            # 优先显示重要列
            priority_cols = ['日期', 'ASIN', '父ASIN', 'MSKU', '店铺', '国家', '售价(总价)', '标题', '自动标签']
            displayed = set()
            
            for col in priority_cols:
                if col in row:
                    value = row[col]
                    if value is None or value == '':
                        value = "NULL"
                    print(f"  {col}: {value}")
                    displayed.add(col)
            
            # 显示其他列（前 10 个未显示的）
            other_cols = [c for c in columns if c not in displayed][:10]
            for col in other_cols:
                value = row[col]
                if value is None or value == '':
                    value = "NULL"
                print(f"  {col}: {value}")
            
            if len(columns) > len(displayed) + 10:
                print(f"  ... 还有 {len(columns) - len(displayed) - 10} 列未显示")
        
        print("\n" + "=" * 80)
        print("数据检查完成!")
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_recent_data()
