#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Import a legacy finance workbook ASIN status snapshot into remote RDS.

Default mode is read-only preview. Pass --apply to insert; an existing snapshot
date is never deleted or overwritten.
"""
from __future__ import annotations

import argparse
import os
import sys
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

import pymysql

ROOT = Path(__file__).resolve().parents[2]
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def read_env(path: Path) -> dict[str, str]:
    result = {}
    if not path.exists():
        return result
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#") and "=" in text:
            key, value = text.split("=", 1)
            result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def rds_config() -> dict:
    values = read_env(ROOT / "config" / "secrets" / "finance_rds.env")
    values.update({k: v for k, v in os.environ.items() if k.startswith("FINANCE_RDS_")})
    return {
        "host": values["FINANCE_RDS_HOST"],
        "port": int(values.get("FINANCE_RDS_PORT", "3306")),
        "user": values["FINANCE_RDS_USER"],
        "password": values["FINANCE_RDS_PASSWORD"],
        "database": values.get("FINANCE_RDS_DATABASE", "sijuelishi"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }


def col_number(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + ord(ch.upper()) - 64
    return value


def load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.iter(f"{NS}t"))
            for item in root.findall(f"{NS}si")]


def first_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    first = workbook.find(f"{NS}sheets")[0]
    rel_id = first.attrib[f"{REL_NS}id"]
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    target = next(rel.attrib["Target"] for rel in rels.findall(f"{PKG_REL_NS}Relationship")
                  if rel.attrib["Id"] == rel_id).replace("\\", "/")
    return target.lstrip("/") if target.startswith("/xl/") else f"xl/{target}"


def cell_value(cell: ET.Element, shared: list[str]):
    node = cell.find(f"{NS}v")
    if node is None or node.text is None:
        return None
    raw = node.text
    if cell.attrib.get("t") == "s":
        return shared[int(raw)]
    try:
        number = float(raw)
        return int(number) if number.is_integer() else number
    except ValueError:
        return raw


def excel_serial(day: date) -> int:
    return (day - date(1899, 12, 30)).days


def serial_date(value) -> date | None:
    if isinstance(value, (int, float)):
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    return None


def number(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def read_snapshot(workbook: Path, snapshot_date: date) -> list[tuple]:
    by_asin: dict[str, tuple] = {}
    target = excel_serial(snapshot_date)
    with zipfile.ZipFile(workbook) as archive:
        shared = load_shared_strings(archive)
        with archive.open(first_sheet_path(archive)) as stream:
            for _, row in ET.iterparse(stream, events=("end",)):
                if row.tag != f"{NS}row":
                    continue
                cells = {}
                for cell in row.findall(f"{NS}c"):
                    value = cell_value(cell, shared)
                    if value is not None:
                        cells[col_number(cell.attrib["r"])] = value
                if cells.get(1) == target and cells.get(2):
                    asin = str(cells[2]).strip()
                    tags = str(cells.get(28, "") or "")
                    invalid = any(keyword in tags for keyword in ("淘汰", "侵权下架", "季节性断货"))
                    out_of_stock = int(number(cells.get(26)) == 1 and not invalid)
                    candidate = (
                        snapshot_date, asin, out_of_stock, tags or None,
                        serial_date(cells.get(29)), str(cells.get(3, "") or "") or None,
                        str(cells.get(4, "") or "") or None, "LEGACY_WORKBOOK",
                    )
                    previous = by_asin.get(asin)
                    if previous is None or out_of_stock > previous[2]:
                        by_asin[asin] = candidate
                row.clear()
    return list(by_asin.values())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--date", type=date.fromisoformat, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    rows = read_snapshot(args.workbook, args.date)
    stockouts = sum(row[2] for row in rows)
    print(f"snapshot_date={args.date} rows={len(rows)} out_of_stock={stockouts}")
    if not args.apply:
        print("preview only; pass --apply to insert into remote RDS")
        return

    sql = """
        INSERT INTO lingxing_finance_asin_status_snapshot
          (snapshot_date, asin, out_of_stock, tag_names, product_create_date,
           principal_names, developer_names, source_type)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """
    with pymysql.connect(**rds_config()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) count FROM lingxing_finance_asin_status_snapshot WHERE snapshot_date=%s",
                (args.date,),
            )
            existing = cursor.fetchone()["count"]
            if existing:
                raise RuntimeError(f"snapshot already exists; refusing overwrite: {args.date}, rows={existing}")
            for offset in range(0, len(rows), 500):
                cursor.executemany(sql, rows[offset:offset + 500])
        connection.commit()
    print(f"inserted={len(rows)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
