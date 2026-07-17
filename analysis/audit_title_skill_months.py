from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from build_title_skill_trial import load_month_rows


ROOT = Path(__file__).resolve().parents[1]
FIRST_VERSION_ROOT = (
    ROOT / "产品数据" / "思考理实团队的开品方向" / "第一版"
)
SOURCE_CSV = (
    FIRST_VERSION_ROOT
    / "第一层_核心开发人开品分析_陈杨宋凤莉蒋舒"
    / "00_三人开品基础明细_2025-04至2026-06.csv"
)
ANALYSIS_ROOT = FIRST_VERSION_ROOT / "第一层开发skll提取"
MONTH_ROOT = ANALYSIS_ROOT / "05_逐标题分析基础"
INDEX_CSV = MONTH_ROOT / "00_商品标题分析总索引.csv"
DATA_ROOT = ANALYSIS_ROOT / "06_数据处理底表"
SKILL_CSV = DATA_ROOT / "00_开发Skill总表.csv"
LEDGER_CSV = DATA_ROOT / "00_开发Skill证据账本.csv"
COLLECTION_ROOT = FIRST_VERSION_ROOT / "持续更新团队开品skll集合"
REPORT_PATH = ANALYSIS_ROOT / "00_全月份AI审核总结_2025-07至2026-06.md"

MONTHS = (
    "2025-07",
    "2025-08",
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06",
)
VAGUE_BODIES = {"其他商品", "小商品", "杂项商品", "待确认产品本体"}


def read_csv(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def month_folder(month: str) -> str:
    year, month_value = month.split("-")
    return f"{year[-2:]}年{int(month_value)}月"


def month_prefix(month: str) -> str:
    year, month_value = month.split("-")
    return f"{year}年{int(month_value):02d}月"


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def audit() -> dict[str, Any]:
    index_rows = read_csv(INDEX_CSV)
    skill_rows = read_csv(SKILL_CSV)
    ledger_rows = read_csv(LEDGER_CSV)

    index_by_month: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in index_rows:
        index_by_month[str(row.get("创建月份") or "")].append(row)

    source_counts = {
        month: len(load_month_rows(month, SOURCE_CSV)) for month in MONTHS
    }
    output_counts = {month: len(index_by_month[month]) for month in MONTHS}
    assert_true(
        source_counts == output_counts,
        f"月份标题覆盖不一致：source={source_counts}, output={output_counts}",
    )
    assert_true(
        set(index_by_month) == set(MONTHS),
        f"逐标题总索引月份不完整：{sorted(index_by_month)}",
    )

    valid_rows = [row for row in index_rows if row.get("是否待复核") != "是"]
    pending_rows = [row for row in index_rows if row.get("是否待复核") == "是"]
    for row in valid_rows:
        assert_true(bool(row.get("SKU")), f"有效记录缺少SKU：{row}")
        assert_true(bool(row.get("原始完整标题")), f"有效记录缺少标题：{row}")
        assert_true(bool(row.get("产品方案ID")), f"有效记录缺少产品方案ID：{row}")
        direction = str(row.get("方向Skill原子") or "")
        assert_true(direction and direction != "待确认开发方向", f"有效记录方向缺失：{row}")
        assert_true("、" not in direction, f"商品方向不是1对1：{row}")
        assert_true(
            str(row.get("产品本体") or "") not in VAGUE_BODIES,
            f"有效记录使用空泛产品本体：{row}",
        )

    skill_ids = {str(row.get("Skill编号") or "") for row in skill_rows}
    assert_true(all(row.get("Skill编号") in skill_ids for row in ledger_rows), "证据账本存在未知Skill编号")

    pd_evidence: defaultdict[tuple[str, str], set[str]] = defaultdict(set)
    ledger_scheme_keys: set[tuple[str, str]] = set()
    for row in ledger_rows:
        key = (str(row.get("证据月份") or ""), str(row.get("产品方案ID") or ""))
        ledger_scheme_keys.add(key)
        skill_id = str(row.get("Skill编号") or "")
        if skill_id.startswith("SK-PD-"):
            pd_evidence[key].add(skill_id)

    valid_scheme_keys = {
        (str(row.get("创建月份") or ""), str(row.get("产品方案ID") or ""))
        for row in valid_rows
    }
    pending_scheme_keys = {
        (str(row.get("创建月份") or ""), str(row.get("产品方案ID") or ""))
        for row in pending_rows
    }
    assert_true(
        all(len(pd_evidence[key]) == 1 for key in valid_scheme_keys),
        "存在有效产品方案未映射或映射多个商品方向Skill",
    )
    assert_true(
        not (pending_scheme_keys & ledger_scheme_keys),
        "待复核产品方案进入了正式Skill证据账本",
    )

    for month in MONTHS:
        folder = MONTH_ROOT / month_folder(month)
        prefix = month_prefix(month)
        required = (
            folder / f"{prefix}_三位核心开发人_逐标题开发分析.xlsx",
            folder / f"{prefix}_三位核心开发人_逐标题开发分析.csv",
            folder / f"{prefix}_开发Skill提取质量审核.md",
            COLLECTION_ROOT
            / "05_证据演化"
            / "01_月度演化"
            / f"{prefix}_Skill变化记录.md",
        )
        for path in required:
            assert_true(path.exists(), f"缺少月份产物：{path}")

    pending_by_month = Counter(str(row.get("创建月份") or "") for row in pending_rows)
    valid_schemes_by_month = Counter(month for month, _ in valid_scheme_keys)
    return {
        "index_rows": index_rows,
        "valid_rows": valid_rows,
        "pending_rows": pending_rows,
        "skill_rows": skill_rows,
        "ledger_rows": ledger_rows,
        "source_counts": source_counts,
        "valid_schemes_by_month": valid_schemes_by_month,
        "pending_by_month": pending_by_month,
        "valid_scheme_count": len(valid_scheme_keys),
    }


def write_report(result: dict[str, Any], target: Path = REPORT_PATH) -> None:
    lines = [
        "# 全月份AI审核总结（2025-07至2026-06）",
        "",
        "> 本文件验证剩余月份是否完成逐标题审核并进入正式团队开品Skill证据。第一层只证明开发方向和方法，不证明上架、销量或盈利。",
        "",
        "## 一、结论",
        "",
        f"- 已审核月份：{len(MONTHS)}个月，覆盖2025年7月至2026年6月。",
        f"- 原始有效标题与逐标题分析：{len(result['index_rows'])}条，覆盖率100%。",
        f"- 已进入正式Skill证据的标题：{len(result['valid_rows'])}条。",
        f"- 已进入正式Skill证据的月度产品方案：{result['valid_scheme_count']}个。",
        f"- 保留待复核/非商品记录：{len(result['pending_rows'])}条，均未进入正式Skill证据。",
        f"- 当前统一Skill：{len(result['skill_rows'])}项；证据映射：{len(result['ledger_rows'])}条。",
        "",
        "## 二、逐月覆盖",
        "",
        "| 月份 | 原始/分析标题 | 正式产品方案 | 待复核/非商品记录 | 月度演化 |",
        "|---|---:|---:|---:|---|",
    ]
    for month in MONTHS:
        evolution = (
            "../持续更新团队开品skll集合/05_证据演化/01_月度演化/"
            f"{month_prefix(month)}_Skill变化记录.md"
        )
        lines.append(
            f"| {month} | {result['source_counts'][month]} | "
            f"{result['valid_schemes_by_month'][month]} | "
            f"{result['pending_by_month'][month]} | [打开]({evolution}) |"
        )

    lines.extend(
        [
            "",
            "## 三、强制检查结果",
            "",
            "- 原始有效标题数等于逐标题分析数：通过。",
            "- SKU、完整标题和产品方案ID可追溯：通过。",
            "- 每个有效产品方案只映射一个商品方向Skill：通过。",
            "- 非待复核记录使用空泛产品本体：0条。",
            "- 待复核记录进入正式证据账本：0条。",
            "- Skill编号全部存在于统一Skill总表：通过。",
            "- 12个月XLSX、CSV、质量审核和月度演化文件完整：通过。",
            "",
            "## 四、未强行学习的记录",
            "",
            "以下记录只有供应商/GPSR标签、包装信息、纯颜色编号或无法确认产品本体。保留它们是为了追溯，但不能把它们伪装成团队开发能力。",
            "",
            "| 月份 | 开发人 | SKU | 原始标题 | 原因 |",
            "|---|---|---|---|---|",
        ]
    )
    for row in result["pending_rows"]:
        title = str(row.get("原始完整标题") or "").replace("|", "\\|")
        reason = str(row.get("待复核原因") or "").replace("|", "\\|")
        lines.append(
            f"| {row.get('创建月份', '')} | {row.get('开发人', '')} | "
            f"{row.get('SKU', '')} | {title} | {reason} |"
        )

    lines.extend(
        [
            "",
            "## 五、正式使用入口",
            "",
            "1. AI审核从[持续更新团队开品Skill集合导航](../持续更新团队开品skll集合/00_持续更新团队开品Skill集合导航.md)进入。",
            "2. 精确追溯使用[开发Skill证据账本](06_数据处理底表/00_开发Skill证据账本.csv)。",
            "3. 搜索历史商品使用[商品标题分析总索引](05_逐标题分析基础/00_商品标题分析总索引.csv)。",
            "4. Codex项目级入口为`.agents/skills/team-product-development-audit/SKILL.md`。",
            "",
        ]
    )
    target.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    result = audit()
    write_report(result)
    print(f"全月份AI审核通过：{REPORT_PATH}")
    print(f"标题={len(result['index_rows'])}")
    print(f"正式标题={len(result['valid_rows'])}")
    print(f"待复核={len(result['pending_rows'])}")
    print(f"正式月度产品方案={result['valid_scheme_count']}")


if __name__ == "__main__":
    main()
