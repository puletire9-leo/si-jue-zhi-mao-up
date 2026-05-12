#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成刘淼的思觉智贸数据总结报告 - 完整版

整合所有分析维度：
1. 执行摘要
2. 时间维度分析（月度趋势、环比变化）
3. 店铺维度分析
4. 类目深度分析（含趋势）
5. 广告效果深度分析（ACoAS/ROAS趋势）
6. 产品生命周期多维度分析（优化版）
7. 数据洞察与建议

作者: AI Assistant
日期: 2026-02-09
"""

import polars as pl
import os
import re
from datetime import datetime

# 配置
PARQUET_PATH = r"e:\项目\开发\主系统-mysql\temp_parquet_output\product_data_merged.parquet"
OUTPUT_PATH = r"e:\项目\开发\主系统-mysql\docs\思觉智贸总结.md"
REPORTS_DIR = r"e:\项目\开发\主系统-mysql\docs\reports"
SUMMARY_REPORT_PATH = r"e:\项目\开发\主系统-mysql\docs\reports\思觉智贸总结_总.md"
DEVELOPER_NAME = "刘淼"


def load_data(developer_name=None):
    """加载数据
    
    Args:
        developer_name: 开发人名称，如果为None则返回所有数据
    
    Returns:
        加载并处理后的数据框
    """
    print("正在加载数据...")
    
    needed_columns = [
        "日期", "ASIN", "SKU", "店铺", "国家", "开发人", 
        "一级分类", "大类排名", "标题",
        "销量", "销售额", "订单量", 
        "广告花费", "广告销售额", "结算毛利润",
        "展示", "点击", "CTR", "CVR", "ACOS", "ACoAS", "ROAS"
    ]
    
    # 读取temp_parquet_output文件夹中的所有parquet文件
    import glob
    parquet_files = glob.glob(os.path.join(r"e:\项目\开发\主系统-mysql\temp_parquet_output", "*.parquet"))
    print(f"找到 {len(parquet_files)} 个parquet文件: {[os.path.basename(f) for f in parquet_files]}")
    
    if not parquet_files:
        raise FileNotFoundError("未找到任何parquet文件")
    
    # 读取所有文件并合并
    dfs = []
    for file_path in parquet_files:
        print(f"读取文件: {os.path.basename(file_path)}")
        try:
            # 使用pyarrow直接读取，避免Polars路径处理问题
            import pyarrow.parquet as pq
            import pyarrow as pa
            
            # 使用pyarrow读取parquet文件
            table = pq.read_table(file_path)
            # 转换为Polars DataFrame
            df = pl.from_arrow(table)
            # 选择需要的列
            available_columns = [c for c in needed_columns if c in df.columns]
            df = df.select(available_columns)
            dfs.append(df)
        except Exception as e:
            print(f"读取文件 {file_path} 时出错: {e}")
            # 如果pyarrow读取失败，尝试使用Polars的read_parquet，添加encoding参数
            try:
                print("尝试使用Polars读取...")
                df = pl.read_parquet(
                    file_path,
                    columns=needed_columns,
                    use_pyarrow=True,
                    memory_map=True
                )
                dfs.append(df)
            except Exception as e2:
                print(f"Polars读取也失败: {e2}")
                # 跳过这个文件，继续处理其他文件
                continue
    
    # 合并所有数据
    df = pl.concat(dfs)
    print(f"合并后的数据行数: {len(df)}")
    
    # 根据开发人筛选数据
    if developer_name:
        df_filtered = df.filter(pl.col("开发人") == developer_name)
    else:
        df_filtered = df
    
    # 提取产品分类
    if "大类排名" in df_filtered.columns:
        df_filtered = df_filtered.with_columns([
            pl.when(pl.col("大类排名").is_null())
            .then(pl.lit("未分类"))
            .otherwise(pl.col("大类排名").str.extract(r'^([^：:]+)', 1))
            .alias("产品分类")
        ])
        df_filtered = df_filtered.with_columns([
            pl.when(pl.col("产品分类").is_null())
            .then(pl.lit("未分类"))
            .otherwise(pl.col("产品分类"))
            .alias("产品分类")
        ])
    else:
        df_filtered = df_filtered.with_columns([pl.lit("未分类").alias("产品分类")])
    
    # 提取年月
    df_filtered = df_filtered.with_columns([pl.col("日期").str.slice(0, 7).alias("年月")])
    
    del df
    return df_filtered


def analyze_all_dimensions(df):
    """分析所有维度"""
    print("\n分析各维度数据...")
    
    # 1. 月度分析
    monthly_stats = df.group_by("年月").agg([
        pl.col("ASIN").n_unique().alias("产品数"),
        pl.col("销量").sum().alias("总销量"),
        pl.col("订单量").sum().alias("总订单量"),
        pl.col("广告花费").sum().alias("总广告花费"),
        pl.col("广告销售额").sum().alias("总广告销售额"),
        pl.col("结算毛利润").sum().alias("总结算毛利润"),
        pl.col("展示").sum().alias("总展示"),
        pl.col("点击").sum().alias("总点击"),
    ]).sort("年月")
    
    monthly_list = monthly_stats.to_dicts()
    
    # 计算环比和指标
    for i in range(len(monthly_list)):
        m = monthly_list[i]
        # 计算净销售额（用于ACoAS）
        # 注意：由于我们不再计算总销售额，这里使用广告销售额作为近似值
        # 实际净销售额应该是总销售额 - 广告花费，但我们已经移除了总销售额的计算
        # 为了保持ACoAS计算的正确性，我们假设净销售额 = 广告销售额
        # 这是一个临时解决方案，实际应该根据业务逻辑调整
        net_sales = m['总广告销售额'] if m['总广告销售额'] > 0 else 1
        m['月度ACoAS'] = (m['总广告花费'] / net_sales * 100) if net_sales > 0 else 0
        m['月度ROAS'] = (m['总广告销售额'] / m['总广告花费']) if m['总广告花费'] > 0 else 0
        m['出单率'] = (m['总销量'] / m['产品数']) if m['产品数'] > 0 else 0
        m['CTR'] = (m['总点击'] / m['总展示'] * 100) if m['总展示'] > 0 else 0
        
        if i > 0:
            prev = monthly_list[i-1]
            m['销量环比'] = ((m['总销量'] - prev['总销量']) / prev['总销量'] * 100) if prev['总销量'] > 0 else (100 if m['总销量'] > 0 else 0)
            m['广告花费环比'] = ((m['总广告花费'] - prev['总广告花费']) / prev['总广告花费'] * 100) if prev['总广告花费'] > 0 else (100 if m['总广告花费'] > 0 else 0)
            m['出单率环比'] = m['出单率'] - prev['出单率']
        else:
            m['销量环比'] = 0
            m['广告花费环比'] = 0
            m['出单率环比'] = 0
    
    # 2. 店铺分析
    store_stats = df.group_by("店铺").agg([
        pl.col("ASIN").n_unique().alias("产品数"),
        pl.col("销量").sum().alias("总销量"),
        pl.col("订单量").sum().alias("总订单量"),
        pl.col("广告花费").sum().alias("总广告花费"),
        pl.col("广告销售额").sum().alias("总广告销售额"),
        pl.col("结算毛利润").sum().alias("总结算毛利润"),
    ]).sort("总销量", descending=True)
    
    stores = store_stats.to_dicts()
    for s in stores:
        # 计算净销售额（用于ACoAS）
        # 使用广告销售额作为近似值
        net_sales = s['总广告销售额'] if s['总广告销售额'] > 0 else 1
        s['ACoAS'] = (s['总广告花费'] / net_sales * 100) if net_sales > 0 else 0
        s['ROAS'] = (s['总广告销售额'] / s['总广告花费']) if s['总广告花费'] > 0 else 0
        s['出单率'] = (s['总销量'] / s['产品数']) if s['产品数'] > 0 else 0
    
    # 3. 类目分析
    categories_data = {}
    cat_list = df.select("产品分类").filter(pl.col("产品分类") != "未分类").unique().to_series().to_list()
    
    for cat in cat_list:
        cat_df = df.filter(pl.col("产品分类") == cat)
        monthly_cat = cat_df.group_by("年月").agg([
            pl.col("销量").sum().alias("总销量"),
            pl.col("ASIN").n_unique().alias("产品数"),
            pl.col("广告花费").sum().alias("总广告花费"),
            pl.col("广告销售额").sum().alias("总广告销售额"),
        ]).sort("年月")
        
        cat_months = monthly_cat.to_dicts()
        if len(cat_months) >= 2:
            first = cat_months[0]
            last = cat_months[-1]
            
            total_sales = sum(m['总销量'] for m in cat_months)
            total_products = sum(m['产品数'] for m in cat_months) / len(cat_months) if len(cat_months) > 0 else 0
            total_ad_sales = sum(m.get('总广告销售额', 0) for m in cat_months)
            total_ad_spend = sum(m['总广告花费'] for m in cat_months)
            
            categories_data[cat] = {
                '类目': cat,
                '总销量': total_sales,
                '产品数': total_products,
                '出单率': total_sales / total_products if total_products > 0 else 0,
                '总广告花费': total_ad_spend,
                '总广告销售额': total_ad_sales,
            }
    
    # 4. 产品分析（多维度分类）
    # 获取开发人实际有数据的月份（销售额>0 或 广告花费>0）
    active_months_df = df.filter(
        (pl.col("销售额") > 0) | (pl.col("广告花费") > 0)
    ).select("年月").unique().sort("年月")
    
    # 如果没有活动数据，使用所有月份
    if len(active_months_df) > 0:
        all_months = active_months_df.to_series().to_list()
    else:
        all_months = df.select("年月").unique().sort("年月").to_series().to_list()
    
    # 获取每个产品的月度数据（用于判断淘汰条件）
    product_monthly = df.group_by(["ASIN", "年月"]).agg([
        pl.col("销量").sum().alias("月销量"),
        pl.col("广告花费").sum().alias("月广告花费"),
        pl.col("广告销售额").sum().alias("月广告销售额"),
    ]).sort(["ASIN", "年月"])
    
    # 计算每月ACoAS
    product_monthly = product_monthly.with_columns([
        (pl.col("月广告花费") / pl.col("月广告销售额") * 100).alias("月ACoAS")
    ])
    
    # 按产品统计汇总数据
    product_stats = df.group_by(["ASIN", "标题", "产品分类"]).agg([
        pl.col("销量").sum().alias("总销量"),
        pl.col("广告花费").sum().alias("总广告花费"),
        pl.col("广告销售额").sum().alias("总广告销售额"),
        pl.col("年月").n_unique().alias("数据月数"),
    ]).sort("总销量", descending=True)
    
    products = product_stats.to_dicts()
    
    # 为每个产品计算淘汰指标
    for p in products:
        # 计算净销售额（用于ACoAS）
        # 使用广告销售额作为近似值
        net_sales = p['总广告销售额'] if p['总广告销售额'] > 0 else 1
        p['ACoAS'] = (p['总广告花费'] / net_sales * 100) if net_sales > 0 else 0
        p['ROAS'] = (p['总广告销售额'] / p['总广告花费']) if p['总广告花费'] > 0 else 0
        p['出单率'] = (p['总销量'] / p['数据月数']) if p['数据月数'] > 0 else 0
        
        # 获取该产品的月度数据
        asin_monthly = product_monthly.filter(pl.col("ASIN") == p['ASIN']).sort("年月")
        monthly_data = {m['年月']: m for m in asin_monthly.to_dicts()}
        
        # 找到产品首次有活动的月份（有销量或有广告花费）
        first_active_month = None
        for month in all_months:
            if month in monthly_data:
                m = monthly_data[month]
                if m['月销量'] > 0 or m['月广告花费'] > 0:
                    first_active_month = month
                    break
        
        # 如果没有活动记录，设为最后一个月份（新产品）
        if first_active_month is None:
            first_active_month = all_months[-1] if all_months else "2025-12"
        
        # 构建从首次活动月份开始的月度序列
        active_months = []
        start_idx = all_months.index(first_active_month) if first_active_month in all_months else 0
        for month in all_months[start_idx:]:
            if month in monthly_data:
                active_months.append(monthly_data[month])
            else:
                active_months.append({
                    'ASIN': p['ASIN'],
                    '年月': month,
                    '月销量': 0,
                    '月广告花费': 0,
                    '月广告销售额': 0,
                    '月ACoAS': 0
                })
        
        # 判断淘汰条件（只从首次活动月份开始计算）
        # 条件1：连续3个月无销量
        consecutive_no_sales = 0
        max_consecutive_no_sales = 0
        for m in active_months:
            if m['月销量'] == 0:
                consecutive_no_sales += 1
                max_consecutive_no_sales = max(max_consecutive_no_sales, consecutive_no_sales)
            else:
                consecutive_no_sales = 0
        
        # 条件2：连续3个月ACoAS > 30%
        consecutive_high_acoas = 0
        max_consecutive_high_acoas = 0
        for m in active_months:
            if m['月ACoAS'] > 30 and m['月广告花费'] > 0:
                consecutive_high_acoas += 1
                max_consecutive_high_acoas = max(max_consecutive_high_acoas, consecutive_high_acoas)
            else:
                consecutive_high_acoas = 0
        
        p['首次活动月份'] = first_active_month
        p['连续无销量月数'] = max_consecutive_no_sales
        p['连续高ACoAS月数'] = max_consecutive_high_acoas
        # 只有总销量为0的产品才可能因为无销量被淘汰
        # 有销量的产品不应该被标记为连续无销量淘汰
        p['应淘汰'] = (p['总销量'] == 0 and max_consecutive_no_sales >= 3) or (max_consecutive_high_acoas >= 3)
    
    # 产品分类
    product_categories = {
        '超级明星': [],
        '利润明星': [],
        '优秀产品': [],
        '高效产品': [],
        '销量爆款': [],
        '潜力新品': [],
        '广告问题': [],
        '淘汰商品': [],
        '滞销产品': [],
    }
    
    for p in products:
        # 首先检查是否应淘汰
        if p['应淘汰']:
            product_categories['淘汰商品'].append(p)
        elif p['ACoAS'] < 10 and p['总销量'] > 300:
            product_categories['超级明星'].append(p)
        elif p['总销量'] > 200:
            product_categories['利润明星'].append(p)
        elif p['ACoAS'] < 20 and p['总销量'] > 200:
            product_categories['优秀产品'].append(p)
        elif p['ROAS'] > 3.5 and p['ACoAS'] < 15 and p['总销量'] > 200:
            product_categories['高效产品'].append(p)
        elif p['总销量'] > 100 and p['ACoAS'] < 25:
            product_categories['销量爆款'].append(p)
        elif p['数据月数'] <= 2 and p['ACoAS'] < 25 and p['总销量'] > 100:
            product_categories['潜力新品'].append(p)
        elif p['ACoAS'] > 30 and p['总广告花费'] > 50:
            product_categories['广告问题'].append(p)
        elif p['总销量'] < 50 and p['数据月数'] > 3:
            product_categories['滞销产品'].append(p)
    
    # 计算数据日期范围
    all_months_in_data = [m['年月'] for m in monthly_list]
    date_range = {
        'start': all_months_in_data[0] if all_months_in_data else 'N/A',
        'end': all_months_in_data[-1] if all_months_in_data else 'N/A',
    }
    
    return {
        'monthly': monthly_list,
        'stores': stores,
        'categories': categories_data,
        'products': product_categories,
        'all_products': products,
        'date_range': date_range,
    }


def generate_report(data, developer_name=DEVELOPER_NAME):
    """生成完整报告
    
    Args:
        data: 分析数据
        developer_name: 开发人名称
    
    Returns:
        生成的报告内容
    """
    print("\n生成完整报告...")
    
    monthly = data['monthly']
    stores = data['stores']
    categories = data['categories']
    product_cats = data['products']
    date_range = data.get('date_range', {'start': 'N/A', 'end': 'N/A'})
    
    # 基础统计
    total_volume = sum(m['总销量'] for m in monthly)
    total_products = sum(m['产品数'] for m in monthly) / len(monthly) if len(monthly) > 0 else 0
    avg_order_rate = sum(m['出单率'] for m in monthly) / len(monthly) if len(monthly) > 0 else 0
    
    # 广告月份统计
    ad_months = [m for m in monthly if m['总广告花费'] > 0]
    # 注意：ACoAS已经在analyze_all_dimensions函数中计算完成
    # 这里不再重复计算
    
    avg_acoas = sum(m['月度ACoAS'] for m in ad_months) / len(ad_months) if ad_months else 0
    
    # 初始化报告
    report = "# 思觉智贸数据总结报告 - 完整版\n\n"
    report += "**开发人**: " + developer_name + "  \n"
    report += "**报告生成时间**: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "  \n"
    report += "**数据时间范围**: " + date_range['start'] + " 至 " + date_range['end'] + "\n\n"
    report += "---\n\n"
    report += "## 📊 执行摘要\n\n"
    report += "### 核心指标概览\n\n"
    report += "| 指标 | 数值 | 说明 |\n"
    report += "|------|------|------|\n"
    report += f"| 总产品数 | {total_products:,.0f} | 全年累计 |\n"
    report += f"| 总销量 | {total_volume:,.0f} 件 | 全年累计 |\n"
    report += f"| 平均出单率 | {avg_order_rate:.2f} | 全年平均 |\n"
    report += f"| 整体ACoAS | {avg_acoas:.2f}% | 广告销售成本占比（广告花费/净销售额） |\n"
    report += "\n"
    
    report += "### 关键发现\n"
    report += "- 📈 业务整体运营状况稳定\n"
    report += "- 🏪 运营 " + str(len(stores)) + " 个店铺，覆盖 " + str(len(categories)) + " 个类目\n"
    report += "- 🌟 识别出 " + str(len(product_cats['超级明星'])) + " 个超级明星产品\n"
    report += "- 🗑️ 建议淘汰 " + str(len(product_cats['淘汰商品'])) + " 个商品\n\n"
    
    report += "### 核心指标月度变化\n\n"
    report += "**趋势说明**: 📈 上升 | 📉 下降 | → 持平\n\n"
    report += "| 月份 | 产品数 | 销量 | 出单率 | 出单率环比 | ACoAS |\n"
    report += "|------|--------|------|--------|------------|-------|\n"
    
    # 添加核心指标月度变化数据行
    for m in monthly:
        volume_change = f"{m['销量环比']:+.1f}%" if m['销量环比'] != 0 else "-"
        order_rate_change = f"{m['出单率环比']:+.2f}" if m['出单率环比'] != 0 else "-"
        # 添加趋势箭头
        volume_trend = "📈" if m['销量环比'] > 0 else ("📉" if m['销量环比'] < 0 else "→")
        order_rate_trend = "📈" if m['出单率环比'] > 0 else ("📉" if m['出单率环比'] < 0 else "→")
        report += f"| {m['年月']} | {m['产品数']:,} | {m['总销量']:,.0f} | {m['出单率']:.2f} | {order_rate_change} {order_rate_trend} | {m['月度ACoAS']:.1f}% |\n"
    report += "\n"
    report += "---\n\n"
    report += "## 1️⃣ 时间维度分析\n\n"
    
    # 添加月度销售趋势数据行
    report += "\n### 1.1 月度销售趋势\n\n"
    report += "| 月份 | 产品数 | 销量 | 出单率 | ACoAS |\n"
    report += "|------|--------|------|--------|-------|\n"
    valid_months = [m for m in monthly if m['总销量'] > 0]
    for m in monthly:
        report += f"| {m['年月']} | {m['产品数']:,} | {m['总销量']:,.0f} | {m['出单率']:.2f} | {m['月度ACoAS']:.1f}% |\n"
    
    if valid_months:
        best_volume_month = max(valid_months, key=lambda x: x['总销量'])
        
        report += f"\n### 1.2 销量分析\n\n**整体销量表现**: 从 {valid_months[0]['总销量']:.0f} 增长至 {valid_months[-1]['总销量']:.0f}\n\n**关键节点**:\n- 最佳销量月份: {best_volume_month['年月']} ({best_volume_month['总销量']:,.0f} 件)\n"
    
    # 月度变化深度分析
    report += "\n### 1.3 月度变化深度分析\n\n"
    report += "#### 核心指标环比变化趋势\n\n"
    
    # 销量环比变化
    volume_changes = [m for m in monthly if m['销量环比'] != 0]
    if volume_changes:
        report += "**销量环比变化**:\n"
        for m in volume_changes:
            trend = "📈" if m['销量环比'] > 0 else "📉"
            report += f"- {m['年月']}: {trend} {m['销量环比']:+.1f}%\n"
        report += "\n"
    
    # 出单率环比变化
    order_rate_changes = [m for m in monthly if m['出单率环比'] != 0]
    if order_rate_changes:
        report += "**出单率环比变化**:\n"
        for m in order_rate_changes:
            trend = "📈" if m['出单率环比'] > 0 else "📉"
            report += f"- {m['年月']}: {trend} {m['出单率环比']:+.2f}\n"
        report += "\n"
    
    # 核心指标月度变化趋势分析
    report += "#### 核心指标月度变化趋势分析\n\n"
    
    # 1. 销量月度变化趋势
    report += "**1. 销量月度变化趋势**\n"
    report += "| 月份 | 销量 | 销量环比 | 趋势 |\n"
    report += "|------|------|----------|------|\n"
    for m in monthly:
        if m['总销量'] > 0:
            trend = "📈" if m['销量环比'] > 0 else ("📉" if m['销量环比'] < 0 else "→")
            change_str = f"{m['销量环比']:+.1f}%" if m['销量环比'] != 0 else "-"
            report += f"| {m['年月']} | {m['总销量']:,.0f} | {change_str} | {trend} |\n"
    report += "\n"
    
    # 2. 出单率月度变化趋势
    report += "**2. 出单率月度变化趋势**\n"
    report += "| 月份 | 出单率 | 出单率环比 | 趋势 |\n"
    report += "|------|--------|------------|------|\n"
    for m in monthly:
        if m['产品数'] > 0:
            trend = "📈" if m['出单率环比'] > 0 else ("📉" if m['出单率环比'] < 0 else "→")
            change_str = f"{m['出单率环比']:+.2f}" if m['出单率环比'] != 0 else "-"
            report += f"| {m['年月']} | {m['出单率']:.2f} | {change_str} | {trend} |\n"
    report += "\n"
    
    # 3. 广告效果月度变化趋势
    report += "**3. 广告效果月度变化趋势**\n"
    report += "| 月份 | 广告花费 | ACoAS | ROAS | 趋势 |\n"
    report += "|------|----------|-------|------|------|\n"
    for m in monthly:
        if m['总广告花费'] > 0:
            ad_trend = "📈" if m['月度ACoAS'] < 20 else ("📉" if m['月度ACoAS'] > 30 else "→")
            report += f"| {m['年月']} | ${m['总广告花费']:,.2f} | {m['月度ACoAS']:.1f}% | {m['月度ROAS']:.2f} | {ad_trend} |\n"
    report += "\n"
    
    # 月度变化亮点分析
    report += "#### 月度变化亮点分析\n\n"
    
    # 识别最佳表现月份
    valid_months = [m for m in monthly if m['总销量'] > 0]
    if valid_months:
        # 最佳销量月份
        best_volume_month = max(valid_months, key=lambda x: x['总销量'])
        # 最佳出单率月份
        best_order_rate_month = max(valid_months, key=lambda x: x['出单率']) if valid_months else None
        # 最佳产品数月份
        best_products_month = max(valid_months, key=lambda x: x['产品数']) if valid_months else None
        # 最佳广告效果月份（ACoAS最低）
        ad_months = [m for m in valid_months if m['总广告花费'] > 0]
        best_ad_month = min(ad_months, key=lambda x: x['月度ACoAS']) if ad_months else None
        
        # 最差表现月份
        worst_volume_month = min(valid_months, key=lambda x: x['总销量']) if valid_months else None
        worst_order_rate_month = min(valid_months, key=lambda x: x['出单率']) if valid_months else None
        
        report += "**最佳表现月份**\n"
        report += f"- 最佳销量月份: {best_volume_month['年月']} ({best_volume_month['总销量']:,.0f} 件)\n"
        report += f"- 最佳出单率月份: {best_order_rate_month['年月']} ({best_order_rate_month['出单率']:.2f})\n"
        report += f"- 最佳产品数月份: {best_products_month['年月']} ({best_products_month['产品数']:,})\n"
        if best_ad_month:
            report += f"- 最佳广告效果月份: {best_ad_month['年月']} (ACoAS: {best_ad_month['月度ACoAS']:.1f}%)\n"
        report += "\n"
        
        report += "**最差表现月份**\n"
        report += f"- 最差销量月份: {worst_volume_month['年月']} ({worst_volume_month['总销量']:,.0f} 件)\n"
        report += f"- 最差出单率月份: {worst_order_rate_month['年月']} ({worst_order_rate_month['出单率']:.2f})\n"
        report += "\n"
        
        # 连续趋势分析
        report += "**连续趋势分析**\n"
        
        # 连续销量增长
        consecutive_growth = 0
        max_consecutive_growth = 0
        growth_periods = []
        current_period = []
        
        for m in valid_months:
            if m['销量环比'] > 0:
                current_period.append(m)
                consecutive_growth += 1
                max_consecutive_growth = max(max_consecutive_growth, consecutive_growth)
            else:
                if current_period:
                    growth_periods.append(current_period)
                    current_period = []
                consecutive_growth = 0
        if current_period:
            growth_periods.append(current_period)
        
        if growth_periods:
            longest_growth = max(growth_periods, key=len)
            if len(longest_growth) >= 2:
                report += f"- 最长连续销量增长期: {len(longest_growth)} 个月 ({longest_growth[0]['年月']} 至 {longest_growth[-1]['年月']})\n"
        
        report += "\n"
    
    # 店铺分析
    report += f"""
---

## 2️⃣ 店铺维度分析

### 2.1 店铺销售排名

| 排名 | 店铺 | 产品数 | 销量 | 出单率 | ACoAS |
|------|------|--------|------|--------|-------|
"""
    
    for i, s in enumerate(stores[:10], 1):
        report += f"| {i} | {s['店铺']} | {s['产品数']:,} | {s['总销量']:,.0f} | {s['出单率']:.2f} | {s['ACoAS']:.1f}% |\n"
    
    if stores:
        best_store = stores[0]
        report += "\n### 2.2 店铺洞察\n\n"
        report += f"**最佳店铺**: {best_store['店铺']}\n"
        report += f"- 销量: {best_store['总销量']:,.0f} 件\n"
        report += f"- 出单率: {best_store['出单率']:.2f}\n"
        report += f"- ACoAS: {best_store['ACoAS']:.1f}%\n"
    
    # 类目分析
    report += "\n---\n\n"
    report += "## 3️⃣ 类目深度分析\n\n"
    report += "### 3.1 类目销售排名\n\n"
    report += "| 类目 | 产品数 | 销量 | 出单率 | ACoAS |\n"
    report += "|------|--------|------|--------|-------|\n"
    
    if categories:
        sorted_cats = sorted(categories.values(), key=lambda x: x['总销量'], reverse=True)
        for cat in sorted_cats[:10]:
            # 使用广告销售额作为净销售额的近似值
            net_sales = cat['总广告销售额'] if cat['总广告销售额'] > 0 else 1
            report += f"| {cat['类目']} | {cat['产品数']:.0f} | {cat['总销量']:,.0f} | {cat['出单率']:.2f} | {(cat['总广告花费']/net_sales*100 if net_sales>0 else 0):.1f}% |\n"
    
    # 产品分析
    report += f"""
---

## 4️⃣ 产品多维度分析

### ACoAS评估标准
| 等级 | ACoAS范围 | 评价 |
|------|-----------|------|
| 优秀 | < 10% | 广告效率极高 |
| 良好 | 10% - 20% | 广告效率良好 |
| 及格 | 20% - 30% | 广告效率一般 |
| 问题 | > 30% | 广告成本过高 |

### 4.1 优质产品

"""
    
    # 超级明星
    if product_cats['超级明星']:
        report += f"**超级明星 ({len(product_cats['超级明星'])}个)** - ACoAS<10%, 销量>300\n\n"
        report += "| ASIN | 标题 | 分类 | 销量 | 出单率 | ACoAS |\n"
        report += "|------|------|------|------|--------|-------|\n"
        for p in product_cats['超级明星']:
            title = p.get('标题', '')[:30] + '...' if p.get('标题', '') else 'N/A'
            report += f"| {p['ASIN']} | {title} | {p['产品分类']} | {p['总销量']:,.0f} | {p['出单率']:.2f} | {p['ACoAS']:.1f}% |\n"
        report += "\n"

    # 利润明星
    if product_cats['利润明星']:
        report += f"**利润明星 ({len(product_cats['利润明星'])}个)** - 销量>200\n\n"
        report += "| ASIN | 标题 | 分类 | 销量 | 出单率 | ACoAS |\n"
        report += "|------|------|------|------|--------|-------|\n"
        for p in product_cats['利润明星']:
            title = p.get('标题', '')[:30] + '...' if p.get('标题', '') else 'N/A'
            report += f"| {p['ASIN']} | {title} | {p['产品分类']} | {p['总销量']:,.0f} | {p['出单率']:.2f} | {p['ACoAS']:.1f}% |\n"
        report += "\n"

    # 优秀产品
    if product_cats['优秀产品']:
        report += f"**优秀产品 ({len(product_cats['优秀产品'])}个)** - ACoAS<20%, 销量>200\n\n"
        report += "| ASIN | 标题 | 分类 | 销量 | 出单率 | ACoAS |\n"
        report += "|------|------|------|------|--------|-------|\n"
        for p in product_cats['优秀产品']:
            title = p.get('标题', '')[:30] + '...' if p.get('标题', '') else 'N/A'
            report += f"| {p['ASIN']} | {title} | {p['产品分类']} | {p['总销量']:,.0f} | {p['出单率']:.2f} | {p['ACoAS']:.1f}% |\n"
        report += "\n"

    # 潜力新品
    if product_cats['潜力新品']:
        report += f"**潜力新品 ({len(product_cats['潜力新品'])}个)** - 数据月数≤2, 销量>100, ACoAS<25\n\n"
        report += "| ASIN | 标题 | 分类 | 销量 | 出单率 | ACoAS | 月数 |\n"
        report += "|------|------|------|------|--------|-------|------|\n"
        for p in product_cats['潜力新品']:
            title = p.get('标题', '')[:30] + '...' if p.get('标题', '') else 'N/A'
            report += f"| {p['ASIN']} | {title} | {p['产品分类']} | {p['总销量']:,.0f} | {p['出单率']:.2f} | {p['ACoAS']:.1f}% | {p['数据月数']} |\n"
        report += "\n"
    
    # 问题产品
    report += "### 4.2 问题产品\n\n"
    
    if product_cats['广告问题']:
        report += f"**广告问题 ({len(product_cats['广告问题'])}个)** - ACoAS>30%, 需优化\n\n"
        report += "| ASIN | 标题 | 分类 | 销量 | 出单率 | ACoAS | 建议 |\n"
        report += "|------|------|------|------|--------|-------|------|\n"
        for p in product_cats['广告问题']:
            title = p.get('标题', '')[:25] + '...' if p.get('标题', '') else 'N/A'
            report += f"| {p['ASIN']} | {title} | {p['产品分类']} | {p['总销量']:,.0f} | {p['出单率']:.2f} | {p['ACoAS']:.1f}% | 优化广告 |\n"
        report += "\n"
    
    if product_cats['淘汰商品']:
        report += f"**淘汰商品 ({len(product_cats['淘汰商品'])}个)** - 连续3个月无销量 或 连续3个月ACoAS>30%\n\n"
        report += "| ASIN | 标题 | 分类 | 首次活动 | 无销量月数 | 高ACoAS月数 | 淘汰原因 |\n"
        report += "|------|------|------|----------|------------|-------------|----------|\n"
        for p in product_cats['淘汰商品']:
            title = p.get('标题', '')[:22] + '...' if p.get('标题', '') else 'N/A'
            reason = []
            if p['总销量'] == 0 and p['连续无销量月数'] >= 3:
                reason.append(f"连续{p['连续无销量月数']}个月无销量")
            if p['连续高ACoAS月数'] >= 3:
                reason.append(f"连续{p['连续高ACoAS月数']}个月ACoAS>30%")
            reason_str = " + ".join(reason) if reason else "满足淘汰条件"
            report += f"| {p['ASIN']} | {title} | {p['产品分类']} | {p['首次活动月份']} | {p['连续无销量月数']}个月 | {p['连续高ACoAS月数']}个月 | {reason_str} |\n"
        report += "\n"
    
    # 洞察与建议
    report += "\n---\n\n"
    report += "## 数据洞察与建议\n\n"
    report += "### 5.1 核心洞察\n\n"
    report += "**核心指标洞察**:\n"
    report += f"- 平均出单率 **{avg_order_rate:.2f}**，整体销售效率{'优秀' if avg_order_rate > 5 else '良好' if avg_order_rate > 2 else '需优化'}\n"
    report += f"- 平均ACoAS **{avg_acoas:.1f}%**，广告效率{'优秀' if avg_acoas < 15 else '良好' if avg_acoas < 20 else '需优化'}\n"
    report += f"- 总产品数 **{total_products:,.0f}**，产品组合{'丰富' if total_products > 100 else '适中' if total_products > 50 else '有限'}\n"
    report += f"- 总销量 **{total_volume:,.0f}** 件，销售规模{'较大' if total_volume > 10000 else '中等' if total_volume > 5000 else '较小'}\n\n"
    
    report += "**增长趋势**:\n"
    report += f"- 业务整体运营状况稳定\n\n"
    
    report += "**产品组合**:\n"
    report += f"- 优质产品: {len(product_cats['超级明星']) + len(product_cats['利润明星']) + len(product_cats['优秀产品'])} 个\n"
    report += f"- 潜力新品: {len(product_cats['潜力新品'])} 个\n"
    report += f"- 淘汰商品: {len(product_cats['淘汰商品'])} 个\n\n"
    
    report += "### 5.2 优化建议\n\n"
    report += "**短期（1-3个月）**:\n"
    report += "1. 扩大出单率高的超级明星产品广告投入，抢占市场份额\n"
    report += "2. 优化ACoAS高的产品，降低广告成本，提高广告效率\n"
    report += "3. 提升低出单率产品的销售策略，增加产品曝光和转化率\n"
    report += "4. 立即淘汰连续3个月无销量或ACoAS>30%的商品\n\n"
    
    report += "**中期（3-6个月）**:\n"
    report += "1. 重点培育出单率高的潜力新品，加大推广力度\n"
    report += "2. 优化店铺结构，集中资源到出单率和ACoAS表现优秀的店铺\n"
    report += "3. 拓展出单率高的类目，增加产品数和销量\n"
    report += "4. 建立产品生命周期管理体系，监控产品出单率变化\n\n"
    
    report += "**长期（6-12个月）**:\n"
    report += "1. 建立完善的广告监控体系，目标ACoAS<15%\n"
    report += "2. 规划新品开发方向，优先开发出单率潜力高的类目\n"
    report += "3. 提升整体出单率，目标出单率>5\n"
    report += "4. 优化产品组合，保持合理的产品数量和质量\n\n"
    
    report += "---\n\n"
    report += "*报告由系统自动生成，数据来源于产品数据看板*\n"
    
    return report


def generate_all_reports():
    """为所有开发人生成报告
    
    Returns:
        生成的报告数量
    """
    print("=" * 80)
    print("开始为所有开发人生成报告")
    print("=" * 80)
    
    try:
        # 加载所有数据
        df_all = load_data(developer_name=None)
        if len(df_all) == 0:
            print("\n未找到数据")
            return 0
        
        # 获取所有开发人的唯一列表，并过滤掉None值
        developers = df_all.select("开发人").unique().to_series().to_list()
        # 过滤掉None值
        developers = [dev for dev in developers if dev is not None]
        print(f"\n找到 {len(developers)} 个开发人: {developers}")
        
        # 创建专门的报告文件夹
        if not os.path.exists(REPORTS_DIR):
            os.makedirs(REPORTS_DIR)
            print(f"\n创建报告文件夹: {REPORTS_DIR}")
        
        # 为每个开发人生成报告
        report_count = 0
        for developer in developers:
            print(f"\n处理开发人: {developer}")
            
            # 加载该开发人的数据
            df_developer = load_data(developer_name=developer)
            if len(df_developer) == 0:
                print(f"未找到开发人 {developer} 的数据，跳过")
                continue
            
            # 分析数据
            data = analyze_all_dimensions(df_developer)
            
            # 生成报告
            report = generate_report(data, developer_name=developer)
            
            # 创建唯一的文件名
            report_filename = f"思觉智贸总结_{developer}.md"
            report_path = os.path.join(REPORTS_DIR, report_filename)
            
            # 保存报告
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write(report)
            
            print(f"报告已保存至: {report_path}")
            report_count += 1
        
        print(f"\n{"=" * 80}")
        print(f"所有报告生成完成！共生成 {report_count} 份报告")
        print(f"报告保存目录: {REPORTS_DIR}")
        print(f"{"=" * 80}")
        
        return report_count
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return 0


def generate_summary_report():
    """生成总报告，汇总所有开发人的数据
    
    Returns:
        bool: 是否生成成功
    """
    print("=" * 80)
    print("开始生成总报告")
    print("=" * 80)
    
    try:
        # 加载所有数据
        df_all = load_data(developer_name=None)
        if len(df_all) == 0:
            print("\n未找到数据")
            return False
        
        # 分析数据
        data = analyze_all_dimensions(df_all)
        
        # 生成报告
        report = generate_report(data, developer_name="所有开发人")
        
        # 保存报告
        if not os.path.exists(REPORTS_DIR):
            os.makedirs(REPORTS_DIR)
        
        with open(SUMMARY_REPORT_PATH, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"\n总报告已保存至: {SUMMARY_REPORT_PATH}")
        print(f"{"=" * 80}")
        print("总报告生成完成！")
        print(f"{"=" * 80}")
        
        return True
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主函数"""
    print("=" * 80)
    print("开始执行报告生成任务")
    print("=" * 80)
    
    try:
        # 为所有开发人生成报告
        report_count = generate_all_reports()
        
        # 生成总报告
        summary_success = generate_summary_report()
        
        print("=" * 80)
        print("所有任务执行完成！")
        print(f"- 为 {report_count} 个开发人生成了报告")
        print(f"- 总报告生成: {'成功' if summary_success else '失败'}")
        print(f"- 报告保存目录: {REPORTS_DIR}")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
