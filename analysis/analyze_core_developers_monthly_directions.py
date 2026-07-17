from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = (
    ROOT
    / "产品数据"
    / "思考理实团队的开品方向"
    / "第一版"
    / "第一层_核心开发人开品分析_陈杨宋凤莉蒋舒"
)
SOURCE_CSV = DATA_ROOT / "00_三人开品基础明细_2025-04至2026-06.csv"
DEVELOPERS = ("陈杨", "宋凤莉", "蒋舒")
MONTHS = [
    f"{year:04d}-{month:02d}"
    for year, start, end in ((2025, 4, 12), (2026, 1, 6))
    for month in range(start, end + 1)
]

SEASON_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("圣诞节", ("圣诞", "christmas", "xmas", "nativity")),
    ("万圣节", ("万圣", "halloween", "南瓜灯")),
    ("复活节", ("复活节", "easter")),
    ("圣帕特里克节", ("圣帕特里克", "st patrick")),
    ("感恩节", ("感恩节", "thanksgiving")),
    ("斋月/开斋节", ("斋月", "ramadan", "开斋节", "eid")),
    ("新年", ("新年", "new year")),
    ("情人节", ("情人节", "valentine")),
    ("母亲节", ("母亲节", "mother's day", "mothers day")),
    ("父亲节", ("父亲节", "father's day", "fathers day")),
    ("毕业季", ("毕业", "graduation")),
    ("婚礼季", ("婚礼", "wedding", "新娘", "bride", "新郎", "groom")),
    ("教师/返校季", ("教师", "老师", "teacher", "开学", "back to school")),
    ("夏季户外", ("泳池", "游泳", "沙滩", "海滩", "露营", "野餐", "烧烤", "太阳帽", "防晒")),
    ("冬季保暖", ("冬季", "保暖", "暖手", "滑雪", "雪人")),
]


def month_folder(month: str) -> str:
    year, value = map(int, month.split("-"))
    return f"{str(year)[2:]}年{value}月"


def month_display(month: str) -> str:
    year, value = map(int, month.split("-"))
    return f"{year}年{value:02d}月"


def percent(value: int | float, total: int | float) -> str:
    return f"{value / total:.2%}" if total else "0.00%"


def includes_any(text: str, keywords: Iterable[str]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def season_tags(name: str) -> list[str]:
    return [label for label, keywords in SEASON_RULES if includes_any(name, keywords)]


def load_rows() -> list[dict[str, Any]]:
    with SOURCE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["采购价(CNY)"] = float(row.get("采购价(CNY)") or 0)
        row["产品族出现月份数（开发人）"] = int(row.get("产品族出现月份数（开发人）") or 0)
        row["季节性标签"] = "、".join(season_tags(str(row.get("产品名称") or "")))
    return rows


def family_level(active_months: int) -> str:
    if active_months >= 5:
        return "常驻品线"
    if active_months >= 3:
        return "持续测试品线"
    return "短期/单月测试"


def valid_family(family: str) -> bool:
    return bool(family) and family != "待人工归族"


def count_table(counter: Counter[str], total: int, limit: int = 10) -> list[str]:
    lines = ["| 项目 | SKU数 | 占比 |", "|---|---:|---:|"]
    for name, count in counter.most_common(limit):
        lines.append(f"| {name} | {count} | {percent(count, total)} |")
    if not counter:
        lines.append("| 暂无 | 0 | 0.00% |")
    return lines


def family_month_stats(rows: list[dict[str, Any]]) -> dict[tuple[str, str, str], int]:
    result: dict[tuple[str, str, str], int] = Counter()
    for row in rows:
        result[(row["创建月份"], row["开发人"], row["产品族"])] += 1
    return result


def developer_family_stats(rows: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        buckets[(row["开发人"], row["产品族"])].append(row)
    output: dict[tuple[str, str], dict[str, Any]] = {}
    for key, items in buckets.items():
        months = sorted({row["创建月份"] for row in items})
        output[key] = {
            "months": months,
            "active_months": len(months),
            "total_skus": len(items),
            "direction": Counter(row["主方向"] for row in items).most_common(1)[0][0],
            "seasonal": Counter(
                tag
                for row in items
                for tag in str(row["季节性标签"]).split("、")
                if tag
            ),
        }
    return output


def first_direction_months(rows: list[dict[str, Any]]) -> dict[tuple[str, str], str]:
    months: dict[tuple[str, str], list[str]] = defaultdict(list)
    for row in rows:
        months[(row["开发人"], row["主方向"])].append(row["创建月份"])
    return {key: min(values) for key, values in months.items()}


def month_developer_summary(
    selected: list[dict[str, Any]],
    developer: str,
    family_stats: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any]:
    rows = [row for row in selected if row["开发人"] == developer]
    families = {row["产品族"] for row in rows}
    new_families = {row["产品族"] for row in rows if row["本月产品族状态"] == "新增品线"}
    continued_families = families - new_families
    evergreen = {
        family
        for family in families
        if valid_family(family) and family_stats[(developer, family)]["active_months"] >= 5
    }
    seasonal_count = sum(bool(row["季节性标签"]) for row in rows)
    return {
        "rows": rows,
        "sku": len(rows),
        "families": families,
        "new_families": new_families,
        "continued_families": continued_families,
        "evergreen": evergreen,
        "custom": sum(row["是否定制"] == "是" for row in rows),
        "bundle": sum(row["是否多件/套装"] == "是" for row in rows),
        "risk": sum(row["风险标记"] != "无明显硬风险" for row in rows),
        "seasonal": seasonal_count,
        "standard": sum(row["商品标准化类型"] == "标品" for row in rows),
        "nonstandard": sum(row["商品标准化类型"] == "非标" for row in rows),
        "standard_review": sum(row["商品标准化类型"] == "待复核" for row in rows),
        "value_types": Counter(row["价值主导类型"] for row in rows),
        "avg_price": sum(row["采购价(CNY)"] for row in rows) / len(rows) if rows else 0,
        "directions": Counter(row["主方向"] for row in rows),
        "family_counts": Counter(row["产品族"] for row in rows),
        "themes": Counter(
            theme
            for row in rows
            for theme in str(row["主题"]).split("、")
            if theme != "通用/无明显主题"
        ),
        "seasons": Counter(
            tag
            for row in rows
            for tag in str(row["季节性标签"]).split("、")
            if tag
        ),
        "risks": Counter(
            flag
            for row in rows
            for flag in str(row["风险标记"]).split("、")
            if flag != "无明显硬风险"
        ),
    }


def family_lines(
    summary: dict[str, Any],
    developer: str,
    family_stats: dict[tuple[str, str], dict[str, Any]],
    families: set[str],
    limit: int = 10,
) -> list[str]:
    ranked = sorted(families, key=lambda family: (-summary["family_counts"][family], family))[:limit]
    lines = ["| 产品族 | 本月SKU | 15个月出现月份数 | 类型 | 出现月份 |", "|---|---:|---:|---|---|"]
    for family in ranked:
        stats = family_stats[(developer, family)]
        lines.append(
            f"| {family} | {summary['family_counts'][family]} | {stats['active_months']} | "
            f"{family_level(stats['active_months'])} | {'、'.join(stats['months'])} |"
        )
    if not ranked:
        lines.append("| 暂无 | 0 | 0 | - | - |")
    return lines


def individual_conclusion(developer: str, summary: dict[str, Any]) -> list[str]:
    if not summary["sku"]:
        return [f"- {developer}本月没有创建记录，因此不做方向优劣判断。"]
    lines = []
    top_direction = summary["directions"].most_common(1)[0]
    lines.append(
        f"- 本月核心方向是“{top_direction[0]}”，共{top_direction[1]}个SKU，占{percent(top_direction[1], summary['sku'])}。"
    )
    lines.append(
        f"- 新增产品族{len(summary['new_families'])}个，跨月延续产品族{len(summary['continued_families'])}个；"
        f"当前更偏向{'扩新品线' if len(summary['new_families']) > len(summary['continued_families']) else '延续已有品线'}。"
    )
    if summary["seasonal"]:
        lines.append(
            f"- 明确季节性SKU有{summary['seasonal']}个，占{percent(summary['seasonal'], summary['sku'])}；"
            "开发月份不是销售旺季本身，后续需要结合上架提前量判断是否踩准季节。"
        )
    else:
        lines.append("- 产品名称中未发现明确季节词，本月主要按常年需求候选看待，但不能因此直接认定一定常销。")
    if summary["risk"]:
        lines.append(f"- 有风险标记SKU {summary['risk']}个，占{percent(summary['risk'], summary['sku'])}，进入运营前仍需逐条复核。")
    return lines


def write_individual_report(
    month: str,
    developer: str,
    summary: dict[str, Any],
    family_stats: dict[tuple[str, str], dict[str, Any]],
    direction_first: dict[tuple[str, str], str],
    target: Path,
) -> None:
    lines = [
        f"# {developer}：{month_display(month)}开品分析",
        "",
        "> 第一层只分析开发创建的SKU及方向结构，不使用FBA、销量和利润评价最终成败。",
        "",
        "## 一、本月基础数量",
        "",
        "| 指标 | 数值 |",
        "|---|---:|",
        f"| SKU数 | {summary['sku']} |",
        f"| 产品族数 | {len(summary['families'])} |",
        f"| 新增产品族 | {len(summary['new_families'])} |",
        f"| 跨月延续产品族 | {len(summary['continued_families'])} |",
        f"| 本月涉及常驻品线 | {len(summary['evergreen'])} |",
        f"| 定制SKU | {summary['custom']}（{percent(summary['custom'], summary['sku'])}） |",
        f"| 多件/套装SKU | {summary['bundle']}（{percent(summary['bundle'], summary['sku'])}） |",
        f"| 明确季节性SKU | {summary['seasonal']}（{percent(summary['seasonal'], summary['sku'])}） |",
        f"| 标品SKU | {summary['standard']}（{percent(summary['standard'], summary['sku'])}） |",
        f"| 非标SKU | {summary['nonstandard']}（{percent(summary['nonstandard'], summary['sku'])}） |",
        f"| 标准化待复核SKU | {summary['standard_review']}（{percent(summary['standard_review'], summary['sku'])}） |",
        f"| 风险SKU | {summary['risk']}（{percent(summary['risk'], summary['sku'])}） |",
        f"| 平均采购价 | CNY {summary['avg_price']:.2f} |",
        "",
        "## 二、主要开品方向",
        "",
        *count_table(summary["directions"], summary["sku"]),
        "",
        "价值主导结构：",
        "",
        *count_table(summary["value_types"], summary["sku"]),
        "",
        "本月首次进入的主方向：",
        "",
    ]
    new_directions = [
        direction
        for direction in summary["directions"]
        if direction_first[(developer, direction)] == month
    ]
    lines.extend([f"- {item}" for item in new_directions] or ["- 没有首次出现的主方向，新增主要发生在已有大方向下的产品族。"])

    lines.extend([
        "",
        "## 三、常驻品线",
        "",
        "常驻品线口径：同一开发人的同一产品族在15个月中至少出现5个月。",
        "",
        *family_lines(summary, developer, family_stats, summary["evergreen"]),
        "",
        "## 四、跨月延续品线",
        "",
        *family_lines(summary, developer, family_stats, summary["continued_families"]),
        "",
        "## 五、本月新增品线",
        "",
        *family_lines(summary, developer, family_stats, summary["new_families"]),
        "",
        "## 六、季节性线索",
        "",
        "季节性只根据产品名称中的明确节日、季节和使用场景词识别，不等于已经验证销量旺季。",
        "",
        *count_table(summary["seasons"], summary["seasonal"]),
        "",
        "## 七、主题与风险",
        "",
        "主要主题：",
        "",
        *count_table(summary["themes"], summary["sku"]),
        "",
        "风险类型：",
        "",
        *count_table(summary["risks"], summary["risk"]),
        "",
        "## 八、本月第一层判断",
        "",
        *individual_conclusion(developer, summary),
        "",
        f"基础明细见：[本月三人开品基础数据]({month_display(month)}_三人开品基础数据.xlsx)。",
        "",
    ])
    if month == MONTHS[0]:
        lines.insert(
            4,
            "> 2025年4月是当前观察窗口起点；本月“新增品线”仅表示在本数据窗口内首次出现，不能证明公司历史上从未开发。",
        )
        lines.insert(5, "")
    target.write_text("\n".join(lines), encoding="utf-8")


def write_month_report(
    month: str,
    summaries: dict[str, dict[str, Any]],
    family_stats: dict[tuple[str, str], dict[str, Any]],
    target: Path,
) -> None:
    total = sum(summary["sku"] for summary in summaries.values())
    lines = [
        f"# {month_display(month)}三位核心开发人开品总览",
        "",
        f"> 本月共整理{total}个SKU。当前仅分析第一层开发方向；陈杨、宋凤莉、蒋舒作为团队核心样本。",
        "",
        "## 一、三人数量对比",
        "",
        "| 开发人 | SKU | 产品族 | 新增产品族 | 跨月延续 | 标品 | 非标 | 待复核 | 定制率 | 套装率 | 季节性SKU | 风险率 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    if month == MONTHS[0]:
        lines[3:3] = [
            "> 2025年4月是观察窗口起点；本月“新增”只代表窗口内首次出现，不能证明此前从未开发。",
            "",
        ]
    for developer in DEVELOPERS:
        item = summaries[developer]
        lines.append(
            f"| {developer} | {item['sku']} | {len(item['families'])} | {len(item['new_families'])} | "
            f"{len(item['continued_families'])} | {item['standard']} | {item['nonstandard']} | {item['standard_review']} | "
            f"{percent(item['custom'], item['sku'])} | {percent(item['bundle'], item['sku'])} | "
            f"{item['seasonal']} | {percent(item['risk'], item['sku'])} |"
        )

    lines.extend(["", "## 二、本月主要方向", ""])
    for developer in DEVELOPERS:
        top = summaries[developer]["directions"].most_common(5)
        text = "、".join(f"{name}{count}个" for name, count in top) if top else "本月无开品"
        lines.append(f"- {developer}：{text}。")

    lines.extend(["", "## 三、季节性线索", ""])
    all_seasons = Counter()
    for summary in summaries.values():
        all_seasons.update(summary["seasons"])
    lines.extend(count_table(all_seasons, sum(all_seasons.values()), 15))
    lines.extend([
        "",
        "这里统计的是开发创建时的季节性题材。开发月份通常应早于实际销售旺季，因此后续要在第二层检查是否及时上架。",
        "",
        "## 四、三人共同或重叠品线",
        "",
    ])
    family_developers: dict[str, set[str]] = defaultdict(set)
    family_counts: Counter[str] = Counter()
    for developer, summary in summaries.items():
        for family in summary["families"]:
            family_developers[family].add(developer)
            family_counts[family] += summary["family_counts"][family]
    overlaps = [family for family, devs in family_developers.items() if len(devs) >= 2]
    if overlaps:
        lines.extend(["| 产品族 | 涉及开发人 | 本月SKU |", "|---|---|---:|"])
        for family in sorted(overlaps, key=lambda item: (-family_counts[item], item))[:15]:
            lines.append(f"| {family} | {'、'.join(sorted(family_developers[family]))} | {family_counts[family]} |")
    else:
        lines.append("- 本月三人的产品族没有直接重叠；仍需在主方向和主题层面检查间接重复开发。")

    lines.extend(["", "## 五、常驻、延续与新增", ""])
    for developer in DEVELOPERS:
        item = summaries[developer]
        evergreen = sorted(item["evergreen"], key=lambda family: -item["family_counts"][family])[:5]
        continued = sorted(item["continued_families"], key=lambda family: -item["family_counts"][family])[:5]
        new = sorted(item["new_families"], key=lambda family: -item["family_counts"][family])[:5]
        lines.append(f"### {developer}")
        lines.append("")
        lines.append(f"- 常驻：{'、'.join(evergreen) if evergreen else '暂无达到5个月口径的产品族'}。")
        lines.append(f"- 延续：{'、'.join(continued) if continued else '无'}。")
        lines.append(f"- 新增：{'、'.join(new) if new else '无'}。")
        lines.append("")

    lines.extend([
        "## 六、阅读顺序",
        "",
        f"- [陈杨本月分析](01_陈杨_{month_display(month)}开品分析.md)",
        f"- [宋凤莉本月分析](02_宋凤莉_{month_display(month)}开品分析.md)",
        f"- [蒋舒本月分析](03_蒋舒_{month_display(month)}开品分析.md)",
        f"- [本月三人基础数据]({month_display(month)}_三人开品基础数据.xlsx)",
        "",
    ])
    target.write_text("\n".join(lines), encoding="utf-8")


def write_trend_report(
    rows: list[dict[str, Any]],
    family_stats: dict[tuple[str, str], dict[str, Any]],
    target: Path,
) -> None:
    lines = [
        "# 三位核心开发人：2025年4月至2026年6月开品趋势总览",
        "",
        "> 三位核心样本为陈杨、宋凤莉、蒋舒。本文汇总15个月第一层开品事实，不使用FBA、销量和利润判定最终好坏。",
        "",
        "## 一、15个月总量",
        "",
        "| 开发人 | SKU总数 | 有开品月份 | 产品族数 | 常驻产品族 | 标品 | 非标 | 待复核 | 明确季节性SKU | 风险SKU |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for developer in DEVELOPERS:
        selected = [row for row in rows if row["开发人"] == developer]
        families = {row["产品族"] for row in selected}
        evergreen = sum(
            valid_family(family) and family_stats[(developer, family)]["active_months"] >= 5
            for family in families
        )
        seasonal = sum(bool(row["季节性标签"]) for row in selected)
        risk = sum(row["风险标记"] != "无明显硬风险" for row in selected)
        standard = sum(row["商品标准化类型"] == "标品" for row in selected)
        nonstandard = sum(row["商品标准化类型"] == "非标" for row in selected)
        review = sum(row["商品标准化类型"] == "待复核" for row in selected)
        lines.append(
            f"| {developer} | {len(selected)} | {len({row['创建月份'] for row in selected})} | {len(families)} | "
            f"{evergreen} | {standard} | {nonstandard} | {review} | {seasonal} | {risk} |"
        )

    total_standard = sum(row["商品标准化类型"] == "标品" for row in rows)
    total_nonstandard = sum(row["商品标准化类型"] == "非标" for row in rows)
    total_review = sum(row["商品标准化类型"] == "待复核" for row in rows)
    lines.extend([
        "",
        "### 标品/非标说明",
        "",
        f"三人合计：标品{total_standard}个（{percent(total_standard, len(rows))}）、非标{total_nonstandard}个（{percent(total_nonstandard, len(rows))}）、待复核{total_review}个（{percent(total_review, len(rows))}）。",
        "",
        "非标不只包括标题明确写“定制”的商品，也包括玩具、图像主题载体、装饰礼品和娱乐情绪主导商品。标品以功能、适配、维修、收纳、工具和防护价值为主。",
    ])

    lines.extend([
        "",
        "## 二、按月开品数量",
        "",
        "| 月份 | 陈杨 | 宋凤莉 | 蒋舒 | 三人合计 |",
        "|---|---:|---:|---:|---:|",
    ])
    for month in MONTHS:
        counts = Counter(row["开发人"] for row in rows if row["创建月份"] == month)
        lines.append(f"| {month} | {counts['陈杨']} | {counts['宋凤莉']} | {counts['蒋舒']} | {sum(counts.values())} |")

    lines.extend(["", "## 三、三人的常驻品线", ""])
    for developer in DEVELOPERS:
        items = [
            (family, stats)
            for (owner, family), stats in family_stats.items()
            if owner == developer and valid_family(family) and stats["active_months"] >= 5
        ]
        items.sort(key=lambda item: (-item[1]["active_months"], -item[1]["total_skus"], item[0]))
        lines.append(f"### {developer}")
        lines.append("")
        lines.append("| 产品族 | 出现月份数 | SKU总数 | 首次月份 | 最近月份 |")
        lines.append("|---|---:|---:|---|---|")
        for family, stats in items[:20]:
            lines.append(
                f"| {family} | {stats['active_months']} | {stats['total_skus']} | {stats['months'][0]} | {stats['months'][-1]} |"
            )
        if not items:
            lines.append("| 暂无 | 0 | 0 | - | - |")
        lines.append("")

    lines.extend(["## 四、季节性开发分布", ""])
    for developer in DEVELOPERS:
        selected = [row for row in rows if row["开发人"] == developer]
        seasons = Counter(
            tag
            for row in selected
            for tag in str(row["季节性标签"]).split("、")
            if tag
        )
        text = "、".join(f"{name}{count}个" for name, count in seasons.most_common()) or "未识别到明确季节词"
        lines.append(f"- {developer}：{text}。")

    shared_buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if valid_family(row["产品族"]):
            shared_buckets[row["产品族"]].append(row)
    shared = []
    for family, items in shared_buckets.items():
        owners = {row["开发人"] for row in items}
        if len(owners) == 3:
            shared.append((family, len(items), owners))
    shared.sort(key=lambda item: (-item[1], item[0]))

    lines.extend([
        "",
        "## 五、三人共同的团队基础品线",
        "",
        "| 产品族 | 三人SKU合计 | 说明 |",
        "|---|---:|---|",
    ])
    for family, count, _ in shared[:20]:
        lines.append(f"| {family} | {count} | 三位核心开发人均有创建记录 |")
    if not shared:
        lines.append("| 暂无 | 0 | - |")

    april_jiang = [
        row for row in rows
        if row["创建月份"] == "2025-04" and row["开发人"] == "蒋舒"
    ]
    beach_towels = sum("沙滩巾" in str(row["产品名称"]) for row in april_jiang)
    diamond_paintings = sum("钻石画" in str(row["产品名称"]) for row in april_jiang)
    lines.extend([
        "",
        "## 六、目前可确认的第一层结论",
        "",
        f"1. 蒋舒是开发主管，也是唯一覆盖全部15个月的人。2025年4月的916个SKU中，沙滩巾{beach_towels}个、钻石画{diamond_paintings}个，说明早期使用了明显的载体批量化和季节主题矩阵；该月不能和后续普通月份直接比较。",
        "2. 陈杨从2025年6月开始出现记录，2026年6月达到312个SKU。其常驻基础逐步集中到钥匙扣、贺卡、帆布袋、3D打印、亚克力挂牌和化妆包。",
        "3. 宋凤莉从2025年7月开始出现记录，15个月总量最高；钥匙扣、化妆包、贺卡、贴纸、蛋糕装饰和挂饰的跨月连续性最明显。",
        "4. 三人的共同基础不是单一主题，而是一组可反复换图、换主题、做套装的载体：钥匙扣、贺卡、帆布袋、化妆包、手链、3D打印、贴纸等。",
        "5. 季节方向存在明显分工：蒋舒早期高度集中于夏季沙滩巾、圣帕特里克和复活节；陈杨、宋凤莉后续更分散地覆盖圣诞、万圣、复活节、情人节和礼品场景。",
        "6. 这些结论只说明开发端持续投入什么。是否值得保留，必须进入第二层比较FBA上架率、上架速度和季节前完成率。",
        "",
        "## 七、逐月入口",
        "",
    ])
    for month in MONTHS:
        lines.append(f"- [{month_display(month)}](./{month_folder(month)}/00_三位核心开发人本月开品分析.md)")
    lines.extend([
        "",
        "## 八、口径提醒",
        "",
        "1. 常驻品线是开发端持续创建，不等于亚马逊端持续盈利。",
        "2. 季节性依据产品名称中的明确词识别，开发月份通常早于实际销售季节。",
        "3. 新增品线分为首次进入的主方向和首次出现的产品族；同一主方向下换载体仍可能属于新增产品族。",
        "4. 2025年4月是观察窗口起点，因此该月的“新增”不能等同于公司历史首次开发。",
        "5. 下一步应把常驻、季节和新增品线分别接入第二层，比较运营上架率与上架速度。",
        "",
    ])
    target.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    rows = load_rows()
    family_stats = developer_family_stats(rows)
    direction_first = first_direction_months(rows)

    for month in MONTHS:
        selected = [row for row in rows if row["创建月份"] == month]
        summaries = {
            developer: month_developer_summary(selected, developer, family_stats)
            for developer in DEVELOPERS
        }
        folder = DATA_ROOT / month_folder(month)
        folder.mkdir(parents=True, exist_ok=True)
        write_month_report(month, summaries, family_stats, folder / "00_三位核心开发人本月开品分析.md")
        for index, developer in enumerate(DEVELOPERS, start=1):
            write_individual_report(
                month,
                developer,
                summaries[developer],
                family_stats,
                direction_first,
                folder / f"0{index}_{developer}_{month_display(month)}开品分析.md",
            )

    write_trend_report(rows, family_stats, DATA_ROOT / "00_三位核心开发人15个月趋势总览.md")
    print(f"已生成15个月分析：{DATA_ROOT}")


if __name__ == "__main__":
    main()
