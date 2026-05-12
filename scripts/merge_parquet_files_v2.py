#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parquet 文件合并工具 V2

功能：将指定目录下的多个 Parquet 文件合并为单个文件
使用 PyArrow 实现高效合并，支持大文件处理
确保所有文件列结构完全一致
"""

import os
import sys
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path


def merge_parquet_files_strict(input_dir: str, output_filename: str = "product_data_merged.parquet") -> str:
    """
    使用 PyArrow 合并指定目录下的所有 Parquet 文件
    严格检查列结构一致性
    
    参数:
        input_dir: 输入目录路径
        output_filename: 输出文件名
    
    返回:
        合并后的文件路径
    """
    print(f"=== 开始合并 Parquet 文件（严格模式）===")
    print(f"输入目录: {input_dir}")
    
    # 获取所有 parquet 文件（排除备份文件和临时文件）
    parquet_files = [
        f for f in os.listdir(input_dir) 
        if f.endswith('.parquet') 
        and not f.endswith('.backup')
        and not f.startswith('temp_')
        and not f.startswith('chunk_')
        and f != output_filename
    ]
    parquet_files.sort()
    
    # 如果输出文件已存在，将其加入合并列表（重命名为临时名称）
    existing_file_path = os.path.join(input_dir, output_filename)
    if os.path.exists(existing_file_path):
        print(f"检测到输出文件 {output_filename} 已存在，将参与合并")
        # 将原文件移动到临时名称以便合并
        temp_existing = "_temp_existing_" + output_filename
        temp_existing_path = os.path.join(input_dir, temp_existing)
        if os.path.exists(temp_existing_path):
            os.remove(temp_existing_path)
        os.rename(existing_file_path, temp_existing_path)
        # 添加到文件列表开头
        parquet_files.insert(0, temp_existing)
        print(f"  原文件将参与合并")
    
    if not parquet_files:
        print("错误: 未找到 Parquet 文件")
        return None
    
    print(f"找到 {len(parquet_files)} 个文件待合并:")
    for f in parquet_files:
        print(f"  - {f}")
    
    # 收集所有文件的元数据并检查一致性
    print("\n=== 检查文件结构一致性 ===")
    file_infos = []
    all_columns = None
    standard_schema = None
    total_rows = 0
    
    for i, file in enumerate(parquet_files, 1):
        file_path = os.path.join(input_dir, file)
        try:
            # 读取 Parquet 文件的元数据
            parquet_file = pq.ParquetFile(file_path)
            schema = parquet_file.schema_arrow
            columns = schema.names
            row_count = parquet_file.metadata.num_rows
            
            # 设置标准结构（第一个文件）
            if all_columns is None:
                all_columns = columns
                standard_schema = schema
                print(f"标准列结构: {len(columns)} 列")
            else:
                # 检查列数是否一致
                if len(columns) != len(all_columns):
                    print(f"❌ 错误: {file} 列数不匹配 ({len(columns)} vs {len(all_columns)})")
                    return None
                # 检查列名是否一致
                if set(columns) != set(all_columns):
                    diff = set(all_columns) - set(columns)
                    print(f"❌ 错误: {file} 列名不匹配，缺少: {diff}")
                    return None
            
            file_infos.append({
                'file': file,
                'path': file_path,
                'columns': columns,
                'column_count': len(columns),
                'row_count': row_count
            })
            total_rows += row_count
            
            print(f"[{i}/{len(parquet_files)}] {file}: {len(columns)} 列, {row_count:,} 行 ✓")
        except Exception as e:
            print(f"[{i}/{len(parquet_files)}] {file}: 错误 - {e}")
            return None
    
    print(f"\n✅ 所有文件结构一致")
    print(f"统一列数: {len(all_columns)}")
    print(f"预计总行数: {total_rows:,}")
    
    # 创建输出路径
    output_path = os.path.join(input_dir, output_filename)
    print(f"\n=== 流式合并并写入 ===")
    print(f"输出路径: {output_path}")
    
    # 使用 ParquetWriter 进行流式写入
    writer = None
    processed_rows = 0
    
    # 创建统一的 Schema（所有列转为字符串类型）
    print("\n创建统一 Schema（所有列转为字符串类型）...")
    unified_fields = []
    for col_name in all_columns:
        unified_fields.append(pa.field(col_name, pa.string(), nullable=True))
    unified_schema = pa.schema(unified_fields)
    print(f"  ✓ 统一 Schema 创建完成: {len(all_columns)} 列")
    
    try:
        for i, file_info in enumerate(file_infos, 1):
            print(f"\n处理第 {i}/{len(file_infos)} 个文件: {file_info['file']}")
            
            try:
                # 使用 ParquetFile 进行流式读取
                parquet_file = pq.ParquetFile(file_info['path'])
                
                # 逐批读取
                for batch in parquet_file.iter_batches(batch_size=50000):
                    # 将 RecordBatch 转换为 Table
                    table = pa.Table.from_batches([batch])
                    
                    # 确保列顺序与标准一致
                    aligned_table = table.select(all_columns)
                    
                    # 转换为统一 Schema（所有列转为字符串）
                    try:
                        unified_table = aligned_table.cast(unified_schema)
                    except Exception as cast_error:
                        # 如果转换失败，使用 pandas 转换
                        print(f"    警告: 直接 Schema 转换失败，使用 pandas 转换: {cast_error}")
                        import pandas as pd
                        df = aligned_table.to_pandas()
                        for col in df.columns:
                            df[col] = df[col].astype(str)
                        unified_table = pa.Table.from_pandas(df)
                        del df
                    
                    # 初始化 writer（第一次写入时）
                    if writer is None:
                        writer = pq.ParquetWriter(
                            output_path,
                            unified_schema,
                            compression='snappy',
                            use_dictionary=True,
                            write_statistics=True
                        )
                    
                    # 写入数据
                    writer.write_table(unified_table)
                    processed_rows += len(unified_table)
                
                print(f"  ✓ 已处理 {file_info['row_count']:,} 行")
                
            except Exception as e:
                print(f"  ✗ 错误: 处理文件失败 - {e}")
                import traceback
                traceback.print_exc()
                return None
        
        # 关闭 writer
        if writer:
            writer.close()
        
        print(f"\n=== 合并完成 ===")
        print(f"总行数: {processed_rows:,}")
        print(f"总列数: {len(all_columns)}")
        
        # 显示文件大小
        file_size = os.path.getsize(output_path)
        print(f"文件大小: {file_size / (1024*1024):.2f} MB")
        
        # 清理临时文件
        temp_existing_path = os.path.join(input_dir, "_temp_existing_" + output_filename)
        if os.path.exists(temp_existing_path):
            os.remove(temp_existing_path)
            print(f"  已清理临时文件")
        
        # 删除已合并的源数据文件（保留原输出文件和备份文件）
        print(f"\n清理已合并的源数据文件...")
        for file_info in file_infos:
            source_file = file_info['file']
            # 跳过临时文件和备份文件
            if source_file.startswith('_temp_existing_') or source_file.endswith('.backup'):
                continue
            source_path = os.path.join(input_dir, source_file)
            if os.path.exists(source_path) and source_file != output_filename:
                os.remove(source_path)
                print(f"  已删除: {source_file}")
        
        return output_path
        
    except Exception as e:
        print(f"\n错误: 合并过程失败 - {e}")
        if writer:
            writer.close()
        return None


def main():
    """主函数"""
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 设置输入目录为脚本所在目录下的 temp_parquet_output
    input_dir = os.path.join(script_dir, "temp_parquet_output")
    
    # 如果目录不存在，尝试使用当前工作目录
    if not os.path.exists(input_dir):
        input_dir = os.path.join(os.getcwd(), "temp_parquet_output")
    
    # 执行合并
    result = merge_parquet_files_strict(input_dir)
    
    if result:
        print(f"\n✅ 合并成功! 输出文件: {result}")
        return 0
    else:
        print(f"\n❌ 合并失败!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
