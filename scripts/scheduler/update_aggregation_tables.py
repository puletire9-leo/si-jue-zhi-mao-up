#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
定时任务：更新预聚合表数据
建议每小时运行一次
"""

import mysql.connector
import sys
import os
from datetime import datetime, timedelta

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'root',
    'database': 'sijuelishi_dev',
    'port': 3306
}

# 尝试从后端配置读取
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))
    from backend.app.core.config import settings
    DB_CONFIG = {
        'host': settings.MYSQL_HOST,
        'user': settings.MYSQL_USER,
        'password': settings.MYSQL_PASSWORD,
        'database': settings.MYSQL_DATABASE,
        'port': settings.MYSQL_PORT
    }
except Exception:
    pass  # 使用默认配置


def get_tables(cursor):
    """获取所有 product_data_20XXXX 表"""
    cursor.execute("SHOW TABLES LIKE 'product_data_20%'")
    tables = cursor.fetchall()
    return [t[0] for t in tables]


def update_daily_stats(cursor, conn):
    """更新每日统计数据"""
    print("\n📊 更新每日统计数据...")

    tables = get_tables(cursor)
    if not tables:
        print("  没有找到数据表")
        return

    # 使用最新的表
    latest_table = tables[-1]

    # 清空旧数据（保留最近30天）
    cursor.execute("""
        DELETE FROM agg_daily_stats
        WHERE date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    """)

    # 插入新数据
    insert_sql = f"""
        INSERT INTO agg_daily_stats (
            date, category, store, country, developer,
            product_count, total_sales_volume, total_sales_amount,
            total_order_quantity, total_ad_spend, total_ad_sales,
            avg_acoas, avg_roas, avg_cvr
        )
        SELECT
            date,
            SUBSTRING_INDEX(main_category_rank, '|', 1) as category,
            store,
            country,
            developer,
            COUNT(DISTINCT asin) as product_count,
            SUM(sales_volume) as total_sales_volume,
            SUM(sales_amount) as total_sales_amount,
            SUM(order_quantity) as total_order_quantity,
            SUM(ad_spend) as total_ad_spend,
            SUM(ad_sales_amount) as total_ad_sales,
            AVG(CAST(REPLACE(acoas, '%', '') AS DECIMAL(5,2))) as avg_acoas,
            AVG(roas) as avg_roas,
            AVG(CAST(REPLACE(cvr, '%', '') AS DECIMAL(5,2))) as avg_cvr
        FROM {latest_table}
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY date, category, store, country, developer
        ON DUPLICATE KEY UPDATE
            product_count = VALUES(product_count),
            total_sales_volume = VALUES(total_sales_volume),
            total_sales_amount = VALUES(total_sales_amount),
            total_order_quantity = VALUES(total_order_quantity),
            total_ad_spend = VALUES(total_ad_spend),
            total_ad_sales = VALUES(total_ad_sales),
            avg_acoas = VALUES(avg_acoas),
            avg_roas = VALUES(avg_roas),
            avg_cvr = VALUES(avg_cvr),
            updated_at = NOW()
    """

    try:
        cursor.execute(insert_sql)
        conn.commit()
        print(f"  ✅ 更新完成，影响行数: {cursor.rowcount}")
    except Exception as e:
        print(f"  ❌ 更新失败: {e}")


def update_monthly_stats(cursor, conn):
    """更新每月统计数据"""
    print("\n📈 更新每月统计数据...")

    tables = get_tables(cursor)
    if not tables:
        print("  没有找到数据表")
        return

    # 清空旧数据
    cursor.execute("DELETE FROM agg_monthly_stats")

    for table in tables:
        month_code = table.replace('product_data_', '')

        insert_sql = f"""
            INSERT INTO agg_monthly_stats (
                month_code, category, store, country, developer,
                product_count, total_sales_volume, total_sales_amount,
                total_order_quantity, total_ad_spend, total_ad_sales,
                avg_acoas, avg_roas, avg_cvr
            )
            SELECT
                '{month_code}' as month_code,
                SUBSTRING_INDEX(main_category_rank, '|', 1) as category,
                store,
                country,
                developer,
                COUNT(DISTINCT asin) as product_count,
                SUM(sales_volume) as total_sales_volume,
                SUM(sales_amount) as total_sales_amount,
                SUM(order_quantity) as total_order_quantity,
                SUM(ad_spend) as total_ad_spend,
                SUM(ad_sales_amount) as total_ad_sales,
                AVG(CAST(REPLACE(acoas, '%', '') AS DECIMAL(5,2))) as avg_acoas,
                AVG(roas) as avg_roas,
                AVG(CAST(REPLACE(cvr, '%', '') AS DECIMAL(5,2))) as avg_cvr
            FROM {table}
            GROUP BY category, store, country, developer
            ON DUPLICATE KEY UPDATE
                product_count = VALUES(product_count),
                total_sales_volume = VALUES(total_sales_volume),
                total_sales_amount = VALUES(total_sales_amount),
                total_order_quantity = VALUES(total_order_quantity),
                total_ad_spend = VALUES(total_ad_spend),
                total_ad_sales = VALUES(total_ad_sales),
                avg_acoas = VALUES(avg_acoas),
                avg_roas = VALUES(avg_roas),
                avg_cvr = VALUES(avg_cvr),
                updated_at = NOW()
        """

        try:
            cursor.execute(insert_sql)
            conn.commit()
            print(f"  ✅ {table} 处理完成")
        except Exception as e:
            print(f"  ❌ {table} 处理失败: {e}")


def update_ad_performance(cursor, conn):
    """更新广告表现数据"""
    print("\n📢 更新广告表现数据...")

    tables = get_tables(cursor)
    if not tables:
        print("  没有找到数据表")
        return

    latest_table = tables[-1]

    # 清空旧数据（保留最近30天）
    cursor.execute("""
        DELETE FROM agg_ad_performance
        WHERE date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    """)

    insert_sql = f"""
        INSERT INTO agg_ad_performance (
            date, category, store, country, developer,
            ad_spend, ad_sales, acoas, roas,
            impressions, clicks, ctr
        )
        SELECT
            date,
            SUBSTRING_INDEX(main_category_rank, '|', 1) as category,
            store,
            country,
            developer,
            SUM(ad_spend) as ad_spend,
            SUM(ad_sales_amount) as ad_sales,
            AVG(CAST(REPLACE(acoas, '%', '') AS DECIMAL(5,2))) as acoas,
            AVG(roas) as roas,
            SUM(impressions) as impressions,
            SUM(clicks) as clicks,
            AVG(CAST(REPLACE(ctr, '%', '') AS DECIMAL(5,2))) as ctr
        FROM {latest_table}
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY date, category, store, country, developer
        ON DUPLICATE KEY UPDATE
            ad_spend = VALUES(ad_spend),
            ad_sales = VALUES(ad_sales),
            acoas = VALUES(acoas),
            roas = VALUES(roas),
            impressions = VALUES(impressions),
            clicks = VALUES(clicks),
            ctr = VALUES(ctr),
            updated_at = NOW()
    """

    try:
        cursor.execute(insert_sql)
        conn.commit()
        print(f"  ✅ 更新完成，影响行数: {cursor.rowcount}")
    except Exception as e:
        print(f"  ❌ 更新失败: {e}")


def main():
    """主函数"""
    print("=" * 60)
    print("预聚合表数据更新")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # 更新各类统计数据
        update_daily_stats(cursor, conn)
        update_monthly_stats(cursor, conn)
        update_ad_performance(cursor, conn)

        cursor.close()
        conn.close()

        print("\n" + "=" * 60)
        print(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("✅ 所有预聚合表更新完成!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ 执行失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
