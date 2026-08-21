#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fetch team ASINs with positive sales in a date window.

The product-performance endpoint is requested with volume descending. Pagination
stops after the first page whose final row has zero volume because all later rows
must also be zero. The artifact is used only as a historical-sales boolean set.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import sync_daily_product_performance as lx


def volume(row: dict) -> int:
    try:
        return int(float(row.get("volume") or 0))
    except (TypeError, ValueError):
        return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-date", required=True)
    parser.add_argument("--end-date", required=True)
    args = parser.parse_args()

    lx.TOKEN = lx.get_token()
    response = lx.get("/erp/sc/data/seller/lists")
    if str(response.get("code")) not in ("0", "200"):
        raise RuntimeError(f"seller list failed: {response}")
    sellers = response.get("data", [])
    sids = sorted(
        seller["sid"] for seller in sellers
        if seller.get("status") == 1 and seller.get("mid") in (4, 5) and seller.get("sid") is not None
    )
    batches = [sids[index:index + lx.SID_BATCH] for index in range(0, len(sids), lx.SID_BATCH)]
    positive_asins: set[str] = set()

    for batch_index, batch in enumerate(batches, 1):
        offset = 0
        while True:
            body = {
                "offset": offset,
                "length": lx.PAGE_SIZE,
                "sort_field": "volume",
                "sort_type": "desc",
                "summary_field": "asin",
                "sid": batch,
                "start_date": args.start_date,
                "end_date": args.end_date,
                "is_recently_enum": False,
            }
            result = lx.post("/bd/productPerformance/openApi/asinList", body)
            if str(result.get("code")) not in ("0", "200"):
                raise RuntimeError(f"asinList failed: {result}")
            rows = result.get("data", {}).get("list", [])
            positive_rows = [row for row in rows if volume(row) > 0]
            for row in positive_rows:
                if not lx.is_lishi(row):
                    continue
                asin = lx.first_nested(row, "asins", "asin")
                if asin:
                    positive_asins.add(str(asin))
            print(
                f"batch={batch_index} offset={offset} rows={len(rows)} "
                f"positive_rows={len(positive_rows)} team_asins={len(positive_asins)}",
                flush=True,
            )
            if not rows or len(rows) < lx.PAGE_SIZE or volume(rows[-1]) <= 0:
                break
            offset += lx.PAGE_SIZE
            time.sleep(lx.MULTI_STORE_INTERVAL)
        if batch_index < len(batches):
            time.sleep(lx.MULTI_STORE_INTERVAL)

    output = Path(__file__).resolve().parent / f"_positive_sales_{args.start_date}_{args.end_date}_lishi.json"
    output.write_text(
        json.dumps({"start_date": args.start_date, "end_date": args.end_date, "asins": sorted(positive_asins)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"saved {len(positive_asins)} ASINs -> {output}")


if __name__ == "__main__":
    main()
