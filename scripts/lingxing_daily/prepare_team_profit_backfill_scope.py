"""Build the full monthly target-store scope for weekly Lingxing profit backfill."""

from __future__ import annotations

import csv
import os
import re
from collections import defaultdict
from pathlib import Path

import pymysql
from python_calamine import load_workbook


ROOT = Path(__file__).resolve().parents[2]
MONTHLY_DIR = ROOT / "\u4ea7\u54c1\u6570\u636e" / "\u9886\u661f\u6570\u636eapi" / "\u9886\u661f25\u5e74\u523026\u5e746\u6708\u6240\u6709\u6570\u636e\uff0c\u4ee5\u6bcf\u6708\u6570\u636e"
HISTORY_DIR = MONTHLY_DIR / "\u5386\u53f2SKU\u4e0a\u67b6\u57fa\u7840\u6570\u636e_2025-04\u81f32026-06"
LIFECYCLE_INPUT = HISTORY_DIR / "03_\u56e2\u961f\u5f00\u53d1SKU\u751f\u547d\u5468\u671f" / "\u56e2\u961fSKU_\u751f\u547d\u5468\u671f\u5224\u5b9a_\u6570\u636e\u622a\u6b622026-06.csv"
OUTPUT_DIR = HISTORY_DIR / "05_\u8d22\u52a1\u5229\u6da6\u5468\u5ea6\u56de\u8865"
OUTPUT = OUTPUT_DIR / "\u56e2\u961f\u76ee\u6807SKU\u5e97\u94fa\u8303\u56f4_2025-04\u81f32026-06.csv"

TEAM_DEVELOPERS = {"\u848b\u8212", "\u9648\u6768", "\u5b8b\u51e4\u8389", "\u5218\u6dfc", "\u9f99\u68a6\u4e34", "\u5468\u6c81\u4eea", "\u5f20\u5b50\u8f69", "\u9ec4\u96e8\u73ca"}
PREFIX_ACTIVE_SINCE = "2025-04"
MONTH_PATTERN = re.compile(r"(20\d{2}-\d{2})-\d{2}~")
COUNTRY = "\u56fd\u5bb6"
STORE = "\u5e97\u94fa"
SKU = "SKU"


def connection():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", "13338")),
        user=os.getenv("MYSQL_USERNAME", "sijue"),
        password=os.getenv("MYSQL_PASSWORD", "sijue123456"),
        database=os.getenv("MYSQL_DATABASE", "sijuelishi_dev"),
        charset="utf8mb4",
    )


def team_sku_scope() -> tuple[set[str], dict[str, tuple[str, str]]]:
    with LIFECYCLE_INPUT.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    prefix_latest: dict[tuple[str, str], str] = {}
    for row in rows:
        developer = row["\u5f00\u53d1\u4eba"]
        sku = row["SKU"]
        if developer not in TEAM_DEVELOPERS or not sku.isdigit():
            continue
        key = (developer, sku[:3])
        prefix_latest[key] = max(prefix_latest.get(key, ""), row["\u521b\u5efa\u6708\u4efd"])
    active_prefixes = {key for key, latest in prefix_latest.items() if latest >= PREFIX_ACTIVE_SINCE}
    sku_owner = {
        row["SKU"]: (row["\u5f00\u53d1\u4eba"], row["SKU"][:3])
        for row in rows
        if (row["\u5f00\u53d1\u4eba"], row["SKU"][:3]) in active_prefixes
    }
    return set(sku_owner), sku_owner


def seller_ids() -> dict[tuple[str, str], str]:
    with connection() as db, db.cursor() as cursor:
        cursor.execute("SELECT sid, name, country FROM lingxing_seller")
        rows = cursor.fetchall()
    mapping = {}
    for sid, name, country in rows:
        if sid is not None and name:
            mapping[(str(country or "").strip(), str(name).strip())] = str(sid)
    return mapping


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target_skus, sku_owner = team_sku_scope()
    store_data: dict[tuple[str, str], dict] = defaultdict(lambda: {"skus": set(), "months": set(), "owners": set()})
    files = []
    for path in MONTHLY_DIR.glob("*.xlsx"):
        match = MONTH_PATTERN.search(path.name)
        if match:
            files.append((match.group(1), path))
    if len(files) != 15:
        raise RuntimeError(f"Expected 15 workbooks for 2025-04 through 2026-06, found {len(files)}")

    for month, path in sorted(files):
        workbook = load_workbook(path)
        rows = workbook.get_sheet_by_index(0).iter_rows()
        headers = [str(value or "") for value in next(rows)]
        positions = {field: headers.index(field) for field in (COUNTRY, STORE, SKU)}
        for row in rows:
            sku = str(row[positions[SKU]] or "").strip()
            if sku not in target_skus:
                continue
            country = str(row[positions[COUNTRY]] or "").strip()
            store = str(row[positions[STORE]] or "").strip()
            if not country or not store:
                continue
            item = store_data[(country, store)]
            item["skus"].add(sku)
            item["months"].add(month)
            item["owners"].add("-".join(sku_owner[sku]))

    seller_by_store = seller_ids()
    columns = ["SID", "\u56fd\u5bb6", "\u5e97\u94fa", "\u76ee\u6807SKU\u6570", "\u51fa\u73b0\u6708\u4efd", "\u5f00\u53d1\u4eba\u4e0e\u524d\u7f00", "SID\u6620\u5c04\u72b6\u6001"]
    output_rows = []
    for (country, store), item in store_data.items():
        sid = seller_by_store.get((country, store), "")
        output_rows.append({
            "SID": sid,
            "\u56fd\u5bb6": country,
            "\u5e97\u94fa": store,
            "\u76ee\u6807SKU\u6570": len(item["skus"]),
            "\u51fa\u73b0\u6708\u4efd": " | ".join(sorted(item["months"])),
            "\u5f00\u53d1\u4eba\u4e0e\u524d\u7f00": " | ".join(sorted(item["owners"])),
            "SID\u6620\u5c04\u72b6\u6001": "\u5df2\u6620\u5c04" if sid else "\u672a\u6620\u5c04\uff0c\u4e0d\u53c2\u4e0e\u56de\u8865",
        })
    output_rows.sort(key=lambda row: (not bool(row["SID"]), -row["\u76ee\u6807SKU\u6570"], row["\u5e97\u94fa"]))
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        writer.writerows(output_rows)

    mapped = [row for row in output_rows if row["SID"]]
    print(f"target_skus={len(target_skus)} target_stores={len(output_rows)} mapped_stores={len(mapped)} output={OUTPUT}")


if __name__ == "__main__":
    main()
