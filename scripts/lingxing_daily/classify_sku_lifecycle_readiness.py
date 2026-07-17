"""Build team SKU status from the latest observed Lingxing listing labels."""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

from python_calamine import load_workbook


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "产品数据" / "领星数据api" / "领星25年到26年6月所有数据，以每月数据"
DATA_DIR = SOURCE_DIR / "历史SKU上架基础数据_2025-04至2026-06"
TEAM_DIR = DATA_DIR / "03_团队开发SKU生命周期"
INPUT = TEAM_DIR / "团队SKU_月度FBA对账_数据截止2026-06.csv"
OUTPUT = TEAM_DIR / "团队SKU_生命周期判定_数据截止2026-06.csv"
DATA_CUTOFF_MONTH = "2026-06"
WINDOW = re.compile(r"(20\d{2}-\d{2})-\d{2}~")
RAW_HEADERS = ("SKU", "listing标签")


def add_months(month: str, months: int) -> str:
    if not month:
        return ""
    year, value = map(int, month.split("-"))
    index = year * 12 + value - 1 + months
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def sales_data_maturity(created_month: str) -> str:
    if not created_month:
        return "创建时间未知"
    if DATA_CUTOFF_MONTH >= add_months(created_month, 2):
        return "已满两个月，可作为稳定观察样本"
    if DATA_CUTOFF_MONTH >= add_months(created_month, 1):
        return "已有首个完整销售月，尚未满两个月"
    return "尚未到首个完整销售月"


def classify_listing_status(observed_month: str, tags: set[str]) -> tuple[str, str]:
    tag_text = " | ".join(sorted(tags))
    if not observed_month:
        return "未在领星前端观察到", "截至数据截止月，月度领星前端清单中未出现该 SKU；不以此推断淘汰。"
    if "欧洲精铺2025淘汰" in tag_text:
        return "淘汰", "最新领星前端标签包含“欧洲精铺2025淘汰”。"
    if "欧洲精铺2025待淘汰" in tag_text:
        return "待淘汰", "最新领星前端标签包含“欧洲精铺2025待淘汰”。"
    if "侵权下架" in tag_text:
        return "侵权下架", "最新领星前端标签包含“侵权下架”。"
    if "季节性断货" in tag_text:
        return "上架-季节性断货", "SKU 仍在领星前端清单，标签标注为季节性断货。"
    if not tag_text:
        return "上架-标签为空", "SKU 出现在领星前端清单，但未返回 listing 标签。"
    return "上架在售", "SKU 出现在领星前端清单，且最新标签不含淘汰或下架状态。"


def latest_listing_tags(target_skus: set[str]) -> dict[str, tuple[str, set[str]]]:
    observations: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    files = []
    for path in SOURCE_DIR.glob("产品表现ASIN（*.xlsx"):
        match = WINDOW.search(path.name)
        if match:
            files.append((match.group(1), path))
    if len(files) != 15:
        raise RuntimeError(f"Expected 15 monthly Lingxing workbooks, found {len(files)}")
    for month, path in sorted(files):
        rows = load_workbook(path).get_sheet_by_index(0).iter_rows()
        headers = [str(value or "") for value in next(rows)]
        positions = {field: headers.index(field) for field in RAW_HEADERS}
        for row in rows:
            sku = str(row[positions["SKU"]] or "").strip()
            if sku not in target_skus:
                continue
            tag = str(row[positions["listing标签"]] or "").strip()
            if tag:
                observations[sku][month].add(tag)
            else:
                observations[sku][month]
    return {
        sku: (max(months), months[max(months)])
        for sku, months in observations.items()
    }


def main() -> None:
    with INPUT.open(encoding="utf-8-sig", newline="") as source:
        source_rows = list(csv.DictReader(source))
    target_skus = {row["SKU"] for row in source_rows}
    latest_tags = latest_listing_tags(target_skus)
    columns = [
        "开发人", "SKU", "创建时间", "创建月份", "本地状态", "是否组合产品", "组合计数状态", "品名",
        "首次FBA可售观察月", "FBA匹配店铺SKU数", "FBA匹配店铺", "月度FBA匹配状态",
        "最近领星前端观察月", "最近Listing标签", "领星业务状态", "标签状态说明",
        "预计上架月份", "首个完整销售月份", "两个月成熟月份", "数据截止时销售成熟度", "数据截止月份",
    ]
    result_rows = []
    for row in source_rows:
        sku = row["SKU"]
        created_month = row["创建月份"]
        observed_month, tags = latest_tags.get(sku, ("", set()))
        business_status, status_reason = classify_listing_status(observed_month, tags)
        result_rows.append({
            "开发人": row["开发人"], "SKU": sku, "创建时间": row["创建时间"], "创建月份": created_month,
            "本地状态": row["本地状态"], "是否组合产品": "是" if row["是否组合产品"] == "True" else "否",
            "组合计数状态": "组合子件关系待确认" if row["组合计数状态"] == "SINGLE_OR_COMPONENT_UNKNOWN" else row["组合计数状态"],
            "品名": row["品名"], "首次FBA可售观察月": row["首次FBA可售观察月"],
            "FBA匹配店铺SKU数": row["FBA匹配店铺SKU数"], "FBA匹配店铺": row["FBA匹配店铺"],
            "月度FBA匹配状态": "月度数据中已出现FBA可售" if row["月度FBA匹配状态"] == "FBA_AVAILABLE_IN_MONTHLY_DATA" else "月度数据中未出现FBA可售",
            "最近领星前端观察月": observed_month, "最近Listing标签": " | ".join(sorted(tags)),
            "领星业务状态": business_status, "标签状态说明": status_reason,
            "预计上架月份": add_months(created_month, 1), "首个完整销售月份": add_months(created_month, 1),
            "两个月成熟月份": add_months(created_month, 2), "数据截止时销售成熟度": sales_data_maturity(created_month),
            "数据截止月份": DATA_CUTOFF_MONTH,
        })
    result_rows.sort(key=lambda item: (item["领星业务状态"], item["创建月份"], item["开发人"], item["SKU"]))
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        writer.writerows(result_rows)
    counts = defaultdict(int)
    for row in result_rows:
        counts[row["领星业务状态"]] += 1
    print(f"rows={len(result_rows)} labels_observed={len(latest_tags)} output={OUTPUT}")
    print(dict(sorted(counts.items())))


if __name__ == "__main__":
    main()
