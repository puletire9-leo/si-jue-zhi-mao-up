#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分批合并 Parquet 文件（低内存版本）
逐个文件流式合并，避免内存溢出
"""

import os
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime

# 配置
INPUT_DIR = r"E:\project\sjzm\产品数据\压缩数据"
OUTPUT_FILE = r"E:\project\sjzm\产品数据\压缩数据\product_data_final.parquet"

def get_parquet_files(input_dir):
    """获取所有 Parquet 文件（排除临时文件和输出文件）"""
    files = []
    for f in os.listdir(input_dir):
        if f.endswith('.parquet') and not f.startswith('temp_') and f != 'product_data_final.parquet':
            files.append(os.path.join(input_dir, f))
    return sorted(files)

def merge_two_files(file1, file2, output_file):
    """合并两个 Parquet 文件（自动处理列不一致）"""
    print(f"\n=== 合并两个文件 ===")
    print(f"文件1: {os.path.basename(file1)}")
    print(f"文件2: {os.path.basename(file2)}")
    print(f"输出: {os.path.basename(output_file)}")
    
    # 获取文件信息
    pf1 = pq.ParquetFile(file1)
    pf2 = pq.ParquetFile(file2)
    
    rows1 = pf1.metadata.num_rows
    rows2 = pf2.metadata.num_rows
    cols1 = set(pf1.schema_arrow.names)
    cols2 = set(pf2.schema_arrow.names)
    
    print(f"文件1: {rows1:,} 行, {len(cols1)} 列")
    print(f"文件2: {rows2:,} 行, {len(cols2)} 列")
    
    # 处理列不一致 - 取并集
    all_columns = sorted(cols1 | cols2)  # 并集并排序
    print(f"合并后列数: {len(all_columns)}")
    
    # 显示差异
    if cols1 != cols2:
        only_in_1 = cols1 - cols2
        only_in_2 = cols2 - cols1
        if only_in_1:
            print(f"  仅在文件1中的列: {only_in_1}")
        if only_in_2:
            print(f"  仅在文件2中的列: {only_in_2}")
        print("  将自动填充缺失列为 NULL")
    
    # 使用统一的字符串 schema（包含所有列）
    unified_fields = []
    for col_name in all_columns:
        unified_fields.append(pa.field(col_name, pa.string(), nullable=True))
    unified_schema = pa.schema(unified_fields)
    
    # 流式合并
    writer = None
    total_rows = 0
    
    # 计算每个文件缺失的列
    cols1_list = pf1.schema_arrow.names
    cols2_list = pf2.schema_arrow.names
    missing_in_1 = [c for c in all_columns if c not in cols1_list]
    missing_in_2 = [c for c in all_columns if c not in cols2_list]
    
    try:
        # 处理第一个文件
        print(f"\n处理文件1...")
        for batch in pf1.iter_batches(batch_size=50000):
            table = pa.Table.from_batches([batch])
            
            # 统一处理：转换为 pandas，确保列顺序一致
            import pandas as pd
            df = table.to_pandas()
            
            # 添加缺失列（填充 NULL）
            for col in missing_in_1:
                df[col] = None
            
            # 按统一顺序排列列
            df = df[all_columns]
            
            # 所有列转为字符串
            for col in df.columns:
                df[col] = df[col].astype(str)
            
            unified_table = pa.Table.from_pandas(df)
            
            if writer is None:
                writer = pq.ParquetWriter(output_file, unified_schema, compression='snappy')
            
            writer.write_table(unified_table)
            total_rows += len(unified_table)
            print(f"  已处理 {total_rows:,} 行...")
        
        # 处理第二个文件
        print(f"\n处理文件2...")
        for batch in pf2.iter_batches(batch_size=50000):
            table = pa.Table.from_batches([batch])
            
            # 统一处理：转换为 pandas，确保列顺序一致
            import pandas as pd
            df = table.to_pandas()
            
            # 添加缺失列（填充 NULL）
            for col in missing_in_2:
                df[col] = None
            
            # 按统一顺序排列列
            df = df[all_columns]
            
            # 所有列转为字符串
            for col in df.columns:
                df[col] = df[col].astype(str)
            
            unified_table = pa.Table.from_pandas(df)
            
            writer.write_table(unified_table)
            total_rows += len(unified_table)
            print(f"  已处理 {total_rows:,} 行...")
        
        if writer:
            writer.close()
        
        # 显示结果
        file_size = os.path.getsize(output_file) / (1024 * 1024)
        print(f"\n✅ 合并完成!")
        print(f"总行数: {total_rows:,}")
        print(f"文件大小: {file_size:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        if writer:
            writer.close()
        return False

def main():
    print("=" * 80)
    print("分批合并 Parquet 文件")
    print("=" * 80)
    print(f"输入目录: {INPUT_DIR}")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 获取所有文件
    files = get_parquet_files(INPUT_DIR)
    print(f"\n找到 {len(files)} 个文件:")
    for i, f in enumerate(files, 1):
        size = os.path.getsize(f) / (1024 * 1024)
        pf = pq.ParquetFile(f)
        print(f"  {i}. {os.path.basename(f)} ({pf.metadata.num_rows:,} 行, {size:.2f} MB)")
    
    if len(files) < 2:
        print("\n文件数量不足，无需合并")
        return
    
    # 分批合并策略
    print("\n" + "=" * 80)
    print("合并策略: 逐个合并")
    print("=" * 80)
    
    # 第一步：合并前两个文件
    temp_file = os.path.join(INPUT_DIR, "temp_merged_01.parquet")
    if not merge_two_files(files[0], files[1], temp_file):
        print("第一步合并失败")
        return
    
    # 如果有第三个文件，继续合并
    if len(files) >= 3:
        print("\n" + "=" * 80)
        print("第二步：合并临时文件与第三个文件")
        print("=" * 80)
        
        final_file = OUTPUT_FILE
        if not merge_two_files(temp_file, files[2], final_file):
            print("第二步合并失败")
            return
        
        # 清理临时文件
        print(f"\n清理临时文件: {os.path.basename(temp_file)}")
        os.remove(temp_file)
        
        print(f"\n✅ 所有文件合并完成!")
        print(f"最终文件: {final_file}")
    else:
        # 只有两个文件，重命名临时文件为最终文件
        print(f"\n重命名为最终文件...")
        os.rename(temp_file, OUTPUT_FILE)
        print(f"✅ 合并完成: {OUTPUT_FILE}")
    
    # 显示最终文件信息
    final_pf = pq.ParquetFile(OUTPUT_FILE)
    final_size = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\n最终文件信息:")
    print(f"  路径: {OUTPUT_FILE}")
    print(f"  行数: {final_pf.metadata.num_rows:,}")
    print(f"  列数: {len(final_pf.schema_arrow.names)}")
    print(f"  大小: {final_size:.2f} MB")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
