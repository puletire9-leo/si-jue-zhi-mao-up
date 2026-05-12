#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从Excel文件生成SKU月度汇总报告

生成两个维度的报告：
1. 时间维度：sku_summary_from_excel.xlsx（汇总 + 各月份明细）
2. 开发人维度：每个开发人一个独立的Excel文件
"""

import pandas as pd
import polars as pl
import os


def generate_developer_report(
    df: pl.DataFrame,
    developer: str,
    output_dir: str,
    month_list: list
):
    """
    为单个开发人生成报告
    
    Args:
        df: 完整数据框
        developer: 开发人姓名
        output_dir: 输出目录
        month_list: 月份列表
    """
    print(f"\n  生成 {developer} 的报告...")
    
    # 筛选该开发人的数据
    dev_data = df.filter(pl.col('开发人') == developer)
    
    if dev_data.is_empty():
        print(f"    {developer} 没有数据，跳过")
        return
    
    # 按ASIN汇总（用于月份明细）
    asin_summary_by_month = {}
    summary_results = []
    
    for month in month_list:
        # 筛选该月份的数据
        month_data = dev_data.filter(pl.col('创建月份') == month)
        
        if month_data.is_empty():
            continue
        
        # 按ASIN汇总
        agg_exprs = [
            pl.col('SKU').last().alias('SKU'),
            pl.col('标题').last().alias('标题'),
            pl.col('销量').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销量'),
            pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销售额'),
            pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算利润'),
            pl.col('可用库存').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总可用库存'),
            pl.col('listing标签').last().alias('最新标签')
        ]
        
        asin_summary = month_data.group_by('ASIN').agg(agg_exprs)
        asin_summary_by_month[month] = asin_summary
        
        # 计算汇总指标
        total_count = len(asin_summary)
        total_sales_qty = asin_summary['总销量'].sum()
        total_sales_amount = asin_summary['总销售额'].sum()
        total_profit = asin_summary['总结算利润'].sum()
        total_available_stock = asin_summary['总可用库存'].sum()
        total_profit_rate = (total_profit / total_sales_amount * 100) if total_sales_amount > 0 else 0
        
        # 计算存活/留存SKU
        active_df = asin_summary.filter(
            (pl.col('最新标签').str.contains('欧洲精铺2025')) &
            (~pl.col('最新标签').str.contains('淘汰'))
        )
        active_count = len(active_df)
        active_sales_qty = active_df['总销量'].sum()
        active_sales_amount = active_df['总销售额'].sum()
        active_profit = active_df['总结算利润'].sum()
        active_profit_rate = (active_profit / active_sales_amount * 100) if active_sales_amount > 0 else 0
        
        # 计算淘汰SKU
        inactive_df = asin_summary.filter(
            pl.col('最新标签').str.contains('淘汰')
        )
        inactive_count = len(inactive_df)
        inactive_sales_qty = inactive_df['总销量'].sum()
        inactive_sales_amount = inactive_df['总销售额'].sum()
        inactive_profit = inactive_df['总结算利润'].sum()
        inactive_rate = (inactive_count / total_count * 100) if total_count > 0 else 0
        inactive_profit_rate = (inactive_profit / inactive_sales_amount * 100) if inactive_sales_amount > 0 else 0
        
        # 存活率
        survival_rate = (active_count / total_count * 100) if total_count > 0 else 0
        
        summary_results.append({
            '时间': month,
            'SKU总数': total_count,
            '总销售量': int(total_sales_qty),
            '总销售额': round(total_sales_amount, 2),
            '总结算利润': round(total_profit, 2),
            '总利润率': f"{total_profit_rate:.2f}%",
            '总可用库存': int(total_available_stock),
            '存活率': f"{survival_rate:.2f}%",
            '存活sku销售量': int(active_sales_qty),
            '存活sku销售额': round(active_sales_amount, 2),
            '存活SKU数': active_count,
            '留存SKU总利润': round(active_profit, 2),
            '留存SKU利润率': f"{active_profit_rate:.2f}%",
            '淘汰SKU销售量': int(inactive_sales_qty),
            '淘汰SKU销售额': round(inactive_sales_amount, 2),
            '淘汰SKU总数': inactive_count,
            '淘汰率': f"{inactive_rate:.2f}%",
            '淘汰SKU总利润': round(inactive_profit, 2),
            '淘汰SKU利润率': f"{inactive_profit_rate:.2f}%"
        })
    
    # 保存为Excel
    output_path = os.path.join(output_dir, f"{developer}_sku_report.xlsx")
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        # 写入汇总sheet
        summary_df = pl.DataFrame(summary_results)
        summary_df.to_pandas().to_excel(writer, sheet_name='汇总', index=False)
        
        # 写入每个月份的明细sheet
        for month, result_df in asin_summary_by_month.items():
            sheet_name = month.replace('2025-', '25年').replace('2026-', '26年') + '月'
            result_df.to_pandas().to_excel(writer, sheet_name=sheet_name, index=False)
    
    print(f"    保存成功: {output_path}")
    print(f"    包含 {len(asin_summary_by_month) + 1} 个sheet")


def generate_report_from_excel(
    excel_path: str = r'e:\project\sjzm\产品数据\产品表现ASIN（2025-04-01~2026-03-31，全部广告）-903647391114104832.xlsx',
    time_output_dir: str = r'e:\project\sjzm\产品数据\时间维度',
    developer_output_dir: str = r'e:\project\sjzm\产品数据\开发人维度',
    start_month: str = "2025-04"
):
    """
    从Excel文件生成月度汇总报告
    
    Args:
        excel_path: Excel文件路径
        time_output_dir: 时间维度输出目录
        developer_output_dir: 开发人维度输出目录
        start_month: 开始月份
    """
    print("=" * 80)
    print("从Excel生成SKU月度汇总报告")
    print("=" * 80)
    
    # 确保输出目录存在
    os.makedirs(time_output_dir, exist_ok=True)
    os.makedirs(developer_output_dir, exist_ok=True)
    
    # 1. 读取Excel数据
    print("\n[1/4] 读取Excel数据...")
    df = pd.read_excel(excel_path)
    print(f"  读取完成: {len(df):,} 行")
    print(f"  列名: {df.columns.tolist()}")
    
    # 转换为polars
    df = pl.from_pandas(df)
    
    # 2. 处理数据
    print(f"\n[2/4] 处理数据...")
    
    # 提取创建月份
    df = df.with_columns([
        pl.col('创建时间').str.slice(0, 7).alias('创建月份')
    ])
    
    # 筛选从start_month开始的数据
    df = df.filter(pl.col('创建月份') >= start_month)
    print(f"  筛选后: {len(df):,} 行")
    
    # 获取所有月份
    months = df.select('创建月份').unique().sort('创建月份')
    month_list = months['创建月份'].to_list()
    print(f"  发现 {len(month_list)} 个月份: {', '.join(month_list)}")
    
    # 获取所有开发人
    developers = df.select('开发人').unique().sort('开发人')
    developer_list = [d for d in developers['开发人'].to_list() if d is not None]
    print(f"  发现 {len(developer_list)} 个开发人: {', '.join(developer_list)}")
    
    # 3. 生成时间维度报告
    print("\n[3/4] 生成时间维度报告...")
    
    summary_results = []
    month_results = {}
    
    for month in month_list:
        # 筛选该月份的数据
        month_data = df.filter(pl.col('创建月份') == month)
        
        # 按ASIN汇总
        agg_exprs = [
            pl.col('SKU').last().alias('SKU'),
            pl.col('标题').last().alias('标题'),
            pl.col('开发人').last().alias('开发人'),
            pl.col('销量').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销量'),
            pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销售额'),
            pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算利润'),
            pl.col('可用库存').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总可用库存'),
            pl.col('listing标签').last().alias('最新标签')
        ]
        
        asin_summary = month_data.group_by('ASIN').agg(agg_exprs)
        month_results[month] = asin_summary
        
        # 计算汇总指标
        total_count = len(asin_summary)
        total_sales_qty = asin_summary['总销量'].sum()
        total_sales_amount = asin_summary['总销售额'].sum()
        total_profit = asin_summary['总结算利润'].sum()
        total_available_stock = asin_summary['总可用库存'].sum()
        total_profit_rate = (total_profit / total_sales_amount * 100) if total_sales_amount > 0 else 0
        
        # 计算存活/留存SKU
        active_df = asin_summary.filter(
            (pl.col('最新标签').str.contains('欧洲精铺2025')) &
            (~pl.col('最新标签').str.contains('淘汰'))
        )
        active_count = len(active_df)
        active_sales_qty = active_df['总销量'].sum()
        active_sales_amount = active_df['总销售额'].sum()
        active_profit = active_df['总结算利润'].sum()
        active_profit_rate = (active_profit / active_sales_amount * 100) if active_sales_amount > 0 else 0
        
        # 计算淘汰SKU
        inactive_df = asin_summary.filter(
            pl.col('最新标签').str.contains('淘汰')
        )
        inactive_count = len(inactive_df)
        inactive_sales_qty = inactive_df['总销量'].sum()
        inactive_sales_amount = inactive_df['总销售额'].sum()
        inactive_profit = inactive_df['总结算利润'].sum()
        inactive_rate = (inactive_count / total_count * 100) if total_count > 0 else 0
        inactive_profit_rate = (inactive_profit / inactive_sales_amount * 100) if inactive_sales_amount > 0 else 0
        
        # 存活率
        survival_rate = (active_count / total_count * 100) if total_count > 0 else 0
        
        summary_results.append({
            '时间': month,
            'SKU总数': total_count,
            '总销售量': int(total_sales_qty),
            '总销售额': round(total_sales_amount, 2),
            '总结算利润': round(total_profit, 2),
            '总利润率': f"{total_profit_rate:.2f}%",
            '总可用库存': int(total_available_stock),
            '存活率': f"{survival_rate:.2f}%",
            '存活sku销售量': int(active_sales_qty),
            '存活sku销售额': round(active_sales_amount, 2),
            '存活SKU数': active_count,
            '留存SKU总利润': round(active_profit, 2),
            '留存SKU利润率': f"{active_profit_rate:.2f}%",
            '淘汰SKU销售量': int(inactive_sales_qty),
            '淘汰SKU销售额': round(inactive_sales_amount, 2),
            '淘汰SKU总数': inactive_count,
            '淘汰率': f"{inactive_rate:.2f}%",
            '淘汰SKU总利润': round(inactive_profit, 2),
            '淘汰SKU利润率': f"{inactive_profit_rate:.2f}%"
        })
        
        print(f"  {month}: SKU数 {total_count}, 销量 {total_sales_qty:,}, 存活率 {survival_rate:.2f}%")
    
    # 保存时间维度报告
    time_output_path = os.path.join(time_output_dir, "sku_summary_from_excel.xlsx")
    
    with pd.ExcelWriter(time_output_path, engine='openpyxl') as writer:
        # 写入汇总sheet
        summary_df = pl.DataFrame(summary_results)
        summary_df.to_pandas().to_excel(writer, sheet_name='汇总', index=False)
        
        # 写入每个月份的明细sheet
        for month, result_df in month_results.items():
            sheet_name = month.replace('2025-', '25年').replace('2026-', '26年') + '月'
            result_df.to_pandas().to_excel(writer, sheet_name=sheet_name, index=False)
    
    print(f"\n  时间维度报告保存: {time_output_path}")
    print(f"  包含 {len(month_results) + 1} 个sheet: 汇总 + {len(month_results)} 个月份明细")
    
    # 4. 生成开发人维度报告
    print("\n[4/4] 生成开发人维度报告...")
    
    for developer in developer_list:
        generate_developer_report(df, developer, developer_output_dir, month_list)
    
    print(f"\n  开发人维度报告保存到: {developer_output_dir}")
    print(f"  共生成 {len(developer_list)} 个开发人报告")
    
    # 打印汇总
    print("\n" + "=" * 80)
    print("时间维度汇总统计")
    print("=" * 80)
    print(summary_df.to_pandas().to_string(index=False))
    
    return summary_df


def main():
    """主函数"""
    try:
        generate_report_from_excel()
        print("\n" + "=" * 80)
        print("处理完成!")
        print("=" * 80)
        return 0
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
