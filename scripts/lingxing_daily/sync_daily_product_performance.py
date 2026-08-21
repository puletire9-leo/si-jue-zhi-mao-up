#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""领星产品表现日表同步：拉取单日 asinList → 清洗理实团队(开发人∈TEAM_DEVELOPERS) → 写 RDS lingxing_product_performance_daily。

签名算法忠实移植自 Java LingxingClient：
  MD5(ASCII 排序 key=value&...) 大写 → AES/ECB/PKCS5Padding(密钥=appId 16字节) → Base64。
清洗口径复用 scripts/lingxing_daily/lingxing_base_access.py 的 TEAM_DEVELOPERS。
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import quote

import pymysql
import requests
from Crypto.Cipher import AES

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config_env import load_project_env, require  # noqa: E402

_ENV = load_project_env()
APP_ID = require(_ENV, "LINGXING_APP_ID")
APP_SECRET = require(_ENV, "LINGXING_APP_SECRET")
BASE_URL = "https://openapi.lingxing.com"

RDS = dict(
    host=_ENV.get("RDS_HOST", "127.0.0.1"),
    port=int(_ENV.get("RDS_PORT", "3306")),
    user=_ENV.get("RDS_USERNAME", "ai_platform_app"),
    password=require(_ENV, "RDS_PASSWORD"),
    database=_ENV.get("RDS_DATABASE", "sijuelishi"),
    charset="utf8mb4",
)

DATA_DATE = "2026-08-14"
SUMMARY_FIELD = "asin"
CURRENCY_CODE = "GBP"
IS_RECENTLY_ENUM = False  # 全部商品（含未上架/断货）
PAGE_SIZE = 1000
SID_BATCH = 200          # asinList sid 上限 200
MULTI_STORE_INTERVAL = 10.0

# 理实团队开发人（复用 lingxing_base_access.TEAM_DEVELOPERS）
TEAM_DEVELOPERS = frozenset(
    {"蒋舒", "陈杨", "宋凤莉", "刘淼", "龙梦临", "周沁仪", "黄雨珊", "夏浩宇"}
)


# ────────────────────────────────────────────────────────────────
def stringify(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (list, tuple, dict)):
        return json.dumps(v, separators=(",", ":"), ensure_ascii=False)
    return str(v)


def generate_sign(params: dict) -> str:
    filtered = {}
    for k, v in params.items():
        s = stringify(v)
        if s is not None and s != "":
            filtered[k] = s
    raw = "&".join(f"{k}={filtered[k]}" for k in sorted(filtered))
    md5_upper = hashlib.md5(raw.encode("utf-8")).hexdigest().upper()
    key = APP_ID.encode("utf-8")  # 16 字节 AES-128
    pad_len = 16 - len(md5_upper) % 16
    padded = md5_upper.encode("utf-8") + bytes([pad_len]) * pad_len
    enc = AES.new(key, AES.MODE_ECB).encrypt(padded)
    return base64.b64encode(enc).decode()


def get_token() -> str:
    url = f"{BASE_URL}/api/auth-server/oauth/access-token?appId={quote(APP_ID)}&appSecret={quote(APP_SECRET, safe='')}"
    r = requests.post(url, timeout=30)
    body = r.json()
    if str(body.get("code")) not in ("0", "200"):
        raise RuntimeError(f"领星 token 获取失败 [{body.get('code')}]: {body}")
    return body["data"]["access_token"]


def post(path: str, body: dict) -> dict:
    ts = str(int(time.time()))
    sign_params = {"access_token": TOKEN, "app_key": APP_ID, "timestamp": ts}
    sign_params.update(body)
    sign = generate_sign(sign_params)
    url = f"{BASE_URL}{path}?access_token={quote(TOKEN)}&app_key={quote(APP_ID)}&timestamp={ts}&sign={quote(sign)}"
    r = requests.post(url, json=body, timeout=120)
    return r.json()


def get(path: str, params: dict | None = None) -> dict:
    ts = str(int(time.time()))
    sign_params = {"access_token": TOKEN, "app_key": APP_ID, "timestamp": ts}
    if params:
        sign_params.update(params)
    sign = generate_sign(sign_params)
    qs = "&".join(f"{quote(k)}={quote(stringify(v))}" for k, v in sign_params.items())
    url = f"{BASE_URL}{path}?{qs}&sign={quote(sign)}"
    r = requests.get(url, timeout=120)
    return r.json()


# ────────────────────────────────────────────────────────────────
DDL = """
CREATE TABLE IF NOT EXISTS `lingxing_product_performance_daily` (
    `id`                      BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    `biz_key`                 VARCHAR(255) NOT NULL COMMENT '业务幂等键 summary:value|sidScope|dataDate|currency',
    `summary_field`           VARCHAR(32)  DEFAULT NULL,
    `summary_value`           VARCHAR(255) DEFAULT NULL,
    `sid_scope`               VARCHAR(500) DEFAULT NULL COMMENT '查询店铺集合(排序逗号拼接)',
    `asin`                    VARCHAR(20)  DEFAULT NULL,
    `parent_asin`             VARCHAR(20)  DEFAULT NULL,
    `msku`                    VARCHAR(128) DEFAULT NULL,
    `sku`                     VARCHAR(128) DEFAULT NULL,
    `item_name`               VARCHAR(1000) DEFAULT NULL,
    `currency_code`           VARCHAR(16)  DEFAULT NULL,
    `data_date`               DATE         DEFAULT NULL,
    `principal_names`         VARCHAR(500) DEFAULT NULL,
    `developer_names`         VARCHAR(500) DEFAULT NULL,
    `store_names`             VARCHAR(1000) DEFAULT NULL,
    `tag_names`               VARCHAR(1000) DEFAULT NULL,
    `product_create_time`     VARCHAR(64)  DEFAULT NULL,
    `volume`                  INT          DEFAULT NULL,
    `order_items`             INT          DEFAULT NULL,
    `amount`                  DECIMAL(18,4) DEFAULT NULL,
    `gross_profit`            DECIMAL(18,4) DEFAULT NULL,
    `gross_margin`            DECIMAL(18,6) DEFAULT NULL,
    `sessions_total`          INT          DEFAULT NULL,
    `clicks`                  INT          DEFAULT NULL,
    `impressions`             INT          DEFAULT NULL,
    `ad_order_quantity`       INT          DEFAULT NULL,
    `ad_sales_amount`         DECIMAL(18,4) DEFAULT NULL,
    `spend`                   DECIMAL(18,4) DEFAULT NULL,
    `tacos`                   DECIMAL(18,6) DEFAULT NULL,
    `afn_fulfillable_quantity` INT         DEFAULT NULL,
    `available_inventory`      INT         DEFAULT NULL,
    `return_amount`            DECIMAL(18,4) DEFAULT NULL,
    `avg_custom_price`         DECIMAL(18,4) DEFAULT NULL,
    `raw_json`                JSON         DEFAULT NULL,
    `synced_at`               DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_biz_key` (`biz_key`),
    INDEX `idx_asin` (`asin`),
    INDEX `idx_data_date` (`data_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领星产品表现日表(asinList 单日落库)';
"""


def as_text(row, key):
    v = row.get(key)
    return None if v in (None, "") else str(v)


def as_int(row, key):
    v = row.get(key)
    if v in (None, ""):
        return None
    try:
        return int(float(str(v)))
    except (ValueError, TypeError):
        return None


def as_dec(row, key):
    v = row.get(key)
    if v in (None, ""):
        return None
    try:
        return float(str(v))
    except (ValueError, TypeError):
        return None


def first_nested(row, arr_key, field):
    arr = row.get(arr_key)
    if isinstance(arr, list) and arr:
        v = arr[0].get(field)
        return v if v not in (None, "") else None
    return None


def join_list(vals):
    if not isinstance(vals, list):
        return None
    items = [str(x) for x in vals if x not in (None, "")]
    return ",".join(items) if items else None


def row_developers(row):
    devs = row.get("developer_names")
    if not isinstance(devs, list):
        return set()
    return {str(d) for d in devs if d not in (None, "")}


def is_lishi(row):
    return bool(row_developers(row) & TEAM_DEVELOPERS)


# ────────────────────────────────────────────────────────────────
def main(dry_run: bool):
    global TOKEN
    # 日事实是不可变快照。即使 dry-run 不写库，也不允许对已完成日期重复请求领星。
    with pymysql.connect(**RDS) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema=DATABASE()
                  AND table_name='lingxing_product_performance_daily'
            """)
            table_exists = cursor.fetchone()[0] > 0
            existing_rows = 0
            if table_exists:
                cursor.execute(
                    "SELECT COUNT(*) FROM lingxing_product_performance_daily WHERE data_date=%s",
                    (DATA_DATE,),
                )
                existing_rows = cursor.fetchone()[0]
    if existing_rows:
        raise RuntimeError(
            f"RDS 已存在 {DATA_DATE} 日事实 {existing_rows} 行，拒绝重复拉取或覆盖"
        )

    print(f"[1/6] 获取领星 access_token ...")
    TOKEN = get_token()
    print("      token OK")

    print("[2/6] 拉取店铺列表 → UK(mid=4)/DE(mid=5) status=1 ...")
    resp = get("/erp/sc/data/seller/lists")
    if str(resp.get("code")) not in ("0", "200"):
        raise RuntimeError(f"店铺列表失败: {resp}")
    sellers = resp.get("data", [])
    lishi_stores = [s for s in sellers if s.get("status") == 1 and s.get("mid") in (4, 5)]
    sids = sorted(s["sid"] for s in lishi_stores if s.get("sid") is not None)
    print(f"      全部店铺 {len(sellers)} 家；UK/DE 店 {len(lishi_stores)} 家")

    # 分批（sid 上限 200）
    batches = [sids[i:i + SID_BATCH] for i in range(0, len(sids), SID_BATCH)]
    print(f"      分 {len(batches)} 批：{[len(b) for b in batches]}")

    print(f"[3/6] 拉取 asinList（summary={SUMMARY_FIELD}, {DATA_DATE}, 全部商品） ...")
    all_rows = []
    for bi, batch in enumerate(batches):
        raw_scope = ",".join(str(x) for x in batch)
        sid_scope = raw_scope if len(raw_scope) <= 200 else "sha256:" + hashlib.sha256(raw_scope.encode()).hexdigest()
        offset = 0
        while True:
            body = {
                "offset": offset, "length": PAGE_SIZE,
                "sort_field": "volume", "sort_type": "desc",
                "summary_field": SUMMARY_FIELD,
                "sid": batch,
                "start_date": DATA_DATE, "end_date": DATA_DATE,
                "currency_code": CURRENCY_CODE,
                "is_recently_enum": IS_RECENTLY_ENUM,
            }
            r = post("/bd/productPerformance/openApi/asinList", body)
            if str(r.get("code")) not in ("0", "200"):
                raise RuntimeError(f"asinList 失败: {r}")
            data = r.get("data", {})
            lst = data.get("list", [])
            if not lst:
                break
            for row in lst:
                row["_sid_scope"] = sid_scope
            all_rows.extend(lst)
            total = data.get("total", 0)
            print(f"      批{bi+1} offset={offset} 本页{len(lst)} 累计{len(all_rows)} total={total}")
            if len(lst) < PAGE_SIZE or len(all_rows) >= total:
                break
            offset += PAGE_SIZE
            time.sleep(MULTI_STORE_INTERVAL)
        if bi < len(batches) - 1:
            time.sleep(MULTI_STORE_INTERVAL)

    print(f"      拉取总行数：{len(all_rows)}")

    # 开发人分布 + 理实团队过滤
    dev_counter = Counter()
    for row in all_rows:
        devs = row_developers(row)
        if devs:
            dev_counter.update(devs)
        else:
            dev_counter["(空)"] += 1
    print(f"[4/6] 开发人分布（Top 20）：")
    for name, cnt in dev_counter.most_common(20):
        mark = " *理实" if name in TEAM_DEVELOPERS else ""
        print(f"        {name}: {cnt}{mark}")

    lishi_rows = [r for r in all_rows if is_lishi(r)]
    print(f"      理实团队 ASIN 行数：{len(lishi_rows)} / {len(all_rows)}")

    dump_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"_daily_{DATA_DATE}_lishi.json")
    with open(dump_path, "w", encoding="utf-8") as f:
        json.dump(lishi_rows, f, ensure_ascii=False)
    print(f"      已备份 lishi 行到 {dump_path}")

    if dry_run:
        print("      [dry-run] 不建表不写库，结束")
        return

    print("[5/6] 建表（幂等） ...")
    conn = pymysql.connect(**RDS)
    try:
        with conn.cursor() as cur:
            cur.execute(DDL)
        conn.commit()
    finally:
        conn.close()
    print("      表 lingxing_product_performance_daily 就绪")

    print("[6/6] 映射 + 幂等写入 RDS ...")
    inserts = 0
    conn = pymysql.connect(**RDS)
    try:
        for row in lishi_rows:
            asin = first_nested(row, "asins", "asin")
            parent_asin = first_nested(row, "parent_asins", "parent_asin")
            msku = first_nested(row, "price_list", "seller_sku")
            sku = first_nested(row, "price_list", "local_sku")
            response_currency = as_text(row, "currency_code")
            if response_currency and response_currency.upper() != CURRENCY_CODE:
                raise RuntimeError(f"领星返回非 GBP 数据，拒绝入库: {response_currency}")
            currency = CURRENCY_CODE
            sid_scope = row.get("_sid_scope", "")

            principal = join_list(row.get("principal_names"))
            developer = join_list(row.get("developer_names"))
            tags = ",".join(t["tag_name"] for t in row.get("tag_set", []) if isinstance(t, dict) and t.get("tag_name")) or None
            stores = ",".join(f"{c.get('seller_name','')}" for c in row.get("seller_store_countries", []) if isinstance(c, dict) and c.get("seller_name")) or None
            create_time = as_text(row, "product_create_time")

            avail_inv = None
            ai = row.get("available_inventory")
            if isinstance(ai, dict):
                avail_inv = as_int(ai, "available_inventory")

            biz_key = f"{SUMMARY_FIELD}:{asin or ''}|{sid_scope}|{DATA_DATE}|{currency or ''}"
            if len(biz_key) > 250:
                biz_key = "sha256:" + hashlib.sha256(biz_key.encode()).hexdigest()

            sql = """
                INSERT INTO lingxing_product_performance_daily
                  (biz_key, summary_field, summary_value, sid_scope, asin, parent_asin, msku, sku,
                   item_name, currency_code, data_date, principal_names, developer_names, store_names,
                   tag_names, product_create_time, volume, order_items, amount, gross_profit, gross_margin,
                   sessions_total, clicks, impressions, ad_order_quantity, ad_sales_amount, spend, tacos,
                   afn_fulfillable_quantity, available_inventory, return_amount, avg_custom_price, raw_json)
                VALUES
                  (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            vals = (
                biz_key, SUMMARY_FIELD, asin, sid_scope, asin, parent_asin, msku, sku,
                as_text(row, "item_name"), currency, DATA_DATE, principal, developer, stores,
                tags, create_time,
                as_int(row, "volume"), as_int(row, "order_items"), as_dec(row, "amount"),
                as_dec(row, "gross_profit"), as_dec(row, "gross_margin"),
                as_int(row, "sessions_total"), as_int(row, "clicks"), as_int(row, "impressions"),
                as_int(row, "ad_order_quantity"), as_dec(row, "ad_sales_amount"),
                as_dec(row, "spend"), as_dec(row, "tacos"),
                as_int(row, "afn_fulfillable_quantity"), avail_inv,
                as_dec(row, "return_amount"), as_dec(row, "avg_custom_price"),
                json.dumps(row, ensure_ascii=False),
            )
            with conn.cursor() as cur:
                cur.execute(sql, vals)
            inserts += 1
        conn.commit()
    finally:
        conn.close()

    print(f"      写入理实团队 {inserts} 行完成")


if __name__ == "__main__":
    TOKEN = ""
    main("--dry-run" in sys.argv)
