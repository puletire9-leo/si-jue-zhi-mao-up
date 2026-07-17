from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORK_ROOT = ROOT / "analysis" / "skill_review_work" / "2025-10"
OUTPUT_PATH = (
    ROOT
    / "产品数据"
    / "思考理实团队的开品方向"
    / "第一版"
    / "第一层开发skll提取"
    / "07_逐月深审"
    / "25年10月"
    / "2025年10月_逐标题深审修正.csv"
)
PART_FILES = (
    WORK_ROOT / "part_001_102_corrections.csv",
    WORK_ROOT / "part_103_204_corrections.csv",
    WORK_ROOT / "part_205_306_corrections.csv",
)
OUTPUT_HEADERS = (
    "创建月份",
    "行号",
    "SKU",
    "建议产品本体",
    "建议方向Skill原子",
    "建议商品标准化类型",
    "建议是否待复核",
    "建议待复核原因",
    "风险提示补充",
    "修正理由",
    "主审裁决说明",
)


# 子智能体建议中的少数边界，由主审依据“标题本体和主要购买目的优先”统一裁决。
MAIN_DECISIONS: dict[str, dict[str, str]] = {
    "2560331": {
        "建议产品本体": "汽车后视镜装饰贴纸",
        "建议方向Skill原子": "家居装饰商品开发",
        "建议商品标准化类型": "非标",
        "建议是否待复核": "否",
        "风险提示补充": "汽车装饰贴图案/商标复核",
        "主审裁决说明": "成品装饰贴不是消费者DIY材料，也不是汽车功能配件；按装饰方向处理。",
    },
    "2550377": {
        "建议产品本体": "Q版角色收藏人偶",
        "建议方向Skill原子": "玩具娱乐商品开发",
        "建议商品标准化类型": "非标",
        "建议是否待复核": "否",
        "风险提示补充": "鬼灭之刃IP/授权复核",
        "主审裁决说明": "“qq人”在商品语境中可识别为Q版角色人偶；IP风险单列，不因风险退出第一层证据。",
    },
    "2550405": {
        "建议商品标准化类型": "标品",
        "主审裁决说明": "饼干模具的购买主因是烘焙成型功能，爱心造型属于主题差异化。",
    },
    "2550421": {
        "建议商品标准化类型": "标品",
        "风险提示补充": "食品接触材质与目标站点合规复核",
        "主审裁决说明": "吸管是功能型餐饮用品；情人节仅是主题和售卖场景。",
    },
    "2255168": {
        "建议产品本体": "充气篝火派对布景",
        "建议方向Skill原子": "派对庆典商品开发",
        "建议商品标准化类型": "非标",
        "建议是否待复核": "否",
        "风险提示补充": "材质、阻燃和儿童接触风险复核",
        "主审裁决说明": "标题已经明确商品本体“充气篝火”，按派对布景处理；用途不明不等于本体不明。",
    },
    "2560387": {
        "建议是否待复核": "否",
        "风险提示补充": "JPC-12/PAC-12设备类型、接口和规格适配复核",
        "主审裁决说明": "标题明确为专用适配配件，可进入功能维修方向；未知设备类别作为适配风险，不是标题分类缺失。",
    },
}


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def merge() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen_skus: set[str] = set()
    for path in PART_FILES:
        if not path.exists():
            raise FileNotFoundError(f"缺少分段审查修正文件：{path}")
        for row in read_rows(path):
            sku = str(row.get("SKU") or "").strip()
            if not sku:
                raise ValueError(f"修正行缺少SKU：{path} {row}")
            if sku in seen_skus:
                raise ValueError(f"多个分段重复修正SKU：{sku}")
            seen_skus.add(sku)
            merged = {header: "" for header in OUTPUT_HEADERS}
            merged.update(row)
            merged["创建月份"] = "2025-10"
            for field, value in MAIN_DECISIONS.get(sku, {}).items():
                if field == "风险提示补充" and merged.get(field) and value:
                    merged[field] = f"{merged[field]}；{value}"
                else:
                    merged[field] = value
            rows.append(merged)
    return sorted(rows, key=lambda item: int(item["行号"]))


def validate(rows: list[dict[str, str]]) -> None:
    if len(rows) != 159:
        raise ValueError(f"10月深审修正应为159条，实际为{len(rows)}条")
    if len({row["行号"] for row in rows}) != len(rows):
        raise ValueError("10月深审修正存在重复行号")
    pending_rows = [row for row in rows if row["建议是否待复核"] == "是"]
    expected_pending_skus = {
        "2255155", "2255157", "2255158", "2560353", "2550408",
        "2550411", "2255171", "2600286",
        "2600287", "2600292", "2600293",
    }
    actual_pending_skus = {row["SKU"] for row in pending_rows}
    if actual_pending_skus != expected_pending_skus:
        raise ValueError(
            f"待复核SKU不符合主审结论：{sorted(actual_pending_skus)}"
        )


def write_rows(rows: list[dict[str, str]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT_PATH.with_name(f"{OUTPUT_PATH.stem}.tmp{OUTPUT_PATH.suffix}")
    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_HEADERS)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(OUTPUT_PATH)


def main() -> None:
    rows = merge()
    validate(rows)
    write_rows(rows)
    pending = sum(row["建议是否待复核"] == "是" for row in rows)
    print(f"已生成10月主审修正表：{OUTPUT_PATH}")
    print(f"修正={len(rows)}，待复核={pending}")


if __name__ == "__main__":
    main()
