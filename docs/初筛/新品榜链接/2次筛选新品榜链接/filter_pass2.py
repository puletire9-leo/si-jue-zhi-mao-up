#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
二次筛选：在一次筛选结果之上，对 🔶 部分爬大类按"子类名称"做关键词白/黑名单，
只留装饰/小件子类，砍掉核心件/器械/工具/化学。

为什么依然三国通用、不受德文影响：
  - 三站 md 里的子类名称都是英文（de.md 走 amazon.de/-/en/ 英文页面，实测子类名
    是 Decals / Helmets / Nail Design 这种英文），所以英文关键词表三站共用。
  - ✅ 必爬大类整类保留，不碰子类；🔶 大类才过关键词。

两类大类：
  - KEEP_ALL_SLUGS（✅ 必爬）：整类保留。
  - PARTIAL_SLUGS（🔶 部分爬）：子类名先过黑名单（命中即删，优先级最高，防误伤），
    再过白名单（命中才留）；都不命中则删。

输入：../1次筛选新品榜链接/{uk,de,us}.md
输出：./{uk,de,us}.md + ./_二次筛选报告.md
"""
import re
from pathlib import Path

# ✅ 必爬大类：整类保留（含各站 slug 变体）
KEEP_ALL_SLUGS = {
    "kitchen", "home-garden",            # Home / 厨房小物（噪音大但留到第3步按商品筛）
    "kids", "toys", "toys-and-games",    # 玩具
    "arts-crafts",                        # 手工 DIY(US)
    "outdoors", "garden", "lawn-garden", # 花园装饰
    "officeproduct", "office-products",  # 文具
    "handmade",                           # 手工艺品
    "diy",                                # 手工五金（含大量装饰辅料，留到第3步筛）
    "pet-supplies",                       # 宠物小件（量小，整留）
}

# 🔶 部分爬大类：子类名过关键词
PARTIAL_SLUGS = {"automotive", "sports", "beauty", "fashion", "baby", "baby-products"}

# —— 黑名单（命中即删，优先级最高）：核心件 / 器械 / 工具 / 化学 / 大件 ——
BLACK = [
    # 汽车核心件 & 工具
    r"engine", r"brake", r"alternator", r"starter", r"\bfilter", r"exhaust",
    r"steering", r"suspension", r"clutch", r"transmission", r"drive & gear",
    r"fuel", r"ignition", r"chassis", r"\btyre", r"wheel", r"\brim", r"sensor",
    r"fuse", r"battery", r"batteries", r"charger", r"inverter", r"alternat",
    r"\btool", r"equipment", r"riveter", r"wrench", r"puller", r"diagnostic",
    r"refrigerator", r"air conditioning", r"service lift", r"garage",
    r"windscreen", r"wiper", r"motor vehicle", r"\bmotors?\b", r"bike",
    # 运动器械 / 大件
    r"\bball\b", r"balls", r"\bbat\b", r"bats", r"boxing", r"batting cage",
    r"treadmill", r"weight", r"dumbbell", r"machine", r"backboard", r"hoop",
    r"kayak", r"canoe", r"\bboat", r"tent", r"bicycle", r"\bbikes?\b",
    # 美妆护肤化学
    r"cleanser", r"shampoo", r"conditioner", r"serum", r"cream", r"lotion",
    r"deodorant", r"sun care", r"tanning", r"perm", r"hair colour", r"hair loss",
    r"make-?up remover", r"scrub", r"scalp", r"bath additive",
    # 服装鞋 / 婴童大件安全件
    r"clothing", r"apparel", r"\bshoes?\b", r"\bboots?\b", r"protective",
    r"furniture", r"mattress", r"highchair", r"cot\b", r"crib", r"nappy",
    r"nappies", r"monitor", r"feeding", r"breastfeed", r"safety", r"gate",
    r"walker", r"playpen", r"car seat", r"stroller", r"pram", r"bedding",
    r"duvet", r"wipes?", r"potty", r"potties", r"soother", r"teether",
]

# —— 白名单（命中才留）：装饰 / 小件 / 礼品 / 手工载体 ——
WHITE = [
    # 装饰摆件挂件
    r"ornament", r"figurine", r"idol", r"sculpture", r"statue", r"decor",
    r"decoration", r"sign", r"plaque", r"flag", r"sticker", r"decal", r"patch",
    r"sun ?catcher", r"wind", r"frame", r"framed", r"picture", r"poster",
    r"print", r"wall", r"keepsake", r"memory", r"photo album", r"bookend",
    # 车内软装小件
    r"air fresh", r"aroma", r"diffuser", r"seat cover", r"steering wheel cover",
    r"mats? & carpet", r"sunshade", r"key ?ring", r"key ?chain", r"rearview",
    r"dashboard", r"cushion",
    # 饰品配饰 / 轻定制载体
    r"jewell?ery", r"pouch", r"organiser", r"organizer", r"\bbox", r"bag",
    r"backpack", r"wallet", r"case", r"nail design", r"nail treatment",
    r"nail art", r"hair styling accessor", r"hair extension", r"headband",
    r"fascinator", r"brooch", r"earring", r"pendant", r"bracelet",
    # 钓鱼 / 高尔夫 / 露营小件
    r"fishing", r"bait", r"lure", r"\brod\b", r"tackle", r"\bhook", r"float",
    r"golf", r"\btee\b", r"arrow", r"\bbow\b", r"archery",
    r"camp", r"drawstring", r"carabiner", r"compass",
    # 派对礼品婴童装饰
    r"gift", r"soft toy", r"plush", r"christening", r"baby jewell",
    r"mobile", r"playmat",
]

SLUG_RE = re.compile(r"/new-releases/([^/]+)/")
BLACK_RE = [re.compile(p, re.I) for p in BLACK]
WHITE_RE = [re.compile(p, re.I) for p in WHITE]
SITES = {"uk": "uk.md", "de": "de.md", "us": "us.md"}

HERE = Path(__file__).resolve().parent
SRC_DIR = HERE.parent / "1次筛选新品榜链接"


def classify(slug: str, name: str, has_names: bool):
    """返回 (keep: bool, reason: str)。
    has_names=False（如 US 纯 URL 无子类名）时，🔶 大类无法做关键词筛，
    一律原样保留并标记，避免误杀——等重抓成带子类名的格式再筛。"""
    if slug in KEEP_ALL_SLUGS:
        return True, "keep-all"
    if slug in PARTIAL_SLUGS:
        if not has_names:
            return True, "partial-nonames-kept"   # 无子类名，保守全留待重抓
        if any(r.search(name) for r in BLACK_RE):
            return False, "black"
        if any(r.search(name) for r in WHITE_RE):
            return True, "white"
        return False, "no-white"
    # 不在两个名单里的 slug（理论上一次筛选已清掉垃圾）——保守保留并标记
    return True, "unknown-slug"


def main():
    report = ["# 二次筛选报告（🔶 大类按子类名关键词白/黑名单）\n",
              "> ✅ 必爬大类整类保留；🔶 大类子类名先过黑名单再过白名单。子类名英文，三站通用。\n"]
    for site, fname in SITES.items():
        src = SRC_DIR / fname
        if not src.exists():
            report.append(f"\n## {site.upper()}：源不存在，跳过\n")
            continue
        lines = src.read_text(encoding="utf-8", errors="replace").splitlines()
        # 探测该站是否带子类名列（任意一行含 TAB 即认为有名称）
        has_names = any("\t" in ln for ln in lines)
        if not has_names:
            print(f"[注意] {site.upper()} 无子类名列（纯 URL），部分爬大类跳过关键词筛，原样保留待重抓")

        kept, total = [], 0
        stat = {}   # slug -> [keep, drop]
        for line in lines:
            if not line.strip():
                continue
            parts = line.split("\t")
            url = parts[-1].strip()
            if not url.startswith("http"):
                continue
            name = parts[0] if len(parts) > 1 else ""
            total += 1
            m = SLUG_RE.search(url)
            slug = m.group(1) if m else "?"
            keep, _ = classify(slug, name, has_names)
            stat.setdefault(slug, [0, 0])
            if keep:
                kept.append(line)
                stat[slug][0] += 1
            else:
                stat[slug][1] += 1

        (HERE / f"{site}.md").write_text("\n".join(kept) + "\n", encoding="utf-8")
        rate = (len(kept) / total * 100) if total else 0
        print(f"=== {site.upper()}: 总 {total} → 保留 {len(kept)} ({rate:.0f}%) ===")
        report.append(f"\n## {site.upper()}：总 {total} → 保留 {len(kept)}（{rate:.0f}%）\n")
        report.append("| slug | 保留 | 剔除 |\n|---|---|---|\n")
        for slug, (k, d) in sorted(stat.items(), key=lambda x: -(x[1][0] + x[1][1])):
            print(f"    {slug:<18} 留{k:>5}  删{d:>5}")
            report.append(f"| {slug} | {k} | {d} |\n")

    (HERE / "_二次筛选报告.md").write_text("".join(report), encoding="utf-8")
    print("\n完成。输出目录：", HERE)


if __name__ == "__main__":
    main()
