# -*- coding: utf-8 -*-
"""
通用数据库查询工具 (领星库)

用途: 直连领星MySQL，执行SQL查询/检查数据，避免高频 docker exec 打爆 WSL2 内存
依赖: pip install pymysql
数据库: 读 config/public + config/secrets（密码 MYSQL_PASSWORD，端口 MYSQL_PORT_EXTERNAL）

⚠️ 铁律: 分析类查数据禁止高频 docker exec, 必须用 pymysql 直连, 一次连接批量查
"""
import sys
from pathlib import Path

import pymysql

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from config_env import local_mysql_config  # noqa: E402

DB_CONFIG = local_mysql_config()


def get_conn():
    return pymysql.connect(**DB_CONFIG)


def q(sql, args=None, conn=None):
    """执行查询并返回全部行(list of tuple)"""
    own = conn is None
    c = own and get_conn() or conn
    try:
        with c.cursor() as cur:
            cur.execute(sql, args)
            return cur.fetchall()
    finally:
        if own:
            c.close()


def qone(sql, args=None, conn=None):
    """执行查询返回第一行"""
    rows = q(sql, args, conn)
    return rows[0] if rows else None


def show_tables(conn=None):
    """列出所有表"""
    return q("SHOW TABLES", conn=conn)


def show_columns(table, conn=None):
    """查看表结构"""
    return q(f"SHOW COLUMNS FROM `{table}`", conn=conn)


def build_in_clause(n):
    """生成IN占位符, 如 n=3 -> '%s,%s,%s'"""
    return ",".join(["%s"] * n)


if __name__ == "__main__":
    import sys
    # 命令行用法: python query_database.py "SELECT COUNT(*) FROM lingxing_purchase_plan"
    if len(sys.argv) > 1:
        sql = sys.argv[1]
        for row in q(sql):
            print(row)
    else:
        # 默认打印所有表
        print("=== 领星库所有表 ===")
        for (t,) in q("SHOW TABLES"):
            print(f"  {t}")
        print("\n用法: python query_database.py \"SELECT COUNT(*) FROM lingxing_purchase_plan\"")
