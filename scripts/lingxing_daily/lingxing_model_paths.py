#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""领星基础事实与模型目录的唯一位置定义。"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

# 原始导出、API 数据及数据库导入来源。
LINGXING_DATA_ROOT = ROOT / "产品数据" / "领星数据api"
LEGACY_MODEL_ARCHIVE_ROOT = LINGXING_DATA_ROOT / "99_历史模型归档_2026-07-14"

# 所有正式模型及跨模型公共事实层。
LINGXING_MODEL_ROOT = ROOT / "产品数据" / "领星模型"
BASE_TABLE_ROOT = LINGXING_MODEL_ROOT / "基础统一表"

# 已确认的固定上架批次与 ASIN 集合；模型只能读取，不能改写。
COHORT_BASE_DIR = BASE_TABLE_ROOT / "上架批次和批次ASIN集合永远锁定基础批次表"
FBA_INVENTORY_BASELINE = COHORT_BASE_DIR / "ASIN_FBA库存首现月基准_2025-04至2026-06.csv"
ASIN_START_BASELINE = (
    COHORT_BASE_DIR
    / "ASIN_FBA可售优先_商品信息创建时间兜底_模型分析起算月基准_2025-04至2026-06.csv"
)
NO_FBA_INVENTORY_ASINS = COHORT_BASE_DIR / "月表未观察到FBA库存_ASIN_2025-04至2026-06.txt"

MONTHLY_MODEL_DIR = LINGXING_MODEL_ROOT / "ASIN月度经营模型_FBA可售优先_2025-04至2026-06"
LIFECYCLE_MODEL_DIR = LINGXING_MODEL_ROOT / "ASIN完整生命周期模型_2025-04至2026-06"
