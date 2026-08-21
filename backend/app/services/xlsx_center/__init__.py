# -*- coding: utf-8 -*-
"""xlsx 处理中心 —— Excel 处理能力沉淀。

纯 Python 能力库，不开 API、不耦合 DB。业务侧（service / 脚本）import 后调用，
数据源差异通过注入回调解耦。

能力清单：
    dispimg          解析 WPS DISPIMG 内嵌图片（cellimages.xml 链路）
    image_embed      把图片锚定嵌入单元格（缩放 / 行高列宽）
    sku_image_filler 按 SKU 列填图片列（SKU->图片 靠注入 resolver）

快速上手（按 SKU 填图，图片在本地目录、文件名=图片键）：
    from app.services.xlsx_center import fill_images_by_sku, build_dir_resolver

    # resolver: (sku, market) -> 图片路径/None
    resolver = build_dir_resolver(
        sku_to_keys=lambda sku, market: my_lingxing_lookup(sku, market),
        image_dirs=["/data/images", "/data/lingxing_images"],
    )
    report = fill_images_by_sku(
        "in.xlsx", "out.xlsx", resolver,
        sku_col=1, img_col=3, data_start_row=2,
    )
    print(report.total_filled)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, Iterable, Optional, Sequence

from .dispimg import (
    extract_dispimg_bytes,
    guess_ext,
    row_dispimg_ids,
)
from .image_embed import (
    embed_image,
    set_image_column_width,
)
from .sku_image_filler import (
    FillReport,
    ImageResolver,
    ImageSource,
    SheetFillResult,
    fill_images_by_sku,
)

__all__ = [
    # dispimg
    "extract_dispimg_bytes",
    "guess_ext",
    "row_dispimg_ids",
    # image_embed
    "embed_image",
    "set_image_column_width",
    # sku_image_filler
    "fill_images_by_sku",
    "FillReport",
    "SheetFillResult",
    "ImageResolver",
    "ImageSource",
    # helpers
    "build_image_index",
    "build_dir_resolver",
]


def build_image_index(
    image_dirs: Sequence[str | Path],
    exts: Iterable[str] = (".jpg", ".jpeg", ".png"),
) -> dict[str, str]:
    """扫描目录，建 {文件名(去扩展名): 绝对路径} 索引。

    多目录时先出现的优先（不覆盖）。文件名通常是图片键，如 ASIN。
    """
    exts = {e.lower() for e in exts}
    index: dict[str, str] = {}
    for d in image_dirs:
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            stem, ext = os.path.splitext(name)
            if ext.lower() in exts:
                index.setdefault(stem, os.path.join(str(d), name))
    return index


def build_dir_resolver(
    sku_to_keys: Callable[[str, Optional[str]], Sequence[str]],
    image_dirs: Sequence[str | Path],
    exts: Iterable[str] = (".jpg", ".jpeg", ".png"),
) -> ImageResolver:
    """组装一个"SKU->本地图片路径"的 resolver。

    把两件事拼起来：
      1. sku_to_keys(sku, market) -> 候选图片键列表（如 ASIN，按优先级排序）
      2. 本地目录里按图片键找文件

    sku_to_keys 由调用方注入（通常查领星 listing），本函数只管找文件。
    返回第一个能在目录里命中的键对应的路径；都找不到返回 None。
    """
    index = build_image_index(image_dirs, exts)

    def _resolve(sku: str, market: Optional[str]) -> Optional[str]:
        for key in sku_to_keys(sku, market):
            path = index.get(key)
            if path:
                return path
        return None

    return _resolve
