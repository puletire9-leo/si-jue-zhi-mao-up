from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from prepare_manual_batches import (
    DEFAULT_REQUIRED_COLUMNS,
    chunk_rows,
    cleanup_existing_batches,
    ensure_required_columns,
    read_source_rows,
    write_batches,
    write_manifest,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MANUAL_ROOT = REPO_ROOT / "0.1版本手动" / "非标选品"
DEFAULT_CARRIER_TABLE = MANUAL_ROOT / "文档载体表" / "载体表.md"
VALID_CARRIER_STATUSES = {"ACTIVE", "HOLD", "OFF"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export manual nonstandard candidates and split them into AI batches.")
    parser.add_argument("--marketplace", required=True, help="Marketplace code, for example UK / DE / US")
    parser.add_argument("--date-folder", required=True, help="Date folder under manual pipeline, for example 6.24")
    parser.add_argument("--base-url", default="http://localhost:8004", help="Base URL of the product service")
    parser.add_argument("--scan-limit", type=int, default=5000, help="manual-candidates scanLimit")
    parser.add_argument("--limit", type=int, default=100, help="Final exported candidate count after local carrier policy filtering")
    parser.add_argument("--batch-size", type=int, default=50, help="Rows per AI batch file")
    parser.add_argument("--month", default=None, help="Optional month override, for example 202606")
    parser.add_argument("--carrier", default=None, help="Optional canonical carrier filter sent to backend")
    parser.add_argument("--fetch-limit", type=int, default=0, help="Backend fetch limit before local carrier filtering. 0 means auto.")
    parser.add_argument("--carrier-table", default=str(DEFAULT_CARRIER_TABLE), help="Markdown carrier table path")
    parser.add_argument("--allowed-statuses", default="ACTIVE", help="Comma-separated allowed carrier statuses, for example ACTIVE or ACTIVE,HOLD")
    parser.add_argument("--exclude-carriers", default="", help="Comma-separated canonical carriers to exclude after fetch, for example Cap,Figure")
    return parser.parse_args()


def parse_csv_tokens(raw: str | None) -> list[str]:
    if raw is None:
        return []
    return [token.strip() for token in raw.split(",") if token.strip()]


def normalize_allowed_statuses(raw: str) -> set[str]:
    statuses = {token.upper() for token in parse_csv_tokens(raw)}
    invalid = sorted(statuses - VALID_CARRIER_STATUSES)
    if invalid:
        raise ValueError(f"unsupported carrier statuses: {invalid}")
    return statuses or {"ACTIVE"}


def resolve_fetch_limit(final_limit: int, requested_fetch_limit: int, needs_local_filter: bool) -> int:
    if requested_fetch_limit > 0:
        return min(1000, requested_fetch_limit)
    if not needs_local_filter:
        return final_limit
    return min(1000, max(final_limit * 3, final_limit + 200))


def load_carrier_statuses(carrier_table: Path) -> dict[str, str]:
    if not carrier_table.exists():
        raise FileNotFoundError(f"carrier table not found: {carrier_table}")

    statuses: dict[str, str] = {}
    for line in carrier_table.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 6:
            continue
        canonical = cells[0]
        status = cells[2].upper()
        if canonical in {"canonical_en", "---"}:
            continue
        if status in VALID_CARRIER_STATUSES:
            statuses[canonical] = status

    if not statuses:
        raise RuntimeError(f"no carrier rows parsed from: {carrier_table}")
    return statuses


def fetch_manual_candidates(
    base_url: str,
    marketplace: str,
    scan_limit: int,
    fetch_limit: int,
    month: str | None,
    carrier: str | None,
) -> dict[str, Any]:
    query = {
        "marketplace": marketplace.upper(),
        "scanLimit": scan_limit,
        "limit": fetch_limit,
    }
    if month:
        query["month"] = month
    if carrier:
        query["carrier"] = carrier

    url = f"{base_url.rstrip('/')}/api/v1/element-discovery/manual-candidates?{urlencode(query)}"
    try:
        with urlopen(url) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"request failed: {error.code} {body}") from error
    except URLError as error:
        raise RuntimeError(f"request failed: {error}") from error

    if payload.get("code") != 200:
        raise RuntimeError(f"unexpected response: {json.dumps(payload, ensure_ascii=False)}")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise RuntimeError("response data is not an object")
    return data


def detect_canonical_carrier(item: dict[str, Any]) -> str:
    for field in ("canonical_carrier", "carrier_candidates"):
        value = item.get(field)
        if isinstance(value, str) and value.strip():
            return value.split("|")[0].strip()
    candidates = item.get("carrier_candidates_list")
    if isinstance(candidates, list):
        for value in candidates:
            if isinstance(value, str) and value.strip():
                return value.strip()
    return ""


def apply_carrier_policy(
    items: list[dict[str, Any]],
    carrier_statuses: dict[str, str],
    allowed_statuses: set[str],
    excluded_carriers: set[str],
    final_limit: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    kept_items: list[dict[str, Any]] = []
    dropped_by_status: dict[str, int] = {}
    dropped_by_excluded_carrier: dict[str, int] = {}
    kept_by_carrier: dict[str, int] = {}
    unmapped_carriers: set[str] = set()

    for raw_item in items:
        item = dict(raw_item)
        canonical_carrier = detect_canonical_carrier(item)
        carrier_status = carrier_statuses.get(canonical_carrier)
        effective_status = carrier_status or "ACTIVE"

        if canonical_carrier and carrier_status is None:
            unmapped_carriers.add(canonical_carrier)

        if canonical_carrier in excluded_carriers:
            dropped_by_excluded_carrier[canonical_carrier] = dropped_by_excluded_carrier.get(canonical_carrier, 0) + 1
            continue

        if effective_status not in allowed_statuses:
            key = f"{canonical_carrier or 'UNKNOWN'}|{effective_status}"
            dropped_by_status[key] = dropped_by_status.get(key, 0) + 1
            continue

        if canonical_carrier:
            item["carrier_status"] = effective_status if carrier_status else "ACTIVE(default)"
            kept_by_carrier[canonical_carrier] = kept_by_carrier.get(canonical_carrier, 0) + 1
        kept_items.append(item)

    exported_items = kept_items[:final_limit]
    stats = {
        "rawFetchedItems": len(items),
        "keptAfterCarrierPolicy": len(kept_items),
        "droppedByCarrierPolicy": len(items) - len(kept_items),
        "droppedByStatus": dropped_by_status,
        "droppedByExcludedCarrier": dropped_by_excluded_carrier,
        "keptByCarrier": kept_by_carrier,
        "unmappedCarriers": sorted(unmapped_carriers),
        "exportedItems": len(exported_items),
    }
    return exported_items, stats


def build_fieldnames(items: list[dict[str, Any]]) -> list[str]:
    ordered: list[str] = list(DEFAULT_REQUIRED_COLUMNS)
    seen = set(ordered)
    for item in items:
        for key in item.keys():
            if key not in seen:
                ordered.append(key)
                seen.add(key)
    return ordered


def stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def write_source_csv(source_file: Path, fieldnames: list[str], items: list[dict[str, Any]]) -> None:
    source_file.parent.mkdir(parents=True, exist_ok=True)
    with source_file.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            row = {field: stringify(item.get(field)) for field in fieldnames}
            writer.writerow(row)


def write_export_summary(
    source_dir: Path,
    data: dict[str, Any],
    source_file: Path,
    output_dir: Path,
    fetch_limit: int,
    policy_stats: dict[str, Any],
    carrier_table: Path,
    allowed_statuses: set[str],
    excluded_carriers: set[str],
) -> None:
    summary = {
        "marketplace": data.get("marketplace"),
        "month": data.get("month"),
        "scanLimit": data.get("scanLimit"),
        "fetchLimit": fetch_limit,
        "finalLimit": data.get("limit"),
        "matchedProducts": data.get("matchedProducts"),
        "keptNonStandardProducts": data.get("keptNonStandardProducts"),
        "filteredStandardProducts": data.get("filteredStandardProducts"),
        "baselineResolvedCandidates": data.get("baselineResolvedCandidates"),
        "rawFetchedItems": policy_stats["rawFetchedItems"],
        "keptAfterCarrierPolicy": policy_stats["keptAfterCarrierPolicy"],
        "droppedByCarrierPolicy": policy_stats["droppedByCarrierPolicy"],
        "droppedByStatus": policy_stats["droppedByStatus"],
        "droppedByExcludedCarrier": policy_stats["droppedByExcludedCarrier"],
        "keptByCarrier": policy_stats["keptByCarrier"],
        "unmappedCarriers": policy_stats["unmappedCarriers"],
        "exportedItems": policy_stats["exportedItems"],
        "carrierTable": str(carrier_table),
        "allowedStatuses": sorted(allowed_statuses),
        "excludedCarriers": sorted(excluded_carriers),
        "source_file": str(source_file),
        "output_dir": str(output_dir),
    }
    (source_dir / "export_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def prepare_batches(source_file: Path, output_dir: Path, batch_size: int) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    cleanup_existing_batches(output_dir)

    fieldnames, rows = read_source_rows(source_file)
    ensure_required_columns(fieldnames, DEFAULT_REQUIRED_COLUMNS)

    rows = [row for row in rows if any(value for value in row.values())]
    chunks = chunk_rows(rows, batch_size)
    manifest_items = write_batches(output_dir, fieldnames, chunks)
    write_manifest(output_dir, source_file, manifest_items, len(rows))

    return {
        "rows": len(rows),
        "batches": len(manifest_items),
        "batch_size": batch_size,
    }


def main() -> None:
    args = parse_args()
    marketplace = args.marketplace.upper()
    allowed_statuses = normalize_allowed_statuses(args.allowed_statuses)
    excluded_carriers = set(parse_csv_tokens(args.exclude_carriers))
    carrier_table = Path(args.carrier_table)
    carrier_statuses = load_carrier_statuses(carrier_table)
    needs_local_filter = bool(excluded_carriers) or any(
        status not in allowed_statuses for status in carrier_statuses.values()
    )
    fetch_limit = resolve_fetch_limit(args.limit, args.fetch_limit, needs_local_filter)

    source_dir = MANUAL_ROOT / "系统来源" / args.date_folder / marketplace
    output_dir = MANUAL_ROOT / "批次输入" / args.date_folder / marketplace
    source_file = source_dir / "system_filtered_candidates.csv"

    data = fetch_manual_candidates(
        base_url=args.base_url,
        marketplace=marketplace,
        scan_limit=args.scan_limit,
        fetch_limit=fetch_limit,
        month=args.month,
        carrier=args.carrier,
    )

    raw_items = data.get("items")
    if not isinstance(raw_items, list):
        raise RuntimeError("response items is not a list")

    items = [item for item in raw_items if isinstance(item, dict)]
    filtered_items, policy_stats = apply_carrier_policy(
        items=items,
        carrier_statuses=carrier_statuses,
        allowed_statuses=allowed_statuses,
        excluded_carriers=excluded_carriers,
        final_limit=args.limit,
    )

    fieldnames = build_fieldnames(filtered_items)
    write_source_csv(source_file, fieldnames, filtered_items)
    write_export_summary(
        source_dir=source_dir,
        data={**data, "limit": args.limit},
        source_file=source_file,
        output_dir=output_dir,
        fetch_limit=fetch_limit,
        policy_stats=policy_stats,
        carrier_table=carrier_table,
        allowed_statuses=allowed_statuses,
        excluded_carriers=excluded_carriers,
    )
    batch_summary = prepare_batches(source_file, output_dir, args.batch_size)

    print(json.dumps(
        {
            "marketplace": marketplace,
            "month": data.get("month"),
            "scanLimit": data.get("scanLimit"),
            "fetchLimit": fetch_limit,
            "finalLimit": args.limit,
            "matchedProducts": data.get("matchedProducts"),
            "keptNonStandardProducts": data.get("keptNonStandardProducts"),
            "filteredStandardProducts": data.get("filteredStandardProducts"),
            "rawFetchedItems": policy_stats["rawFetchedItems"],
            "keptAfterCarrierPolicy": policy_stats["keptAfterCarrierPolicy"],
            "droppedByCarrierPolicy": policy_stats["droppedByCarrierPolicy"],
            "exportedItems": policy_stats["exportedItems"],
            "allowedStatuses": sorted(allowed_statuses),
            "excludedCarriers": sorted(excluded_carriers),
            "source_file": str(source_file),
            "output_dir": str(output_dir),
            "batch_rows": batch_summary["rows"],
            "batch_count": batch_summary["batches"],
            "batch_size": batch_summary["batch_size"],
        },
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()
