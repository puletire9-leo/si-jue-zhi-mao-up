# -*- coding: utf-8 -*-
"""
批量提取所有月份、所有开发人的SKU清单

用途: 扫描理实产品开发表某个月份目录下所有对接表，按"开发"列提取每个开发人的SKU，
      输出到 SKU清单/{月份}SKU明细/{月份}新建sku-{开发人简称}.xlsx

用法: 直接运行, 编辑下方 MONTHS_CONFIG 定义要处理的月份

理实产品对接表结构:
  - 第一个Sheet
  - 表头行含 "SKU" 列 和 "开发" 列 (开发列=开发人全名如"宋凤莉")
  - 数据行: SKU列=本地SKU编码(数字), 开发列=开发人姓名

输出文件名: {月份}新建sku-{开发人简称}.xlsx, 内容=一列SKU
"""
import glob, os, openpyxl

OUT_BASE = r"E:\项目\si-jue-zhi-mao-up\产品数据\领星模型\领星采购批次分析\SKU清单"

# 月份配置: (输出月份名, 源目录, 文件前缀)
MONTHS_CONFIG = [
    ("1-2月", r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表1.2月份", "理实产品对接表0"),
    ("3月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表3月份", "理实产品对接表03."),
    ("4月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表4月份", "理实产品对接表04."),
    ("5月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表5月份", "理实产品对接表05."),
    ("6月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表6月份", "理实产品对接表06."),
    ("7月",   r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\理实产品开发表7月份", "理实产品对接表07."),
]

# 开发人全名 → 输出文件简称 (宋凤莉→宋, 其余用全名)
SHORT = {"宋凤莉": "宋"}


def short_name(full):
    return SHORT.get(full, full)


def extract_month(month_name, src_dir, prefix):
    out_dir = os.path.join(OUT_BASE, f"{month_name}SKU明细")
    os.makedirs(out_dir, exist_ok=True)
    dev_skus = {}
    files = sorted(glob.glob(os.path.join(src_dir, f"{prefix}*.xlsx")))
    print(f"\n=== {month_name}: {len(files)} 个文件 ===")
    for fpath in files:
        fn = os.path.basename(fpath)
        try:
            wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(min_row=1, values_only=True))
            header_row = None
            for i, r in enumerate(rows[:10]):
                if r and any(str(c).strip() == "SKU" for c in r if c):
                    header_row = i; break
            if header_row is None:
                wb.close(); continue
            hdr = [str(c).strip() if c else "" for c in rows[header_row]]
            sku_col = hdr.index("SKU"); dev_col = hdr.index("开发")
            cnt = 0
            for r in rows[header_row+1:]:
                if not r or len(r) <= max(sku_col, dev_col): continue
                sku_val, dev_val = r[sku_col], r[dev_col]
                if not sku_val or not dev_val: continue
                dev = str(dev_val).strip()
                sku = str(sku_val).strip()
                if sku and any(c.isdigit() for c in sku):
                    dev_skus.setdefault(dev, []).append(sku)
                    cnt += 1
            if cnt > 0:
                print(f"  {fn}: {cnt}行")
            wb.close()
        except Exception as e:
            print(f"  读取失败 {fn}: {e}")
    # 保存每个开发人
    for dev, skus in sorted(dev_skus.items()):
        uniq, seen = [], set()
        for s in skus:
            if s not in seen: seen.add(s); uniq.append(s)
        short = short_name(dev)
        out_file = os.path.join(out_dir, f"{month_name}新建sku-{short}.xlsx")
        wbo = openpyxl.Workbook(); wso = wbo.active
        wso.title = short
        for i, s in enumerate(uniq, 1):
            wso.cell(row=i, column=1, value=s)
        wbo.save(out_file)
        print(f"  → {short}: {len(uniq)} SKU")


if __name__ == "__main__":
    for month_name, src_dir, prefix in MONTHS_CONFIG:
        extract_month(month_name, src_dir, prefix)
    print("\n=== 全部完成 ===")
