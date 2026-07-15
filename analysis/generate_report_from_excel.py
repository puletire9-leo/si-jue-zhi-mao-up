#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从Excel文件生成SKU月度汇总报告

生成两个维度的报告：
1. 时间维度：sku_summary_from_excel.xlsx（汇总 + 各月份明细）
2. 开发人维度：每个开发人一个独立的Excel文件

合并规则（多文件时）：
- 累计字段（销量、销售额、结算毛利润、结算销售额）: 跨文件相加
- 快照字段（可用库存、listing标签）: 取最新窗口的值
- 结算毛利率: Σ结算毛利润 / Σ结算销售额（重算，不直接加/平均）
"""

import pandas as pd
import polars as pl
import os
import re


def _parse_win_end(filename):
    """从文件名中解析窗口结束日期，如 '2026-07-09'"""
    m = re.search(r'(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})', filename)
    return m.group(2) if m else '1970-01-01'


def _compute_settle_sales(df: pl.DataFrame) -> pl.DataFrame:
    """
    为数据框添加 结算销售额 列。

    结算毛利率 = 结算毛利润 / 结算销售额 → 结算销售额 = 结算毛利润 / 率

    当结算毛利率 <= 0 或不可解析时（通常为亏损SKU），用订单销售额兜底。
    """
    rate = (
        pl.col('结算毛利率')
        .str.replace('%', '', literal=True)
        .cast(pl.Float64, strict=False)
        .fill_nan(0)
        .fill_null(0)
        / 100.0
    )
    profit = pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0)
    order_sales = pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0)

    settle_sales = pl.when(rate > 0).then(profit / rate).otherwise(order_sales)
    return df.with_columns(settle_sales.alias('结算销售额'))


def generate_developer_report(
    df: pl.DataFrame,
    developer: str,
    output_dir: str,
    month_list: list
):
    """为单个开发人生成报告"""
    print(f"\n  生成 {developer} 的报告...")

    dev_data = df.filter(pl.col('开发人') == developer)

    if dev_data.is_empty():
        print(f"    {developer} 没有数据，跳过")
        return

    asin_summary_by_month = {}
    summary_results = []

    for month in month_list:
        month_data = dev_data.filter(pl.col('创建月份') == month)

        if month_data.is_empty():
            continue

        agg_exprs = [
            pl.col('SKU').last().alias('SKU'),
            pl.col('店铺').last().alias('店铺'),
            pl.col('销量').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销量'),
            pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销售额'),
            pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算利润'),
            pl.col('结算销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算销售额'),
            pl.col('可用库存').sort_by('_win_end', descending=True).first().alias('总可用库存'),
            pl.col('listing标签').sort_by('_win_end', descending=True).first().alias('最新标签'),
        ]

        asin_summary = month_data.group_by('ASIN').agg(agg_exprs)
        asin_summary_by_month[month] = asin_summary

        total_count = len(asin_summary)
        total_sales_qty = asin_summary['总销量'].sum()
        total_sales_amount = asin_summary['总销售额'].sum()
        total_profit = asin_summary['总结算利润'].sum()
        total_settle_sales = asin_summary['总结算销售额'].sum()
        total_available_stock = asin_summary['总可用库存'].sum()
        total_profit_rate = (total_profit / total_settle_sales * 100) if total_settle_sales > 0 else 0

        active_df = asin_summary.filter(
            (pl.col('最新标签').str.contains('欧洲精铺2025')) &
            (~pl.col('最新标签').str.contains('淘汰'))
        )
        active_count = len(active_df)
        active_sales_qty = active_df['总销量'].sum()
        active_sales_amount = active_df['总销售额'].sum()
        active_profit = active_df['总结算利润'].sum()
        active_settle_sales = active_df['总结算销售额'].sum()
        active_profit_rate = (active_profit / active_settle_sales * 100) if active_settle_sales > 0 else 0

        inactive_df = asin_summary.filter(
            pl.col('最新标签').str.contains('淘汰')
        )
        inactive_count = len(inactive_df)
        inactive_sales_qty = inactive_df['总销量'].sum()
        inactive_sales_amount = inactive_df['总销售额'].sum()
        inactive_profit = inactive_df['总结算利润'].sum()
        inactive_settle_sales = inactive_df['总结算销售额'].sum()
        inactive_rate = (inactive_count / total_count * 100) if total_count > 0 else 0
        inactive_profit_rate = (inactive_profit / inactive_settle_sales * 100) if inactive_settle_sales > 0 else 0

        survival_rate = (active_count / total_count * 100) if total_count > 0 else 0

        summary_results.append({
            '时间': month,
            'SKU总数': total_count,
            '总销售量': int(total_sales_qty),
            '总销售额': round(total_sales_amount, 2),
            '总结算利润': round(total_profit, 2),
            '总结算销售额': round(total_settle_sales, 2),
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

    output_path = os.path.join(output_dir, f"{developer}_sku_report.xlsx")

    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        summary_df = pl.DataFrame(summary_results)
        summary_df.to_pandas().to_excel(writer, sheet_name='汇总', index=False)

        for month, result_df in asin_summary_by_month.items():
            sheet_name = month.replace('2025-', '25年').replace('2026-', '26年') + '月'
            result_df.to_pandas().to_excel(writer, sheet_name=sheet_name, index=False)

    print(f"    保存成功: {output_path}")
    print(f"    包含 {len(asin_summary_by_month) + 1} 个sheet")


def generate_report_from_excel(
    excel_path: str = None,
    input_dir: str = r'e:\项目\si-jue-zhi-mao-up\analysis\读取文件',
    time_output_dir: str = r'e:\项目\si-jue-zhi-mao-up\analysis\时间维度',
    developer_output_dir: str = r'e:\项目\si-jue-zhi-mao-up\analysis\开发人维度',
    start_month: str = "2025-04"
):
    """从Excel文件生成月度汇总报告"""
    print("=" * 80)
    print("从Excel生成SKU月度汇总报告")
    print("=" * 80)

    os.makedirs(time_output_dir, exist_ok=True)
    os.makedirs(developer_output_dir, exist_ok=True)

    # ---- 1. 读取Excel数据 ----
    print("\n[1/4] 读取Excel数据...")

    if excel_path and os.path.exists(excel_path):
        df = pd.read_excel(excel_path)
        df['_win_end'] = _parse_win_end(os.path.basename(excel_path))
        print(f"  读取单个文件: {os.path.basename(excel_path)}")
    else:
        import glob
        excel_files = glob.glob(os.path.join(input_dir, '*.xlsx'))
        excel_files = [f for f in excel_files if not os.path.basename(f).startswith('~$')]

        if not excel_files:
            raise FileNotFoundError(f"在 {input_dir} 目录下未找到Excel文件")

        print(f"  发现 {len(excel_files)} 个Excel文件:")
        for f in excel_files:
            print(f"    - {os.path.basename(f)}")

        dfs = []
        for file_path in excel_files:
            try:
                temp_df = pd.read_excel(file_path)
                temp_df['_win_end'] = _parse_win_end(os.path.basename(file_path))
                dfs.append(temp_df)
                print(f"  读取成功: {os.path.basename(file_path)} ({len(temp_df)} 行)")
            except Exception as e:
                print(f"  读取失败: {os.path.basename(file_path)} - {e}")

        if not dfs:
            raise ValueError("没有成功读取任何Excel文件")

        df = pd.concat(dfs, ignore_index=True)
        print(f"\n  合并完成: 共 {len(df):,} 行")

    print(f"  列名: {df.columns.tolist()}")

    # 转换为polars
    df = pl.from_pandas(df)

    # ---- 2. 处理数据 ----
    print(f"\n[2/4] 处理数据...")

    # 提取创建月份
    df = df.with_columns([
        pl.col('创建时间').str.slice(0, 7).alias('创建月份')
    ])

    # 计算每行的结算销售额
    df = _compute_settle_sales(df)

    # 筛选从start_month开始的数据
    df = df.filter(pl.col('创建月份') >= start_month)
    print(f"  筛选后: {len(df):,} 行")

    months = df.select('创建月份').unique().sort('创建月份')
    month_list = months['创建月份'].to_list()
    print(f"  发现 {len(month_list)} 个月份: {', '.join(month_list)}")

    developers = df.select('开发人').unique().sort('开发人')
    developer_list = [d for d in developers['开发人'].to_list() if d is not None]
    print(f"  发现 {len(developer_list)} 个开发人: {', '.join(developer_list)}")

    # ---- 3. 生成时间维度报告 ----
    print("\n[3/4] 生成时间维度报告...")

    summary_results = []
    month_results = {}

    for month in month_list:
        month_data = df.filter(pl.col('创建月份') == month)

        agg_exprs = [
            pl.col('SKU').last().alias('SKU'),
            pl.col('店铺').last().alias('店铺'),
            pl.col('开发人').last().alias('开发人'),
            pl.col('负责人').last().alias('负责人'),
            pl.col('销量').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销量'),
            pl.col('销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总销售额'),
            pl.col('结算毛利润').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算利润'),
            pl.col('结算销售额').cast(pl.Float64, strict=False).fill_null(0).sum().alias('总结算销售额'),
            pl.col('可用库存').sort_by('_win_end', descending=True).first().alias('总可用库存'),
            pl.col('listing标签').sort_by('_win_end', descending=True).first().alias('最新标签'),
        ]

        asin_summary = month_data.group_by('ASIN').agg(agg_exprs)
        month_results[month] = asin_summary

        total_count = len(asin_summary)
        total_sales_qty = asin_summary['总销量'].sum()
        total_sales_amount = asin_summary['总销售额'].sum()
        total_profit = asin_summary['总结算利润'].sum()
        total_settle_sales = asin_summary['总结算销售额'].sum()
        total_available_stock = asin_summary['总可用库存'].sum()
        total_profit_rate = (total_profit / total_settle_sales * 100) if total_settle_sales > 0 else 0

        # 存活/留存SKU
        active_df = asin_summary.filter(
            (pl.col('最新标签').str.contains('欧洲精铺2025')) &
            (~pl.col('最新标签').str.contains('淘汰'))
        )
        active_count = len(active_df)
        active_sales_qty = active_df['总销量'].sum()
        active_sales_amount = active_df['总销售额'].sum()
        active_profit = active_df['总结算利润'].sum()
        active_settle_sales = active_df['总结算销售额'].sum()
        active_profit_rate = (active_profit / active_settle_sales * 100) if active_settle_sales > 0 else 0

        # 淘汰SKU
        inactive_df = asin_summary.filter(
            pl.col('最新标签').str.contains('淘汰')
        )
        inactive_count = len(inactive_df)
        inactive_sales_qty = inactive_df['总销量'].sum()
        inactive_sales_amount = inactive_df['总销售额'].sum()
        inactive_profit = inactive_df['总结算利润'].sum()
        inactive_settle_sales = inactive_df['总结算销售额'].sum()
        inactive_rate = (inactive_count / total_count * 100) if total_count > 0 else 0
        inactive_profit_rate = (inactive_profit / inactive_settle_sales * 100) if inactive_settle_sales > 0 else 0

        survival_rate = (active_count / total_count * 100) if total_count > 0 else 0

        summary_results.append({
            '时间': month,
            'SKU总数': total_count,
            '总销售量': int(total_sales_qty),
            '总销售额': round(total_sales_amount, 2),
            '总结算利润': round(total_profit, 2),
            '总结算销售额': round(total_settle_sales, 2),
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

        print(f"  {month}: SKU数 {total_count}, 销量 {total_sales_qty:,}, "
              f"总利润率 {total_profit_rate:.2f}%")

    # ---- 构建「求和/平均」行 ----
    sum_columns = {
        'SKU总数', '总销售量', '总销售额', '总结算利润', '总结算销售额', '总可用库存',
        '存活sku销售量', '存活sku销售额', '存活SKU数', '留存SKU总利润',
        '淘汰SKU销售量', '淘汰SKU销售额', '淘汰SKU总数', '淘汰SKU总利润'
    }
    avg_columns = {
        '存活率', '淘汰率'
    }
    # 利润率：不平均各月率，而是 Σ总利润 / Σ总结算销售额
    rate_from_totals = {
        '总利润率', '留存SKU利润率', '淘汰SKU利润率'
    }

    summary_row = {'时间': '求和/平均'}

    for col in summary_results[0].keys():
        if col == '时间':
            continue

        values = [item[col] for item in summary_results]

        if col in sum_columns:
            summary_row[col] = sum(values)
        elif col in avg_columns:
            rate_values = [float(str(v).replace('%', '')) for v in values]
            avg_rate = sum(rate_values) / len(rate_values) if rate_values else 0
            summary_row[col] = f"{avg_rate:.2f}%"
        elif col in rate_from_totals:
            continue  # 下面统一计算
        else:
            summary_row[col] = sum(values)

    # ---- 利润率：Σ总利润 / Σ总结算销售额 ----
    # 总利润率
    total_profit_all = sum(item['总结算利润'] for item in summary_results)
    total_settle_all = sum(item['总结算销售额'] for item in summary_results)
    summary_row['总利润率'] = f"{(total_profit_all / total_settle_all * 100):.2f}%" if total_settle_all > 0 else "0.00%"

    # 留存/淘汰SKU利润率：重跑月度明细汇总
    ta_profit = 0.0
    ta_settle = 0.0
    ti_profit = 0.0
    ti_settle = 0.0
    for month in month_list:
        asin_summary = month_results[month]
        active_df = asin_summary.filter(
            (pl.col('最新标签').str.contains('欧洲精铺2025')) &
            (~pl.col('最新标签').str.contains('淘汰'))
        )
        inactive_df = asin_summary.filter(
            pl.col('最新标签').str.contains('淘汰')
        )
        if len(active_df):
            ta_profit += active_df['总结算利润'].sum()
            ta_settle += active_df['总结算销售额'].sum()
        if len(inactive_df):
            ti_profit += inactive_df['总结算利润'].sum()
            ti_settle += inactive_df['总结算销售额'].sum()

    summary_row['留存SKU利润率'] = f"{(ta_profit / ta_settle * 100):.2f}%" if ta_settle > 0 else "0.00%"
    summary_row['淘汰SKU利润率'] = f"{(ti_profit / ti_settle * 100):.2f}%" if ti_settle > 0 else "0.00%"

    summary_results.append(summary_row)

    # ---- 保存时间维度报告 ----
    time_output_path = os.path.join(time_output_dir, "sku_summary_from_excel.xlsx")

    with pd.ExcelWriter(time_output_path, engine='openpyxl') as writer:
        summary_df = pl.DataFrame(summary_results)
        summary_df.to_pandas().to_excel(writer, sheet_name='汇总', index=False)

        for month, result_df in month_results.items():
            sheet_name = month.replace('2025-', '25年').replace('2026-', '26年') + '月'
            result_df.to_pandas().to_excel(writer, sheet_name=sheet_name, index=False)

    print(f"\n  时间维度报告保存: {time_output_path}")
    print(f"  包含 {len(month_results) + 1} 个sheet: 汇总 + {len(month_results)} 个月份明细")

    # ---- 4. 生成开发人维度报告 ----
    print("\n[4/4] 生成开发人维度报告...")

    for developer in developer_list:
        generate_developer_report(df, developer, developer_output_dir, month_list)

    print(f"\n  开发人维度报告保存到: {developer_output_dir}")
    print(f"  共生成 {len(developer_list)} 个开发人报告")

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
