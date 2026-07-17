#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""维护领星跨模型公共基础事实表。

模型生成脚本不得调用本文件；需要更新公共基础事实时由人工单独执行。
"""

from build_asin_monthly_fba_inventory_baseline import build as build_inventory_baseline
from lingxing_model_paths import ASIN_START_BASELINE, COHORT_BASE_DIR, FBA_INVENTORY_BASELINE
from maintain_asin_model_start_baseline import build as build_analysis_start_baseline


def main() -> None:
    COHORT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    build_inventory_baseline()
    build_analysis_start_baseline()
    print("领星基础统一表维护完成")
    print(f"FBA库存首现基准：{FBA_INVENTORY_BASELINE}")
    print(f"模型分析起算基准：{ASIN_START_BASELINE}")


if __name__ == "__main__":
    main()
