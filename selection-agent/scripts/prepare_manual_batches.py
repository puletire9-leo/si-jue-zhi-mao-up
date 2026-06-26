from __future__ import annotations

import csv
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SWITCH_FILE = REPO_ROOT / "0.1版本手动" / "非标选品" / "任务开关.json"
DEFAULT_REQUIRED_COLUMNS = [
    "row_id",
    "asin",
    "marketplace",
    "title",
    "matched_carrier_anchor",
    "carrier_candidates",
    "category_hint",
    "bsr_id",
    "notes",
]


def load_switch(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_source_rows(source_file: Path) -> tuple[list[str], list[dict[str, str]]]:
    with source_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        rows = [normalize_row(row, fieldnames) for row in reader]
    return fieldnames, rows


def normalize_row(row: dict[str, str | None], fieldnames: list[str]) -> dict[str, str]:
    return {name: (row.get(name) or "").strip() for name in fieldnames}


def ensure_required_columns(fieldnames: list[str], required_columns: list[str]) -> None:
    missing = [column for column in required_columns if column not in fieldnames]
    if missing:
        raise ValueError(f"source file is missing required columns: {missing}")


def cleanup_existing_batches(output_dir: Path) -> None:
    for file in output_dir.glob("batch_*asin.csv"):
        file.unlink()
    for file in output_dir.glob("batch_manifest.*"):
        file.unlink()


def chunk_rows(rows: list[dict[str, str]], batch_size: int) -> list[list[dict[str, str]]]:
    return [rows[index : index + batch_size] for index in range(0, len(rows), batch_size)]


def write_batches(
    output_dir: Path,
    fieldnames: list[str],
    chunks: list[list[dict[str, str]]],
) -> list[dict]:
    manifest_items: list[dict] = []
    for index, chunk in enumerate(chunks, start=1):
        count = len(chunk)
        filename = f"batch_{index:03d}_{count}asin.csv"
        file_path = output_dir / filename
        with file_path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(chunk)

        asin_values = [row.get("asin", "") for row in chunk if row.get("asin", "")]
        manifest_items.append(
            {
                "batch_index": index,
                "filename": filename,
                "count": count,
                "first_asin": asin_values[0] if asin_values else "",
                "last_asin": asin_values[-1] if asin_values else "",
            }
        )
    return manifest_items


def write_manifest(output_dir: Path, source_file: Path, manifest_items: list[dict], total_rows: int) -> None:
    manifest_json = {
        "source_file": str(source_file),
        "total_rows": total_rows,
        "total_batches": len(manifest_items),
        "batches": manifest_items,
    }
    (output_dir / "batch_manifest.json").write_text(
        json.dumps(manifest_json, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# 批次清单",
        "",
        f"- source_file: `{source_file}`",
        f"- total_rows: `{total_rows}`",
        f"- total_batches: `{len(manifest_items)}`",
        "",
        "| batch_index | filename | count | first_asin | last_asin |",
        "| --- | --- | --- | --- | --- |",
    ]
    for item in manifest_items:
        lines.append(
            f"| {item['batch_index']} | {item['filename']} | {item['count']} | {item['first_asin']} | {item['last_asin']} |"
        )
    (output_dir / "batch_manifest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    switch_file = DEFAULT_SWITCH_FILE
    switch = load_switch(switch_file)

    if not switch.get("enabled", False):
        print(f"[skip] switch disabled: {switch_file}")
        return

    if switch.get("action") != "prepare_batches":
        raise ValueError(f"unsupported action: {switch.get('action')}")

    source_file = Path(switch["source_file"])
    output_dir = Path(switch["output_dir"])
    batch_size = int(switch.get("batch_size", 50))
    required_columns = switch.get("required_columns") or DEFAULT_REQUIRED_COLUMNS

    if not source_file.exists():
        raise FileNotFoundError(f"source file not found: {source_file}")

    output_dir.mkdir(parents=True, exist_ok=True)

    if switch.get("clear_existing_batches", False):
        cleanup_existing_batches(output_dir)

    fieldnames, rows = read_source_rows(source_file)
    ensure_required_columns(fieldnames, required_columns)

    rows = [row for row in rows if any(value for value in row.values())]
    chunks = chunk_rows(rows, batch_size)
    manifest_items = write_batches(output_dir, fieldnames, chunks)

    if switch.get("write_manifest", True):
        write_manifest(output_dir, source_file, manifest_items, len(rows))

    print(f"[ok] source={source_file}")
    print(f"[ok] output_dir={output_dir}")
    print(f"[ok] rows={len(rows)} batches={len(manifest_items)} batch_size={batch_size}")


if __name__ == "__main__":
    main()
