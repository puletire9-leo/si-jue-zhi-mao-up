from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
RAW_ROOT = (
    ROOT
    / "\u4ea7\u54c1\u6570\u636e"
    / "\u9093\u603b\u5e97\u94fa"
    / "sellersprite_raw"
    / "zheng_all_uk_de_20260707"
)
OUT_ROOT = RAW_ROOT / "variant_mode_compare"


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
    raise RuntimeError("SELLERSPRITE_SECRET_KEY not found")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_items(response_record: dict[str, Any]) -> list[dict[str, Any]]:
    response = response_record.get("response") or {}
    data = response.get("data") or {}
    items = data.get("items") or []
    return [item for item in items if isinstance(item, dict)]


def load_existing_items(marketplace: str, seller_name: str) -> list[dict[str, Any]]:
    seller_dir = RAW_ROOT / marketplace / seller_name
    items: list[dict[str, Any]] = []
    for path in sorted(seller_dir.glob("response-page-*.json")):
        record = read_json(path)
        items.extend(extract_items(record))
    return items


def dedup_key(item: dict[str, Any]) -> str:
    return str(item.get("parent") or item.get("parentAsin") or item.get("asin") or "").strip()


def as_number(value: Any, default: float = -1) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clean_representatives(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        key = dedup_key(item)
        if key:
            groups.setdefault(key, []).append(item)

    reps = []
    for key, group in groups.items():
        # Mirrors the baseline idea: one representative per parent group.
        # SellerSprite shop raw data has availableDate instead of listing_days;
        # newer availableDate means newer listing. units breaks ties.
        reps.append(
            sorted(
                group,
                key=lambda item: (
                    as_number(item.get("availableDate")),
                    as_number(item.get("units")),
                    str(item.get("asin") or ""),
                ),
                reverse=True,
            )[0]
        )
    return reps


def summarize_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[str, list[str]] = {}
    for item in items:
        key = dedup_key(item)
        asin = str(item.get("asin") or "").strip()
        if key:
            groups.setdefault(key, []).append(asin)
    duplicate_groups = {key: asins for key, asins in groups.items() if len(set(asins)) > 1}
    return {
        "rows": len(items),
        "dedupGroups": len(groups),
        "duplicateParentGroups": len(duplicate_groups),
        "duplicateRows": sum(len(set(asins)) for asins in duplicate_groups.values()),
        "maxVariantsInParentGroup": max((len(set(asins)) for asins in duplicate_groups.values()), default=0),
    }


def analyze_existing() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for marketplace_dir in [RAW_ROOT / "UK", RAW_ROOT / "DE"]:
        if not marketplace_dir.exists():
            continue
        marketplace = marketplace_dir.name
        for seller_dir in sorted(path for path in marketplace_dir.iterdir() if path.is_dir()):
            items = load_existing_items(marketplace, seller_dir.name)
            if not items:
                continue
            summary = summarize_items(items)
            summary.update({"marketplace": marketplace, "sellerName": seller_dir.name})
            rows.append(summary)
    rows.sort(key=lambda row: (row["duplicateRows"], row["rows"]), reverse=True)
    return rows


def call_sellersprite(secret_key: str, body: dict[str, Any], timeout: int) -> tuple[int | None, dict[str, Any]]:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"secret-key": secret_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8")
            return response.status, json.loads(text)
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(text)
        except json.JSONDecodeError:
            return exc.code, {"raw": text}


def request_no_variation(marketplace: str, seller_name: str, size: int, timeout: int, variation_field: str) -> Path:
    secret_key = load_secret_key()
    body = {
        "marketplace": marketplace,
        "sellerName": seller_name,
        "asins": [],
        "page": 1,
        "size": size,
        "orderDesc": True,
    }
    # SellerSprite API docs in this repo use variation=N/Y. The user mentioned
    # variationString=N/Y, so this script supports both for one-off verification.
    body[variation_field] = "Y"
    request_snapshot = {
        "url": API_URL,
        "headers": {
            "secret-key": f"{secret_key[:4]}***{secret_key[-4:]}",
            "Content-Type": "application/json",
        },
        "body": body,
    }
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = OUT_ROOT / run_id / marketplace / seller_name
    write_json(out_dir / "request-page-001.json", request_snapshot)

    started = datetime.now().isoformat(timespec="seconds")
    start = time.time()
    status, response = call_sellersprite(secret_key, body, timeout)
    elapsed_ms = int((time.time() - start) * 1000)
    record = {
        "requestedAt": started,
        "elapsedMs": elapsed_ms,
        "httpStatus": status,
        "request": request_snapshot,
        "response": response,
    }
    write_json(out_dir / "response-page-001.json", record)
    return out_dir


def compare(
    marketplace: str,
    seller_name: str,
    response_dir: Path | None = None,
    request: bool = False,
    size: int = 100,
    timeout: int = 120,
    variation_field: str = "variation",
) -> dict[str, Any]:
    existing_items = load_existing_items(marketplace, seller_name)
    cleaned = clean_representatives(existing_items)

    if request:
        response_dir = request_no_variation(marketplace, seller_name, size, timeout, variation_field)
    if response_dir is None:
        raise ValueError("response_dir is required when request=False")

    new_record = read_json(response_dir / "response-page-001.json")
    new_items = extract_items(new_record)
    response = new_record.get("response") or {}
    data = response.get("data") or {}

    existing_asins = {str(item.get("asin") or "") for item in existing_items if item.get("asin")}
    cleaned_asins = {str(item.get("asin") or "") for item in cleaned if item.get("asin")}
    new_asins = {str(item.get("asin") or "") for item in new_items if item.get("asin")}
    cleaned_keys = {dedup_key(item) for item in cleaned if dedup_key(item)}
    new_keys = {dedup_key(item) for item in new_items if dedup_key(item)}
    common_asins = new_asins & cleaned_asins
    common_keys = new_keys & cleaned_keys

    result = {
        "marketplace": marketplace,
        "sellerName": seller_name,
        "responseDir": str(response_dir),
        "requestVariationField": variation_field,
        "requestVariationValue": "Y",
        "apiCode": response.get("code"),
        "apiTotal": data.get("total"),
        "apiPages": data.get("pages"),
        "apiItemsPage1": len(new_items),
        "newPage1": summarize_items(new_items),
        "existing": summarize_items(existing_items),
        "cleanedRows": len(cleaned),
        "setCompare": {
            "newAsinCount": len(new_asins),
            "cleanedRepAsinCount": len(cleaned_asins),
            "commonAsinCount": len(common_asins),
            "newParentKeyCount": len(new_keys),
            "cleanedParentKeyCount": len(cleaned_keys),
            "commonParentKeyCount": len(common_keys),
            "parentKeyOverlapRatio": round(len(common_keys) / max(len(new_keys | cleaned_keys), 1), 4),
            "newAsinsEqualsExistingAsins": new_asins == existing_asins,
            "newAsinsEqualsCleanedRepAsins": new_asins == cleaned_asins,
            "newParentKeysEqualsCleanedParentKeys": new_keys == cleaned_keys,
            "newOnlyAsins": sorted(new_asins - cleaned_asins),
            "cleanedOnlyAsins": sorted(cleaned_asins - new_asins),
            "newOnlyParentKeys": sorted(new_keys - cleaned_keys),
            "cleanedOnlyParentKeys": sorted(cleaned_keys - new_keys),
        },
    }
    write_json(response_dir / "comparison.json", result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    analyze_cmd = sub.add_parser("analyze")
    analyze_cmd.add_argument("--top", type=int, default=20)

    compare_cmd = sub.add_parser("compare")
    compare_cmd.add_argument("--marketplace", required=True, choices=["UK", "DE"])
    compare_cmd.add_argument("--seller", required=True)
    compare_cmd.add_argument("--request", action="store_true")
    compare_cmd.add_argument("--response-dir")
    compare_cmd.add_argument("--variation-field", default="variation", choices=["variation", "variationString"])
    compare_cmd.add_argument("--size", type=int, default=100)
    compare_cmd.add_argument("--timeout", type=int, default=120)

    args = parser.parse_args()
    if args.command == "analyze":
        rows = analyze_existing()
        out = OUT_ROOT / "existing_variant_pollution_summary.json"
        write_json(out, rows)
        print(f"summary={out}")
        for row in rows[: args.top]:
            print(
                "{marketplace} {sellerName} rows={rows} groups={dedupGroups} dupGroups={duplicateParentGroups} "
                "dupRows={duplicateRows} maxVariants={maxVariantsInParentGroup}".format(**row)
            )
        return 0

    response_dir = Path(args.response_dir) if args.response_dir else None
    result = compare(
        args.marketplace,
        args.seller,
        response_dir=response_dir,
        request=args.request,
        size=args.size,
        timeout=args.timeout,
        variation_field=args.variation_field,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
