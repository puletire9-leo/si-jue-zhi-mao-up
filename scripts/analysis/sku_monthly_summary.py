#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SKU 月度数据汇总脚本

功能：
1. 筛选指定月份创建的SKU（支持单个月份或全部月份）
2. 按SKU汇总销售量、销售额、结算毛利润
3. 判断listing标签（2026年3月时是否为"欧洲精铺2025"）

使用方法：
1. 单个月份: python sku_monthly_summary.py --month 2025-04
2. 全部月份: python sku_monthly_summary.py --all-months

输出字段：
- 创建时间
- ASIN/MSKU/SKU
- 开发人
- 品名
- 总销售量
- 总销售额
- 总结算毛利润
- listing标签（欧洲精铺2025 / 淘汰sku）
"""

# ==================== 用户可配置区域 ====================

# 默认配置（可通过命令行参数覆盖）
DEFAULT_CONFIG = {
    # 汇总模式
    # "single" - 单个月份（需设置 MONTH）
    # "all" - 一键生成所有月份
    "MODE": "all",
    
    # 汇总月份 (格式: YYYY-MM, 例如: "2025-04")
    # MODE 为 "single" 时有效
    "MONTH": None,
    
    # 数据筛选开始月份 (格式: YYYY-MM)
    # 设置为 None 则从最早数据开始
    # 设置为具体月份则从该月份开始（例如: "2025-04"）
    "START_MONTH": "2025-04",
    
    # listing标签判断截止日期 (格式: YYYY-MM-DD)
    # 设置为 None 则使用数据的最新日期（推荐）
    # 设置为具体日期则使用该日期作为截止点
    "CUTOFF_DATE": None,
    
    # 特殊标签检测配置
    # 支持两种检测方式：
    # 1. listing标签检测 - 直接填写标签名称
    # 2. 品名关键字检测 - 格式: {"field": "品名", "keyword": "【定制】", "tag": "非标品"}
    "SPECIAL_TAGS": [
        # 品名中包含【定制】的自动标记为"非标品"
        {"field": "品名", "keyword": "【定制】", "tag": "非标品"},
        # 也可以同时检测listing标签中的特定标签
        # "欧洲精铺2025非标品",
    ],
    
    # 基础标签判定
    "BASE_TAGS": {
        "active": "欧洲精铺2025",   # 活跃SKU标签
        "inactive": "淘汰sku",       # 淘汰SKU标签
    },
    
    # 输出目录 (None 表示使用默认目录)
    "OUTPUT_DIR": None,
}

# ==================== 配置区域结束 ====================

import polars as pl
import os
import argparse
from datetime import datetime
from typing import List, Dict, Optional


def get_latest_listing_tag(df: pl.DataFrame, asin: str, cutoff_date: str = None) -> str:
    """
    获取SKU的最新listing标签
    
    如果指定了cutoff_date，则使用该日期；否则使用数据的最新日期
    """
    # 基础标签
    active_tag = DEFAULT_CONFIG["BASE_TAGS"]["active"]
    inactive_tag = DEFAULT_CONFIG["BASE_TAGS"]["inactive"]
    
    # 筛选该ASIN的数据
    asin_data = df.filter(pl.col("ASIN") == asin)
    
    if asin_data.is_empty():
        return inactive_tag
    
    # 如果指定了截止日期，则筛选该日期之前的数据
    if cutoff_date:
        asin_data = asin_data.filter(pl.col("日期") <= cutoff_date)
        if asin_data.is_empty():
            return inactive_tag
    
    # 获取最新日期的记录
    latest = asin_data.sort("日期", descending=True).head(1)
    
    if "listing标签" in latest.columns:
        tag = latest["listing标签"][0]
        if tag:
            tag_str = str(tag)
            # 优先检查是否是淘汰状态（避免"欧洲精铺2025淘汰"被误判为活跃）
            if "淘汰" in tag_str:
                return inactive_tag
            # 检查是否包含活跃标签
            elif active_tag in tag_str:
                return active_tag
    
    return inactive_tag


def get_special_tags(df: pl.DataFrame, asin: str) -> str:
    """
    获取SKU的特殊标签（检查历史数据中是否包含特定标签或品名关键字）
    
    在 DEFAULT_CONFIG["SPECIAL_TAGS"] 中配置需要检测的内容：
    - 字符串: 直接检测listing标签
    - 字典: {"field": "字段名", "keyword": "关键字", "tag": "要追加的标签"}
    
    Returns:
        特殊标签列表，用逗号分隔
    """
    asin_data = df.filter(pl.col("ASIN") == asin)
    
    if asin_data.is_empty():
        return ""
    
    special_tags = []
    
    # 检查配置中的特殊标签
    for tag_config in DEFAULT_CONFIG["SPECIAL_TAGS"]:
        if isinstance(tag_config, str):
            # 方式1: 字符串 - 直接检测listing标签
            if "listing标签" in asin_data.columns:
                tagged_data = asin_data.filter(
                    pl.col("listing标签").str.contains(tag_config)
                )
                if not tagged_data.is_empty():
                    special_tags.append(tag_config)
                    
        elif isinstance(tag_config, dict):
            # 方式2: 字典 - 检测指定字段中的关键字
            field = tag_config.get("field")
            keyword = tag_config.get("keyword")
            tag = tag_config.get("tag")
            
            if field and keyword and tag and field in asin_data.columns:
                # 筛选包含关键字的记录
                matched_data = asin_data.filter(
                    pl.col(field).str.contains(keyword)
                )
                if not matched_data.is_empty():
                    special_tags.append(tag)
    
    return ",".join(special_tags) if special_tags else ""


def safe_sum(sku_data: pl.DataFrame, column_name: str) -> float:
    """安全地汇总数值列"""
    if column_name not in sku_data.columns:
        return 0
    col = sku_data[column_name]
    try:
        return col.cast(pl.Float64, strict=False).fill_null(0).sum()
    except:
        return 0


def summarize_skus_by_month(
    df: pl.DataFrame,
    year_month: str,
    cutoff_date: str = "2026-03-31"
) -> pl.DataFrame:
    """
    汇总指定月份创建的SKU数据
    
    Args:
        df: 数据框
        year_month: 年月 (格式: YYYY-MM)
        cutoff_date: listing标签判断截止日期
        
    Returns:
        汇总结果DataFrame
    """
    print(f"\n{'='*80}")
    print(f"汇总 {year_month} 月份创建的SKU")
    print(f"{'='*80}")
    
    # 筛选指定月份创建的SKU
    month_skus = df.filter(
        pl.col("创建时间").str.contains(f"{year_month}-")
    )
    
    if month_skus.is_empty():
        print(f"  未找到 {year_month} 月份创建的SKU")
        return pl.DataFrame()
    
    # 获取唯一的SKU列表（包含开发人）
    unique_skus = month_skus.select(["ASIN", "MSKU", "SKU", "品名", "创建时间", "开发人"]).unique()
    print(f"  找到 {len(unique_skus)} 个SKU")
    
    # 汇总数据
    print(f"  正在汇总数据...")
    results = []
    
    for idx, row in enumerate(unique_skus.iter_rows(named=True), 1):
        asin = row["ASIN"]
        sku = row["SKU"]
        msku = row["MSKU"]
        product_name = row["品名"]
        create_time = row["创建时间"]
        developer = row["开发人"]
        
        # 获取该SKU的所有历史数据
        sku_data = df.filter(pl.col("ASIN") == asin)
        
        # 汇总销售量、销售额、结算毛利润
        total_sales = safe_sum(sku_data, "销量")
        total_amount = safe_sum(sku_data, "销售额")
        total_profit = safe_sum(sku_data, "结算毛利润")
        
        # 获取listing标签（2026年3月时的状态）
        listing_tag = get_latest_listing_tag(df, asin, cutoff_date)
        
        # 获取特殊标签（历史数据中是否有"欧洲精铺2025非标品"）
        special_tags = get_special_tags(df, asin)
        
        # 组合最终标签
        if special_tags:
            final_tag = f"{listing_tag}，{special_tags}"
        else:
            final_tag = listing_tag
        
        results.append({
            "创建月份": year_month,
            "创建时间": create_time,
            "ASIN": asin,
            "MSKU": msku,
            "SKU": sku,
            "开发人": developer,
            "品名": product_name,
            "总销售量": total_sales,
            "总销售额": round(total_amount, 2),
            "总结算毛利润": round(total_profit, 2),
            "listing标签": final_tag
        })
        
        if idx % 10 == 0:
            print(f"    已处理 {idx}/{len(unique_skus)} 个SKU...")
    
    print(f"  汇总完成: {len(results)} 个SKU")
    
    result_df = pl.DataFrame(results)
    return result_df.sort("创建时间")


def get_all_available_months(df: pl.DataFrame) -> List[str]:
    """获取所有可用的创建月份列表（根据 START_MONTH 配置过滤）"""
    # 从创建时间提取年月，过滤掉空值
    months = df.filter(
        pl.col("创建时间").is_not_null()
    ).select(
        pl.col("创建时间").str.slice(0, 7).alias("month")
    ).unique().sort("month")
    
    # 过滤掉None值
    all_months = [m for m in months["month"].to_list() if m is not None]
    
    # 根据 START_MONTH 配置过滤
    start_month = DEFAULT_CONFIG.get("START_MONTH")
    if start_month:
        all_months = [m for m in all_months if m >= start_month]
        print(f"  根据 START_MONTH={start_month} 过滤，剩余 {len(all_months)} 个月份")
    
    return all_months


def process_single_month(
    parquet_path: str,
    output_dir: str,
    year_month: str,
    cutoff_date: str = "2026-03-31"
) -> Optional[str]:
    """处理单个月份"""
    # 读取数据
    needed_columns = [
        "日期", "ASIN", "MSKU", "SKU", "品名", "店铺", "国家",
        "开发人", "负责人", "创建时间", "listing标签",
        "销量", "销售额", "结算毛利润"
    ]
    
    df = pl.read_parquet(parquet_path)
    available_columns = [c for c in needed_columns if c in df.columns]
    df = df.select(available_columns)
    
    # 汇总
    result_df = summarize_skus_by_month(df, year_month, cutoff_date)
    
    if result_df.is_empty():
        return None
    
    # 保存
    output_path = os.path.join(output_dir, f"sku_summary_{year_month}.xlsx")
    result_df.write_excel(output_path)
    
    # 打印统计
    print(f"\n  统计信息:")
    print(f"    总SKU数: {len(result_df)}")
    print(f"    总销售量: {result_df['总销售量'].sum():,}")
    print(f"    总销售额: £{result_df['总销售额'].sum():,.2f}")
    print(f"    总结算毛利润: £{result_df['总结算毛利润'].sum():,.2f}")
    
    tag_counts = result_df.group_by("listing标签").len()
    print(f"    listing标签分布:")
    for row in tag_counts.iter_rows(named=True):
        print(f"      {row['listing标签']}: {row['len']} 个")
    
    print(f"\n  保存成功: {output_path}")
    return output_path


def process_all_months(
    parquet_path: str,
    output_dir: str,
    cutoff_date: str = "2026-03-31"
) -> str:
    """处理所有月份，生成一个多sheet的Excel文件"""
    print(f"{'='*80}")
    print("SKU 月度数据汇总 - 全部月份")
    print(f"{'='*80}")
    
    # 读取数据
    print("\n[1/3] 读取Parquet数据...")
    needed_columns = [
        "日期", "ASIN", "MSKU", "SKU", "品名", "店铺", "国家",
        "开发人", "负责人", "创建时间", "listing标签",
        "销量", "销售额", "结算毛利润"
    ]
    
    df = pl.read_parquet(parquet_path)
    available_columns = [c for c in needed_columns if c in df.columns]
    df = df.select(available_columns)
    print(f"  读取完成: {len(df):,} 行")
    
    # 获取所有月份
    print("\n[2/3] 获取所有创建月份...")
    all_months = get_all_available_months(df)
    print(f"  发现 {len(all_months)} 个月份: {', '.join(all_months)}")
    
    # 处理每个月份
    print("\n[3/3] 逐月汇总...")
    all_results = []
    month_results = {}  # 存储每个月份的结果
    
    for month in all_months:
        result_df = summarize_skus_by_month(df, month, cutoff_date)
        if not result_df.is_empty():
            all_results.append(result_df)
            month_results[month] = result_df
            print(f"  ✓ {month}: {len(result_df)} 个SKU")
    
    # 生成多sheet的Excel文件
    if all_results:
        import pandas as pd
        
        output_path = os.path.join(output_dir, "sku_summary_report.xlsx")
        
        # 生成汇总表数据
        summary_results = []
        for month, result_df in month_results.items():
            total_sales = result_df['总销售量'].sum()
            total_amount = result_df['总销售额'].sum()
            total_profit = result_df['总结算毛利润'].sum()
            
            # 计算利润率
            profit_rate = (total_profit / total_amount * 100) if total_amount > 0 else 0
            
            # 计算存活率（包含"欧洲精铺2025"但不包含"淘汰"的SKU数 / 总数）
            total_count = len(result_df)
            active_count = result_df.filter(
                (pl.col('listing标签').str.contains('欧洲精铺2025')) &
                (~pl.col('listing标签').str.contains('淘汰'))
            ).height
            survival_rate = (active_count / total_count * 100) if total_count > 0 else 0
            
            summary_results.append({
                '时间': month,
                '总销售额': round(total_amount, 2),
                '总销售量': int(total_sales),
                '总结算利润': round(total_profit, 2),
                '总结算利润率': f"{profit_rate:.2f}%",
                '存活率': f"{survival_rate:.2f}%",
                'SKU总数': total_count,
                '存活SKU数': active_count
            })
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # 写入汇总表sheet
            summary_df = pl.DataFrame(summary_results)
            summary_df.to_pandas().to_excel(writer, sheet_name='汇总', index=False)
            
            # 写入每个月份的明细sheet
            for month, result_df in month_results.items():
                sheet_name = month.replace('2025-', '25年').replace('2026-', '26年') + '月'
                result_df.to_pandas().to_excel(writer, sheet_name=sheet_name, index=False)
        
        print(f"\n  多sheet文件保存: {output_path}")
        print(f"  包含 {len(month_results) + 1} 个sheet: 汇总 + {len(month_results)} 个月份明细")
        print(f"  总计: {len(summary_df)} 个月份")
        
        return output_path
    
    return ""


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="SKU 月度数据汇总工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 汇总2025年4月
  python sku_monthly_summary.py --month 2025-04
  
  # 汇总2025年5月
  python sku_monthly_summary.py --month 2025-05
  
  # 汇总所有月份
  python sku_monthly_summary.py --all-months
  
  # 指定listing标签判断截止日期
  python sku_monthly_summary.py --month 2025-04 --cutoff-date 2026-02-28
        """
    )
    
    parser.add_argument(
        "--month",
        type=str,
        help="指定月份 (格式: YYYY-MM, 例如: 2025-04)"
    )
    
    parser.add_argument(
        "--all-months",
        action="store_true",
        help="汇总所有月份"
    )
    
    parser.add_argument(
        "--cutoff-date",
        type=str,
        default=DEFAULT_CONFIG["CUTOFF_DATE"],
        help=f"listing标签判断截止日期 (格式: YYYY-MM-DD, 默认: {DEFAULT_CONFIG['CUTOFF_DATE']})"
    )
    
    parser.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_CONFIG["OUTPUT_DIR"],
        help="输出目录 (默认: temp_parquet_output)"
    )
    
    args = parser.parse_args()
    
    # 设置路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    parquet_path = os.path.join(project_root, "temp_parquet_output", "product_data_merged.parquet")
    output_dir = args.output_dir or os.path.join(project_root, "temp_parquet_output")
    
    # 检查文件是否存在
    if not os.path.exists(parquet_path):
        print(f"错误: 找不到Parquet文件: {parquet_path}")
        return 1
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 确定运行模式（优先级: 命令行参数 > 配置文件）
    run_all_months = args.all_months or DEFAULT_CONFIG["MODE"] == "all"
    target_month = args.month or DEFAULT_CONFIG["MONTH"]
    
    # 检查参数
    if not run_all_months and not target_month:
        parser.print_help()
        print("\n错误: 请指定 --month 或 --all-months，或在配置文件中设置 MODE/MONTH")
        return 1
    
    # 执行处理
    try:
        if run_all_months:
            output_path = process_all_months(parquet_path, output_dir, args.cutoff_date)
            if output_path:
                print(f"\n{'='*80}")
                print(f"全部处理完成!")
                print(f"  文件: {output_path}")
                print(f"{'='*80}")
        else:
            output_path = process_single_month(
                parquet_path, output_dir, target_month, args.cutoff_date
            )
            if output_path:
                print(f"\n{'='*80}")
                print("处理完成!")
                print(f"{'='*80}")
            else:
                print(f"\n{'='*80}")
                print(f"未找到 {args.month} 月份的数据")
                print(f"{'='*80}")
                return 1
        
        return 0
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
