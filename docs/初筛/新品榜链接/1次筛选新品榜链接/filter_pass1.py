#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一次筛选：从三站完整新品榜链接里，剔除"完全不要"的垃圾大类。

设计要点（为什么三国通用、不受德文影响）：
  - 只看 URL 里的大类标识 slug（/new-releases/<slug>/…），slug 是英文，三站一致。
  - 完全不碰商品名，所以德文/英文无所谓；US 没重抓也照样能筛，重抓后再跑一遍即可。
  - 只做减法：只删 ❌ 完全不要的大类；🔶 部分爬 / ✅ 必爬的一条不删，留给后续细筛。

输入：../完整/{uk,de,us}.md   （uk/de 为 "名称<TAB>URL"，us 为纯 URL）
输出：./{uk,de,us}.md         （保留下来的链接，原格式）
      ./_剔除报告.md          （每站删了哪些 slug、各多少条）
"""
import re
from pathlib import Path

# ❌ 完全不要的顶级大类 slug（三站通用，URL 路径里的英文标识）。
# 只放"确定完全不要"的；🔶 部分爬的类目（automotive/sports/fashion/pet-supplies/
# baby/diy/beauty…）一律不入黑名单，留到后续步骤按商品细筛。
JUNK_SLUGS = {
    # —— 数字内容 / 图书 / 音乐 / 软件 / 游戏 ——
    "mobile-apps", "books", "digital-text", "ebooks",
    "dmusic", "music", "software", "videogames", "video-games",
    "musical-instruments",
    # —— 电子 / 相机 / 电脑 / 手机 ——
    "electronics", "ce-de", "photo", "camera-photo", "camera",
    "computers", "pc", "wireless", "mobile",
    # —— 家电 / 五金工具 / 照明 ——
    "appliances", "large-appliances", "hi",   # hi = Tools & Home Improvement(US)
    "lighting",
    # —— 药品 / 健康个护 ——
    "drugstore", "hpc", "health-personal-care",
}

SLUG_RE = re.compile(r"/new-releases/([^/]+)/")
SITES = {"uk": "uk.md", "de": "de.md", "us": "us.md"}

HERE = Path(__file__).resolve().parent
SRC_DIR = HERE.parent / "完整"


def extract_url(line: str):
    """从一行里取出 URL；表头/空行返回 None。"""
    line = line.rstrip("\r\n")
    if not line.strip():
        return None
    url = line.split("\t")[-1].strip()   # uk/de: 名称<TAB>URL；us: 纯 URL
    return url if url.startswith("http") else None


def main():
    report = ["# 一次筛选剔除报告（按 URL slug 黑名单）\n",
              "> 只删 ❌ 完全不要的大类；🔶/✅ 类目全部保留。slug 三站通用，与语言无关。\n"]
    for site, fname in SITES.items():
        src = SRC_DIR / fname
        if not src.exists():
            print(f"[跳过] {site}: {src} 不存在（US 待重抓时可后补）")
            report.append(f"\n## {site.upper()}：源文件不存在，跳过\n")
            continue

        kept, dropped, total = [], {}, 0
        with src.open(encoding="utf-8", errors="replace") as f:
            for line in f:
                url = extract_url(line)
                if url is None:
                    continue                      # 丢表头/空行
                total += 1
                m = SLUG_RE.search(url)
                slug = m.group(1) if m else "?"
                if slug in JUNK_SLUGS:
                    dropped[slug] = dropped.get(slug, 0) + 1
                else:
                    kept.append(line.rstrip("\r\n"))

        (HERE / f"{site}.md").write_text("\n".join(kept) + "\n", encoding="utf-8")

        drop_total = sum(dropped.values())
        keep_rate = (len(kept) / total * 100) if total else 0
        print(f"=== {site.upper()}: 总 {total} → 保留 {len(kept)} ({keep_rate:.0f}%) / 剔除 {drop_total} ===")
        report.append(f"\n## {site.upper()}：总 {total} → 保留 {len(kept)}（{keep_rate:.0f}%）/ 剔除 {drop_total}\n")
        report.append("| 剔除的垃圾大类 slug | 条数 |\n|---|---|\n")
        for slug, c in sorted(dropped.items(), key=lambda x: -x[1]):
            print(f"    -{c:>5}  {slug}")
            report.append(f"| {slug} | {c} |\n")

    (HERE / "_剔除报告.md").write_text("".join(report), encoding="utf-8")
    print("\n完成。输出目录：", HERE)


if __name__ == "__main__":
    main()
