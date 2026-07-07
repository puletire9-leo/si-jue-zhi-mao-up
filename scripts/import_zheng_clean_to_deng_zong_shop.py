#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import SellerSprite clean (variation=Y) 郑总店铺数据 into deng_zong_shop.
不删除旧数据；按 (marketplace, seller_name, asin, month, batch_date) 去重后新增。
"""

import json
import os
from pathlib import Path
from collections import OrderedDict

import pymysql

# ---------------- 配置 ----------------
BASE_DIR = Path(r"F:\项目\si-jue-zhi-mao-up\产品数据\邓总店铺\邓总店铺\sellersprite_raw\zheng_clean_no_variants_20260707")
BATCH_DATE = "20260707"          # 导入批次：今天
MONTH = BATCH_DATE[:6]           # 202607，对应"这周/本月"批次
SOURCE = "sellersprite"

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "3410"))
DB_NAME = os.environ.get("DB_NAME", "sijuelishi_dev")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
if not DB_PASSWORD:
    raise RuntimeError("请设置环境变量 DB_PASSWORD")

BATCH_SIZE = 500
# -------------------------------------


def clean_number(value, allow_negative=False):
    """把 -1 / null 等占位转成 None"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if not allow_negative and value < 0:
            return None
        return value
    return value


def clean_text(value, max_len=None):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    if max_len and len(text) > max_len:
        text = text[:max_len]
    return text


def extract_items_from_response(path: Path):
    """解析单个 response-page 文件，返回商品列表。"""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    request_body = data.get("request", {}).get("body", {})
    marketplace = request_body.get("marketplace", "")
    seller_name_from_request = request_body.get("sellerName", "")

    items = data.get("response", {}).get("data", {}).get("items", [])
    for item in items:
        badge = item.get("badge") or {}
        record = OrderedDict()
        record["marketplace"] = clean_text(marketplace, 10)
        record["asin"] = clean_text(item.get("asin"), 20)
        record["month"] = MONTH
        record["title"] = clean_text(item.get("title"), 500)
        record["brand"] = clean_text(item.get("brand"), 200)
        record["brand_url"] = clean_text(item.get("brandUrl"), 512)
        record["image_url"] = clean_text(item.get("imageUrl"), 512)
        record["parent_asin"] = clean_text(item.get("parent"), 20)
        record["sku"] = clean_text(item.get("sku"), 500)
        record["node_id"] = item.get("nodeId")
        record["node_id_path"] = clean_text(item.get("nodeIdPath"), 500)
        record["node_label_path"] = clean_text(item.get("nodeLabelPath"), 500)
        record["symbol"] = clean_text(item.get("symbol"), 10)
        record["units"] = clean_number(item.get("units"))
        record["units_gr"] = clean_number(item.get("unitsGr"))
        record["amz_unit"] = clean_number(item.get("amzUnit"))
        record["amz_sales"] = clean_number(item.get("amzSales"))
        record["amz_unit_date"] = clean_number(item.get("amzUnitDate"))
        record["revenue"] = clean_number(item.get("revenue"))
        record["bsr_id"] = clean_text(item.get("bsrId"), 100)
        record["bsr"] = clean_number(item.get("bsr"))
        record["bsr_cr"] = clean_number(item.get("bsrCr"))
        record["bsr_cv"] = clean_number(item.get("bsrCv"))
        record["ratings"] = clean_number(item.get("ratings"))
        record["rating"] = clean_number(item.get("rating"))
        record["ratings_rate"] = clean_number(item.get("ratingsRate"))
        record["ratings_cv"] = clean_number(item.get("ratingsCv"))
        record["rating_delta"] = clean_number(item.get("ratingDelta"))
        record["price"] = clean_number(item.get("price"))
        record["prime_price"] = clean_number(item.get("primePrice"))
        record["profit"] = clean_number(item.get("profit"))
        record["fba"] = clean_number(item.get("fba"))
        record["delivery_price"] = clean_number(item.get("deliveryPrice"))
        record["seller_name"] = clean_text(item.get("sellerName") or seller_name_from_request, 300)
        record["seller_id"] = clean_text(item.get("sellerId"), 50)
        record["seller_nation"] = clean_text(item.get("sellerNation"), 10)
        record["sellers"] = clean_number(item.get("sellers"))
        record["fulfillment"] = clean_text(item.get("fulfillment"), 10)
        record["variations"] = clean_number(item.get("variations"))
        record["weight"] = clean_text(item.get("weight"), 50)
        record["dimension"] = clean_text(item.get("dimension"), 100)
        record["dimensions_type"] = clean_text(item.get("dimensionsType"), 20)
        record["pkg_dimensions"] = clean_text(item.get("pkgDimensions"), 100)
        record["pkg_dimension_type"] = clean_text(item.get("pkgDimensionType"), 20)
        record["pkg_weight"] = clean_text(item.get("pkgWeight"), 50)
        record["lqs"] = clean_number(item.get("lqs"))
        record["available_date"] = clean_number(item.get("availableDate"))
        record["best_seller"] = clean_text(badge.get("bestSeller"), 200)
        record["amazon_choice"] = clean_text(badge.get("amazonChoice"), 200)
        record["new_release"] = clean_text(badge.get("newRelease"), 200)
        record["ebc"] = clean_text(badge.get("ebc"), 200)
        record["video"] = clean_text(badge.get("video"), 200)
        record["product_url"] = None
        record["similar_url"] = None
        record["source"] = SOURCE
        record["batch_date"] = BATCH_DATE
        yield record


def collect_records(base_dir: Path):
    """遍历所有 response-page 文件并去重。"""
    seen = set()
    records = []
    pattern = re.compile(r"response-page-(\d+)\.json$")

    for response_file in sorted(base_dir.rglob("response-page-*.json")):
        for record in extract_items_from_response(response_file):
            key = (
                record["marketplace"],
                record["seller_name"],
                record["asin"],
                record["month"],
                record["batch_date"],
            )
            if key in seen:
                continue
            seen.add(key)
            records.append(record)

    return records


def insert_records(records):
    if not records:
        print("No records to insert.")
        return

    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        charset="utf8mb4",
        autocommit=False,
    )

    columns = list(records[0].keys())
    placeholders = ",".join(["%s"] * len(columns))
    column_names = ",".join(columns)
    sql = f"INSERT INTO deng_zong_shop ({column_names}) VALUES ({placeholders})"

    try:
        with conn.cursor() as cur:
            for i in range(0, len(records), BATCH_SIZE):
                batch = records[i : i + BATCH_SIZE]
                values = [tuple(r.values()) for r in batch]
                cur.executemany(sql, values)
                conn.commit()
                print(f"Inserted {cur.rowcount} rows (batch {i // BATCH_SIZE + 1}/{(len(records) - 1) // BATCH_SIZE + 1})")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    print(f"Base dir: {BASE_DIR}")
    print(f"Batch date: {BATCH_DATE}, Month: {MONTH}")

    records = collect_records(BASE_DIR)
    print(f"Total unique records: {len(records)}")

    # 按 marketplace 统计
    counts = {}
    for r in records:
        mp = r["marketplace"]
        counts[mp] = counts.get(mp, 0) + 1
    print(f"By marketplace: {counts}")

    insert_records(records)
    print("Done.")


if __name__ == "__main__":
    main()
