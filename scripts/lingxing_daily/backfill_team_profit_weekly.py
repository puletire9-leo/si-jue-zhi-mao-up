"""Backfill weekly profit facts for the 2026 target SKU store scope."""

from __future__ import annotations

import csv
import os
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[2]
MONTHLY_DIR = ROOT / "\u4ea7\u54c1\u6570\u636e" / "\u9886\u661f\u6570\u636eapi" / "\u9886\u661f25\u5e74\u523026\u5e746\u6708\u6240\u6709\u6570\u636e\uff0c\u4ee5\u6bcf\u6708\u6570\u636e"
OUTPUT_DIR = MONTHLY_DIR / "\u5386\u53f2SKU\u4e0a\u67b6\u57fa\u7840\u6570\u636e_2025-04\u81f32026-06" / "05_\u8d22\u52a1\u5229\u6da6\u5468\u5ea6\u56de\u8865"
SCOPE_INPUT = Path(os.getenv("PROFIT_SCOPE_INPUT", OUTPUT_DIR / "2026\u5e74\u76ee\u6807SKU\u5e97\u94fa\u8303\u56f4\u6e05\u5355.csv"))

API_URL = os.getenv("LINGXING_PROFIT_SYNC_URL", "http://127.0.0.1:8002/api/v1/modules/lingxing/profit-asin/sync")
START_DATE = date.fromisoformat(os.getenv("PROFIT_BACKFILL_START", "2026-01-01"))
END_DATE = date.fromisoformat(os.getenv("PROFIT_BACKFILL_END", "2026-07-12"))
PROGRESS_OUTPUT = OUTPUT_DIR / f"{START_DATE.year}\u5e74\u76ee\u6807SKU\u5468\u5ea6\u5229\u6da6\u56de\u8865\u8fdb\u5ea6.csv"
REQUEST_TIMEOUT_SECONDS = 300

PROGRESS_COLUMNS = ["\u7a97\u53e3\u5f00\u59cb\u65e5", "\u7a97\u53e3\u7ed3\u675f\u65e5", "\u5e97\u94faSID\u6570", "\u76ee\u6807SKU\u5e97\u94fa\u6570", "\u72b6\u6001", "\u9875\u6570", "\u62c9\u53d6\u884c\u6570", "\u5e42\u7b49\u5199\u5165\u884c\u6570", "\u8017\u65f6\u79d2", "\u5b8c\u6210\u65f6\u95f4", "\u9519\u8bef\u4fe1\u606f"]


def target_sids() -> tuple[list[int], int]:
    with SCOPE_INPUT.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    mapped = [row for row in rows if row["SID"] and row["SID\u6620\u5c04\u72b6\u6001"] == "\u5df2\u6620\u5c04"]
    sids = sorted({int(row["SID"]) for row in mapped})
    if not sids:
        raise RuntimeError("No mapped target stores in scope manifest")
    return sids, len(mapped)


def completed_windows() -> set[tuple[str, str]]:
    if not PROGRESS_OUTPUT.exists():
        return set()
    with PROGRESS_OUTPUT.open(encoding="utf-8-sig", newline="") as source:
        return {
            (row["\u7a97\u53e3\u5f00\u59cb\u65e5"], row["\u7a97\u53e3\u7ed3\u675f\u65e5"])
            for row in csv.DictReader(source)
            if row["\u72b6\u6001"] == "\u5b8c\u6210"
        }


def append_progress(row: dict[str, object]) -> None:
    exists = PROGRESS_OUTPUT.exists()
    with PROGRESS_OUTPUT.open("a", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=PROGRESS_COLUMNS)
        if not exists:
            writer.writeheader()
        writer.writerow(row)


def weekly_windows() -> list[tuple[date, date]]:
    windows = []
    current = START_DATE
    while current <= END_DATE:
        end = min(current + timedelta(days=6), END_DATE)
        windows.append((current, end))
        current = end + timedelta(days=1)
    return windows


def sync_window(sids: list[int], store_count: int, start: date, end: date) -> dict[str, object]:
    started = time.perf_counter()
    payload = {"sids": sids, "startDate": start.isoformat(), "endDate": end.isoformat()}
    try:
        response = requests.post(API_URL, json=payload, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        body = response.json()
        if body.get("code") != 200:
            raise RuntimeError(f"Unexpected application response: {body}")
        data = body.get("data") or {}
        return {
            "\u7a97\u53e3\u5f00\u59cb\u65e5": start.isoformat(),
            "\u7a97\u53e3\u7ed3\u675f\u65e5": end.isoformat(),
            "\u5e97\u94faSID\u6570": len(sids),
            "\u76ee\u6807SKU\u5e97\u94fa\u6570": store_count,
            "\u72b6\u6001": "\u5b8c\u6210",
            "\u9875\u6570": data.get("pages", 0),
            "\u62c9\u53d6\u884c\u6570": data.get("fetched", 0),
            "\u5e42\u7b49\u5199\u5165\u884c\u6570": data.get("upserted", 0),
            "\u8017\u65f6\u79d2": round(time.perf_counter() - started, 2),
            "\u5b8c\u6210\u65f6\u95f4": datetime.now().isoformat(timespec="seconds"),
            "\u9519\u8bef\u4fe1\u606f": "",
        }
    except Exception as error:
        return {
            "\u7a97\u53e3\u5f00\u59cb\u65e5": start.isoformat(),
            "\u7a97\u53e3\u7ed3\u675f\u65e5": end.isoformat(),
            "\u5e97\u94faSID\u6570": len(sids),
            "\u76ee\u6807SKU\u5e97\u94fa\u6570": store_count,
            "\u72b6\u6001": "\u5931\u8d25",
            "\u9875\u6570": 0,
            "\u62c9\u53d6\u884c\u6570": 0,
            "\u5e42\u7b49\u5199\u5165\u884c\u6570": 0,
            "\u8017\u65f6\u79d2": round(time.perf_counter() - started, 2),
            "\u5b8c\u6210\u65f6\u95f4": datetime.now().isoformat(timespec="seconds"),
            "\u9519\u8bef\u4fe1\u606f": str(error),
        }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sids, store_count = target_sids()
    done = completed_windows()
    for start, end in weekly_windows():
        key = (start.isoformat(), end.isoformat())
        if key in done:
            print(f"skip={start}~{end}", flush=True)
            continue
        result = sync_window(sids, store_count, start, end)
        append_progress(result)
        status = result["\u72b6\u6001"]
        pages = result["\u9875\u6570"]
        fetched = result["\u62c9\u53d6\u884c\u6570"]
        elapsed = result["\u8017\u65f6\u79d2"]
        print(
            f"window={start}~{end} status={status} pages={pages} "
            f"fetched={fetched} elapsed={elapsed}s",
            flush=True,
        )
        if result["\u72b6\u6001"] != "\u5b8c\u6210":
            error_message = result["\u9519\u8bef\u4fe1\u606f"]
            raise RuntimeError(f"Backfill stopped at {start}~{end}: {error_message}")


if __name__ == "__main__":
    main()
