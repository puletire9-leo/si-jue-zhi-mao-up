#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用 openpyxl 和 pyarrow 批量转换 Excel 文件为 Parquet 格式

该脚本遍历指定目录中的所有 Excel 文件，
使用 openpyxl 流式读取并转换为 Parquet 格式，
存储到指定的输出目录。
"""

# ==================== 配置参数 ====================
# 输入目录：包含 Excel 文件的目录
INPUT_DIRECTORY = r"产品数据"

# 输出目录：Parquet 文件输出目录
OUTPUT_DIRECTORY = r"temp_parquet_output"

# 输出文件格式：product_data_001.parquet, product_data_002.parquet 等
OUTPUT_FILENAME_FORMAT = "product_data_{:03d}.parquet"
# ==================================================

import os
import time
import pandas as pd
from datetime import datetime


def ensure_directory(directory):
    """
    确保目录存在，如果不存在则创建
    
    参数:
    directory: str - 目录路径
    """
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"创建目录: {directory}")
    else:
        print(f"目录已存在: {directory}")


def get_excel_files(directory):
    """
    获取目录中的所有 Excel 文件
    
    参数:
    directory: str - 目录路径
    
    返回:
    list - Excel 文件路径列表
    """
    excel_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            # 排除临时文件和非 Excel 文件
            if file.endswith('.xlsx') and not file.startswith('~$'):
                excel_files.append(os.path.join(root, file))
    return excel_files


def convert_excel_to_parquet(excel_path, output_directory, file_index):
    """
    将单个 Excel 文件转换为 Parquet 格式
    
    参数:
    excel_path: str - Excel 文件路径
    output_directory: str - 输出目录
    file_index: int - 文件索引，用于生成简单文件名
    
    返回:
    tuple - (成功标志, 消息, 处理时间)
    """
    start_time = time.time()
    
    try:
        # 获取文件名（不含扩展名）
        file_name = os.path.basename(excel_path)
        # 使用配置的文件名格式
        parquet_file = os.path.join(output_directory, OUTPUT_FILENAME_FORMAT.format(file_index))
        
        print(f"\n=== 处理文件: {file_name} ===")
        
        print("  使用 openpyxl 流式读取并增量写入 Parquet...")
        import openpyxl
        import pyarrow as pa
        import pyarrow.parquet as pq
        
        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
        ws = wb.active
        
        writer = None
        schema = None
        headers = None
        chunk_data = []
        chunk_size = 20000  # 每 2 万行写入一次
        total_rows = 0
        duplicate_count = 0
        seen_keys = set()
        asin_idx = -1
        date_idx = -1
        
        for row in ws.iter_rows(values_only=True):
            if not headers:
                headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(row)]
                
                # 查找 ASIN 和日期列的索引（不区分大小写）
                for i, h in enumerate(headers):
                    h_lower = h.lower()
                    if h_lower == 'asin':
                        asin_idx = i
                    elif h_lower == 'date' or h_lower == '日期':
                        date_idx = i
                
                if asin_idx != -1 and date_idx != -1:
                    print(f"    检测到 ASIN 列 (索引 {asin_idx}) 和日期列 (索引 {date_idx})，将进行查重...")
                else:
                    print("    未同时找到 ASIN 和日期列，将跳过查重逻辑。")

                # 检查是否有重复的列名
                seen = {}
                for i, h in enumerate(headers):
                    if h in seen:
                        seen[h] += 1
                        headers[i] = f"{h}_{seen[h]}"
                    else:
                        seen[h] = 0
                continue
            
            # 查重逻辑
            if asin_idx != -1 and date_idx != -1:
                asin_val = str(row[asin_idx]) if row[asin_idx] is not None else ""
                # 日期处理：如果是 datetime 对象，转换为字符串以保证 key 的一致性
                date_val = row[date_idx]
                if isinstance(date_val, (datetime, pd.Timestamp)):
                    date_val = date_val.strftime('%Y-%m-%d')
                else:
                    date_val = str(date_val) if date_val is not None else ""
                
                key = (asin_val, date_val)
                
                if key in seen_keys:
                    duplicate_count += 1
                    continue
                seen_keys.add(key)
            
            chunk_data.append(row)
            total_rows += 1
            
            if len(chunk_data) >= chunk_size:
                # 转换为 pandas 并强制所有列为 object 类型以确保 schema 一致
                df_chunk = pd.DataFrame(chunk_data, columns=headers).astype(object)
                table = pa.Table.from_pandas(df_chunk)
                
                if writer is None:
                    # 优化 Schema：将所有整数类型转换为浮点数类型
                    # 这样可以避免后续分片中出现浮点数导致 int64 转换失败（truncation error）
                    new_fields = []
                    for field in table.schema:
                        if pa.types.is_integer(field.type):
                            new_fields.append(pa.field(field.name, pa.float64(), nullable=field.nullable))
                        else:
                            new_fields.append(field)
                    schema = pa.schema(new_fields)
                    writer = pq.ParquetWriter(parquet_file, schema, compression='snappy')
                
                # 确保 table 的 schema 与 writer 的 schema 一致
                table = table.cast(schema)
                
                writer.write_table(table)
                print(f"    已处理 {total_rows} 行...")
                chunk_data = []
        
        # 写入最后一块
        if chunk_data:
            df_chunk = pd.DataFrame(chunk_data, columns=headers).astype(object)
            table = pa.Table.from_pandas(df_chunk)
            if writer is None:
                new_fields = []
                for field in table.schema:
                    if pa.types.is_integer(field.type):
                        new_fields.append(pa.field(field.name, pa.float64(), nullable=field.nullable))
                    else:
                        new_fields.append(field)
                schema = pa.schema(new_fields)
                writer = pq.ParquetWriter(parquet_file, schema, compression='snappy')
            
            table = table.cast(schema)
                
            writer.write_table(table)
            print(f"    已处理 {total_rows} 行 (完成)...")
        
        if writer:
            writer.close()
        
        wb.close()
        
        if total_rows == 0:
            return False, f"文件为空: {file_name}", 0
            
        print(f"  读取完成，有效行数: {total_rows}")
        if duplicate_count > 0:
            print(f"  跳过重复行数: {duplicate_count}")
        
        # 写入 Parquet 文件
        print("  正在完成 Parquet 写入...")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # 获取文件大小
        excel_size = os.path.getsize(excel_path) / (1024 * 1024)
        parquet_size = os.path.getsize(parquet_file) / (1024 * 1024)
        
        print(f"✓ 转换成功!")
        print(f"  Excel文件大小: {excel_size:.2f} MB")
        print(f"  Parquet文件大小: {parquet_size:.2f} MB")
        print(f"  压缩率: {parquet_size/excel_size*100:.1f}%")
        print(f"  处理时间: {processing_time:.2f} 秒")
        print(f"  输出文件: {parquet_file}")
        
        return True, f"转换成功: {file_name}", processing_time
        
    except Exception as e:
        end_time = time.time()
        processing_time = end_time - start_time
        
        print(f"✗ 转换失败: {file_name}")
        print(f"  错误信息: {str(e)}")
        print(f"  处理时间: {processing_time:.2f} 秒")
        
        return False, f"转换失败: {file_name} - {str(e)}", processing_time


def batch_convert(excel_directory, output_directory):
    """
    批量转换 Excel 文件为 Parquet 格式
    
    参数:
    excel_directory: str - Excel 文件目录
    output_directory: str - 输出目录
    """
    print("=" * 100)
    print("使用 openpyxl 和 pyarrow 批量转换 Excel 文件为 Parquet 格式")
    print("=" * 100)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Excel 目录: {excel_directory}")
    print(f"输出目录: {output_directory}")
    
    # 确保输出目录存在
    ensure_directory(output_directory)
    
    # 获取所有 Excel 文件
    excel_files = get_excel_files(excel_directory)
    total_files = len(excel_files)
    
    print(f"\n找到 {total_files} 个 Excel 文件:")
    for i, file in enumerate(excel_files, 1):
        print(f"  {i}. {os.path.basename(file)}")
    
    if total_files == 0:
        print("\n未找到 Excel 文件，退出程序。")
        return
    
    # 开始转换
    print(f"\n开始批量转换 ({total_files} 个文件)...")
    print("-" * 80)
    
    # 统计信息
    success_count = 0
    failed_count = 0
    total_time = 0
    failed_files = []
    
    for i, excel_file in enumerate(excel_files, 1):
        print(f"\n[{i}/{total_files}]")
        success, message, processing_time = convert_excel_to_parquet(excel_file, output_directory, i)
        
        total_time += processing_time
        
        if success:
            success_count += 1
        else:
            failed_count += 1
            failed_files.append(message)
    
    # 输出统计结果
    print("\n" + "-" * 80)
    print("=== 批量转换完成 ===")
    print(f"总文件数: {total_files}")
    print(f"成功: {success_count}")
    print(f"失败: {failed_count}")
    print(f"总处理时间: {total_time:.2f} 秒")
    print(f"平均处理时间: {total_time/total_files:.2f} 秒/文件")
    
    if failed_files:
        print("\n失败文件列表:")
        for fail_msg in failed_files:
            print(f"  - {fail_msg}")
    
    print(f"\n结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 100)


def main():
    """
    主函数
    """
    # 使用顶部配置参数
    excel_directory = INPUT_DIRECTORY
    output_directory = OUTPUT_DIRECTORY
    
    # 执行批量转换
    batch_convert(excel_directory, output_directory)


if __name__ == "__main__":
    main()
