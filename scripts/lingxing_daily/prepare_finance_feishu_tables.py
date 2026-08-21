#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare five Feishu Base tables and batch payloads from the final workbook."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from python_calamine import load_workbook

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
WORKBOOK = ROOT / "产品数据" / "自动化" / "财务" / "任务" / "财务领星数据信息自动化" / "理实日报：数据研究" / "最终给的：理实日报原数据 -飞书.xlsx"
REPORT = SCRIPT_DIR / "_finance_report_2026-08-14.json"
OUTPUT = SCRIPT_DIR / "_feishu_five_tables"

SHEETS = {
    "总": ["日期", "淘汰SKU", "季节性SKU", "SKU总数量", "动销＞90天的SKU", "未上架SKU", "断货SKU", "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额", "广告花费", "可用库存", "退款金额"],
    "运营": ["日期", "销售人员", "淘汰SKU", "季节性SKU", "SKU总数量", "动销＞90天的SKU", "未上架SKU", "断货SKU", "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额", "广告花费", "可用库存", "退款金额"],
    "开发": ["日期", "开发人员", "淘汰SKU", "季节性SKU", "看SKU数据", "SKU的库存/销量", "没库存的", "有出单后面没库存的", "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额", "广告花费", "可用库存", "退款金额"],
    "非标品": ["日期", "淘汰SKU", "季节性SKU", "看SKU数据", "SKU的库存/销量", "没库存的", "有出单后面没库存的", "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额", "广告花费", "可用库存", "退款金额"],
    "上架时间": ["日期", "上架时间", "淘汰SKU", "季节性SKU", "看SKU数据", "SKU的库存/销量", "没库存的", "有出单后面没库存的", "销量", "订单量", "销售额", "展示", "点击", "广告订单量", "广告销售额", "广告花费", "可用库存", "退款金额"],
}
DECIMAL_FIELDS = {"销售额", "广告销售额", "广告花费", "退款金额"}
TEXT_FIELDS = {"销售人员", "开发人员", "上架时间"}
INTERNAL_MAP = {
    "看SKU数据": "SKU总数量",
    "SKU的库存/销量": "动销90天SKU",
    "没库存的": "未上架SKU",
    "有出单后面没库存的": "断货SKU",
    "动销＞90天的SKU": "动销90天SKU",
}


def excel_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d 00:00")
    if isinstance(value, (int, float)):
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).strftime("%Y-%m-%d 00:00")
    return None


def field_schema(headers: list[str]) -> list[dict[str, Any]]:
    fields: list[dict[str, Any]] = []
    for header in headers:
        if header == "日期":
            fields.append({"type": "datetime", "name": header, "style": {"format": "yyyy-MM-dd"}})
        elif header in TEXT_FIELDS:
            fields.append({"type": "text", "name": header})
        else:
            fields.append({
                "type": "number",
                "name": header,
                "style": {
                    "type": "plain",
                    "precision": 2 if header in DECIMAL_FIELDS else 0,
                    "percentage": False,
                    "thousands_separator": False,
                },
            })
    return fields


def historical_rows(sheet_name: str, headers: list[str]) -> list[dict[str, Any]]:
    workbook = load_workbook(WORKBOOK)
    rows = list(workbook.get_sheet_by_name(sheet_name).iter_rows())
    result: list[dict[str, Any]] = []
    for source in rows[3:]:
        parsed_date = excel_date(source[0] if source else None)
        if not parsed_date:
            continue
        record: dict[str, Any] = {"日期": parsed_date}
        for index, header in enumerate(headers[1:], 1):
            value = source[index] if index < len(source) else None
            if value in (None, ""):
                continue
            if header in TEXT_FIELDS:
                record[header] = str(value)
            elif isinstance(value, (int, float)):
                record[header] = value
        result.append(record)
    return result


def target_rows(sheet_name: str, headers: list[str]) -> list[dict[str, Any]]:
    long_records = json.loads(REPORT.read_text(encoding="utf-8"))["create_records"]
    selected = []
    for source in long_records:
        dimension = source["维度"][0]
        if dimension != sheet_name:
            continue
        record: dict[str, Any] = {"日期": source["日期"]}
        if sheet_name == "运营":
            record["销售人员"] = source["维度值"]
        elif sheet_name == "开发":
            record["开发人员"] = source["维度值"]
        elif sheet_name == "上架时间":
            record["上架时间"] = source["维度值"]
        for header in headers[1:]:
            if header in TEXT_FIELDS:
                continue
            source_field = INTERNAL_MAP.get(header, header)
            if source_field in source:
                record[header] = source[source_field]
        selected.append(record)
    return selected


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    workbook = load_workbook(WORKBOOK)
    sheet_names = set(workbook.sheet_names)
    manifest: dict[str, Any] = {"workbook": str(WORKBOOK), "tables": {}}
    for sheet_name, headers in SHEETS.items():
        if sheet_name not in sheet_names:
            raise RuntimeError(f"Missing sheet: {sheet_name}")
        records = historical_rows(sheet_name, headers) + target_rows(sheet_name, headers)
        keys = []
        for record in records:
            key = [record["日期"][:10]]
            for dimension_field in ("销售人员", "开发人员", "上架时间"):
                if dimension_field in record:
                    key.append(record[dimension_field])
            keys.append(tuple(key))
        if len(keys) != len(set(keys)):
            raise RuntimeError(f"Duplicate business keys in {sheet_name}")

        table_dir = OUTPUT / sheet_name
        table_dir.mkdir(exist_ok=True)
        (table_dir / "fields.json").write_text(json.dumps(field_schema(headers), ensure_ascii=False, indent=2), encoding="utf-8")
        batches = []
        for index in range(0, len(records), 200):
            path = table_dir / f"batch_{index // 200 + 1:02d}.json"
            path.write_text(json.dumps({"create_records": records[index:index + 200]}, ensure_ascii=False), encoding="utf-8")
            batches.append(str(path))
        manifest["tables"][sheet_name] = {
            "headers": headers,
            "historical_records": len(records) - len(target_rows(sheet_name, headers)),
            "target_records": len(target_rows(sheet_name, headers)),
            "total_records": len(records),
            "min_date": min(key[0] for key in keys),
            "max_date": max(key[0] for key in keys),
            "fields_file": str(table_dir / "fields.json"),
            "batches": batches,
        }
    manifest_path = OUTPUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
