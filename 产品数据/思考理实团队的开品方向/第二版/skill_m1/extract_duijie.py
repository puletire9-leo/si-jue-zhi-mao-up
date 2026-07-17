"""M1 摸底:抽对接表 06.30 (英国+德国) 关键字段 → CSV。

只取 M1 阶段需要的核心列,不做任何加工。
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import openpyxl

SRC = Path("F:/项目/si-jue-zhi-mao-up/产品数据/产品表/理实产品开发表/理实产品开发表6月份/理实产品对接表06.30.xlsx")
DST = Path("F:/项目/si-jue-zhi-mao-up/analysis/skill_m1/duijie_06_30.csv")

COL = {
    "序号": 0, "时间": 1, "产品名称": 3, "SKU": 4, "开发": 5, "运营": 6,
    "采购数量": 7, "CPC段": 8, "市场价格段": 9, "开品理由": 10, "开发备注": 11,
    "竞品链接1": 12, "竞品链接2": 13, "竞品链接3": 14,
    "售价": 15,
    "空运利润$": 16, "空运利润率": 18,
    "海运利润$": 19, "海运利润率": 21,
    "站点": 22, "汇率": 23,
    "长cm": 26, "宽cm": 27, "高cm": 28, "体积重kg": 29, "毛重kg": 30,
    "采购价¥": 33,
    "供应商": 47, "材质": 49, "中文报关名": 50, "英文报关名": 51, "产品尺寸": 52,
}


def extract() -> list[dict]:
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    out: list[dict] = []
    for sheet_name in ("英国", "德国"):
        ws = wb[sheet_name]
        # 数据从第 4 行开始(索引 3);表头占前 3 行
        for row in ws.iter_rows(min_row=4, values_only=True):
            if not row or row[COL["SKU"]] in (None, ""):
                continue
            rec = {"来源sheet": sheet_name}
            for k, idx in COL.items():
                v = row[idx] if idx < len(row) else None
                # 图片是 DISPIMG 公式串,别抓,先跳过
                if isinstance(v, str) and v.startswith("=DISPIMG"):
                    v = ""
                rec[k] = v
            # 至少要求 SKU 和 开发人不空
            if not rec.get("开发"):
                continue
            out.append(rec)
    return out


def main() -> int:
    rows = extract()
    DST.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        print("no rows extracted", file=sys.stderr)
        return 1
    fields = ["来源sheet"] + list(COL.keys())
    with DST.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"[extract] {len(rows)} rows → {DST}")
    devs = {}
    reasons_empty = 0
    for r in rows:
        devs[r["开发"]] = devs.get(r["开发"], 0) + 1
        if not r.get("开品理由"):
            reasons_empty += 1
    print(f"[extract] developers: {devs}")
    print(f"[extract] rows without 开品理由: {reasons_empty}/{len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
