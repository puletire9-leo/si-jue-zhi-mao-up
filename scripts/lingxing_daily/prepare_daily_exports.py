"""Prepare canonical daily Lingxing files without touching MySQL.

The source workbooks contain overlapping export windows.  This converter keeps
the later export for each calendar day, writes model-focused monthly CSV files,
and writes import-ready monthly CSV files with the full original row as JSON.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from zipfile import ZipFile

from lxml import etree


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_ROOT = (
    PROJECT_ROOT
    / "\u4ea7\u54c1\u6570\u636e"
    / "\u9886\u661f\u6570\u636eapi"
    / "\u9886\u661f26\u5e741\u52306\u6708\u6240\u6709\u6570\u636e\u6240\u6709"
)
DEFAULT_OUTPUT_DIR = DEFAULT_SOURCE_ROOT / "\u6d3e\u751f\u65e5\u6570\u636e_v1"

DATE = "\u65e5\u671f"
ASIN = "ASIN"
PARENT_ASIN = "\u7236ASIN"
PRICE = "\u552e\u4ef7(\u603b\u4ef7)"
SKU = "SKU"
VOLUME = "\u9500\u91cf"
FBA_AVAILABLE = "FBA-\u53ef\u552e"
COUNTRY = "\u56fd\u5bb6"
LISTING_TAGS = "listing\u6807\u7b7e"
GROSS_PROFIT = "\u7ed3\u7b97\u6bdb\u5229\u6da6"
MSKU = "MSKU"
STORE_NAME = "\u5e97\u94fa"
SALES_AMOUNT = "\u9500\u552e\u989d"
NET_SALES_AMOUNT = "\u51c0\u9500\u552e"
REFUND_QUANTITY = "\u9000\u6b3e\u91cf"
RETURN_QUANTITY = "\u9000\u8d27\u91cf"
AD_SPEND = "\u5e7f\u544a\u82b1\u8d39"
AD_SALES_AMOUNT = "\u5e7f\u544a\u9500\u552e\u989d"

MODEL_SOURCE_FIELDS = (
    DATE,
    COUNTRY,
    STORE_NAME,
    SKU,
    MSKU,
    ASIN,
    PARENT_ASIN,
    LISTING_TAGS,
    PRICE,
    VOLUME,
    FBA_AVAILABLE,
    GROSS_PROFIT,
    AD_SPEND,
    SALES_AMOUNT,
    NET_SALES_AMOUNT,
    AD_SALES_AMOUNT,
    REFUND_QUANTITY,
    RETURN_QUANTITY,
)

FAST_TEST_HEADERS = (
    "biz_key",
    "data_date",
    "marketplace",
    "country",
    "store_name",
    "sku",
    "msku",
    "asin",
    "parent_asin",
    "listing_tags",
    "price",
    "volume",
    "fba_available",
    "gross_profit",
    "ad_spend",
    "sales_amount",
    "net_sales_amount",
    "ad_sales_amount",
    "refund_quantity",
    "return_quantity",
    "source_file",
    "source_row",
    "source_priority",
)

DB_IMPORT_HEADERS = FAST_TEST_HEADERS + ("raw_json",)
SHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DATE_RANGE = re.compile(r"(20\d{2}-\d{2}-\d{2})~(20\d{2}-\d{2}-\d{2})")
COLUMN_REF = re.compile(r"[A-Z]+")


def choose_source_rank(data_date: str) -> int:
    """Return the authoritative export priority for a calendar date."""
    parsed = date.fromisoformat(data_date)
    if parsed <= date(2026, 1, 31):
        return 1
    if parsed <= date(2026, 4, 30):
        return 2
    return 3


def build_business_key(
    data_date: str,
    country: str,
    store_name: str,
    sku: str,
    msku: str,
    asin: str,
) -> str:
    value = "|".join((data_date, country, store_name, sku, msku, asin))
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def marketplace_for(country: str) -> str:
    return {"\u82f1\u56fd": "UK", "\u5fb7\u56fd": "DE"}.get(country, "UNKNOWN")


def to_fast_test_row(
    raw: dict[str, str], source_file: str, source_row: int, source_priority: int
) -> dict[str, str | int]:
    data_date = raw.get(DATE, "")
    country = raw.get(COUNTRY, "")
    store_name = raw.get(STORE_NAME, "")
    sku = raw.get(SKU, "")
    msku = raw.get(MSKU, "")
    asin = raw.get(ASIN, "")
    return {
        "biz_key": build_business_key(data_date, country, store_name, sku, msku, asin),
        "data_date": data_date,
        "marketplace": marketplace_for(country),
        "country": country,
        "store_name": store_name,
        "sku": sku,
        "msku": msku,
        "asin": asin,
        "parent_asin": raw.get(PARENT_ASIN, ""),
        "listing_tags": raw.get(LISTING_TAGS, ""),
        "price": raw.get(PRICE, ""),
        "volume": raw.get(VOLUME, ""),
        "fba_available": raw.get(FBA_AVAILABLE, ""),
        "gross_profit": raw.get(GROSS_PROFIT, ""),
        "ad_spend": raw.get(AD_SPEND, ""),
        "sales_amount": raw.get(SALES_AMOUNT, ""),
        "net_sales_amount": raw.get(NET_SALES_AMOUNT, ""),
        "ad_sales_amount": raw.get(AD_SALES_AMOUNT, ""),
        "refund_quantity": raw.get(REFUND_QUANTITY, ""),
        "return_quantity": raw.get(RETURN_QUANTITY, ""),
        "source_file": source_file,
        "source_row": source_row,
        "source_priority": source_priority,
    }


def source_rank_for_path(path: Path) -> int:
    match = DATE_RANGE.search(str(path.parent))
    if match is None:
        raise ValueError(f"Cannot infer export window from path: {path}")
    start_date = match.group(1)
    return {"2026-01-01": 1, "2026-02-01": 2, "2026-05-01": 3}[start_date]


def cell_text(cell: etree._Element) -> str:
    if cell.get("t") == "inlineStr":
        text_node = cell.find(f"{SHEET_NS}is")
        return "".join(text_node.itertext()).strip() if text_node is not None else ""
    value_node = cell.find(f"{SHEET_NS}v")
    return value_node.text.strip() if value_node is not None and value_node.text else ""


def iter_workbook_rows(path: Path):
    with ZipFile(path) as archive, archive.open("xl/worksheets/sheet1.xml") as source:
        headers: dict[str, str] | None = None
        for _, row in etree.iterparse(source, events=("end",), tag=f"{SHEET_NS}row", huge_tree=True):
            row_number = int(row.get("r", "0"))
            values_by_column: dict[str, str] = {}
            for cell in row:
                reference = cell.get("r", "")
                match = COLUMN_REF.match(reference)
                if match is not None:
                    values_by_column[match.group(0)] = cell_text(cell)

            if row_number == 1:
                headers = values_by_column
            else:
                if headers is None:
                    raise ValueError(f"Workbook has no header row: {path}")
                yield row_number, {
                    header: values_by_column.get(column, "") for column, header in headers.items() if header
                }

            row.clear()
            while row.getprevious() is not None:
                del row.getparent()[0]


def open_writer(path: Path, headers: tuple[str, ...]):
    handle = path.open("w", encoding="utf-8", newline="")
    writer = csv.DictWriter(handle, fieldnames=headers, quoting=csv.QUOTE_MINIMAL, extrasaction="raise")
    writer.writeheader()
    return handle, writer


def prepare_exports(source_root: Path, output_dir: Path, month: str | None = None) -> dict[str, object]:
    requested_month = month
    sources = sorted(source_root.rglob("*.xlsx"), key=lambda path: (source_rank_for_path(path), str(path)))
    if not sources:
        raise FileNotFoundError(f"No .xlsx files found under {source_root}")
    if requested_month is None and output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError(f"Output directory must be empty: {output_dir}")
    if requested_month is not None and not re.fullmatch(r"20\d{2}-\d{2}", requested_month):
        raise ValueError(f"Month must use yyyy-MM: {requested_month}")
    if requested_month is not None:
        requested_rank = choose_source_rank(f"{requested_month}-01")
        sources = [source for source in sources if source_rank_for_path(source) == requested_rank]

    fast_dir = output_dir / "fast_test"
    import_dir = output_dir / "db_import"
    fast_dir.mkdir(parents=True, exist_ok=True)
    import_dir.mkdir(parents=True, exist_ok=True)

    fast_writers: dict[str, tuple[object, csv.DictWriter]] = {}
    import_writers: dict[str, tuple[object, csv.DictWriter]] = {}
    seen_keys: set[str] = set()
    kept_by_month: Counter[str] = Counter()
    source_rows: Counter[str] = Counter()
    skipped_by_reason: Counter[str] = Counter()

    try:
        for source in sources:
            source_rank = source_rank_for_path(source)
            relative_source = str(source.relative_to(source_root))
            for source_row, raw in iter_workbook_rows(source):
                source_rows[relative_source] += 1
                data_date = raw.get(DATE, "")
                if not data_date:
                    skipped_by_reason["missing_date"] += 1
                    continue
                if choose_source_rank(data_date) != source_rank:
                    skipped_by_reason["overlap_superseded"] += 1
                    continue
                if requested_month is not None and data_date[:7] != requested_month:
                    skipped_by_reason["outside_selected_month"] += 1
                    continue

                model_row = to_fast_test_row(raw, relative_source, source_row, source_rank)
                biz_key = str(model_row["biz_key"])
                if biz_key in seen_keys:
                    skipped_by_reason["duplicate_listing_day"] += 1
                    continue
                seen_keys.add(biz_key)

                period_month = data_date[:7]
                if period_month not in fast_writers:
                    fast_path = fast_dir / f"lingxing_daily_model_{period_month}.csv"
                    import_path = import_dir / f"lingxing_daily_import_{period_month}.csv"
                    if fast_path.exists() or import_path.exists():
                        raise FileExistsError(f"Monthly output already exists: {period_month}")
                    fast_writers[period_month] = open_writer(fast_path, FAST_TEST_HEADERS)
                    import_writers[period_month] = open_writer(import_path, DB_IMPORT_HEADERS)

                fast_writers[period_month][1].writerow(model_row)
                import_row = dict(model_row)
                import_row["raw_json"] = json.dumps(raw, ensure_ascii=False, separators=(",", ":"))
                import_writers[period_month][1].writerow(import_row)
                kept_by_month[period_month] += 1
    finally:
        for handle, _ in [*fast_writers.values(), *import_writers.values()]:
            handle.close()

    manifest = {
        "version": 1,
        "sourceRoot": str(source_root),
        "sourceFiles": [str(source.relative_to(source_root)) for source in sources],
        "canonicalDatePriority": {
            "2026-01-01_to_2026-01-31": 1,
            "2026-02-01_to_2026-04-30": 2,
            "2026-05-01_to_2026-06-30": 3,
        },
        "businessKey": "data_date|country|store_name|sku|msku|asin (SHA-256)",
        "modelFiles": {month: f"fast_test/lingxing_daily_model_{month}.csv" for month in kept_by_month},
        "importFiles": {month: f"db_import/lingxing_daily_import_{month}.csv" for month in kept_by_month},
        "keptRowsByMonth": dict(sorted(kept_by_month.items())),
        "sourceRows": dict(source_rows),
        "skippedRows": dict(skipped_by_reason),
        "totalCanonicalRows": sum(kept_by_month.values()),
        "importHeaders": list(DB_IMPORT_HEADERS),
    }
    manifest_name = f"manifest_{requested_month}.json" if requested_month is not None else "manifest.json"
    (output_dir / manifest_name).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--month", help="Generate one canonical yyyy-MM partition only")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = prepare_exports(args.source_root.resolve(), args.output_dir.resolve(), args.month)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
