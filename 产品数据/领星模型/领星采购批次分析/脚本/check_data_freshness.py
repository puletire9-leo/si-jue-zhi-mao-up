# -*- coding: utf-8 -*-
"""
数据同步检查 + 采购数据增量同步触发

用途:
  1. 检查采购计划/采购单/周表的数据时效性 (分析前必须确认同步到位)
  2. 触发领星采购计划/采购单的增量同步 (补缺失月份)

分析前必做: 采购数据可能停在上个月, 必须先检查最新日期, 过期则同步。
同步API走生产 java-product 直连端口 8025 (绕 gateway 鉴权)。

用法:
  python check_data_freshness.py          # 只检查数据时效
  python check_data_freshness.py --sync   # 检查并同步采购数据到昨天
"""
import sys, urllib.request, json
from query_database import q, qone


def check_freshness():
    print("=== 数据时效检查 ===")
    r = qone("SELECT MIN(DATE(create_time)), MAX(DATE(create_time)), COUNT(*) FROM lingxing_purchase_plan WHERE status=-2")
    print(f"采购计划(已完成): {r}")
    r = qone("SELECT MAX(order_time), COUNT(*) FROM lingxing_purchase_order")
    print(f"采购单: {r}")
    r = qone("SELECT MAX(week_start) FROM lingxing_sku_weekly_performance")
    print(f"周表最新周: {r}")
    r = qone("SELECT MAX(lx_update_time) FROM lingxing_listing")
    print(f"Listing最新更新时间: {r}")


def sync_purchase(start_date, end_date):
    """触发采购计划+采购单增量同步"""
    base = "http://127.0.0.1:8025/api/v1/modules/lingxing"

    def post(path, body):
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(f"{base}{path}", data=data,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=600) as resp:
            return json.loads(resp.read().decode("utf-8"))

    print(f"\n同步采购计划 {start_date} ~ {end_date} ...")
    r = post("/purchase/plans/sync",
             {"startDate": start_date, "endDate": end_date, "searchFieldTime": "creator_time"})
    print(f"  结果: {r.get('data', {}).get('fetched')}条, 状态{r.get('code')}")

    print(f"同步采购单 {start_date} ~ {end_date} ...")
    r = post("/purchase/orders/sync",
             {"startDate": start_date, "endDate": end_date, "searchFieldTime": "create_time"})
    print(f"  结果: 单{r.get('data', {}).get('fetchedOrders')}条, 明细{r.get('data', {}).get('upsertedItems')}条, 状态{r.get('code')}")


if __name__ == "__main__":
    check_freshness()
    if "--sync" in sys.argv:
        # 从上次同步日期补到昨天(可用 '2026-06-30' 之类的起点)
        start = input("起始日期(如 2026-06-30): ").strip()
        end = "2026-08-11"  # 或计算昨天
        sync_purchase(start, end)
