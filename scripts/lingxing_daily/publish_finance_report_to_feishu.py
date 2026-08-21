#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Idempotently publish a generated finance report to Feishu Base via lark-cli."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config_env import load_project_env, require  # noqa: E402

_ENV = load_project_env()
DEFAULT_BASE_TOKEN = require(_ENV, "FINANCE_DAILY_REPORT_FEISHU_APP_TOKEN")
DEFAULT_TABLE_ID = (
    os.getenv("FINANCE_FEISHU_TABLE_ID")
    or _ENV.get("FINANCE_DAILY_REPORT_TABLE_TOTAL")
    or ""
)


def lark_command() -> list[str]:
    executable = shutil.which("lark-cli") or shutil.which("lark-cli.cmd") or shutil.which("lark-cli.exe")
    if executable:
        return [executable]
    script = shutil.which("lark-cli.ps1")
    if script:
        return ["pwsh", "-NoProfile", "-File", script]
    raise RuntimeError("lark-cli is not available on PATH")


def run_cli(arguments: list[str], cwd: Path | None = None) -> dict[str, Any]:
    completed = subprocess.run(
        [*lark_command(), *arguments],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=cwd,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    payload = json.loads(completed.stdout)
    if not payload.get("ok"):
        raise RuntimeError(json.dumps(payload, ensure_ascii=False))
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--base-token", default=os.getenv("FINANCE_FEISHU_BASE_TOKEN") or DEFAULT_BASE_TOKEN)
    parser.add_argument("--table-id", default=DEFAULT_TABLE_ID or None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.table_id:
        raise RuntimeError("缺少 --table-id 或 config/public 中的 FINANCE_DAILY_REPORT_TABLE_TOTAL")

    report_path = Path(args.report).resolve()
    records = json.loads(report_path.read_text(encoding="utf-8"))["create_records"]
    dates = {str(record["日期"])[:10] for record in records}
    if len(dates) != 1:
        raise RuntimeError(f"Report must contain exactly one date, got {sorted(dates)}")
    target_date = next(iter(dates))

    filter_body = {"logic": "and", "conditions": [["日期", "==", f"ExactDate({target_date})"]]}
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        filter_path = temp / "filter.json"
        filter_path.write_text(json.dumps(filter_body, ensure_ascii=False), encoding="utf-8")
        existing = run_cli([
            "base", "+record-list", "--base-token", args.base_token, "--table-id", args.table_id,
            "--filter-json", "@filter.json", "--field-id", "文本", "--limit", "200",
            "--as", "user", "--format", "json",
        ], cwd=temp)["data"]
        existing_by_key = {
            row[0]: record_id
            for row, record_id in zip(existing.get("data", []), existing.get("record_id_list", []))
            if row and row[0]
        }

        creates = [record for record in records if record["文本"] not in existing_by_key]
        updates = {
            existing_by_key[record["文本"]]: record
            for record in records if record["文本"] in existing_by_key
        }
        expected_keys = {record["文本"] for record in records}
        stale = sorted(set(existing_by_key) - expected_keys)
        if stale:
            raise RuntimeError(f"Found unexpected same-date records; refusing implicit deletion: {stale}")

        summary = {"date": target_date, "create": len(creates), "update": len(updates), "existing": len(existing_by_key)}
        if args.dry_run:
            print(json.dumps(summary, ensure_ascii=False, indent=2))
            return

        if creates:
            create_path = temp / "create.json"
            create_path.write_text(json.dumps({"create_records": creates}, ensure_ascii=False), encoding="utf-8")
            run_cli([
                "base", "+record-batch-create", "--base-token", args.base_token, "--table-id", args.table_id,
                "--json", "@create.json", "--as", "user", "--format", "json",
            ], cwd=temp)
        if updates:
            update_path = temp / "update.json"
            update_path.write_text(json.dumps({"update_records": updates}, ensure_ascii=False), encoding="utf-8")
            run_cli([
                "base", "+record-batch-update", "--base-token", args.base_token, "--table-id", args.table_id,
                "--json", "@update.json", "--as", "user", "--format", "json",
            ], cwd=temp)
        print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
