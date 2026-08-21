# -*- coding: utf-8 -*-
"""
脚本1: 从理实产品对接表提取指定开发人的SKU清单

用途: 按开发人从月度理实产品对接表中筛选SKU，输出到 SKU清单 目录
用法:
    python extract_sku_by_dev.py <月份> <源目录> <文件前缀> [开发人1,开发人2,...]

示例:
    # 提取3月宋凤莉的SKU
    python extract_sku_by_dev.py 3月 "E:\...\理实产品开发表3月份" "理实产品对接表03." 宋凤莉

    # 提取4月所有目标开发人
    python extract_sku_by_dev.py 4月 "E:\...\理实产品开发表4月份" "理实产品对接表04." 龙梦临,周沁仪,宋凤莉,陈杨,蒋舒

说明:
    - 理实产品对接表结构: 第一个Sheet, 表头行含"SKU"和"开发"列
    - "开发"列 = 开发人姓名(全名,如"宋凤莉")
    - 输出文件名格式: {月份}新建sku-{开发人简称}.xlsx
    - 开发人简称映射: 宋凤莉→宋, 其余用全名
"""
import os, sys, glob, openpyxl

# 开发人全名 → 简称（用于输出文件名和后续报表）
DEV_SHORT_NAME = {
    "宋凤莉": "宋",
    # 其余开发人简称=全名
}

def get_short_name(full_name):
    return DEV_SHORT_NAME.get(full_name, full_name)

def extract(month_name, src_dir, file_prefix, target_devs, out_base_dir):
    """提取指定开发人的SKU"""
    out_dir = os.path.join(out_base_dir, f"{month_name}SKU明细")
    os.makedirs(out_dir, exist_ok=True)

    # 先扫描所有开发人（辅助确认全名）
    all_devs = set()
    files = glob.glob(os.path.join(src_dir, f"{file_prefix}*.xlsx"))
    print(f"找到 {len(files)} 个对接表文件")

    dev_skus = {dev: [] for dev in target_devs}

    for fpath in sorted(files):
        fn = os.path.basename(fpath)
        wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(min_row=1, values_only=True))

        # 找表头行
        header_row = None
        for i, r in enumerate(rows[:10]):
            if r and any(str(c).strip() == "SKU" for c in r if c):
                header_row = i
                break
        if header_row is None:
            wb.close()
            continue

        hdr = [str(c).strip() if c else "" for c in rows[header_row]]
        try:
            sku_col = hdr.index("SKU")
            dev_col = hdr.index("开发")
        except ValueError:
            wb.close()
            continue

        count = 0
        for r in rows[header_row+1:]:
            if not r or len(r) <= max(sku_col, dev_col):
                continue
            sku_val = r[sku_col]
            dev_val = r[dev_col]
            if not sku_val or not dev_val:
                continue
            dev_name = str(dev_val).strip()
            all_devs.add(dev_name)
            if dev_name in target_devs:
                sku = str(sku_val).strip()
                if sku and any(c.isdigit() for c in sku):
                    dev_skus[dev_name].append(sku)
                    count += 1
        if count > 0:
            print(f"  {fn}: 抓到 {count} 行")
        wb.close()

    print(f"\n对接表中所有开发人: {sorted(all_devs)}")

    # 去重并保存
    for dev in target_devs:
        skus = dev_skus[dev]
        uniq = []
        seen = set()
        for s in skus:
            if s not in seen:
                seen.add(s)
                uniq.append(s)
        short = get_short_name(dev)
        print(f"{dev}({short}): {len(uniq)} 个去重SKU")

        if len(uniq) == 0:
            print(f"  跳过（无SKU）")
            continue

        out_file = os.path.join(out_dir, f"{month_name}新建sku-{short}.xlsx")
        wb_out = openpyxl.Workbook()
        ws_out = wb_out.active
        ws_out.title = short
        for i, sku in enumerate(uniq, 1):
            ws_out.cell(row=i, column=1, value=sku)
        wb_out.save(out_file)
        print(f"  已保存: {out_file}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("用法: python extract_sku_by_dev.py <月份> <源目录> <文件前缀> [开发人,逗号分隔]")
        print('示例: python extract_sku_by_dev.py 3月 "E:\\...\\理实产品开发表3月份" "理实产品对接表03." 宋凤莉')
        sys.exit(1)

    month_name = sys.argv[1]
    src_dir = sys.argv[2]
    file_prefix = sys.argv[3]
    target_devs = sys.argv[4].split(",") if len(sys.argv) > 4 else ["龙梦临","周沁仪","宋凤莉","陈杨","蒋舒"]

    OUT_BASE = r"E:\项目\si-jue-zhi-mao-up\产品数据\领星模型\领星采购批次分析\SKU清单"

    print(f"=== 提取 {month_name} 开发人SKU: {target_devs} ===")
    extract(month_name, src_dir, file_prefix, target_devs, OUT_BASE)
    print("\n完成")
