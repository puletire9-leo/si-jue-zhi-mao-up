#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""维护 ASIN 模型分析起算月统一基准。

唯一目标产物：
ASIN_FBA可售优先_商品信息创建时间兜底_模型分析起算月基准_2025-04至2026-06.csv

固定算法：
1. 优先采用月度产品表现中首次 `FBA-可售 > 0` 的月份。
2. 全期间未观察到 FBA 可售时，采用原始月表“商品信息/创建时间”的最早日期所在月。
3. 原始月表创建时间为空时，采用 FBA 库存首现基准中保留的年度产品表现创建时间。
4. 两者均无时不确定起算月；起算月晚于 2026-06 时保留事实但不进入截止期模型。

本文件只维护公共基础事实。任何模型脚本只能读取结果，不得复制本算法或改写结果。
"""

from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path

from python_calamine import load_workbook

from lingxing_model_paths import (
    ASIN_START_BASELINE,
    COHORT_BASE_DIR,
    FBA_INVENTORY_BASELINE,
    LINGXING_DATA_ROOT,
)


ALGORITHM_VERSION = "ASIN_START_BASELINE_V1_2026-07-14"
DATA_CUTOFF_MONTH = "2026-06"
DATE = re.compile(r"(20\d{2}-\d{2}-\d{2})")
MONTHLY_SOURCE_DIR = LINGXING_DATA_ROOT / "领星25年到26年6月所有数据，以每月数据"
README_FILE = COHORT_BASE_DIR / "ASIN_FBA可售优先_商品信息创建时间兜底_模型分析起算月基准_说明.md"


def parse_created_at(value: object) -> str:
    """返回创建时间中的 yyyy-mm-dd；无法识别时返回空值。"""
    match = DATE.search(str(value or ""))
    return match.group(1) if match else ""


def load_raw_created_dates(source_dir: Path, required_asins: set[str]) -> dict[str, str]:
    """从原始月表读取商品信息创建时间，同一 ASIN 取最早日期。"""
    created_dates: dict[str, str] = {}
    for path in sorted(source_dir.glob("*.xlsx")):
        rows = load_workbook(path).get_sheet_by_index(0).iter_rows()
        headers = [str(value or "") for value in next(rows)]
        try:
            asin_index = headers.index("ASIN")
            created_index = headers.index("创建时间")
        except ValueError as exc:
            raise ValueError(f"原始月表缺少 ASIN 或 创建时间字段：{path.name}") from exc
        for row in rows:
            asin = str(row[asin_index] or "").strip()
            if asin not in required_asins:
                continue
            created_at = parse_created_at(row[created_index])
            if created_at and (asin not in created_dates or created_at < created_dates[asin]):
                created_dates[asin] = created_at
    return created_dates


def determine_start(
    first_available_month: str,
    raw_created_at: str,
) -> tuple[str, str, str, str, str]:
    """返回起算月、依据、时间精度、截止状态、使用说明。"""
    if first_available_month:
        start_month = first_available_month
        basis = "月表首次观察到FBA可售"
        precision = "月"
        note = "月表中首次观察到FBA可售大于0；不是亚马逊真实上架日"
    elif raw_created_at:
        start_month = raw_created_at[:7]
        basis = "原始月表商品信息创建时间兜底"
        precision = "日（创建记录）"
        note = "全期间未观察到FBA可售，以商品信息创建时间所在月参与分析；不是FBA首现或亚马逊真实上架日"
    else:
        start_month = ""
        basis = "无法确定"
        precision = "无"
        note = "既无FBA可售首现月，也没有商品信息创建时间；不进入按批次时间分析"

    if not start_month:
        cutoff_status = "无法纳入按批次时间分析"
    elif start_month > DATA_CUTOFF_MONTH:
        cutoff_status = "数据截止后创建，暂不纳入截至截止月的批次分析"
    else:
        cutoff_status = "可纳入截至截止月的批次分析"
    return start_month, basis, precision, cutoff_status, note


def build() -> None:
    if not FBA_INVENTORY_BASELINE.exists():
        raise FileNotFoundError(f"未找到上游 FBA 库存首现基准：{FBA_INVENTORY_BASELINE}")

    with FBA_INVENTORY_BASELINE.open("r", encoding="utf-8-sig", newline="") as source:
        input_rows = list(csv.DictReader(source))

    no_fba_available_asins = {
        row["ASIN"]
        for row in input_rows
        if not (row.get("首次观察到FBA可售月") or "").strip()
    }
    raw_created_dates = load_raw_created_dates(MONTHLY_SOURCE_DIR, no_fba_available_asins)

    COHORT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    source_counts: Counter[str] = Counter()
    headers = list(input_rows[0]) if input_rows else []
    added_headers = [
        "商品信息创建时间",
        "商品信息创建时间来源",
        "FBA可售首现月",
        "FBA可售首现依据",
        "模型分析起算月",
        "模型分析起算依据",
        "时间精度",
        "数据截止月",
        "截至数据截止月分析状态",
        "基础算法版本",
        "使用说明",
    ]

    with ASIN_START_BASELINE.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=headers + added_headers)
        writer.writeheader()
        for row in input_rows:
            asin = row["ASIN"]
            first_available_month = (row.get("首次观察到FBA可售月") or "").strip()
            created_at = raw_created_dates.get(asin, "")
            created_source = "原始月度产品表现表商品信息"
            if not created_at:
                created_at = parse_created_at(row.get("创建时间") or "")
                created_source = "年度产品表现表商品信息（原始月表无值补齐）"

            start_month, basis, precision, cutoff_status, note = determine_start(
                first_available_month,
                created_at,
            )
            row.update(
                {
                    "商品信息创建时间": created_at,
                    "商品信息创建时间来源": created_source if created_at else "无",
                    "FBA可售首现月": first_available_month,
                    "FBA可售首现依据": "月表首次观察到FBA可售" if first_available_month else "未观察到FBA可售",
                    "模型分析起算月": start_month,
                    "模型分析起算依据": basis,
                    "时间精度": precision,
                    "数据截止月": DATA_CUTOFF_MONTH,
                    "截至数据截止月分析状态": cutoff_status,
                    "基础算法版本": ALGORITHM_VERSION,
                    "使用说明": note,
                }
            )
            source_counts[basis] += 1
            writer.writerow(row)

    README_FILE.write_text(
        "# ASIN 模型分析起算月统一基准\n\n"
        f"- 算法版本：`{ALGORITHM_VERSION}`\n"
        f"- 数据截止月：`{DATA_CUTOFF_MONTH}`\n"
        f"- 唯一维护脚本：`scripts/lingxing_daily/maintain_asin_model_start_baseline.py`\n"
        f"- 上游事实：`{FBA_INVENTORY_BASELINE}`\n"
        f"- 输出文件：`{ASIN_START_BASELINE}`\n\n"
        "## 固定优先级\n\n"
        "1. 月表首次观察到 `FBA-可售 > 0` 的月份。\n"
        "2. 全期间未观察到 FBA 可售时，使用原始月表商品信息的最早创建日期所在月。\n"
        "3. 原始月表创建时间为空时，使用上游基准保留的年度产品表现创建时间。\n"
        "4. 均不存在时起算月为空；晚于截止月时保留但不进入截止期模型。\n\n"
        "该起算月用于批次经营分析，不代表亚马逊真实上架瞬间。\n\n"
        "## 最近一次生成统计\n\n"
        + "\n".join(f"- {key}：{value:,} 个 ASIN" for key, value in sorted(source_counts.items()))
        + "\n",
        encoding="utf-8",
    )
    print(f"输出：{ASIN_START_BASELINE}")
    print("；".join(f"{key}={value}" for key, value in sorted(source_counts.items())))


if __name__ == "__main__":
    build()

