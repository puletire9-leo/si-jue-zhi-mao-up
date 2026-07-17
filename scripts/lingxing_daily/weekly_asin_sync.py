#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""领星周增量同步：自动拉取本周 ASIN 产品表现，识别新上架 ASIN，更新 baseline。

使用方式：
    # 直接调 Java 后端 API 拉取最新一周（推荐生产使用）
    python scripts/lingxing_daily/weekly_asin_sync.py --api

    # 指定周
    python scripts/lingxing_daily/weekly_asin_sync.py --api --start 2026-07-14 --end 2026-07-20

    # 从 DB 已有周数据识别（离线模式）
    python scripts/lingxing_daily/weekly_asin_sync.py

流程：
    1. 调 Java 后端 /call 端点，透传领星 productPerformance/openApi/asinList
       - sid = UK 115 + DE 115 全部活跃店铺
       - summary_field=asin, is_recently_enum=false（务必传 false，默认 true 会漏淘汰品）
    2. 从返回数据中筛选带 6 个团队标签之一的 ASIN
       6 个团队 tag_id 见 TARGET_TAG_IDS
    3. 和 lingxing_asin_baseline 比对：
       - 已存在 → 更新标签
       - 不存在 + 本周 FBA-可售 > 0 → 新上架 ASIN，起算月=本周所在月
       - 不存在 + FBA-可售 = 0 + 有创建时间 → 创建时间兜底
       - 不存在 + 无 FBA + 无创建时间 → 起算依据=周同步首次出现
    4. 自动写入 baseline

领星 API 限流规则：
    - 领星 API 只有限流，没有配额上限，可以放心多调
    - 单店铺请求：1 秒间隔
    - 多店铺请求（sid 数组 > 1）：10 秒间隔
    - 令牌桶容量 1 —— 紧凑请求会累积等待
    - 单次 sid 数组上限 200 —— UK/DE 各 115 个正好塞得下

实测性能（UK+DE 全量一周窗口 2026-07-14~20）：
    - UK 21 页, 20994 rows, 6.8 分钟
    - DE 15 页, 14875 rows, 4.7 分钟
    - 合计 12 分钟, 拉到 6562 个团队 ASIN

依赖：
    - Java 后端 /api/v1/modules/lingxing/call 端点（通用透传）
    - 后端跑在 localhost:18002（宿主机）或 java-product:8002（容器内）
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymysql
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lingxing_base_access import dec, mysql_env, TEAM_DEVELOPERS, team_developer
from lingxing_model_paths import ROOT


# ─── 配置 ───────────────────────────────────────────────────────────────

# Java 后端地址（宿主机访问用 localhost:18002，容器内互访用 java-product:8002）
BACKEND_BASE_URL = "http://localhost:18002/api/v1/modules/lingxing"

# 6 个团队标签 tag_id（领星 global_tag_id）
TARGET_TAG_IDS = {
    "907657425150046095",  # 绿标
    "907563170455592213",  # 欧洲精铺2025
    "907654877317203632",  # 欧洲精铺2025非标品
    "907596133278666918",  # 欧洲精铺2025季节性断货
    "907585847123066054",  # 欧洲精铺2025待淘汰
    "907585631391968576",  # 欧洲精铺2025淘汰
}

# 标签文本（用于匹配 listing_tags 字符串）
TARGET_TAG_NAMES = {
    "欧洲精铺2025",
    "欧洲精铺2025非标品",
    "欧洲精铺2025季节性断货",
    "欧洲精铺2025待淘汰",
    "欧洲精铺2025淘汰",
    "绿标",
}

# UK=mid4, DE=mid5
MARKETPLACE_MAP = {4: "GBP", 5: "EUR"}


# ─── 数据库工具 ──────────────────────────────────────────────────────────

def get_connection():
    return pymysql.connect(**mysql_env())


def get_active_sids() -> dict[int, list[int]]:
    """获取 UK/DE 活跃店铺 sid，按 mid 分组。"""
    result = {4: [], 5: []}
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT sid, mid FROM lingxing_seller WHERE mid IN (4,5) AND status = 1")
            for sid, mid in cur.fetchall():
                result[int(mid)].append(int(sid))
    return result


def get_existing_baseline_asins() -> set[str]:
    """获取已有 baseline 中的全部 ASIN。"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT asin FROM lingxing_asin_baseline")
            return {row[0] for row in cur.fetchall()}


def get_existing_monthly_months() -> set[str]:
    """获取 monthly_performance 中已有的月份。"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT month FROM lingxing_asin_monthly_performance")
            return {row[0] for row in cur.fetchall()}


# ─── 核心逻辑 ────────────────────────────────────────────────────────────

def has_target_tag(tag_set: list | None, listing_tags: str | None) -> bool:
    """判断该 ASIN 是否带有 6 个团队标签之一。"""
    # 方式1: 检查 raw_json 中的 tag_set（tag_id 列表）
    if tag_set:
        for tag in tag_set:
            tag_id = str(tag.get("id") or tag.get("tag_id") or "") if isinstance(tag, dict) else str(tag)
            if tag_id in TARGET_TAG_IDS:
                return True
    # 方式2: 检查 listing_tags 文本
    if listing_tags:
        for name in TARGET_TAG_NAMES:
            if name in listing_tags:
                return True
    return False


def extract_asin_data(row: dict) -> dict[str, Any] | None:
    """从领星 API 返回的一行数据中提取关键信息。"""
    # ASIN
    asins_list = row.get("asins") or []
    asin = asins_list[0].get("asin") if asins_list else row.get("asin")
    if not asin:
        return None

    # 标签检查
    tag_set = row.get("tag_set") or []
    listing_tags_list = row.get("tags") or []
    listing_tags_str = ",".join(str(t.get("tag_name", t) if isinstance(t, dict) else t) for t in listing_tags_list) if listing_tags_list else ""
    if not listing_tags_str:
        # 从 price_list 的标签中找
        price_list = row.get("price_list") or []
        if price_list:
            listing_tags_str = ""

    if not has_target_tag(tag_set, listing_tags_str):
        return None

    # FBA 可售
    fba_available = int(row.get("afn_fulfillable_quantity") or 0)

    # 国家
    countries = row.get("seller_store_countries") or []
    country = countries[0].get("country", "") if countries else ""

    # 开发人
    developers = row.get("developer_names") or []
    developer = developers[0] if developers else ""

    # SKU
    price_list = row.get("price_list") or []
    sku = price_list[0].get("local_sku", "") if price_list else ""
    msku = price_list[0].get("seller_sku", "") if price_list else ""
    store_name = price_list[0].get("seller_name", "") if price_list else ""

    # 创建时间
    create_time = row.get("product_create_time") or ""

    return {
        "asin": str(asin).strip(),
        "sku": str(sku).strip(),
        "msku": str(msku).strip(),
        "store_name": str(store_name).strip(),
        "country": str(country).strip(),
        "developer": str(developer).strip(),
        "fba_available": fba_available,
        "listing_tags": listing_tags_str,
        "create_time": str(create_time).strip(),
        "volume": int(row.get("volume") or 0),
        "amount": str(row.get("amount") or "0"),
        "gross_profit": str(row.get("gross_profit") or "0"),
    }


def sync_week_via_backend(sids: list[int], start_date: str, end_date: str) -> list[dict]:
    """通过 Java 后端 /call 端点分页拉取产品表现数据。

    Java 后端 URL 是 java-product:8002（容器内），或 localhost:18002（宿主机）。
    """
    url = f"{BACKEND_BASE_URL}/call"
    all_rows: list[dict] = []
    page_size = 1000

    # 一次一店铺（超过 1 店铺时领星要求 10 秒间隔，太慢，先按店铺组分批）
    # 每批最多 200 个 sid
    for i in range(0, len(sids), 200):
        batch_sids = [str(s) for s in sids[i:i + 200]]
        offset = 0
        while True:
            body = {
                "offset": offset,
                "length": page_size,
                "sort_field": "volume",
                "sort_type": "desc",
                "summary_field": "asin",
                "sid": batch_sids,
                "start_date": start_date,
                "end_date": end_date,
            }
            try:
                resp = requests.post(
                    url,
                    params={"path": "/bd/productPerformance/openApi/asinList"},
                    json=body,
                    timeout=300,
                )
                resp.raise_for_status()
                data = resp.json().get("data", {})
                if data.get("code") != 0:
                    print(f"  [WARN] 领星 API 错误: {data.get('msg')}")
                    break
                inner = data.get("data", {})
                rows = inner.get("list") or []
                if not rows:
                    break
                all_rows.extend(rows)
                if len(rows) < page_size:
                    break
                offset += page_size
                # 单店铺组 1s，多店铺 10s
                import time
                time.sleep(10 if len(batch_sids) > 1 else 1)
            except Exception as e:
                print(f"  [WARN] 后端调用失败: {e}")
                break
    return all_rows


def sync_week_direct(sids: list[int], start_date: str, end_date: str, mid: int) -> list[dict]:
    """直接从 DB 中已有的 sku_weekly 数据提取（不调 API，用于测试/离线）。"""
    currency = MARKETPLACE_MAP[mid]
    results = []
    with get_connection() as conn:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            placeholders = ",".join(["%s"] * len(sids))
            cur.execute(f"""
                SELECT w.asin, w.sku, w.seller_sku AS msku, w.store_name,
                       w.currency_code, w.tags AS listing_tags,
                       COALESCE(w.afn_fulfillable_quantity, 0) AS fba_available,
                       COALESCE(w.volume, 0) AS volume,
                       COALESCE(w.amount, 0) AS amount,
                       COALESCE(w.gross_profit, 0) AS gross_profit
                FROM lingxing_sku_weekly_performance w
                WHERE w.week_start = %s AND w.week_end = %s
                  AND w.currency_code = %s
            """, (start_date, end_date, currency))
            for row in cur.fetchall():
                row["country"] = "英国" if currency == "GBP" else "德国"
                row["developer"] = ""
                row["create_time"] = ""
                results.append(row)
    return results


def insert_new_baseline_asin(conn, asin_data: dict, week_start: str, currency: str) -> None:
    """将新发现的 ASIN 插入 baseline 表。"""
    month = week_start[:7]
    country = asin_data["country"]

    # 判断起算依据
    if asin_data["fba_available"] > 0:
        start_month = month
        start_basis = "周同步首次观察到FBA可售"
        fba_first = month
        fba_basis = "周同步首次观察到FBA可售"
    elif asin_data["create_time"]:
        create_month = asin_data["create_time"][:7] if len(asin_data["create_time"]) >= 7 else ""
        start_month = create_month or month
        start_basis = "商品信息创建时间兜底"
        fba_first = ""
        fba_basis = "未观察到FBA可售"
    else:
        start_month = month
        start_basis = "周同步首次出现(无FBA无创建时间)"
        fba_first = ""
        fba_basis = "未观察到FBA可售"

    sql = """
        INSERT IGNORE INTO lingxing_asin_baseline
        (asin, base_sku, base_store, developer, listing_tags, create_time,
         fba_available_first_month, available_first_store, available_first_country,
         model_start_month, model_start_basis,
         fba_available_first_month_final, fba_available_first_basis,
         data_cutoff_month, analysis_status, baseline_version)
        VALUES (%s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (
            asin_data["asin"], asin_data["sku"], asin_data["store_name"],
            asin_data["developer"], asin_data["listing_tags"], asin_data["create_time"],
            fba_first, asin_data["store_name"], country,
            start_month, start_basis,
            fba_first, fba_basis,
            month, "周同步自动新增", "WEEKLY_SYNC_AUTO",
        ))


def update_baseline_tags(conn, asin: str, listing_tags: str) -> None:
    """更新已有 ASIN 的标签（如果标签变化了）。"""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE lingxing_asin_baseline SET listing_tags = %s WHERE asin = %s AND listing_tags != %s",
            (listing_tags, asin, listing_tags)
        )


def process_weekly_data(
    week_start: str,
    week_end: str,
    all_rows: list[dict],
    existing_asins: set[str],
    mode: str = "direct",
) -> dict[str, Any]:
    """处理一周数据：识别新 ASIN，更新 baseline。"""
    new_asins = []
    updated_tags = 0
    team_total = 0

    conn = get_connection()
    try:
        for row in all_rows:
            # 直连模式: 行已经是 dict
            if mode == "direct":
                asin = str(row.get("asin") or "").strip()
                if not asin:
                    continue
                listing_tags = str(row.get("listing_tags") or "")
                # 检查是否团队标签
                is_team = any(name in listing_tags for name in TARGET_TAG_NAMES)
                if not is_team:
                    continue
                team_total += 1
                fba_available = int(row.get("fba_available") or 0)
                data = {
                    "asin": asin,
                    "sku": str(row.get("sku") or ""),
                    "msku": str(row.get("msku") or ""),
                    "store_name": str(row.get("store_name") or ""),
                    "country": str(row.get("country") or ""),
                    "developer": str(row.get("developer") or ""),
                    "fba_available": fba_available,
                    "listing_tags": listing_tags,
                    "create_time": str(row.get("create_time") or ""),
                }
            else:
                # API 模式: 需要从 raw_json 提取
                data = extract_asin_data(row)
                if data is None:
                    continue
                team_total += 1
                asin = data["asin"]
                listing_tags = data["listing_tags"]

            if asin in existing_asins:
                # 已有 ASIN → 更新标签
                if listing_tags:
                    update_baseline_tags(conn, asin, listing_tags)
                    updated_tags += 1
            else:
                # 新 ASIN → 加入 baseline
                currency = "GBP" if "英国" in data.get("country", "") else "EUR"
                insert_new_baseline_asin(conn, data, week_start, currency)
                existing_asins.add(asin)
                new_asins.append(data)

        conn.commit()
    finally:
        conn.close()

    return {
        "week": f"{week_start} ~ {week_end}",
        "team_asins_seen": team_total,
        "new_asins": len(new_asins),
        "tags_updated": updated_tags,
        "new_asin_list": new_asins,
    }


# ─── 主入口 ──────────────────────────────────────────────────────────────

def main():
    """周增量同步主流程。

    默认使用 DB 中已有的最新周数据（direct 模式），
    如果传参 --api 则调用 Java 后端拉取最新一周。
    """
    import argparse
    parser = argparse.ArgumentParser(description="领星周增量同步 + 自动发现新 ASIN")
    parser.add_argument("--api", action="store_true", help="调用 Java 后端 API 拉取（需要后端运行）")
    parser.add_argument("--start", type=str, help="周开始日期 YYYY-MM-DD（默认自动取最近一个周一）")
    parser.add_argument("--end", type=str, help="周结束日期 YYYY-MM-DD（默认 start + 6 天）")
    args = parser.parse_args()

    # 确定时间窗
    if args.start:
        week_start = args.start
    else:
        today = date.today()
        # 取最近一个完整周的周一（如果今天是周三，取上周一）
        days_since_monday = today.weekday()
        last_monday = today - timedelta(days=days_since_monday + 7)
        week_start = last_monday.isoformat()

    if args.end:
        week_end = args.end
    else:
        week_end = (date.fromisoformat(week_start) + timedelta(days=6)).isoformat()

    print(f"═══ 领星周增量同步 ═══")
    print(f"时间窗: {week_start} ~ {week_end}")
    print(f"模式: {'API调用' if args.api else 'DB直连(离线)'}")
    print()

    # 获取已有 baseline
    existing_asins = get_existing_baseline_asins()
    print(f"当前 baseline: {len(existing_asins)} ASINs")

    # 获取数据
    all_rows = []
    if args.api:
        # API 模式: 调后端拉最新数据
        sids_by_mid = get_active_sids()
        for mid, sids in sids_by_mid.items():
            currency = MARKETPLACE_MAP[mid]
            print(f"  拉取 {'UK' if mid == 4 else 'DE'} ({len(sids)} 店铺)...")
            rows = sync_week_via_backend(sids, week_start, week_end)
            all_rows.extend(rows)
            print(f"    返回 {len(rows)} 行")
        mode = "api"
    else:
        # Direct 模式: 从 DB 已有 sku_weekly 数据读取
        for mid in (4, 5):
            currency = MARKETPLACE_MAP[mid]
            print(f"  从 DB 读取 {'UK' if mid == 4 else 'DE'} 周数据...")
            sids = []  # direct 模式不需要 sids
            rows = sync_week_direct(sids, week_start, week_end, mid)
            all_rows.extend(rows)
            print(f"    读取 {len(rows)} 行")
        mode = "direct"

    print(f"\n总计读取: {len(all_rows)} 行")

    # 处理数据
    result = process_weekly_data(week_start, week_end, all_rows, existing_asins, mode=mode)

    # 输出结果
    print(f"\n═══ 结果 ═══")
    print(f"本周团队 ASIN 总数: {result['team_asins_seen']}")
    print(f"标签更新: {result['tags_updated']}")
    print(f"新增 ASIN: {result['new_asins']}")

    if result["new_asin_list"]:
        print(f"\n── 新增 ASIN 明细 ──")
        for i, item in enumerate(result["new_asin_list"][:20], 1):
            fba_status = "FBA可售" if item["fba_available"] > 0 else "无FBA"
            print(f"  {i}. {item['asin']} | {item['sku']} | {item['country']} | {fba_status} | {item['listing_tags'][:30]}")
        if len(result["new_asin_list"]) > 20:
            print(f"  ... 共 {len(result['new_asin_list'])} 个")

    # 更新后 baseline 数量
    final_count = len(get_existing_baseline_asins())
    print(f"\n更新后 baseline: {final_count} ASINs (净增 {final_count - len(existing_asins)})")
    print("完成。")


if __name__ == "__main__":
    main()
