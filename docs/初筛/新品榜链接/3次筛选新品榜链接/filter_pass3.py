#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
三次筛选：收拾"巨型混合大类"——kitchen / home-garden / garden / diy / lawn-garden。

背景（对着真实子类名看出来的）：
  - UK kitchen 735 个子类 = 手工DIY + 装饰摆件 + 派对（好品）混在 真厨具 + 家具家电大件（噪音）里。
  - DE diy   315 个子类 ≈ 几乎全是五金/建材/水暖/安防（噪音），好品只有门牌/墙贴/木烙寥寥几个。
  故这些大类不能整类放行，必须按子类名做白/黑名单精筛。

分工：
  - 二次筛已处理的 🔶 大类（automotive/sports/beauty/fashion/baby）不再动，直接沿用。
  - 明确干净的 ✅ 大类（kids/toys/toys-and-games/officeproduct/handmade/pet-supplies/outdoors）整类保留。
  - 本步只对 MIXED_SLUGS 做子类名白/黑名单：黑名单命中即删（优先级最高），再白名单命中才留。

三国通用：子类名三站均为英文（de.md 走 /-/en/），英文词表共用；US 补齐子类名后同样适用。

输入：../2次筛选新品榜链接/{uk,de,us}.md
输出：./{uk,de,us}.md + ./_三次筛选报告.md
"""
import re
from pathlib import Path

# 巨型混合大类：需按子类名精筛
MIXED_SLUGS = {"kitchen", "home-garden", "garden", "lawn-garden", "diy", "arts-crafts"}

# 明确干净、整类保留的大类（二次筛已定；handmade/pet/office/玩具/花园装饰入口）
KEEP_ALL_SLUGS = {
    "kids", "toys", "toys-and-games",
    "officeproduct", "office-products",
    "handmade", "pet-supplies", "outdoors",
}

# 二次筛已按关键词处理过的 🔶 大类：本步原样沿用（不再改）
PASSTHROUGH_SLUGS = {"automotive", "sports", "beauty", "fashion", "baby", "baby-products", "sporting-goods"}

# —— 黑名单（命中即删，优先级最高）：厨具 / 家具家电大件 / 五金建材 / 水暖卫浴 / 床品收纳 ——
BLACK = [
    # 真厨具 / 餐具 / 小家电
    r"whisk", r"masher", r"peeler", r"grater", r"slicer", r"colander", r"strainer",
    r"kettle", r"toaster", r"fryer", r"\bhob", r"cooktop", r"\boven", r"microwave",
    r"pots? & pans", r"cookware", r"bakeware", r"baking dish", r"blender", r"mixer",
    r"food processor", r"juicer", r"percolator", r"coffee machine", r"coffee grinder",
    r"milk froth", r"spiralizer", r"can opener", r"garlic press", r"pizza cutter",
    r"skewer", r"skimmer", r"tenderiser", r"poultry", r"spatula", r"turner",
    r"kitchen scale", r"kitchen timer", r"kitchen scissor", r"blow torch",
    r"chopping board", r"bread board", r"draining board", r"worktop", r"trivet",
    r"dinnerware", r"pasta tool", r"salt mill", r"pepper mill", r"spice mill",
    r"waffle", r"slow cooker", r"steamer", r"fondue", r"griddle", r"grill",
    r"vacuum sealer", r"whipped cream", r"dispenser", r"measuring cup",
    r"measuring spoon", r"funnel", r"sieve", r"terrine", r"tagine", r"ricer",
    r"egg (boiler|poacher)", r"defrosting", r"food dome", r"food storage",
    # 家具 / 大件
    r"sofa", r"couch", r"\bbeds?\b", r"bed frame", r"mattress", r"wardrobe",
    r"dresser", r"chest of drawer", r"bookcase", r"cabinet", r"sideboard",
    r"\btable", r"\bchairs?\b", r"stool", r"bench", r"ottoman", r"armchair",
    r"desk", r"futon", r"divan", r"headboard", r"footboard", r"recliner",
    r"shelf", r"shelves", r"bookcase", r"drawer", r"trolley", r"trolleys",
    r"slipcover", r"poufs?\b", r"zabuton", r"barstool",
    # 家电
    r"air conditioner", r"air purifier", r"dehumidifier", r"humidifier", r"\bfans?\b",
    r"evaporative cooler", r"washing machine", r"tumble dr", r"\bvacuum", r"vacuums",
    r"carpet washer", r"steam cleaner", r"sweeper", r"iron\b", r"ironing", r"irons\b",
    r"fridge", r"refrigerator", r"wine cabinet", r"wine fridge", r"chiller",
    r"heating", r"heater", r"fireplace", r"water purifier", r"water heater",
    # 床品纺织大件 / 卫浴
    r"bedding", r"duvet", r"comforter", r"bedspread", r"coverlet", r"pillowcase",
    r"\bsheets?\b", r"blanket", r"quilt\b", r"pillow", r"cushion protector",
    r"mattress protector", r"bath linen", r"bath mat", r"bathrobe", r"towel",
    r"bathroom", r"shower", r"toilet", r"sink", r"bathtub", r"bidet", r"tap\b",
    r"taps? ", r"showerhead", r"vanity", r"medicine cabinet",
    # 五金 / 建材 / 水暖 / 安防（DE diy 主体）
    r"screw", r"\bbolt", r"\bnut\b", r"nuts\b", r"nail\b", r"nails\b", r"rivet",
    r"anchor", r"bracket", r"hinge", r"\block", r"locks?\b", r"latch", r"knob",
    r"handle", r"doorknob", r"\bdoors?\b", r"window frame", r"windows\b",
    r"flooring", r"tile\b", r"tiles\b", r"wallpaper", r"caulk", r"grout",
    r"adhesive", r"\bpaint\b", r"paints\b", r"primer", r"varnish", r"stain\b",
    r"epoxy", r"epoxies", r"silicone", r"\bfoam", r"sealant", r"sealing", r"wax\b",
    r"pipe", r"plumb", r"valve", r"washer", r"aerator", r"fastener", r"dowel",
    r"chimney", r"roofing", r"decking", r"fencing", r"masonry", r"millwork",
    r"detector", r"sensor", r"alarm", r"safe\b", r"safes\b", r"surveillance",
    r"doorbell", r"letterbox", r"mailbox", r"\bsaws?\b", r"router", r"planer",
    r"drill", r"wrench", r"plier", r"pincer", r"crowbar", r"file\b", r"rasp",
    r"tool (bag|belt|box|chest|cabinet|set|tray|pouch)", r"compressor",
    r"snow (plough|thrower)", r"pressure washer", r"pump", r"ventilator",
    # 收纳/储物大件（非装饰）
    r"laundry", r"waste", r"recycling", r"dustbin", r"wastebasket", r"bins?\b",
    r"hamper", r"storage box", r"storage drawer", r"under-bed", r"space saver",
]

# —— 白名单（命中才留）：装饰 / 手工DIY / 派对 / 礼品 / 相框 / 饰品制作 ——
WHITE = [
    # 装饰摆件挂件
    r"sculpture", r"figurine", r"statue", r"ornament", r"vase", r"snow globe",
    r"dream catcher", r"wreath", r"wall d[eé]cor", r"wall art", r"wall cross",
    r"wall pediment", r"wall stickers?", r"wall mural", r"3d wall", r"tapestr",
    r"decorative", r"decoration", r"decor\b", r"artificial (flora|flower|plant|tree|shrub|fruit|veget)",
    r"dried (& preserved )?flora", r"dried (flower|plant)", r"preserved flower",
    r"potpourri", r"home fragrance", r"incense", r"oil burner", r"scents?\b",
    r"candles? & holder", r"candle making", r"musical box", r"holiday figurine",
    r"snow globe", r"finial", r"tassel", r"mobiles?\b", r"money (bank|box)",
    r"hanging (ornament|decorative)", r"ceiling d[eé]cor", r"seasonal d[eé]cor",
    r"christmas", r"halloween", r"easter", r"carnival", r"nutcracker",
    # 相框 / 照片 / 镜子(装饰性)
    r"photo frame", r"picture frame", r"photo album", r"shadow box", r"clip photo",
    r"mirror\b", r"mirrors\b", r"clock\b", r"clocks\b",  # 挂钟/装饰镜（轻装饰）
    # 手工 DIY 全套
    r"beading", r"\bbeads?\b", r"jewell?ery-making", r"jewell?ery findings",
    r"jewell?ery box", r"charms?\b", r"cross-?stitch", r"embroider", r"needlework",
    r"knitting", r"crochet", r"quilling", r"scrapbook", r"stamping", r"die-?cut",
    r"diamond painting", r"sculpt", r"pottery", r"ceramics", r"clay", r"mosaic",
    r"decoupage", r"papier", r"paper craft", r"card making", r"greeting card",
    r"embellishment", r"glitter", r"stencil", r"sewing", r"\bfabric", r"\byarn\b",
    r"woodcraft", r"woodburning", r"engraving", r"etching", r"printmaking",
    r"screen printing", r"relief printing", r"mask making", r"basket making",
    r"candle making", r"soap making", r"wine making", r"felt", r"macrame",
    # 派对 / 节庆
    r"party", r"invitation", r"photobooth", r"sky lantern", r"favour", r"balloon",
    r"guestbook", r"place card", r"cardboard cutout", r"banner", r"garland",
    # 门牌标识（装饰性）
    r"address plaque", r"name plaque", r"house number", r"door plate", r"signs? & plaque",
    r"money bank", r"letter rack", r"address sign", r"yard sign", r"pool sign",
    # 园艺装饰摆件（第3步抽样回收：确属好品线）
    r"sun ?catcher", r"suncatcher", r"garden stake", r"gnome", r"wind spinner",
    r"wind sculpture", r"memorial garden", r"garden stone", r"candleholder",
    r"candle holder", r"lantern", r"tree topper", r"window box", r"hanging planter",
    r"hanging basket", r"hanging decorative", r"clay rock", r"decorative stone",
    r"fresh wreath",
    # 手工载体 / 美术耗材（注意：仅手工/美术类，装修涂料仍在黑名单拦截）
    r"fabric & textile paint", r"fabric pens?", r"paint-?by-?numbers?", r"paint pens? & marker",
    r"paint dauber", r"\bstamps?\b", r"stamps? & ink", r"sticker machine", r"tile sticker",
    r"pom ?pom", r"leathercraft", r"craft supplies", r"craft tape", r"3d craft",
    r"albums? & refill", r"favou?rs?\b", r"gift wrap", r"ball winder",
    r"frame sections?", r"frame molding", r"frame parts",
]

SLUG_RE = re.compile(r"/new-releases/([^/]+)/")
BLACK_RE = [re.compile(p, re.I) for p in BLACK]
WHITE_RE = [re.compile(p, re.I) for p in WHITE]
SITES = {"uk": "uk.md", "de": "de.md", "us": "us.md"}

HERE = Path(__file__).resolve().parent
SRC_DIR = HERE.parent / "2次筛选新品榜链接"


def classify(slug, name, has_names):
    if slug in KEEP_ALL_SLUGS or slug in PASSTHROUGH_SLUGS:
        return True, "keep"
    if slug in MIXED_SLUGS:
        if not has_names:
            return True, "mixed-nonames-kept"     # 无子类名，保守全留待重抓
        # 白名单优先：明确好品词（含手工类 paint/stamp）直接留，不被黑名单误拦
        if any(r.search(name) for r in WHITE_RE):
            return True, "white"
        if any(r.search(name) for r in BLACK_RE):
            return False, "black"
        return False, "no-white"
    return True, "unknown-slug"


def main():
    report = ["# 三次筛选报告（巨型混合大类按子类名精筛）\n",
              "> 只对 kitchen/home-garden/garden/lawn-garden/diy/arts-crafts 做白/黑名单；其余沿用二次结果。\n"]
    for site, fname in SITES.items():
        src = SRC_DIR / fname
        if not src.exists():
            report.append(f"\n## {site.upper()}：源不存在，跳过\n")
            continue
        lines = src.read_text(encoding="utf-8", errors="replace").splitlines()
        has_names = any("\t" in ln for ln in lines)
        if not has_names:
            print(f"[注意] {site.upper()} 无子类名列，混合大类跳过精筛，原样保留待重抓")

        kept, total = [], 0
        stat = {}
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
        print(f"=== {site.upper()}: 总 {total} -> 保留 {len(kept)} ({rate:.0f}%) ===")
        report.append(f"\n## {site.upper()}：总 {total} → 保留 {len(kept)}（{rate:.0f}%）\n")
        report.append("| slug | 保留 | 剔除 |\n|---|---|---|\n")
        for slug, (k, d) in sorted(stat.items(), key=lambda x: -(x[1][0] + x[1][1])):
            mark = " ←精筛" if slug in MIXED_SLUGS and has_names else ""
            print(f"    {slug:<18} 留{k:>5}  删{d:>5}{mark}")
            report.append(f"| {slug} | {k} | {d} |\n")

    (HERE / "_三次筛选报告.md").write_text("".join(report), encoding="utf-8")
    print("\n完成。输出目录：", HERE)


if __name__ == "__main__":
    main()
