#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成月度汇总总表

输出字段：
- 时间
- 总销售额
- 总销售量
- 总结算利润
- 总结算利润率（总结算利润/总销售额）
- 存活率（欧洲精铺2025标签数/标签总数）
"""

import polars as pl
import os


def generate_monthly_summary_report(
    parquet_path: str = "temp_parquet_output/product_data_merged.parquet",
    output_path: str = "temp_parquet_output/monthly_summary_report.xlsx",
    start_month: str = "2025-04"
):
    """
    生成月度汇总总表
    
    Args:
        parquet_path: Parquet文件路径
        output_path: 输出Excel文件路径
        start_month: 开始月份 (格式: YYYY-MM)
    """
    print("=" * 80)
    print("生成月度汇总总表")
    print("=" * 80)
    
    # 1. 读取数据
    print("\n[1/3] 读取Parquet数据...")
    df = pl.read_parquet(parquet_path, columns=[
        '创建时间', 'ASIN', 'MSKU', 'SKU', '品名', '开发人', '销量', '销售额', '结算毛利润', 'listing标签'
    ])
    print(f"  读取完成: {len(df):,} 行")
    
    # 2. 筛选从start_month开始的数据
    print(f"\n[2/3] 筛选从 {start_month} 开始的数据...")
    df = df.filter(pl.col('创建时间').is_not_null())
    df = df.with_columns([
        pl.col('创建时间').str.slice(0, 7).alias('创建月份')
    ])
    df = df.filter(pl.col('创建月份') >= start_month)
    print(f"  筛选后: {len(df):,} 行")
    
    # 获取所有月份
    months = df.select('创建月份').unique().sort('创建月份')
    month_list = months['创建月份'].to_list()
    print(f"  发现 {len(month_list)} 个月份: {', '.join(month_list)}")
    
    # 3. 按月份汇总
    print("\n[3/3] 按月份汇总统计...")
    
    # 预先获取所有ASIN的最新标签（从完整数据中）
    print("  获取所有SKU的最新标签...")
    df_sorted = df.sort(['ASIN', '创建时间'])
    latest_tags = df_sorted.group_by('ASIN').agg([
        pl.col('listing标签').last().alias('最新标签')
    ])
    
    results = []
    for month in month_list:
        # 筛选该月份创建的SKU
        month_data = df.filter(pl.col('创建月份') == month)
        
        # 按ASIN汇总销售数据
        asin_sales = month_data.group_by('ASIN').agg([
            pl.col('销量').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销量'),
            pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销售额'),
            pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算利润')
        ])
        
        # 合并最新标签
        asin_summary = asin_sales.join(latest_tags, on='ASIN', how='left')
        
        # 计算汇总指标
        total_sales = asin_summary['总销量'].sum()
        total_amount = asin_summary['总销售额'].sum()
        total_profit = asin_summary['总结算利润'].sum()
        
        # 计算利润率
        profit_rate = (total_profit / total_amount * 100) if total_amount > 0 else 0
        
        # 计算存活率（包含"欧洲精铺2025"但不包含"淘汰"的SKU数 / 总数）
        total_count = len(asin_summary)
        # 包含"欧洲精铺2025"但不包含"淘汰"
        active_count = asin_summary.filter(
            (pl.col('最新标签').str.contains('欧洲精铺2025')) &
            (~pl.col('最新标签').str.contains('淘汰'))
        ).height
        survival_rate = (active_count / total_count * 100) if total_count > 0 else 0
        
        results.append({
            '时间': month,
            '总销售额': round(total_amount, 2),
            '总销售量': int(total_sales),
            '总结算利润': round(total_profit, 2),
            '总结算利润率': f"{profit_rate:.2f}%",
            '存活率': f"{survival_rate:.2f}%",
            'SKU总数': total_count,
            '存活SKU数': active_count
        })
        
        print(f"  {month}: 销售额 £{total_amount:,.2f}, 销量 {total_sales:,}, 利润率 {profit_rate:.2f}%, 存活率 {survival_rate:.2f}%")
    
    # 4. 创建结果DataFrame并保存
    print("\n" + "=" * 80)
    print("保存结果...")
    result_df = pl.DataFrame(results)
    
    # 保存为Excel（多sheet）
    import pandas as pd
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        # 写入汇总sheet
        result_df.to_pandas().to_excel(writer, sheet_name='汇总', index=False)
        
        # 写入每个月份的明细sheet
        for month in month_list:
            # 筛选该月份创建的SKU
            month_data = df.filter(pl.col('创建月份') == month)
            
            # 按ASIN汇总销售数据，并保留其他字段
            asin_summary = month_data.sort('创建时间').group_by('ASIN').agg([
                pl.col('MSKU').last().alias('MSKU'),
                pl.col('SKU').last().alias('SKU'),
                pl.col('品名').last().alias('品名'),
                pl.col('开发人').last().alias('开发人'),
                pl.col('销量').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销量'),
                pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销售额'),
                pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算利润'),
                pl.col('listing标签').last().alias('最新标签')
            ])
            
            # 选择需要的列并排序
            asin_summary = asin_summary.select([
                'ASIN', 'MSKU', 'SKU', '品名', '开发人', 
                '总销量', '总销售额', '总结算利润', '最新标签'
            ])
            
            # 转换为pandas并写入sheet
            sheet_name = month.replace('2025-', '25年').replace('2026-', '26年') + '月'
            asin_summary.to_pandas().to_excel(writer, sheet_name=sheet_name, index=False)
        
    print(f"  保存成功: {output_path}")
    print(f"  包含 {len(month_list) + 1} 个sheet: 汇总 + {len(month_list)} 个月份明细")
    
    # 打印汇总
    print("\n" + "=" * 80)
    print("汇总统计")
    print("=" * 80)
    print(result_df.to_pandas().to_string(index=False))
    
    return result_df


def main():
    """主函数"""
    # 获取项目根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    
    # 设置路径
    parquet_path = os.path.join(project_root, "temp_parquet_output", "product_data_merged.parquet")
    output_path = os.path.join(project_root, "temp_parquet_output", "monthly_summary_report_v2.xlsx")
    
    # 检查文件是否存在
    if not os.path.exists(parquet_path):
        print(f"错误: 找不到Parquet文件: {parquet_path}")
        return 1
    
    # 执行生成
    try:
        generate_monthly_summary_report(parquet_path, output_path, "2025-04")
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
