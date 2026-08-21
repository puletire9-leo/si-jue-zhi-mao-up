#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Create and import the five finance report tables into Feishu Base."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

BASE_TOKEN = "QBc8bH86oayGgssalfhcXqKLnwc"
SCRIPT_DIR = Path(__file__).resolve().parent
MANIFEST = SCRIPT_DIR / "_feishu_five_tables" / "manifest.json"
STATE = SCRIPT_DIR / "_feishu_five_tables" / "import_state.json"


def command_prefix() -> list[str]:
    executable = shutil.which("lark-cli") or shutil.which("lark-cli.cmd") or shutil.which("lark-cli.exe")
    if executable:
        return [executable]
    script = shutil.which("lark-cli.ps1")
    if script:
        return ["pwsh", "-NoProfile", "-File", script]
    raise RuntimeError("lark-cli not found")


def run(arguments: list[str], cwd: Path | None = None) -> dict[str, Any]:
    completed = subprocess.run(
        [*command_prefix(), *arguments], cwd=cwd, capture_output=True, text=True, encoding="utf-8", check=False
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    payload = json.loads(completed.stdout)
    if not payload.get("ok"):
        raise RuntimeError(json.dumps(payload, ensure_ascii=False))
    return payload


def existing_tables() -> dict[str, dict[str, Any]]:
    payload = run(["base", "+table-list", "--base-token", BASE_TOKEN, "--limit", "100", "--as", "user", "--format", "json"])
    return {table["name"]: table for table in payload["data"]["tables"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"tables": {}}
    current = existing_tables()

    for name, info in manifest["tables"].items():
        if name in current and name not in state["tables"]:
            raise RuntimeError(f"Table {name} already exists but is not tracked in import state; refusing to overwrite")
        if name not in state["tables"]:
            if args.dry_run:
                print(json.dumps({"table": name, "action": "create", "records": info["total_records"]}, ensure_ascii=False))
                continue
            table_dir = Path(info["fields_file"]).parent
            response = run([
                "base", "+table-create", "--base-token", BASE_TOKEN, "--name", name,
                "--fields", "@fields.json", "--as", "user", "--format", "json",
            ], cwd=table_dir)
            table = response["data"]["table"]
            state["tables"][name] = {"table_id": table["id"], "completed_batches": []}
            STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"created {name}: {table['id']}", flush=True)

        table_state = state["tables"][name]
        table_id = table_state["table_id"]
        for batch_number, batch_path_text in enumerate(info["batches"], 1):
            if batch_number in table_state["completed_batches"]:
                continue
            if args.dry_run:
                print(json.dumps({"table": name, "batch": batch_number, "action": "import"}, ensure_ascii=False))
                continue
            batch_path = Path(batch_path_text)
            response = run([
                "base", "+record-batch-create", "--base-token", BASE_TOKEN, "--table-id", table_id,
                "--json", f"@{batch_path.name}", "--as", "user", "--format", "json",
            ], cwd=batch_path.parent)
            created = len(response["data"].get("record_id_list", []))
            expected = len(json.loads(batch_path.read_text(encoding="utf-8"))["create_records"])
            if created != expected:
                raise RuntimeError(f"{name} batch {batch_number}: created {created}, expected {expected}")
            table_state["completed_batches"].append(batch_number)
            STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"imported {name} batch {batch_number}: {created}", flush=True)

    if not args.dry_run:
        print(json.dumps(state, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
