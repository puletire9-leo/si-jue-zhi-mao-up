#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
性能监控脚本 - 监控数据库和应用性能指标
建议每5分钟运行一次
"""

import mysql.connector
import sys
import os
import json
from datetime import datetime, timedelta
from collections import defaultdict

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


class PerformanceMonitor:
    """性能监控器"""

    def __init__(self):
        self.metrics = {
            'timestamp': datetime.now().isoformat(),
            'database': {},
            'tables': {},
            'queries': {},
            'alerts': []
        }

    def check_database_status(self, cursor):
        """检查数据库状态"""
        print("\n📊 检查数据库状态...")

        # 检查连接数
        cursor.execute("SHOW STATUS LIKE 'Threads_connected'")
        threads_connected = cursor.fetchone()[1]

        cursor.execute("SHOW STATUS LIKE 'Max_used_connections'")
        max_used_connections = cursor.fetchone()[1]

        cursor.execute("SHOW STATUS LIKE 'Threads_running'")
        threads_running = cursor.fetchone()[1]

        self.metrics['database'] = {
            'threads_connected': int(threads_connected),
            'max_used_connections': int(max_used_connections),
            'threads_running': int(threads_running)
        }

        print(f"  当前连接数: {threads_connected}")
        print(f"  最大使用连接数: {max_used_connections}")
        print(f"  运行中线程: {threads_running}")

        # 检查连接数是否过高
        if int(threads_connected) > 80:
            self.metrics['alerts'].append({
                'level': 'warning',
                'message': f'数据库连接数过高: {threads_connected}'
            })

    def check_table_sizes(self, cursor):
        """检查表大小"""
        print("\n📈 检查表大小...")

        cursor.execute("""
            SELECT
                table_name,
                ROUND(data_length / 1024 / 1024, 2) AS data_size_mb,
                ROUND(index_length / 1024 / 1024, 2) AS index_size_mb,
                table_rows
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name LIKE 'product_data_%'
            ORDER BY data_length DESC
        """)

        tables = cursor.fetchall()
        for table in tables:
            table_name, data_size, index_size, rows = table
            self.metrics['tables'][table_name] = {
                'data_size_mb': float(data_size),
                'index_size_mb': float(index_size),
                'rows': int(rows) if rows else 0
            }
            print(f"  {table_name}: {data_size}MB (数据), {index_size}MB (索引), {rows} 行")

    def check_slow_queries(self, cursor):
        """检查慢查询"""
        print("\n🐌 检查慢查询...")

        # 获取慢查询日志状态
        cursor.execute("SHOW VARIABLES LIKE 'slow_query_log%'")
        slow_log_status = cursor.fetchall()

        cursor.execute("SHOW VARIABLES LIKE 'long_query_time'")
        long_query_time = cursor.fetchone()[1]

        print(f"  慢查询阈值: {long_query_time}秒")

        # 检查最近的慢查询（如果 performance_schema 可用）
        try:
            cursor.execute("""
                SELECT
                    DIGEST_TEXT as query,
                    COUNT_STAR as exec_count,
                    AVG_TIMER_WAIT/1000000000000 as avg_latency_sec,
                    MAX_TIMER_WAIT/1000000000000 as max_latency_sec
                FROM performance_schema.events_statements_summary_by_digest
                WHERE AVG_TIMER_WAIT > 100000000000
                ORDER BY AVG_TIMER_WAIT DESC
                LIMIT 5
            """)

            slow_queries = cursor.fetchall()
            for query in slow_queries:
                query_text, exec_count, avg_latency, max_latency = query
                self.metrics['queries'][query_text[:100]] = {
                    'exec_count': int(exec_count),
                    'avg_latency_sec': float(avg_latency),
                    'max_latency_sec': float(max_latency)
                }
                print(f"  慢查询: {query_text[:50]}... 平均: {avg_latency:.2f}s")

                if float(avg_latency) > 5:
                    self.metrics['alerts'].append({
                        'level': 'critical',
                        'message': f'发现严重慢查询: {avg_latency:.2f}s - {query_text[:50]}'
                    })

        except Exception as e:
            print(f"  无法获取慢查询信息: {e}")

    def check_index_usage(self, cursor):
        """检查索引使用情况"""
        print("\n🔍 检查索引使用情况...")

        try:
            cursor.execute("""
                SELECT
                    table_name,
                    index_name,
                    stat_name,
                    stat_value
                FROM mysql.innodb_index_stats
                WHERE database_name = DATABASE()
                AND table_name LIKE 'product_data_%'
                AND stat_name IN ('n_diff_pfx01', 'size')
                ORDER BY table_name, index_name
            """)

            index_stats = cursor.fetchall()
            for stat in index_stats:
                table_name, index_name, stat_name, stat_value = stat
                print(f"  {table_name}.{index_name}: {stat_name}={stat_value}")

        except Exception as e:
            print(f"  无法获取索引统计: {e}")

    def generate_report(self):
        """生成性能报告"""
        print("\n" + "=" * 60)
        print("性能监控报告")
        print("=" * 60)

        # 保存报告到文件
        report_file = f"performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(self.metrics, f, ensure_ascii=False, indent=2)

        print(f"\n📄 报告已保存: {report_file}")

        # 显示告警
        if self.metrics['alerts']:
            print("\n⚠️  告警信息:")
            for alert in self.metrics['alerts']:
                print(f"  [{alert['level'].upper()}] {alert['message']}")
        else:
            print("\n✅ 没有告警")

    def run(self):
        """运行监控"""
        print("=" * 60)
        print("性能监控")
        print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)

        try:
            conn = mysql.connector.connect(**DB_CONFIG)
            cursor = conn.cursor()

            self.check_database_status(cursor)
            self.check_table_sizes(cursor)
            self.check_slow_queries(cursor)
            self.check_index_usage(cursor)

            cursor.close()
            conn.close()

            self.generate_report()

            print("\n" + "=" * 60)
            print("✅ 监控完成!")
            print("=" * 60)

        except Exception as e:
            print(f"\n❌ 监控失败: {e}")
            sys.exit(1)


def main():
    monitor = PerformanceMonitor()
    monitor.run()


if __name__ == "__main__":
    main()
