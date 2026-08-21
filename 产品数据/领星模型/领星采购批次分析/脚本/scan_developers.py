# -*- coding: utf-8 -*-
"""
扫描某月份理实产品对接表里的所有开发人

用途: 分析前查看某个月份有哪些开发人, 确认目标开发人是否存在(尤其新开发人黄雨珊/张子轩等)
用法: 直接运行, 编辑 MONTHS_CONFIG
"""
import glob, os, openpyxl

MONTHS_CONFIG = [
    ("1-2月", r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表1.2月份", "理实产品对接表0"),
    ("3月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表3月份", "理实产品对接表03."),
    ("4月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表4月份", "理实产品对接表04."),
    ("5月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表5月份", "理实产品对接表05."),
    ("6月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表6月份", "理实产品对接表06."),
    ("7月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表7月份", "理实产品对接表07."),
    ("8月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表8月份", "理实产品对接表08."),
]


def scan(month, dir_path, prefix):
    devs = set()
    nfiles = 0
    for fpath in glob.glob(os.path.join(dir_path, f"{prefix}*.xlsx")):
        nfiles += 1
        try:
            wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(min_row=1, max_row=300, values_only=True))
            header_row = None
            for i, r in enumerate(rows[:10]):
                if r and any(str(c).strip() == "SKU" for c in r if c):
                    header_row = i; break
            if header_row is None:
                wb.close(); continue
            hdr = [str(c).strip() if c else "" for c in rows[header_row]]
            try:
                dev_col = hdr.index("开发")
            except ValueError:
                wb.close(); continue
            for r in rows[header_row+1:]:
                if not r or len(r) <= dev_col: continue
                dv = r[dev_col]
                if dv: devs.add(str(dv).strip())
            wb.close()
        except Exception as e:
            print(f"  读取失败 {fpath}: {e}")
    print(f"{month}: {nfiles}文件, 开发人={sorted(devs)}")


if __name__ == "__main__":
    for month, d, p in MONTHS_CONFIG:
        scan(month, d, p)
