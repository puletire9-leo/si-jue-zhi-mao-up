#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建预聚合表，用于存储统计汇总数据，提高查询性能
"""

import mysql.connector
import sys
import os

# 添加 backend 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

try:
    from backend.app.core.config import settings
    DB_CONFIG = {
        'host': settings.MYSQL_HOST,
        'user': settings.MYSQL_USER,
        'password': settings.MYSQL_PASSWORD,
        'database': settings.MYSQL_DATABASE,
        'port': settings.MYSQL_PORT
    }
except:
    # 默认配置
    DB_CONFIG = {
        'host': 'localhost',
        'user': 'root',
        'password': 'root',
        'database': 'sijuelishi_dev',
        'port': 3306
    }

# 预聚合表定义
AGGREGATION_TABLES = {
    'agg_daily_stats': """
        CREATE TABLE IF NOT EXISTS agg_daily_stats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATE NOT NULL,
            category VARCHAR(255),
            store VARCHAR(100),
            country VARCHAR(100),
            developer VARCHAR(100),
            product_count INT DEFAULT 0,
            total_sales_volume INT DEFAULT 0,
            total_sales_amount DECIMAL(15,2) DEFAULT 0.00,
            total_order_quantity INT DEFAULT 0,
            total_ad_spend DECIMAL(15,2) DEFAULT 0.00,
            total_ad_sales DECIMAL(15,2) DEFAULT 0.00,
            avg_acoas DECIMAL(5,2) DEFAULT 0.00,
            avg_roas DECIMAL(5,2) DEFAULT 0.00,
            avg_cvr DECIMAL(5,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_date_category (date, category, store, country, developer),
            INDEX idx_date (date),
            INDEX idx_category (category),
            INDEX idx_store (store),
            INDEX idx_country (country),
            INDEX idx_developer (developer)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日统计数据汇总表'
    """,

    'agg_monthly_stats': """
        CREATE TABLE IF NOT EXISTS agg_monthly_stats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month_code VARCHAR(6) NOT NULL,
            category VARCHAR(255),
            store VARCHAR(100),
            country VARCHAR(100),
            developer VARCHAR(100),
            product_count INT DEFAULT 0,
            total_sales_volume INT DEFAULT 0,
            total_sales_amount DECIMAL(15,2) DEFAULT 0.00,
            total_order_quantity INT DEFAULT 0,
            total_ad_spend DECIMAL(15,2) DEFAULT 0.00,
            total_ad_sales DECIMAL(15,2) DEFAULT 0.00,
            avg_acoas DECIMAL(5,2) DEFAULT 0.00,
            avg_roas DECIMAL(5,2) DEFAULT 0.00,
            avg_cvr DECIMAL(5,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_month_category (month_code, category, store, country, developer),
            INDEX idx_month_code (month_code),
            INDEX idx_category (category),
            INDEX idx_store (store),
            INDEX idx_country (country),
            INDEX idx_developer (developer)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每月统计数据汇总表'
    """,

    'agg_category_rank': """
        CREATE TABLE IF NOT EXISTS agg_category_rank (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATE NOT NULL,
            category VARCHAR(255) NOT NULL,
            rank_type ENUM('sales', 'amount', 'growth') NOT NULL,
            asin VARCHAR(50) NOT NULL,
            product_name VARCHAR(500),
            sales_volume INT DEFAULT 0,
            sales_amount DECIMAL(15,2) DEFAULT 0.00,
            rank_num INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_date_category_rank (date, category, rank_type, asin),
            INDEX idx_date (date),
            INDEX idx_category (category),
            INDEX idx_rank_type (rank_type),
            INDEX idx_rank_num (rank_num)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分类排名汇总表'
    """,

    'agg_ad_performance': """
        CREATE TABLE IF NOT EXISTS agg_ad_performance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATE NOT NULL,
            category VARCHAR(255),
            store VARCHAR(100),
            country VARCHAR(100),
            developer VARCHAR(100),
            ad_spend DECIMAL(15,2) DEFAULT 0.00,
            ad_sales DECIMAL(15,2) DEFAULT 0.00,
            acoas DECIMAL(5,2) DEFAULT 0.00,
            roas DECIMAL(5,2) DEFAULT 0.00,
            impressions INT DEFAULT 0,
            clicks INT DEFAULT 0,
            ctr DECIMAL(5,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_date_category (date, category, store, country, developer),
            INDEX idx_date (date),
            INDEX idx_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='广告表现汇总表'
    """
}


def create_tables():
    """创建预聚合表"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        print("=" * 60)
        print("创建预聚合表")
        print("=" * 60)

        for table_name, create_sql in AGGREGATION_TABLES.items():
            try:
                cursor.execute(create_sql)
                conn.commit()
                print(f"✅ 创建表 {table_name} 成功")
            except Exception as e:
                print(f"❌ 创建表 {table_name} 失败: {e}")

        cursor.close()
        conn.close()

        print("\n" + "=" * 60)
        print("预聚合表创建完成!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"错误: {e}")
        return False


if __name__ == "__main__":
    if create_tables():
        print("\n✅ 所有表创建成功!")
    else:
        print("\n❌ 表创建失败!")
        sys.exit(1)
