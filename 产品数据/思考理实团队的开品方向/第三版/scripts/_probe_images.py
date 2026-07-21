# -*- coding: utf-8 -*-
"""探测 WPS DISPIMG 图片存储结构。"""
import zipfile, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

f = r"E:\项目\si-jue-zhi-mao-up\产品数据\产品表\理实产品开发表\7月份\理实产品对接表07.16.xlsx"
z = zipfile.ZipFile(f)
names = z.namelist()
print("=== zip entries (non-media) ===")
for n in names:
    if not n.startswith("xl/media/"):
        print(" ", n)
media = [n for n in names if n.startswith("xl/media/")]
print(f"\n=== media count: {len(media)} ===")
for n in media[:5]:
    print(" ", n, z.getinfo(n).file_size)

# cellimages.xml maps DISPIMG ID -> embed rId
for cand in ["xl/cellimages.xml", "xl/_rels/cellimages.xml.rels"]:
    if cand in names:
        print(f"\n=== {cand} (first 1500 chars) ===")
        print(z.read(cand).decode("utf-8","replace")[:1500])
z.close()
