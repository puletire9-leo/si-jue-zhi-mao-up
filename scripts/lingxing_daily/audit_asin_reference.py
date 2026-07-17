#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Use a manually verified ASIN table to audit Lingxing monthly source matching.

The reference file must be a UTF-8 tab-separated file with these columns:
ASIN, SKU, 店铺, 开发人.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

from python_calamine import load_workbook


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "产品数据" / "领星数据api" / "领星25年到26年6月所有数据，以每月数据"
LIFECYCLE_FILE = SOURCE_DIR / "历史SKU上架基础数据_2025-04至2026-06" / "03_团队开发SKU生命周期" / "团队SKU_生命周期判定_数据截止2026-06.csv"
DEFAULT_OUTPUT_DIR = ROOT / "analysis" / "ASIN基准对账"
WINDOW = re.compile(r"(20\d{2}-\d{2})-\d{2}~")


def decimal(value: object | None) -> Decimal:
    try:
        return Decimal(str(value or "").strip() or "0")
    except InvalidOperation:
        return Decimal(0)


def read_reference(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source, delimiter="\t"))
    expected_headers = {"ASIN", "SKU", "店铺", "开发人"}
    if not rows or not expected_headers.issubset(rows[0]):
        raise ValueError("标准文件必须是制表符分隔，且表头包含：ASIN、SKU、店铺、开发人")
    seen = set()
    result = []
    for row in rows:
        asin = row["ASIN"].strip()
        if not asin or asin in seen:
            raise ValueError(f"ASIN 为空或重复：{asin!r}")
        seen.add(asin)
        result.append({field: row[field].strip() for field in expected_headers})
    return result


def read_lifecycle() -> dict[str, dict[str, str]]:
    with LIFECYCLE_FILE.open(encoding="utf-8-sig", newline="") as source:
        return {row["SKU"]: row for row in csv.DictReader(source)}


def source_observations(reference_asins: set[str]) -> dict[str, dict[str, set[str] | set[tuple[str, str, str]]]]:
    observations: dict[str, dict[str, set[str] | set[tuple[str, str, str]]]] = defaultdict(lambda: {
        "months": set(), "fba_months": set(), "mappings": set(), "created_months": set(),
    })
    for path in sorted(SOURCE_DIR.glob("*.xlsx")):
        match = WINDOW.search(path.name)
        if not match:
            continue
        month = match.group(1)
        rows = load_workbook(path).get_sheet_by_index(0).iter_rows()
        headers = [str(value or "") for value in next(rows)]
        fields = ("ASIN", "SKU", "店铺", "开发人", "创建时间", "FBA-可售")
        positions = {field: headers.index(field) for field in fields}
        for row in rows:
            asin = str(row[positions["ASIN"]] or "").strip()
            if asin not in reference_asins:
                continue
            point = observations[asin]
            sku = str(row[positions["SKU"]] or "").strip()
            store = str(row[positions["店铺"]] or "").strip()
            developer = str(row[positions["开发人"]] or "").strip()
            point["months"].add(month)
            point["mappings"].add((sku, store, developer))
            point["created_months"].add(str(row[positions["创建时间"]] or "").strip()[:7])
            if decimal(row[positions["FBA-可售"]]) > 0:
                point["fba_months"].add(month)
    return observations


def write_audit(reference: list[dict[str, str]], lifecycle: dict[str, dict[str, str]], observations, output_dir: Path, report_name: str) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    detail_path = output_dir / f"{report_name}_明细.csv"
    summary_path = output_dir / f"{report_name}_结论.md"
    columns = [
        "标准ASIN", "标准SKU", "标准店铺", "标准开发人", "原始月表是否找到", "ASIN-SKU-店铺-开发人精确匹配",
        "原始出现月份", "原始首次FBA可售月", "原始创建月份", "生命周期创建月份", "生命周期首次FBA可售月",
        "生命周期开发人", "生命周期开发人匹配", "当前Listing标签", "差异说明",
    ]
    output_rows = []
    for item in reference:
        asin, sku, store, developer = item["ASIN"], item["SKU"], item["店铺"], item["开发人"]
        raw = observations.get(asin, {})
        mappings = raw.get("mappings", set())
        expected_mapping = (sku, store, developer)
        found = bool(raw.get("months"))
        exact = expected_mapping in mappings
        life = lifecycle.get(sku, {})
        issues = []
        if not found:
            issues.append("原始月表未找到该 ASIN")
        elif not exact:
            issues.append("原始月表存在 ASIN，但 SKU/店铺/开发人不一致")
        if not life:
            issues.append("生命周期表未找到标准 SKU")
        elif life["开发人"] != developer:
            issues.append("生命周期表开发人不一致")
        output_rows.append({
            "标准ASIN": asin, "标准SKU": sku, "标准店铺": store, "标准开发人": developer,
            "原始月表是否找到": "是" if found else "否", "ASIN-SKU-店铺-开发人精确匹配": "是" if exact else "否",
            "原始出现月份": " | ".join(sorted(raw.get("months", set()))),
            "原始首次FBA可售月": min(raw["fba_months"]) if raw.get("fba_months") else "",
            "原始创建月份": " | ".join(sorted(value for value in raw.get("created_months", set()) if value)),
            "生命周期创建月份": life.get("创建月份", ""), "生命周期首次FBA可售月": life.get("首次FBA可售观察月", ""),
            "生命周期开发人": life.get("开发人", ""), "生命周期开发人匹配": "是" if life.get("开发人") == developer else "否",
            "当前Listing标签": life.get("最近Listing标签", ""), "差异说明": "；".join(issues) or "无",
        })
    with detail_path.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        writer.writerows(output_rows)

    total = len(output_rows)
    found = sum(row["原始月表是否找到"] == "是" for row in output_rows)
    exact = sum(row["ASIN-SKU-店铺-开发人精确匹配"] == "是" for row in output_rows)
    fba_months = Counter(row["原始首次FBA可售月"] or "未观察到FBA可售" for row in output_rows)
    created_months = Counter(row["生命周期创建月份"] or "未知" for row in output_rows)
    with summary_path.open("w", encoding="utf-8") as destination:
        destination.write(f"# {report_name} 结论\n\n")
        destination.write(f"- 标准 ASIN：{total}\n")
        destination.write(f"- 原始月表找到：{found}\n")
        destination.write(f"- ASIN、SKU、店铺、开发人四字段精确匹配：{exact}\n\n")
        destination.write("## 首次 FBA 可售月\n\n| 月份 | ASIN 数 |\n|---|---:|\n")
        for month, count in sorted(fba_months.items()):
            destination.write(f"| {month} | {count} |\n")
        destination.write("\n## 生命周期创建月份\n\n| 月份 | SKU 数 |\n|---|---:|\n")
        for month, count in sorted(created_months.items()):
            destination.write(f"| {month} | {count} |\n")
        destination.write("\n结论：创建月份与首次 FBA 可售月是不同事实，不能互相替代。\n")
    return detail_path, summary_path


def main() -> None:
    parser = argparse.ArgumentParser(description="用人工标准 ASIN 表对账领星原始月表")
    parser.add_argument("reference", type=Path, help="UTF-8 制表符分隔的标准文件")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--report-name", default="ASIN标准对账", help="输出文件名，不含扩展名")
    args = parser.parse_args()
    reference = read_reference(args.reference)
    detail_path, summary_path = write_audit(
        reference, read_lifecycle(), source_observations({row["ASIN"] for row in reference}), args.output_dir, args.report_name,
    )
    print(f"reference_asins={len(reference)}")
    print(f"detail={detail_path}")
    print(f"summary={summary_path}")


if __name__ == "__main__":
    main()
