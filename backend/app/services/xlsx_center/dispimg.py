# -*- coding: utf-8 -*-
"""WPS DISPIMG 内嵌图片解析。

WPS 表格用 =DISPIMG("ID_xxx") 公式把图片"钉"在单元格里，图片本体不在
标准 drawing 里，而在私有的 xl/cellimages.xml。openpyxl 读不到，需要直接
从 xlsx(zip) 里按下面的链路取字节：

    单元格公式 =DISPIMG("ID_xxx") / =_xlfn.DISPIMG("ID_xxx")
      -> xl/cellimages.xml            <xdr:cNvPr name="ID_xxx"/> + <a:blip r:embed="rIdN"/>
      -> xl/_rels/cellimages.xml.rels  rIdN -> media/imageN.ext

本模块只做"读取解析"，不依赖 DB、不依赖 openpyxl 的写能力。
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import openpyxl

_NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

_DISPIMG_RE = re.compile(r'DISPIMG\(\s*"([^"]+)"', re.IGNORECASE)

_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def guess_ext(data: bytes) -> str:
    """按魔数猜图片扩展名，只区分 png / jpg（DISPIMG 实际只有这两种）。"""
    return "png" if data[:8] == _PNG_MAGIC else "jpg"


def extract_dispimg_bytes(xlsx_path: str | Path) -> dict[str, bytes]:
    """解析整个工作簿的 DISPIMG 图片，返回 {DISPIMG_ID: 图片字节}。

    不含 cellimages.xml（非 WPS 或无内嵌图）时返回空 dict。
    """
    with zipfile.ZipFile(xlsx_path) as z:
        names = set(z.namelist())
        if "xl/cellimages.xml" not in names:
            return {}

        # rId -> media 路径
        rid_to_media: dict[str, str] = {}
        rels = ET.fromstring(z.read("xl/_rels/cellimages.xml.rels"))
        for rel in rels.findall("rel:Relationship", _NS):
            target = rel.get("Target") or ""
            if not target.startswith("xl/"):
                target = "xl/" + target.lstrip("/")
            rid_to_media[rel.get("Id")] = target

        # DISPIMG ID(name) -> 图片字节
        id_to_bytes: dict[str, bytes] = {}
        cimgs = ET.fromstring(z.read("xl/cellimages.xml"))
        for ci in cimgs:
            pic = ci.find("xdr:pic", _NS)
            if pic is None:
                continue
            cnvpr = pic.find("xdr:nvPicPr/xdr:cNvPr", _NS)
            blip = pic.find("xdr:blipFill/a:blip", _NS)
            if cnvpr is None or blip is None:
                continue
            img_id = cnvpr.get("name")
            rid = blip.get(f"{{{_NS['r']}}}embed")
            media = rid_to_media.get(rid)
            if img_id and media and media in names:
                id_to_bytes[img_id] = z.read(media)
        return id_to_bytes


def row_dispimg_ids(
    xlsx_path: str | Path,
    sheet_name: str,
    img_col: int,
    start_row: int = 1,
) -> dict[int, str]:
    """读某个 sheet 图片列每行的 DISPIMG ID，返回 {行号(1基): DISPIMG_ID}。

    必须用 data_only=False：DISPIMG 是公式，data_only=True 读到的是 None。

    Args:
        img_col: 图片列，1 基（A=1）。
        start_row: 从第几行开始扫描，1 基。
    """
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=False)
    try:
        ws = wb[sheet_name]
        result: dict[int, str] = {}
        for row in ws.iter_rows(min_row=start_row, min_col=img_col, max_col=img_col):
            for cell in row:
                if isinstance(cell.value, str):
                    m = _DISPIMG_RE.search(cell.value)
                    if m:
                        result[cell.row] = m.group(1)
        return result
    finally:
        wb.close()
