"""Fetch SellerSprite shop lookup raw responses for Deng Zong shop experiments.

This script intentionally calls SellerSprite directly instead of the Java API so
the complete raw response can be saved for field inspection.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
DEFAULT_OUT_DIR = ROOT / "产品数据" / "邓总店铺" / "sellersprite_raw"
DEFAULT_LIST_FILES = {
    "UK": ROOT / "产品数据" / "邓总店铺" / "郑总店铺uk.md",
    "DE": ROOT / "产品数据" / "邓总店铺" / "郑总店铺de.md",
}


def load_secret_key() -> str:
    env_key = os.getenv("SELLERSPRITE_SECRET_KEY")
    if env_key:
        return env_key.strip()

    for rel in ("config/secrets/prod.env", "config/secrets/dev.env"):
        path = ROOT / rel
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "SELLERSPRITE_SECRET_KEY" and value.strip():
                return value.strip()

    raise RuntimeError("SELLERSPRITE_SECRET_KEY not found in env or config/secrets/*.env")


def read_seller_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for source, path in DEFAULT_LIST_FILES.items():
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            parts = re.split(r"\s+", stripped, maxsplit=1)
            seller_name = parts[0].strip()
            store_url = parts[1].strip() if len(parts) > 1 else ""
            if seller_name:
                rows.append({"source": source, "sellerName": seller_name, "storeUrl": store_url})
    return rows


def unique_sellers(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    by_name: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = row["sellerName"]
        item = by_name.setdefault(name, {"sellerName": name, "sources": [], "storeUrls": {}})
        if row["source"] not in item["sources"]:
            item["sources"].append(row["source"])
        if row["storeUrl"]:
            item["storeUrls"][row["source"]] = row["storeUrl"]
    return [by_name[name] for name in sorted(by_name)]


def slug(value: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]+", "_", value.strip())
    return clean or "unknown"


def build_request_body(seller_name: str, marketplace: str, page: int, size: int) -> dict[str, Any]:
    # Mirrors DengZongShopService.callApi().
    return {
        "marketplace": marketplace,
        "sellerName": seller_name,
        "asins": [],
        "variation": "N",
        "page": page,
        "size": size,
        "orderDesc": True,
    }


def call_sellersprite(secret_key: str, body: dict[str, Any], timeout: int) -> tuple[int | None, dict[str, Any]]:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "secret-key": secret_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, json.loads(text)
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        try:
            payload_json = json.loads(text)
        except json.JSONDecodeError:
            payload_json = {"raw": text}
        return exc.code, payload_json


def find_possible_date_keys(value: Any, prefix: str = "") -> set[str]:
    hits: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            lower = str(key).lower()
            if any(token in lower for token in ("created", "create", "date", "time", "since")):
                if any(scope in path.lower() for scope in ("seller", "shop", "store", "merchant")):
                    hits.add(path)
            hits.update(find_possible_date_keys(child, path))
    elif isinstance(value, list):
        for idx, child in enumerate(value[:3]):
            hits.update(find_possible_date_keys(child, f"{prefix}[{idx}]"))
    return hits


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run_task(
    *,
    secret_key: str,
    seller: dict[str, Any],
    marketplace: str,
    out_root: Path,
    run_id: str,
    size: int,
    max_pages: int,
    timeout: int,
) -> dict[str, Any]:
    seller_name = seller["sellerName"]
    task_dir = out_root / run_id / marketplace / slug(seller_name)
    responses: list[dict[str, Any]] = []
    total = 0
    pages = 0
    items_saved = 0
    error = None
    possible_date_keys: set[str] = set()

    page = 1
    while True:
        body = build_request_body(seller_name, marketplace, page, size)
        request_snapshot = {
            "url": API_URL,
            "headers": {
                "secret-key": f"{secret_key[:4]}***{secret_key[-4:]}",
                "Content-Type": "application/json",
            },
            "body": body,
        }
        write_json(task_dir / f"request-page-{page:03d}.json", request_snapshot)

        started_at = datetime.now().isoformat(timespec="seconds")
        start = time.time()
        status, response = call_sellersprite(secret_key, body, timeout)
        elapsed_ms = int((time.time() - start) * 1000)
        raw_record = {
            "requestedAt": started_at,
            "elapsedMs": elapsed_ms,
            "httpStatus": status,
            "request": request_snapshot,
            "response": response,
        }
        write_json(task_dir / f"response-page-{page:03d}.json", raw_record)
        responses.append(raw_record)

        if response.get("code") != "OK":
            error = response.get("message") or response.get("code") or f"HTTP {status}"
            break

        data = response.get("data") or {}
        items = data.get("items") or []
        total = int(data.get("total") or total or 0)
        pages = int(data.get("pages") or pages or 0)
        items_saved += len(items)
        possible_date_keys.update(find_possible_date_keys(response))

        if page >= pages or not items:
            break
        if max_pages > 0 and page >= max_pages:
            break
        page += 1
        time.sleep(0.3)

    first_items = []
    if responses:
        data = responses[0].get("response", {}).get("data") or {}
        first_items = data.get("items") or []

    seller_ids = sorted({str(item.get("sellerId")) for item in first_items if item.get("sellerId")})
    seller_nations = sorted({str(item.get("sellerNation")) for item in first_items if item.get("sellerNation")})
    item_keys = sorted({key for item in first_items[:10] if isinstance(item, dict) for key in item.keys()})

    summary = {
        "sellerName": seller_name,
        "marketplace": marketplace,
        "sourceLists": seller.get("sources", []),
        "storeUrls": seller.get("storeUrls", {}),
        "total": total,
        "pagesReported": pages,
        "pagesFetched": len(responses),
        "itemsSaved": items_saved,
        "sellerIdsSeenFirstPage": seller_ids,
        "sellerNationsSeenFirstPage": seller_nations,
        "firstPageItemKeys": item_keys,
        "possibleShopCreatedAtKeys": sorted(possible_date_keys),
        "error": error,
        "taskDir": str(task_dir),
    }
    write_json(task_dir / "summary.json", summary)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seller", action="append", dest="sellers", help="Seller name to fetch. Repeatable.")
    parser.add_argument("--marketplace", action="append", dest="marketplaces", choices=["UK", "DE"], help="Marketplace. Repeatable.")
    parser.add_argument("--limit-sellers", type=int, default=None, help="Use the first N sellers from the unique list.")
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--max-pages", type=int, default=0, help="0 means fetch all pages, matching DengZongShopService.syncBySellerName().")
    parser.add_argument("--delay-seconds", type=float, default=2.0)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--run-id", default=datetime.now().strftime("%Y%m%d_%H%M%S"))
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    args = parser.parse_args()

    secret_key = load_secret_key()
    sellers = unique_sellers(read_seller_rows())
    if args.sellers:
        requested = {s.lower() for s in args.sellers}
        sellers = [s for s in sellers if s["sellerName"].lower() in requested]
        missing = requested - {s["sellerName"].lower() for s in sellers}
        if missing:
            raise SystemExit(f"seller(s) not found in list files: {', '.join(sorted(missing))}")
    if args.limit_sellers is not None:
        sellers = sellers[: args.limit_sellers]

    marketplaces = args.marketplaces or ["UK", "DE"]
    tasks = [(seller, marketplace) for seller in sellers for marketplace in marketplaces]
    out_root = Path(args.out_dir)
    summaries = []

    print(f"run_id={args.run_id}")
    print(f"sellers={len(sellers)} marketplaces={','.join(marketplaces)} tasks={len(tasks)}")
    print(f"max_pages={args.max_pages} delay_seconds={args.delay_seconds}")
    print(f"out_dir={out_root / args.run_id}")

    for index, (seller, marketplace) in enumerate(tasks, 1):
        print(f"[{index}/{len(tasks)}] {seller['sellerName']} {marketplace}")
        summary = run_task(
            secret_key=secret_key,
            seller=seller,
            marketplace=marketplace,
            out_root=out_root,
            run_id=args.run_id,
            size=args.size,
            max_pages=args.max_pages,
            timeout=args.timeout,
        )
        summaries.append(summary)
        print(
            "  total={total} pagesFetched={pagesFetched} items={itemsSaved} error={error}".format(
                **summary
            )
        )
        if index < len(tasks):
            time.sleep(args.delay_seconds)

    write_json(out_root / args.run_id / "summary.json", summaries)
    print(f"summary={out_root / args.run_id / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
