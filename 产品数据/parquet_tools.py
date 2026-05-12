#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parquet 工具集

功能：
1. Excel 批量转换为 Parquet 格式
2. Parquet 文件合并

使用 openpyxl 和 pyarrow 实现高效处理，支持大文件。
"""

# ==================== 配置参数 ====================
# 【转换模式配置】
# 输入目录：包含 Excel 文件的目录
INPUT_DIRECTORY = r"E:\project\sjzm\产品数据\源数据"

# 输出目录：Parquet 文件输出目录
OUTPUT_DIRECTORY = r"E:\project\sjzm\产品数据\压缩数据"

# 输出文件格式：product_data_001.parquet, product_data_002.parquet 等
OUTPUT_FILENAME_FORMAT = "product_data_{:03d}.parquet"

# 【合并模式配置】
# 合并输入目录：包含 Parquet 文件的目录
MERGE_INPUT_DIRECTORY = r"E:\project\sjzm\产品数据\压缩数据"

# 合并输出目录
MERGE_OUTPUT_DIRECTORY = r"E:\project\sjzm\产品数据\压缩数据"

# 合并输出文件名（仅文件名）
MERGE_OUTPUT_FILENAME = "product_data_merged.parquet"
# ==================================================


def select_mode():
    """交互式选择运行模式"""
    print("=" * 60)
    print("请选择功能：")
    print("  1. 转换 - Excel 转 Parquet")
    print("  2. 合并 - 合并 Parquet 文件")
    print("=" * 60)
    
    while True:
        choice = input("请输入选项 (1 或 2): ").strip()
        if choice == "1":
            return "convert"
        elif choice == "2":
            return "merge"
        else:
            print("❌ 无效选项，请重新输入")

import os
import sys
import time
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
from pathlib import Path


def ensure_directory(directory):
    """确保目录存在，如果不存在则创建"""
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"创建目录: {directory}")
    else:
        print(f"目录已存在: {directory}")


def get_excel_files(directory):
    """获取目录中的所有 Excel 文件"""
    excel_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.xlsx') and not file.startswith('~$'):
                excel_files.append(os.path.join(root, file))
    return excel_files


# ==================== 转换功能 ====================

def convert_excel_to_parquet(excel_path, output_directory, file_index):
    """将单个 Excel 文件转换为 Parquet 格式"""
    start_time = time.time()
    
    try:
        file_name = os.path.basename(excel_path)
        parquet_file = os.path.join(output_directory, OUTPUT_FILENAME_FORMAT.format(file_index))
        
        print(f"\n=== 处理文件: {file_name} ===")
        print("  使用 openpyxl 流式读取并增量写入 Parquet...")
        import openpyxl
        
        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
        ws = wb.active
        
        writer = None
        schema = None
        headers = None
        chunk_data = []
        chunk_size = 20000
        total_rows = 0
        duplicate_count = 0
        seen_keys = set()
        asin_idx = -1
        date_idx = -1
        
        for row in ws.iter_rows(values_only=True):
            if not headers:
                headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(row)]
                
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
                print(f"    已处理 {total_rows} 行...")
                chunk_data = []
        
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
        
        end_time = time.time()
        processing_time = end_time - start_time
        
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
        return False, f"转换失败: {file_name} - {str(e)}", processing_time


def batch_convert(excel_directory, output_directory):
    """批量转换 Excel 文件为 Parquet 格式"""
    print("=" * 100)
    print("Excel 批量转换为 Parquet 格式")
    print("=" * 100)
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Excel 目录: {excel_directory}")
    print(f"输出目录: {output_directory}")
    
    ensure_directory(output_directory)
    
    excel_files = get_excel_files(excel_directory)
    total_files = len(excel_files)
    
    print(f"\n找到 {total_files} 个 Excel 文件:")
    for i, file in enumerate(excel_files, 1):
        print(f"  {i}. {os.path.basename(file)}")
    
    if total_files == 0:
        print("\n未找到 Excel 文件，退出程序。")
        return
    
    print(f"\n开始批量转换 ({total_files} 个文件)...")
    print("-" * 80)
    
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
    
    print("\n" + "-" * 80)
    print("=== 批量转换完成 ===")
    print(f"总文件数: {total_files}")
    print(f"成功: {success_count}")
    print(f"失败: {failed_count}")
    print(f"总处理时间: {total_time:.2f} 秒")
    
    if failed_files:
        print("\n失败文件列表:")
        for fail_msg in failed_files:
            print(f"  - {fail_msg}")
    
    print(f"\n结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 100)


# ==================== 合并功能 ====================

def merge_parquet_files(input_dir: str, output_dir: str = None, output_filename: str = None) -> str:
    """合并指定目录下的所有 Parquet 文件"""
    if output_dir is None:
        output_dir = MERGE_OUTPUT_DIRECTORY
    if output_filename is None:
        output_filename = MERGE_OUTPUT_FILENAME
    
    # 确保输出目录存在
    ensure_directory(output_dir)
    
    print(f"=== 开始合并 Parquet 文件 ===")
    print(f"输入目录: {input_dir}")
    print(f"输出目录: {output_dir}")
    
    parquet_files = [
        f for f in os.listdir(input_dir) 
        if f.endswith('.parquet') 
        and not f.endswith('.backup')
        and not f.startswith('temp_')
        and not f.startswith('chunk_')
        and f != output_filename
    ]
    parquet_files.sort()
    
    # 检查输出目录中是否已存在同名文件
    output_path = os.path.join(output_dir, output_filename)
    existing_file_path = os.path.join(input_dir, output_filename)
    
    if os.path.exists(output_path):
        print(f"检测到输出文件 {output_filename} 已存在，将参与合并")
        temp_existing = "_temp_existing_" + output_filename
        temp_existing_path = os.path.join(input_dir, temp_existing)
        if os.path.exists(temp_existing_path):
            os.remove(temp_existing_path)
        # 将输出目录的文件移动到输入目录进行合并
        os.rename(output_path, temp_existing_path)
        parquet_files.insert(0, temp_existing)
        print(f"  原文件将参与合并")
    elif os.path.exists(existing_file_path):
        # 如果输入目录中有同名文件，也参与合并
        print(f"检测到输入目录中有 {output_filename}，将参与合并")
        temp_existing = "_temp_existing_" + output_filename
        temp_existing_path = os.path.join(input_dir, temp_existing)
        if os.path.exists(temp_existing_path):
            os.remove(temp_existing_path)
        os.rename(existing_file_path, temp_existing_path)
        parquet_files.insert(0, temp_existing)
        print(f"  原文件将参与合并")
    
    if not parquet_files:
        print("错误: 未找到 Parquet 文件")
        return None
    
    print(f"找到 {len(parquet_files)} 个文件待合并:")
    for f in parquet_files:
        print(f"  - {f}")
    
    print("\n=== 检查文件结构一致性 ===")
    file_infos = []
    all_columns = None
    total_rows = 0
    
    for i, file in enumerate(parquet_files, 1):
        file_path = os.path.join(input_dir, file)
        try:
            # 使用上下文管理器确保文件正确关闭
            with pq.ParquetFile(file_path) as parquet_file:
                schema = parquet_file.schema_arrow
                columns = schema.names
                row_count = parquet_file.metadata.num_rows
                
                if all_columns is None:
                    all_columns = columns
                    print(f"标准列结构: {len(columns)} 列")
                else:
                    if len(columns) != len(all_columns):
                        print(f"❌ 错误: {file} 列数不匹配 ({len(columns)} vs {len(all_columns)})")
                        return None
                    if set(columns) != set(all_columns):
                        diff = set(all_columns) - set(columns)
                        print(f"❌ 错误: {file} 列名不匹配，缺少: {diff}")
                        return None
                
                file_infos.append({
                    'file': file,
                    'path': file_path,
                    'columns': columns,
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
    
    # 输出路径使用输出目录
    output_path = os.path.join(output_dir, output_filename)
    print(f"\n=== 流式合并并写入 ===")
    print(f"输出路径: {output_path}")
    
    writer = None
    processed_rows = 0
    
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
                # 使用上下文管理器确保文件正确关闭
                with pq.ParquetFile(file_info['path']) as parquet_file:
                    for batch in parquet_file.iter_batches(batch_size=50000):
                        table = pa.Table.from_batches([batch])
                        aligned_table = table.select(all_columns)
                        
                        try:
                            unified_table = aligned_table.cast(unified_schema)
                        except Exception as cast_error:
                            print(f"    警告: 直接 Schema 转换失败，使用 pandas 转换: {cast_error}")
                            df = aligned_table.to_pandas()
                            for col in df.columns:
                                df[col] = df[col].astype(str)
                            unified_table = pa.Table.from_pandas(df)
                            del df
                        
                        if writer is None:
                            writer = pq.ParquetWriter(
                                output_path,
                                unified_schema,
                                compression='snappy',
                                use_dictionary=True,
                                write_statistics=True
                            )
                        
                        writer.write_table(unified_table)
                        processed_rows += len(unified_table)
                
                print(f"  ✓ 已处理 {file_info['row_count']:,} 行")
                
            except Exception as e:
                print(f"  ✗ 错误: 处理文件失败 - {e}")
                import traceback
                traceback.print_exc()
                return None
        
        if writer:
            writer.close()
        
        print(f"\n=== 合并完成 ===")
        print(f"总行数: {processed_rows:,}")
        print(f"总列数: {len(all_columns)}")
        
        file_size = os.path.getsize(output_path)
        print(f"文件大小: {file_size / (1024*1024):.2f} MB")
        
        # 清理临时文件
        temp_existing_path = os.path.join(input_dir, "_temp_existing_" + output_filename)
        if os.path.exists(temp_existing_path):
            os.remove(temp_existing_path)
            print(f"  已清理临时文件")
        
        # 删除已合并的源数据文件
        print(f"\n清理已合并的源数据文件...")
        for file_info in file_infos:
            source_file = file_info['file']
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


# ==================== 主函数 ====================

def main():
    """主函数"""
    print("=" * 100)
    print("Parquet 工具集")
    print("=" * 100)
    
    # 交互式选择模式
    MODE = select_mode()
    print("")
    
    if MODE == "convert":
        print("【转换模式】Excel → Parquet")
        print(f"输入目录: {INPUT_DIRECTORY}")
        print(f"输出目录: {OUTPUT_DIRECTORY}")
        print("")
        batch_convert(INPUT_DIRECTORY, OUTPUT_DIRECTORY)
        
    elif MODE == "merge":
        print("【合并模式】Parquet 文件合并")
        print(f"输入目录: {MERGE_INPUT_DIRECTORY}")
        print(f"输出目录: {MERGE_OUTPUT_DIRECTORY}")
        print(f"输出文件: {MERGE_OUTPUT_FILENAME}")
        print("")
        result = merge_parquet_files(MERGE_INPUT_DIRECTORY, MERGE_OUTPUT_DIRECTORY, MERGE_OUTPUT_FILENAME)
        
        if result:
            print(f"\n✅ 合并成功! 输出文件: {result}")
            return 0
        else:
            print(f"\n❌ 合并失败!")
            return 1
    else:
        print(f"错误: 未知的模式 '{MODE}'")
        print("请设置 MODE = 'convert' 或 'merge'")
        return 1


if __name__ == "__main__":
    sys.exit(main())
