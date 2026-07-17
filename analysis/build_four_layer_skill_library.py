from __future__ import annotations

import argparse
import csv
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = (
    ROOT
    / "产品数据"
    / "思考理实团队的开品方向"
    / "第一版"
    / "第一层开发skll提取"
)
SKILL_COLLECTION_ROOT = (
    OUTPUT_ROOT.parent
    / "持续更新团队开品skll集合"
)
TITLE_INDEX_CSV = (
    OUTPUT_ROOT
    / "05_逐标题分析基础"
    / "00_商品标题分析总索引.csv"
)
DEVELOPERS = ("陈杨", "蒋舒", "宋凤莉")
LAYER_ORDER = ("商品方向", "场景主题", "开发方法", "组合打法")


@dataclass(frozen=True)
class SkillSpec:
    skill_id: str
    name: str
    layer: str
    definition: str
    boundary: str
    next_validation: str


SKILL_SPECS = [
    SkillSpec("SK-PD-001", "首饰与身体饰品开发", "商品方向", "开发项链、手链、耳饰、肚脐饰品、腰链等以身体装饰和穿搭价值为主的商品。", "不包含纯功能型穿戴固定件，也不把所有服装和发饰归入本方向。", "后续月份验证不同饰品产品方案是否持续出现。"),
    SkillSpec("SK-PD-002", "发饰、服装与造型配件开发", "商品方向", "开发发夹、发箍、服装、帽饰、面具、翅膀和角色造型配件。", "不包含项链、耳钉等身体首饰，也不包含纯功能维修配件。", "验证脱离万圣节后能否跨月复现。"),
    SkillSpec("SK-PD-003", "功能维修与替换配件开发", "商品方向", "围绕设备、家居、车辆或用品的维修、替换、密封、连接和功能恢复开发配件。", "工具本体归入作业工具；只有装饰作用的配件不归入。", "验证适配准确性、上架率和长尾销量。"),
    SkillSpec("SK-PD-004", "安装、拆卸与作业工具开发", "商品方向", "开发用于安装、拆卸、测量、切割、打磨或维修作业的工具及工具套件。", "美甲、玩具等专用工具优先归其真实用途，不能只凭工具二字归入。", "继续清理通用工具与垂直场景工具的边界。"),
    SkillSpec("SK-PD-005", "汽车与骑行功能配件开发", "商品方向", "开发汽车、自行车及骑行相关的适配、维修、替换和使用辅助商品。", "通用维修件若没有车辆或骑行语义，不归入本方向。", "验证车型、规格和设备适配质量。"),
    SkillSpec("SK-PD-006", "玩具、解压与收藏商品开发", "商品方向", "开发玩具、解压、互动、3D打印、微景观和收藏展示类商品。", "功能工具、宠物用品和纯装饰品不能只因外形可爱而归入。", "验证礼品季销量、留存和淘汰率。"),
    SkillSpec("SK-PD-007", "DIY手工材料与工具开发", "商品方向", "开发钻石画、贴纸、绘画、点钻、材料包和手工创作辅助商品。", "普通维修工具和完成品装饰不归入DIY。", "验证同载体款式矩阵是否跨月延续。"),
    SkillSpec("SK-PD-008", "美妆个护工具与用品开发", "商品方向", "开发美甲、美容、足部护理、洗护和身体装饰辅助用品。", "纯首饰归入身体饰品；医疗功效商品需要单独风险复核。", "验证人群细分是否带来稳定上架和经营结果。"),
    SkillSpec("SK-PD-009", "派对与装饰商品开发", "商品方向", "开发生日、庆典、家居装饰、挂饰、蛋糕装饰和场景布置商品。", "万圣节主题另在场景主题层记录，避免重复定义。", "验证常驻派对与节日派对产品的差异。"),
    SkillSpec("SK-PD-010", "宠物用品开发", "商品方向", "开发宠物训练、护理、互动和宠物造型商品。", "猫眼美甲、动物图案等非宠物用途不得误归。", "增加月份证据并区分功能品与装扮品。"),
    SkillSpec("SK-PD-011", "花园、户外与运动用品开发", "商品方向", "开发园艺、庭院、露营、钓鱼、球类和户外活动用品。", "汽车骑行单独归类；普通家居用品不因出现户外词就归入。", "观察春夏季节延续和上架窗口。"),
    SkillSpec("SK-PD-012", "家居、厨房与电子功能用品开发", "商品方向", "开发家居收纳、防护、厨房餐饮和小型电子测量功能用品。", "当前是低量集合，后续证据充足时继续拆分。", "等待更多月份后判断是否拆分。"),
    SkillSpec("SK-PD-013", "健康护理与康复辅助用品开发", "商品方向", "开发药盒、身体矫正、睡眠辅助、清洁护理和轻康复辅助用品。", "美妆造型用品归入美妆个护；涉及医疗功效的商品必须单独合规复核。", "验证真实使用频率、合规风险、留存和利润。"),
    SkillSpec("SK-PD-014", "电子与手机功能配件开发", "商品方向", "开发手机摄影、LED工作照明、开关灯座和轻型电子功能配件。", "纯汽车电子件仍归汽车骑行；电子测量用品可以同时保留测量功能证据。", "验证带电履约、适配准确性和退货风险。"),
    SkillSpec("SK-PD-015", "包袋与出行收纳用品开发", "商品方向", "开发护照夹、随身小包、挂绳和出行携带整理用品。", "家庭大型收纳归家居收纳；纯首饰挂件不归入。", "验证随身携带需求、材质质量和常驻销售能力。"),
    SkillSpec("SK-PD-016", "阅读文具与学习用品开发", "商品方向", "开发学习计划本、阅读辅助、知识卡片、立体书和记录用品。", "纯DIY材料归手工创作；仅有装饰图案的礼品需同时记录主题属性。", "验证内容主题、语言版本、版权风险和礼品季表现。"),
    SkillSpec("SK-ST-001", "万圣节季节场景开发", "场景主题", "围绕万圣节的角色、装饰、派对和礼品需求提前组织开发。", "只把标题或组合上下文明确指向万圣节的产品计入。", "检查7至8月上架和9至10月销售承接。"),
    SkillSpec("SK-ST-002", "生日、派对与庆典场景开发", "场景主题", "围绕生日、婚礼、周岁、蛋糕和聚会布置开发商品。", "普通饰品不能仅因可送礼就自动计入。", "验证常驻派对需求和节日庆典需求。"),
    SkillSpec("SK-ST-003", "维修、替换与安装场景开发", "场景主题", "围绕损耗替换、设备维修、密封连接和安装作业需求开发商品。", "只有工具字样但没有维修或安装用途的商品不计入。", "验证适配准确性和长尾经营价值。"),
    SkillSpec("SK-ST-004", "汽车与骑行使用场景开发", "场景主题", "围绕车主、骑行用户、车辆维护和骑行安装场景开发商品。", "只有汽车图案的非功能装饰需单独判断。", "验证车型和规格覆盖是否有效。"),
    SkillSpec("SK-ST-005", "DIY手工与创作场景开发", "场景主题", "围绕家庭手工、点钻、绘画和创作桌面场景开发商品。", "完成品玩具和普通工具不计入。", "观察学校假期、礼品季和跨月延续。"),
    SkillSpec("SK-ST-006", "日常穿搭、造型与礼品场景开发", "场景主题", "围绕日常穿搭、身体装饰、派对造型和礼品购买需求开发商品。", "纯功能穿戴件若不以造型价值为主，不作为核心证据。", "区分日常常驻款和节日造型款。"),
    SkillSpec("SK-ST-007", "家庭护理与家居日用场景开发", "场景主题", "围绕家庭护理、浴室、厨房、收纳、防护和日常测量场景开发商品。", "医疗功效和高风险产品需要单独验证。", "检查常驻销售与使用频率。"),
    SkillSpec("SK-ST-008", "户外、花园与运动场景开发", "场景主题", "围绕园艺、庭院、露营、钓鱼和运动使用场景开发商品。", "汽车骑行场景单独记录。", "验证春夏季节性和上架提前量。"),
    SkillSpec("SK-ST-009", "圣诞节季节场景开发", "场景主题", "围绕圣诞节和降临节的装饰、服饰、玩具、日历、礼品及家庭庆祝需求提前组织开发。", "只有标题或组合上下文明确信号指向圣诞节、Christmas、降临节或Advent的产品才计入；普通冬季商品不自动计入。", "检查开发月份、FBA上架窗口、圣诞销售承接和节后淘汰。"),
    SkillSpec("SK-DM-001", "套装与多组件组合开发", "开发方法", "将多个组件、数量或功能件组织成一个可销售方案。", "组件不能重复算产品方案。", "比较套装与单品的上架率、利润和留存。"),
    SkillSpec("SK-DM-002", "颜色、尺寸与规格变体开发", "开发方法", "通过颜色、尺寸、数量、规格或款式形成同产品方案的变体矩阵。", "变体SKU数量不等于独立开发方案数量。", "验证变体是否扩大有效需求。"),
    SkillSpec("SK-DM-003", "主题元素差异化开发", "开发方法", "用节日、动物、花卉、角色和审美元素形成商品差异。", "纯颜色规格变化不属于主题元素差异化。", "验证主题是否改善销售和利润。"),
    SkillSpec("SK-DM-004", "人群与使用场景细分开发", "开发方法", "针对儿童、车主、手工爱好者、家庭用户等人群或场景细分产品。", "只有推断而无实际产品差异时不能作为强证据。", "验证细分是否形成不同经营表现。"),
    SkillSpec("SK-DM-005", "季节主题提前布局", "开发方法", "在节日或季节销售窗口之前完成产品创建和准备。", "创建时间早不等于FBA上架及时。", "连接第二层FBA首次可售时间验证。"),
    SkillSpec("SK-DM-006", "维修替换需求开发", "开发方法", "从损耗、故障、替换和维修需求中寻找产品机会。", "普通工具若没有替换或维修需求，不计入。", "验证需求稳定性、适配和长期利润。"),
    SkillSpec("SK-DM-007", "设备、车型与规格适配开发", "开发方法", "围绕品牌设备、车型、接口和规格匹配开发产品。", "没有明确适配对象的通用商品不计入。", "验证退货风险和页面表达准确性。"),
    SkillSpec("SK-DM-008", "组合组件复用", "开发方法", "把同一组件复用于不同组合主SKU或套装方案。", "必须能追溯组合主SKU。", "验证是否降低开发成本并提高组合效率。"),
    SkillSpec("SK-CB-001", "万圣节×服装造型×套装主题打法", "组合打法", "把万圣节场景、服装发饰道具和套装或主题差异化组合。", "普通万圣节装饰或普通服饰不自动计入。", "检查上架窗口、季节销售和节后淘汰。"),
    SkillSpec("SK-CB-002", "身体饰品×多组件×规格款式打法", "组合打法", "围绕首饰和身体饰品，通过组件组合、颜色规格和款式形成方案。", "单一首饰或功能穿戴件不作为完整打法。", "验证组合SKU的利润、退货和留存。"),
    SkillSpec("SK-CB-003", "功能维修×工具配件×套件化打法", "组合打法", "围绕维修替换需求，把工具、配件和多组件套件组合起来。", "只有套装但没有维修用途的商品不计入。", "验证功能准确性、适配和长尾利润。"),
    SkillSpec("SK-CB-004", "汽车骑行×适配替换×多件组合打法", "组合打法", "围绕汽车骑行场景，以适配、替换需求和多件组合开发产品。", "纯汽车图案和非功能饰品不计入。", "验证车型覆盖和经营周期。"),
    SkillSpec("SK-CB-005", "DIY创作×同载体×主题规格矩阵打法", "组合打法", "围绕DIY手工载体，通过主题、颜色、规格和套装形成矩阵。", "不同产品随机并列不属于同载体矩阵。", "观察跨月延续和上架转化。"),
    SkillSpec("SK-CB-006", "玩具收藏×主题造型×多件组合打法", "组合打法", "围绕玩具、解压和收藏品，通过主题造型与多件数组合开发。", "功能用品带动物图案不计入。", "验证礼品季、留存和淘汰。"),
    SkillSpec("SK-CB-007", "美妆个护×工具套装×人群细分打法", "组合打法", "围绕美妆个护需求，以工具套装和目标人群细分形成方案。", "单一基础个护用品不作为完整打法。", "验证人群细分、合规和利润。"),
]
SKILL_BY_ID = {spec.skill_id: spec for spec in SKILL_SPECS}
PRODUCT_DIRECTION_BY_ATOM = {
    "功能维修配件开发": "SK-PD-003",
    "通用工具开发": "SK-PD-004",
    "汽车功能配件开发": "SK-PD-005",
    "骑行功能配件开发": "SK-PD-005",
    "玩具娱乐商品开发": "SK-PD-006",
    "DIY手工商品开发": "SK-PD-007",
    "美妆个护功能商品开发": "SK-PD-008",
    "美妆装饰商品开发": "SK-PD-008",
    "派对庆典商品开发": "SK-PD-009",
    "家居装饰商品开发": "SK-PD-009",
    "宠物用品开发": "SK-PD-010",
    "花园园艺功能商品开发": "SK-PD-011",
    "户外运动商品开发": "SK-PD-011",
    "家居收纳与防护商品开发": "SK-PD-012",
    "厨房餐饮功能商品开发": "SK-PD-012",
    "电子测量功能商品开发": "SK-PD-012",
    "健康护理与康复辅助开发": "SK-PD-013",
    "电子与手机功能配件开发": "SK-PD-014",
    "包袋与出行收纳开发": "SK-PD-015",
    "阅读文具与学习用品开发": "SK-PD-016",
}
NEW_SKILL_BOUNDARY_COMPARISONS = {
    "SK-PD-015": (
        "SK-PD-012",
        "SK-PD-015强调随身携带、旅行证件和小型出行收纳；SK-PD-012强调家庭、厨房和固定空间内的收纳防护。",
    ),
    "SK-PD-016": (
        "SK-PD-007",
        "SK-PD-016以阅读、记录、学习内容和知识传递为核心；SK-PD-007以制作、绘画、点钻和手工创作为核心。",
    ),
    "SK-ST-009": (
        "SK-ST-001",
        "SK-ST-009只覆盖圣诞节与降临节需求；SK-ST-001只覆盖万圣节角色、装饰和派对需求，两者销售窗口、主题元素和节后处理不同。",
    ),
}


def contains_any(text: str, keywords: Iterable[str]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def scheme_text(rows: list[dict[str, Any]]) -> str:
    fields = (
        "原始完整标题", "产品本体", "产品族", "核心功能", "使用场景",
        "适用人群", "适配对象", "主题元素", "方向Skill原子", "开发方法原子",
    )
    return " | ".join(str(row.get(field) or "") for row in rows for field in fields)


def select_primary_product_direction_skill(
    title_text: str,
    direction_text: str,
) -> str | None:
    atoms = [
        atom.strip()
        for atom in direction_text.replace("|", "、").split("、")
        if atom.strip() and atom.strip() != "待确认开发方向"
    ]
    unique_atoms = list(dict.fromkeys(atoms))
    explicit_rules: tuple[tuple[str, str, tuple[str, ...]], ...] = (
        ("宠物用品开发", "SK-PD-010", ("宠物", "猫咪", "狗狗", "猫狗", "犬用", "宠物美容", "猫毛收纳", "鱼类休息室")),
        ("汽车功能配件开发", "SK-PD-005", ("汽车", "车载", "挡风玻璃", "宝马", "奔驰", "奥迪", "摩托车", "换挡", "排档")),
        ("骑行功能配件开发", "SK-PD-005", ("自行车", "单车", "骑行")),
        ("健康护理与康复辅助开发", "SK-PD-013", ("药盒", "洗眼杯", "矫正", "康复", "经络刷")),
        ("美妆个护功能商品开发", "SK-PD-008", ("美甲", "指甲", "美容", "推剪", "理发", "脚锉", "磨脚")),
        ("DIY手工商品开发", "SK-PD-007", ("DIY", "diy", "钻石画", "刺绣", "手工", "串珠")),
        ("玩具娱乐商品开发", "SK-PD-006", ("玩具", "解压", "公仔", "毛绒", "3D打印", "3d打印")),
    )
    for atom, skill_id, keywords in explicit_rules:
        if atom in unique_atoms and contains_any(title_text, keywords):
            return skill_id
    if "服饰饰品开发" in unique_atoms:
        if contains_any(
            title_text,
            ("项链", "手链", "耳环", "耳钉", "耳骨夹", "肚脐", "腰链", "腰饰", "胸针", "手镯", "戒指", "指环", "首饰"),
        ):
            return "SK-PD-001"
        return "SK-PD-002"
    if "服饰功能配件开发" in unique_atoms:
        return "SK-PD-002"
    mapped = [
        PRODUCT_DIRECTION_BY_ATOM[atom]
        for atom in unique_atoms
        if atom in PRODUCT_DIRECTION_BY_ATOM
    ]
    if mapped:
        return mapped[0]
    return None


def classify_scheme_skills(rows: list[dict[str, Any]]) -> set[str]:
    text = scheme_text(rows)
    title_text = " | ".join(
        str(row.get(field) or "")
        for row in rows
        for field in ("原始完整标题", "产品本体", "产品族", "核心功能")
    )
    direction_text = " | ".join(
        str(row.get("方向Skill原子") or "") for row in rows
    )
    method_text = " | ".join(
        str(row.get("开发方法原子") or "") for row in rows
    )
    result: set[str] = set()
    jewellery = contains_any(title_text, ("项链", "手链", "耳环", "耳钉", "耳骨夹", "肚脐", "腰链", "腰饰", "胸针", "手镯", "戒指", "指环", "首饰"))
    styling = contains_any(title_text, ("服装", "长袍", "发夹", "发箍", "头饰", "帽", "领结", "翅膀", "面具", "鞋子装饰扣")) or "服饰功能配件开发" in direction_text
    repair = "功能维修配件开发" in direction_text or contains_any(title_text, ("密封环", "替换配件", "维修配件", "清洗泵", "连接器", "接头转换"))
    tools = "通用工具开发" in direction_text or contains_any(title_text, ("拆表耳器", "扳手", "刮刀", "套筒", "塞尺", "钻头", "锯片"))
    vehicle = contains_any(direction_text, ("汽车功能配件开发", "骑行功能配件开发"))
    toys = "玩具娱乐商品开发" in direction_text
    diy = "DIY手工商品开发" in direction_text
    beauty = contains_any(direction_text, ("美妆个护功能商品开发", "美妆装饰商品开发"))
    party = contains_any(direction_text, ("派对庆典商品开发", "家居装饰商品开发")) or contains_any(title_text, ("生日", "婚礼", "周岁", "蛋糕顶饰", "蛋糕插排", "派对装饰"))
    pet = "宠物用品开发" in direction_text
    outdoor = contains_any(direction_text, ("花园园艺功能商品开发", "户外运动商品开发"))
    home = contains_any(direction_text, ("家居收纳与防护商品开发", "厨房餐饮功能商品开发", "电子测量功能商品开发"))
    health = "健康护理与康复辅助开发" in direction_text
    electronics = "电子与手机功能配件开发" in direction_text
    travel = "包袋与出行收纳开发" in direction_text
    reading = "阅读文具与学习用品开发" in direction_text
    celebration_scene = contains_any(
        title_text,
        ("生日", "派对", "婚礼", "周岁", "庆典", "蛋糕顶饰", "蛋糕插排", "洗礼"),
    )
    christmas_scene = contains_any(
        text,
        ("圣诞", "christmas", "降临节", "advent"),
    )
    primary_product_skill = select_primary_product_direction_skill(
        title_text,
        direction_text,
    )
    if primary_product_skill:
        result.add(primary_product_skill)

    for condition, skill_id in (
        (contains_any(text, ("万圣节", "万圣")), "SK-ST-001"),
        (celebration_scene, "SK-ST-002"),
        (repair or tools or "维修替换需求开发" in method_text, "SK-ST-003"),
        (vehicle, "SK-ST-004"), (diy, "SK-ST-005"),
        (jewellery or styling or contains_any(text, ("日常穿搭", "派对造型", "礼品赠送")), "SK-ST-006"),
        (beauty or health or home or electronics or contains_any(text, ("家庭个人护理", "家庭收纳", "浴室", "厨房")), "SK-ST-007"),
        (outdoor, "SK-ST-008"),
        (christmas_scene, "SK-ST-009"),
    ):
        if condition:
            result.add(skill_id)

    method_mapping = {
        "套装组合开发": "SK-DM-001", "规格变体开发": "SK-DM-002",
        "主题元素差异化开发": "SK-DM-003", "人群场景细分开发": "SK-DM-004",
        "季节主题提前布局": "SK-DM-005", "维修替换需求开发": "SK-DM-006",
        "设备适配开发": "SK-DM-007", "组合组件复用": "SK-DM-008",
    }
    for atom, skill_id in method_mapping.items():
        if atom in method_text:
            result.add(skill_id)

    if "SK-ST-001" in result and ({"SK-PD-001", "SK-PD-002"} & result) and ({"SK-DM-001", "SK-DM-003"} & result):
        result.add("SK-CB-001")
    if "SK-PD-001" in result and ({"SK-DM-001", "SK-DM-002", "SK-DM-008"} & result):
        result.add("SK-CB-002")
    if ({"SK-PD-003", "SK-PD-004"} & result) and "SK-DM-001" in result and "SK-DM-006" in result:
        result.add("SK-CB-003")
    if "SK-PD-005" in result and ({"SK-DM-006", "SK-DM-007"} & result):
        result.add("SK-CB-004")
    if "SK-PD-007" in result and ({"SK-DM-001", "SK-DM-002", "SK-DM-003"} & result):
        result.add("SK-CB-005")
    if "SK-PD-006" in result and ({"SK-DM-001", "SK-DM-003"} & result):
        result.add("SK-CB-006")
    if "SK-PD-008" in result and "SK-DM-001" in result:
        result.add("SK-CB-007")
    return result


def determine_ownership(counts: dict[str, int]) -> tuple[str, str]:
    normalized = {developer: int(counts.get(developer, 0)) for developer in DEVELOPERS}
    total = sum(normalized.values())
    contributor = max(DEVELOPERS, key=lambda developer: normalized[developer])
    if total == 0:
        return "待确认", contributor
    if all(normalized[developer] >= 3 for developer in DEVELOPERS):
        return "团队共同", contributor
    if total >= 5 and normalized[contributor] / total >= 0.65:
        return "个人标志候选", contributor
    if sum(value > 0 for value in normalized.values()) >= 2:
        return "团队共享候选", contributor
    return "个人候选", contributor


def determine_maturity(months: set[str]) -> str:
    if len(months) >= 3:
        return "稳定"
    if len(months) == 2:
        return "形成中"
    return "候选"


def group_schemes(
    rows: list[dict[str, Any]],
) -> dict[tuple[str, str, str], list[dict[str, Any]]]:
    schemes: defaultdict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        scheme_id = str(row.get("产品方案ID") or "").strip()
        if scheme_id:
            key = (
                str(row.get("创建月份") or "").strip(),
                str(row.get("开发人") or "").strip(),
                scheme_id,
            )
            schemes[key].append(row)
    return dict(schemes)


def build_evidence(rows: list[dict[str, Any]]) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    evidence_by_skill: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    ledger: list[dict[str, Any]] = []
    for (_, _, scheme_id), scheme_rows in group_schemes(rows).items():
        eligible_rows = [
            item
            for item in scheme_rows
            if str(item.get("分析置信度") or "") != "低"
            and str(item.get("是否待复核") or "") != "是"
        ]
        if not eligible_rows:
            continue
        representative = max(
            eligible_rows,
            key=lambda item: len(str(item.get("原始完整标题") or "")),
        )
        skill_ids = sorted(classify_scheme_skills(eligible_rows))
        product_skills = [
            skill_id for skill_id in skill_ids if skill_id.startswith("SK-PD-")
        ]
        if len(product_skills) != 1:
            raise ValueError(
                f"产品方案{scheme_id}必须且只能映射一个商品方向Skill，当前为{product_skills}"
            )
        for skill_id in skill_ids:
            spec = SKILL_BY_ID[skill_id]
            evidence = {
                "Skill编号": skill_id, "Skill名称": spec.name, "Skill层级": spec.layer,
                "证据月份": representative.get("创建月份", ""), "开发人": representative.get("开发人", ""),
                "产品方案ID": scheme_id, "代表SKU": representative.get("SKU", ""),
                "代表标题": representative.get("原始完整标题", ""), "产品本体": representative.get("产品本体", ""),
                "使用场景": representative.get("使用场景", ""), "适用人群": representative.get("适用人群", ""),
                "方向Skill原子": representative.get("方向Skill原子", ""), "开发方法原子": representative.get("开发方法原子", ""),
                "证据说明": f"该产品方案符合“{spec.name}”的定义。", "来源文件": representative.get("CSV文件", ""),
            }
            evidence_by_skill[skill_id].append(evidence)
            ledger.append(evidence)
    return dict(evidence_by_skill), ledger


def summarize_skills(evidence_by_skill: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for spec in SKILL_SPECS:
        evidence = evidence_by_skill.get(spec.skill_id, [])
        if not evidence:
            continue
        counts = Counter(item["开发人"] for item in evidence)
        months = {item["证据月份"] for item in evidence if item["证据月份"]}
        ownership, contributor = determine_ownership(counts)
        summaries.append({
            "Skill编号": spec.skill_id, "Skill名称": spec.name, "Skill层级": spec.layer,
            "归属类型": ownership, "成熟状态": determine_maturity(months),
            "首次证据月份": min(months) if months else "", "最近证据月份": max(months) if months else "",
            "活跃月份数": len(months), "产品方案证据数": len(evidence),
            "陈杨方案数": counts.get("陈杨", 0), "蒋舒方案数": counts.get("蒋舒", 0),
            "宋凤莉方案数": counts.get("宋凤莉", 0), "主要贡献者": contributor,
            "定义": spec.definition, "边界": spec.boundary, "下一步验证": spec.next_validation,
        })
    return summaries


def validate_skill_library(
    summaries: list[dict[str, Any]],
    ledger: list[dict[str, Any]],
    months: list[str],
) -> None:
    skill_ids = [spec.skill_id for spec in SKILL_SPECS]
    if len(skill_ids) != len(set(skill_ids)):
        raise ValueError("Skill编号存在重复")
    skill_names = [spec.name for spec in SKILL_SPECS]
    if len(skill_names) != len(set(skill_names)):
        raise ValueError("Skill名称存在重复，禁止创建同名Skill")
    for spec in SKILL_SPECS:
        expected_prefix = {
            "商品方向": "SK-PD-",
            "场景主题": "SK-ST-",
            "开发方法": "SK-DM-",
            "组合打法": "SK-CB-",
        }[spec.layer]
        if not spec.skill_id.startswith(expected_prefix):
            raise ValueError(
                f"Skill层级与编号前缀不一致：{spec.skill_id}/{spec.layer}"
            )

    duplicates = Counter(
        (
            item["证据月份"],
            item["开发人"],
            item["产品方案ID"],
            item["Skill编号"],
        )
        for item in ledger
    )
    repeated = [key for key, count in duplicates.items() if count > 1]
    if repeated:
        raise ValueError(f"证据账本存在重复产品方案Skill证据：{repeated[:5]}")

    product_direction_counts: Counter[tuple[str, str, str]] = Counter()
    for item in ledger:
        if item["Skill层级"] == "商品方向":
            product_direction_counts[
                (
                    item["证据月份"],
                    item["开发人"],
                    item["产品方案ID"],
                )
            ] += 1
    invalid = [
        key for key, count in product_direction_counts.items() if count != 1
    ]
    if invalid:
        raise ValueError(f"商品方向层不是1对1：{invalid[:5]}")

    if months:
        first_month = months[0]
        new_skill_ids = {
            item["Skill编号"]
            for item in summaries
            if item["首次证据月份"] > first_month
        }
        missing_comparisons = sorted(
            skill_id
            for skill_id in new_skill_ids
            if skill_id not in NEW_SKILL_BOUNDARY_COMPARISONS
        )
        if missing_comparisons:
            raise ValueError(
                "新增候选Skill缺少与相似Skill的边界对比："
                + "、".join(missing_comparisons)
            )


SUMMARY_HEADERS = [
    "Skill编号", "Skill名称", "Skill层级", "归属类型", "成熟状态", "首次证据月份",
    "最近证据月份", "活跃月份数", "产品方案证据数", "陈杨方案数", "蒋舒方案数",
    "宋凤莉方案数", "主要贡献者", "定义", "边界", "下一步验证",
]
LEDGER_HEADERS = [
    "Skill编号", "Skill名称", "Skill层级", "归属类型", "成熟状态", "证据月份",
    "开发人", "产品方案ID", "代表SKU", "代表标题", "产品本体", "使用场景",
    "适用人群", "方向Skill原子", "开发方法原子", "证据说明", "来源文件",
]


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.stem}.tmp{path.suffix}")
    temporary.write_text(content.rstrip() + "\n", encoding="utf-8")
    temporary.replace(path)


def write_csv(path: Path, headers: list[str], rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.stem}.tmp{path.suffix}")
    with temporary.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def distribution(summary: dict[str, Any]) -> str:
    return (
        f"陈杨{summary['陈杨方案数']} / 蒋舒{summary['蒋舒方案数']} / "
        f"宋凤莉{summary['宋凤莉方案数']}"
    )


def observed_months(rows: list[dict[str, Any]]) -> list[str]:
    return sorted(
        {
            str(row.get("创建月份") or "").strip()
            for row in rows
            if str(row.get("创建月份") or "").strip()
        }
    )


def month_display(month: str) -> str:
    year, value = month.split("-", maxsplit=1)
    return f"{year}年{int(value)}月"


def month_record_filename(month: str) -> str:
    year, value = month.split("-", maxsplit=1)
    return f"{year}年{int(value):02d}月_Skill变化记录.md"


def layer_document(
    layer: str,
    summaries: list[dict[str, Any]],
    evidence_by_skill: dict[str, list[dict[str, Any]]],
) -> str:
    layer_summaries = [item for item in summaries if item["Skill层级"] == layer]
    presentation = {
        "商品方向": (
            "商品方向知识卡",
            "本文件是AI识别商品所属方向时使用的知识卡，不作为独立执行Skill。每个有效产品方案只能对应一个商品方向。",
        ),
        "场景主题": (
            "跨产品场景Skill",
            "本文件记录能够横跨多个商品方向的季节、节日、使用和购买场景。与商品方向高度重合的项目后续可降为标签。",
        ),
        "开发方法": (
            "核心开发方法Skill",
            "本文件记录团队怎样组织、差异化和适配产品，是当前最接近可执行开发能力的Skill层。",
        ),
        "组合打法": (
            "组合打法案例",
            "本文件记录商品方向、场景和开发方法形成的组合案例，不把机械交叉结果当作新的基础Skill。后续经营验证通过后才能升级为正式打法。",
        ),
    }[layer]
    lines = [
        f"# {presentation[0]}",
        "",
        f"> {presentation[1]}归属与成熟度分开记录；成熟度按照实际出现的有效月份数计算。",
        "",
        "| Skill编号 | Skill名称 | 归属 | 成熟度 | 产品方案 | 三人分布 | 主要贡献者 |",
        "|---|---|---|---|---:|---|---|",
    ]
    for item in layer_summaries:
        lines.append(
            f"| {item['Skill编号']} | {item['Skill名称']} | {item['归属类型']} | "
            f"{item['成熟状态']} | {item['产品方案证据数']} | {distribution(item)} | "
            f"{item['主要贡献者']} |"
        )
    for item in layer_summaries:
        evidence = evidence_by_skill[item["Skill编号"]]
        lines.extend([
            "",
            f"## {item['Skill编号']} {item['Skill名称']}",
            "",
            f"- 定义：{item['定义']}",
            f"- 边界：{item['边界']}",
            f"- 当前归属：{item['归属类型']}；主要贡献者：{item['主要贡献者']}。",
            f"- 当前证据：{item['产品方案证据数']}个产品方案；{distribution(item)}。",
            f"- 当前成熟度：{item['成熟状态']}。",
            f"- 下一步：{item['下一步验证']}",
            "- 代表商品：",
        ])
        for example in evidence[:5]:
            lines.append(
                f"  - {example['开发人']}｜{example['代表标题']}｜"
                f"{example['产品方案ID']}"
            )
    return "\n".join(lines)


def design_document() -> str:
    return """# 第一层开发Skill提取设计思考

> 本目录是第一层证据生产区，不是最终团队Skill知识库。正式Skill定义、演化和开发人画像统一沉淀到同级的“持续更新团队开品skll集合”。

## 一、为什么重建

旧版把“服饰饰品、万圣节、汽车、套装”放在同一级，混合了开发什么、在什么场景开发和怎样开发。当前保留四层证据，但不再把39项全部当作同级执行Skill。

## 二、四层结构

逐标题分析 → 产品方案去重 → 商品方向 / 场景主题 / 开发方法 / 组合打法

四层含义：

1. 商品方向知识卡：开发什么商品，作为AI检索入口。
2. 跨产品场景Skill：面向什么季节、节日、使用情境和购买需求。
3. 开发方法Skill：怎样组织套装、规格、人群、主题和适配。
4. 组合打法案例：方向、场景和方法形成的历史组合，经营验证前不升级为基础Skill。

## 三、证据单位

- 每一个标题都保留，但Skill证据使用去组件、去颜色尺寸变体后的产品方案。
- 组合组件并回组合主SKU，不重复计算开发能力。
- 同一个产品方案可以支持不同层的Skill，但同一层必须遵守清晰边界。
- 每个Skill都能反查开发人、月份、产品方案ID、SKU和完整标题。

## 四、归属与成熟度必须分开

归属描述谁主要表现出这项能力：

- 团队共同：三位开发人都有足够产品方案证据。
- 团队共享候选：至少两人出现，但尚未形成全团队共同能力。
- 个人标志候选：证据主要集中于一个开发人。
- 个人候选：目前只有一个人提供少量证据。

成熟度描述能力是否经过时间和经营验证：

- 候选：一个有效月份。
- 形成中：两个有效月份复现。
- 稳定：三个及以上有效月份复现。
- 核心：第二层证明可以稳定上架。
- 有效经营Skill：第三层证明有销量、利润、留存或回本价值。

2025年7月是正式观察起点。后续月份复现同一Skill时，成熟度由候选逐步更新为形成中或稳定。

## 五、三位开发人的当前关系

团队只维护一套Skill定义。个人画像只引用统一Skill编号，不复制定义。

- 陈杨当前更集中于万圣节、服装造型、饰品、主题差异化和季节提前布局。
- 蒋舒当前更集中于DIY手工、多方向试探、玩具以及汽车骑行小商品。
- 宋凤莉当前更集中于维修配件、工具、汽车功能品、复杂套件和组件复用。

这些是当前证据形成的个人特点，不是永久岗位标签。后续月份及图片、ASIN和利润证据可以强化、修正或推翻。

## 六、质量边界

- 第一层Skill只说明开发方向和方法，不代表已经上架或盈利。
- 售卖时间、人群和材质中的推断只能作为开发分析辅助。
- 第二层使用FBA首次可售验证运营承接。
- 第三层使用销量、利润、留存、淘汰和回本验证经营价值。
"""


def analysis_process_document() -> str:
    canonical = OUTPUT_ROOT / "00_开发Skill提取分析流程.md"
    if canonical.exists():
        return canonical.read_text(encoding="utf-8")
    return """# 开发Skill提取分析流程

## 一、这套流程要解决什么

把开发人的每一条商品标题，逐步整理成可追溯、可复用、可跨月积累的开发Skill。第一层只回答“开发了什么、面向什么场景、怎样组织产品”，不能直接说明产品已经上架或盈利。

正式观察从2025年7月开始，当前核心开发人为陈杨、蒋舒、宋凤莉。

## 二、输入与最终输出

输入数据：创建月份、开发人、SKU、原始完整标题，以及能够识别组合主SKU和组件SKU的关联信息。

最终输出分为五类：

1. 逐标题分析：保留每一个SKU和完整标题的语义分析。
2. 产品方案：把颜色、尺寸、数量变体和组合组件合并为真实产品方案。
3. 四层Skill：商品方向、场景主题、开发方法、组合打法。
4. 月度演化：记录Skill首次出现、跨月复现和成熟度变化。
5. 开发人画像：使用统一Skill编号描述个人特点，不复制Skill定义。

## 三、完整数据流

```mermaid
flowchart LR
    A["原始开品记录"] --> B["逐标题分析"]
    B --> C["标品/非标与季节判断"]
    C --> D["组合组件和变体归并"]
    D --> E["产品方案"]
    E --> F["Skill原子提取"]
    F --> G["四层统一Skill映射"]
    G --> H["团队与个人归属"]
    H --> I["月度成熟度演化"]
    I --> J["第二层上架验证"]
    J --> K["第三层经营验证"]
```

## 四、逐步分析流程

### 第1步：确定月份和人员范围

- 按创建月份固定一批开品，不能使用后来上架月份替代开发月份。
- 当前只纳入陈杨、蒋舒、宋凤莉。
- 2025年4—6月不参与Skill成熟度和三人横向比较。
- 原始记录必须保留开发人、SKU和完整标题，不能先按关键词粗略汇总。

### 第2步：逐标题读取，不跳过任何商品

每一个标题都要独立分析，至少填写：

- 规范产品名称、产品本体、产品族；
- 核心功能、使用场景、适用人群、适配对象；
- 主题元素、材质与结构、数量与组合；
- 季节属性、建议售卖时间；
- 标品或非标、差异化方式和风险提示。

标题是第一层最重要的事实来源。标题已经明确的信息必须直接使用；标题没有直接写明的信息，可以根据商品常识进行受控推断，但必须记录补充依据和分析置信度。

### 第3步：提取产品本体和核心功能

- 产品本体回答“这个商品本质是什么”，不能把颜色、数量、节日元素写进本体。
- 核心功能回答“买它主要用来做什么”。
- 套装标题应识别主商品和主要组件，不能只取标题中的第一个名词。
- 型号、编号或内部代号不能直接当作产品本体。

### 第4步：补全六个分析维度

对每个标题继续分析：使用场景、适用人群、适配对象、主题元素、材质与结构、建议售卖时间。

- 能从标题直接确认的，标记为标题事实。
- 能依据商品用途合理判断的，写明推断依据。
- 确实无法判断的，保留未知并进入质量复核，不能批量填入空洞的“标题未明确”。

### 第5步：判断标品和非标

非标判断遵守当前团队定义：

- 标题中明确写有“定制”的，直接判为非标。
- 玩具、装饰、服装造型、首饰等以外观、图像、主题或审美元素主导购买决策的，判为非标。
- 主要依靠功能、规格、适配关系和解决具体问题成交的，判为标品。
- 同时具备功能和主题元素时，判断真正主导购买决策的因素，并写入标准化判断依据。

### 第6步：判断季节性和售卖时间

- 标题明确出现节日、季节、开学、婚礼等时间场景时，按明确场景判断。
- 常驻功能品原则上判为全年，但可以补充需求旺季。
- 不能因为标题中出现颜色或普通装饰元素就强行判断季节性。
- 建议售卖时间是开发辅助判断，不是销量事实。

### 第7步：识别组合产品、组件和规格变体

SKU用于保留开发工作量，产品方案用于计算Skill证据。

- 组合商品按实际售卖的组合主SKU算一个产品方案。
- 被拆出的组件SKU关联回组合主SKU，不能重复贡献Skill证据。
- 仅颜色、尺寸、数量或轻微款式不同的SKU，合并为同一产品方案。
- 功能、目标人群、适配对象或使用场景已经发生实质变化的，保留为不同产品方案。
- 每条标题都必须保留产品方案ID和关联组合主SKU，保证可以反查。

### 第8步：提取Skill原子

先从产品方案提取细粒度原子，不立即创建正式Skill：

- 方向Skill原子：商品或产品线方向。
- 开发方法原子：套装、规格、人群、主题、适配、维修替换等方法。
- 组合打法原子：方向、场景和方法共同形成的开发套路。

同义词要统一，不能因为措辞不同重复创建Skill。

### 第9步：映射到四层统一Skill库

四层含义不可混用：

1. 商品方向：开发什么商品。
2. 场景主题：面向什么时间、场景和购买需求。
3. 开发方法：怎样组织套装、规格、主题、人群和适配。
4. 组合打法：商品方向与场景、方法形成的可复用完整套路。

优先复用已有Skill编号。只有现有定义确实无法覆盖，并且有清晰边界和商品证据时，才新增候选Skill。

### 第10步：建立证据账本

每个Skill证据必须能够反查：Skill编号、月份、开发人、产品方案ID、代表SKU、完整标题、产品本体和判定依据。

Skill数量统计使用产品方案，不使用重复SKU。一个产品方案可以支持不同层的Skill，但同一层不能被近义Skill重复计算。

### 第11步：判断归属和成熟度

归属表示谁主要表现出该能力：

- 团队共同：三人各至少3个产品方案证据。
- 个人标志候选：非团队共同前提下，一人占比至少65%，总证据至少5个方案。
- 团队共享候选：至少两人有证据，但未达到团队共同。
- 个人候选：当前只有一人提供少量证据。

成熟度表示是否经过时间和经营验证：

- 1个月为候选；2个月为形成中；3个月及以上为稳定。
- 第二层证明能够稳定上架后，才可以认定核心Skill。
- 第三层证明有销量、利润、留存或回本价值后，才可以认定有效经营Skill。

### 第12步：生成渐进式文件

- 主目录：设计、流程、质量审核、导航和阅读总览。
- `05_逐标题分析基础`：逐标题XLSX、CSV和跨月检索索引。
- `06_数据处理底表`：结构化Skill总表和证据账本。

会被后续商品图片、ASIN上架和利润证据持续修正的内容，单独存放在同级的`持续更新团队开品skll集合`：

- `01_AI审核入口`：AI审核流程和输出模板。
- `02_商品方向知识卡`：商品方向定义与证据。
- `03_核心开发Skill`：跨产品场景、开发方法和边界。
- `04_组合打法案例`：方向、场景与方法形成的案例。
- `05_证据演化`：月度变化、开发人画像和候选条目。

## 五、每个月怎样继续

1. 新增当月逐标题数据，不覆盖历史月份。
2. 优先复用已确认的产品本体、产品族和Skill编号。
3. 对新商品、新用法和边界冲突进行单独复核。
4. 更新产品方案证据数、开发人分布和活跃月份。
5. 记录Skill是新增、复现、修正、合并还是停止出现。
6. 通过质量审核后，才能更新正式总览和个人画像。

## 六、流程完成标准

只有同时满足以下条件，本月分析才算完成：

- 原始标题全部进入逐标题分析；
- 每条记录都有可追溯的产品方案ID；
- 组合组件和规格变体已经正确归并；
- Skill全部映射到统一编号或进入待确认区；
- 证据账本能够反查到完整标题；
- 已完成《开发Skill提取分析质量审核》中的全部验收门槛。
"""


def analysis_quality_document() -> str:
    canonical = OUTPUT_ROOT / "00_开发Skill提取分析质量审核.md"
    if canonical.exists():
        return canonical.read_text(encoding="utf-8")
    return """# 开发Skill提取分析质量审核

## 一、审核目标

质量审核不是检查文件有没有生成，而是确认每一个Skill都建立在真实标题、正确产品方案和清晰边界上。审核要防止关键词误判、组合产品重复、过度推断、证据虚高和把开发能力误写成盈利能力。

## 二、三条最高原则

1. 标题事实优先：标题明确写出的商品、功能、规格、对象和主题，不得被通用规则覆盖。
2. 推断必须可解释：标题没有直接说明时，可以合理补充，但必须写清依据和置信度。
3. Skill证据以产品方案计数：组合产品和变体不能通过重复SKU放大能力。

## 三、审核分为四关

### 第一关：原始数据完整性

| 审核项 | 合格标准 | 常见问题 |
|---|---|---|
| 月份范围 | 使用开发创建月份，2025年7月起正式积累 | 错用上架月份或销售月份 |
| 开发人 | 仅包含当前确认的核心开发人 | 姓名错字、同人不同写法 |
| 标题覆盖 | 原始有效标题100%进入分析 | 只抽样、按关键词预聚合 |
| 原文保留 | 原始完整标题不得改写或截断 | 只保留短名称导致信息丢失 |
| SKU追溯 | 每条分析都能回到原SKU | 合并后丢失组件或变体SKU |

### 第二关：逐标题语义质量

逐条审核产品本体、核心功能、场景、人群、适配对象、主题、材质、数量组合、季节和标品/非标。

重点规则：

- 产品本体必须具体，不能使用“其他商品”“小商品”“配件”等空泛词。
- 标题明确功能时，不能填写“标题未明确功能”。
- 标题没有直接写场景或人群时，要结合商品用途进行合理判断；无法判断则明确标为待复核。
- 推断内容不能伪装成标题事实，必须在信息补充依据中说明。
- 同类标题的产品本体和术语必须一致，避免同物多名。
- 型号、内部编号、颜色和数量不能单独成为产品本体。

### 第三关：产品方案归并质量

这是最容易让Skill数量虚高的环节。

- 组合产品按实际售卖的组合SKU算一个产品方案。
- 组件SKU必须关联组合主SKU，不能独立贡献相同Skill。
- 颜色、尺寸、数量和轻微款式变体原则上合并。
- 不同功能、不同适配对象或不同核心使用场景不能强行合并。
- 产品方案ID必须稳定；同一方案跨月复现时应尽量复用历史定义。
- 某个方向数量突然异常增大时，必须抽查是否把组件或变体当成了独立产品。

### 第四关：四层Skill质量

| 层级 | 必须回答 | 不应混入 |
|---|---|---|
| 商品方向 | 开发什么商品 | 节日、季节、套装方法 |
| 场景主题 | 面向什么时间、场景和需求 | 纯商品类目、纯规格 |
| 开发方法 | 怎样组织和差异化产品 | 销量、利润、上架结果 |
| 组合打法 | 哪些方向、场景和方法构成完整套路 | 单一关键词或一次偶然尝试 |

审核时必须检查：

- 普通首饰不能仅因推断场景含“派对”就自动归入派对庆典Skill。
- 通用工具不能仅因适用人群含“维修人员”就自动归入维修替换配件。
- 万圣节属于场景主题；服装、玩具、饰品才属于商品方向。
- “套装”“多件”“适配某设备”属于开发方法，不是商品方向。
- 组合打法必须同时存在明确商品方向以及场景或方法证据。
- 新Skill必须与已有Skill有明确边界，不能只换一个近义名称。

## 四、标品与非标专项审核

### 直接判为非标

- 标题明确写有定制。
- 购买决策主要由图像、主题、造型、审美或收藏元素主导。
- 玩具、节日服装造型、装饰品等非功能性商品。

### 通常判为标品

- 主要解决安装、维修、替换、测量、收纳、清洁等功能问题。
- 主要依赖规格、尺寸、材质、性能或设备适配关系成交。

### 必须人工复核

- 同时具有明显功能和强主题元素。
- 标题过短，只包含内部编号或模糊商品名。
- 产品本体能判断，但主导购买因素不明确。
- 同一产品族中出现标品与非标两种不同结果。

## 五、置信度和人工复核规则

### 高置信度

商品本体、功能、对象和关键差异在标题中直接明确。高置信度记录仍需随机抽查10%，每月至少20条。

### 中置信度

产品本体明确，但场景、人群、售卖时间或标品/非标需要合理推断。中置信度记录必须逐条检查推断依据；新增产品族应100%人工复核。

### 低置信度或待复核

标题只有编号、产品本体不清、组合关系不明或多个判断互相冲突。此类记录不能直接进入正式Skill证据，必须先解决或放入待确认区。

以下对象必须100%人工复核：

- 新出现的产品族和新建候选Skill；
- 组合主SKU与组件SKU关系；
- 标品/非标边界记录；
- 个人标志候选Skill；
- 证据数量排名前列或单月异常增长的Skill；
- 季节性、适用人群和售卖时间主要依赖推断的记录；
- 同一标题被映射到同层多个近义Skill的记录。

## 六、自动检查项目

生成脚本或测试至少检查：

1. 原始有效标题数与逐标题分析数一致。
2. 必填字段不存在无说明空值。
3. 每条记录都有产品方案ID。
4. 每个Skill编号唯一，层级固定。
5. 证据账本中的Skill编号都存在于Skill总表。
6. 证据账本可以反查月份、开发人、SKU和完整标题。
7. 同一产品方案在同一Skill下不重复计数。
8. 组合组件不会再次作为独立产品方案放大证据。
9. 导航中的全部文件链接存在。
10. 根目录只保留阅读文件，结构化CSV位于数据处理底表文件夹。

## 七、验收门槛

| 指标 | 必须达到 |
|---|---:|
| 原始有效标题覆盖率 | 100% |
| SKU与完整标题可追溯率 | 100% |
| 产品方案ID覆盖率 | 100% |
| Skill证据可反查率 | 100% |
| Skill编号唯一率 | 100% |
| 导航链接有效率 | 100% |
| 低置信度未处理记录 | 0条进入正式Skill证据 |
| 新产品族人工复核率 | 100% |
| 组合关系人工复核率 | 100% |
| 高置信度随机抽查 | 至少10%，且不少于20条/月 |

若任意硬性门槛未达到，本月数据只能标记为“分析草稿”，不得更新正式Skill成熟度和开发人画像。

## 八、异常信号

出现以下情况必须暂停汇总并回查逐标题数据：

- 某类商品数量远超开发常识，例如单月出现数百个相同产品方案。
- 同一开发人的开品数量与原始创建记录明显不一致。
- 大量不同标题被归入“其他商品”或同一个宽泛Skill。
- 非标占比突然异常升高，且主要由通用关键词触发。
- 三位开发人的Skill画像高度相同，无法解释标题中的实际差异。
- 一个Skill证据很多，但代表标题看不出共同商品、场景或方法。
- 单个产品方案同时贡献多个同义Skill。

## 九、问题等级与处理

- 严重问题：标题遗漏、开发人错误、组合产品重复、Skill证据重复。必须修复后全部重算。
- 重要问题：产品本体、标品/非标、Skill层级或归属错误。修复受影响记录并重新汇总。
- 一般问题：措辞不统一、推断依据不充分、售卖时间表述不清。修订字段并记录原因。
- 建议优化：定义可读性、导航和展示方式。可以不影响本月数据通过，但应进入后续优化清单。

## 十、每月审核记录

每月完成后至少记录：

- 原始标题数、逐标题分析数、产品方案数；
- 高、中、低置信度和待复核数量；
- 组合产品及组件归并数量；
- 新增、复现、合并、拆分和废止的Skill；
- 自动检查结果、人工抽查数量和发现的问题；
- 是否通过验收、未解决事项和下一月观察点。

## 十一、能力结论边界

第一层质量审核通过，只能说明开发Skill提取可信。不能据此直接判断该Skill有效、值得扩大或能够盈利。

- 第二层使用FBA首次可售验证运营是否真正承接上架。
- 第三层使用销量、利润、留存、淘汰和回本验证经营价值。
- 未经过第二、第三层验证的Skill，必须保留“开发能力候选”表述。
"""


def navigation_document(latest_month: str) -> str:
    return f"""# 第一层开发Skill提取导航

## 快速入口

- [第一层Skill提取设计思考](00_第一层Skill提取设计思考.md)
- [开发Skill提取分析流程](00_开发Skill提取分析流程.md)
- [开发Skill提取分析质量审核](00_开发Skill提取分析质量审核.md)
- [全月份AI审核总结](00_全月份AI审核总结_2025-07至2026-06.md)
- [第一层Skill提取结果总览](00_第一层Skill提取结果总览.md)
- [数据处理底表说明](06_数据处理底表/00_数据处理底表说明.md)
- [开发Skill总表](06_数据处理底表/00_开发Skill总表.csv)
- [开发Skill证据账本](06_数据处理底表/00_开发Skill证据账本.csv)
- [逐标题商品分析导航](05_逐标题分析基础/00_逐标题分析导航.md)

## 持续更新的团队Skill集合

- [持续更新团队开品Skill集合导航](../持续更新团队开品skll集合/00_持续更新团队开品Skill集合导航.md)
- [AI第一层开品审核入口](../持续更新团队开品skll集合/01_AI审核入口/00_AI第一层开品审核入口.md)
- [商品方向知识卡](../持续更新团队开品skll集合/02_商品方向知识卡/00_商品方向知识卡.md)
- [核心开发Skill](../持续更新团队开品skll集合/03_核心开发Skill/02_开发方法Skill.md)
- [最新月度Skill演化：{month_display(latest_month)}](../持续更新团队开品skll集合/05_证据演化/01_月度演化/{month_record_filename(latest_month)})
- [开发人Skill画像](../持续更新团队开品skll集合/05_证据演化/02_开发人画像/陈杨_Skill画像.md)
- [候选与待确认](../持续更新团队开品skll集合/05_证据演化/03_候选与待确认/尚未形成稳定能力的方向.md)

## 怎样检索

- 找Skill定义：进入“06_数据处理底表”，搜索00_开发Skill总表.csv。
- 找某个Skill对应的商品：进入“06_数据处理底表”，搜索00_开发Skill证据账本.csv。
- 按商品标题、SKU、产品本体或使用场景搜索：进入逐标题商品分析导航。
- 看某位开发人的特点：进入对应开发人Skill画像。
- 看Skill如何跨月变化：进入月度Skill演化。
"""


def skill_collection_description_document() -> str:
    return """# 持续更新团队开品Skill集合说明

## 一、这个文件夹是什么

这里不是某一个月份的分析结果，也不是第一层原始数据文件夹，而是团队长期维护的开品Skill知识库。

第一层从商品标题提取“开发什么、面向什么场景、怎样开发”；后续还会继续加入商品图片对照、实际ASIN上架、销量、利润、留存、淘汰和回本证据。新证据可以强化、修正、合并、拆分或降级已有Skill。

## 二、与第一层分析数据的关系

- `第一层开发skll提取`：保存分析方法、质量审核、逐标题结果和结构化底表，是证据生产区。
- `持续更新团队开品skll集合`：保存经过证据支持的团队Skill定义、月度演化和开发人画像，是长期知识沉淀区。

两者不能混在一起：分析数据可以按月份重新生成，Skill集合必须保留统一编号和历史变化。

## 三、后续证据怎样进入

1. 标题证据：识别产品本体、场景、人群、标品/非标和开发方法。
2. 商品图片证据：核对标题没有说清的结构、材质、造型、组件和视觉差异化。
3. ASIN上架证据：使用FBA首次可售等事实验证产品是否真正被运营承接。
4. 经营证据：使用销量、利润、留存、淘汰和回本周期验证Skill是否有经营价值。

Skill可以随着证据升级：候选 → 形成中 → 稳定 → 核心 → 有效经营Skill。证据不再支持时，也允许降级、合并或标记失效。

## 四、渐进式结构

- `01_AI审核入口`：AI首先读取的总流程和固定输出模板。
- `02_商品方向知识卡`：回答商品是什么方向，用于检索，不把16个方向都当成独立执行Skill。
- `03_核心开发Skill`：保存跨产品场景Skill、开发方法Skill及统一边界。
- `04_组合打法案例`：保存方向、场景和方法形成的历史案例，不作为基础Skill重复加载。
- `05_证据演化`：保存月度演化、开发人画像、候选与待确认内容。
- 第一层证据生产区中的`06_数据处理底表`：保存可供AI检索的Skill总表和证据账本。

AI按照“审核入口 → 一个商品方向 → 少量相关场景和方法 → 必要时参考组合案例 → 查询证据”的顺序渐进读取，不一次加载全部内容。

## 五、维护铁律

1. 同一个Skill或知识卡只保留一个正式编号，个人画像不得复制定义。
2. 新证据采用追加和修正方式，不抹掉历史月份结论。
3. 第一层标题分析通过，不代表Skill已经上架或盈利。
4. 图片、ASIN和财务结论必须能反查到具体商品和数据来源。
5. Skill升级、降级、合并或拆分都必须记录月份、原因和证据。
6. 先更新基础证据，再更新本集合，模型之间不得相互猜测结果。
"""


def ai_audit_entry_document() -> str:
    return """# AI第一层开品审核入口

> 这是AI进入团队开品知识库时首先读取的文件。当前版本只执行第一层开发信息审核，不直接承诺产品能够上架或盈利。

## 一、当前任务

收到用户提供的数据源后，AI需要：

1. 说明实际读取的数据源、时间范围、字段和有效记录数；
2. 逐条区分标题事实、关联数据事实、AI推断和缺失信息；
3. 为每个有效产品方案确定一个商品方向知识卡；
4. 按需调用相关场景Skill和开发方法Skill；
5. 查询历史证据账本，找到相似产品方案和团队经验；
6. 给出第一层审核结论及进入下一步前仍需补充的证据。

## 二、渐进式读取顺序

AI不得一次把全部知识卡当成同级Skill加载。固定顺序是：

1. 读取本入口和审核输出模板；
2. 根据商品本体只读取一个相关商品方向知识卡；
3. 根据节日、季节、使用或购买场景读取0—2个场景Skill；
4. 根据套装、规格、主题、人群、维修和适配事实读取0—3个开发方法Skill；
5. 只有在方向、场景和方法均匹配时，才参考组合打法案例；
6. 最后查询证据账本，不以Skill定义替代真实数据。

## 三、当前可以判断什么

- 商品属于哪个团队历史方向；
- 团队是否反复开发过类似产品；
- 使用了哪些开发方法；
- 是否存在跨月复现的团队经验；
- 信息是否完整、冲突或需要补充。

## 四、当前不能直接判断什么

- 产品是否一定值得开；
- 是否能够完成FBA上架；
- 是否能够盈利或在多久内回本；
- 是否应该扩大采购。

这些结论必须等待商品图片、ASIN/FBA上架、销量、利润、留存、淘汰和回本证据接入。

## 五、强制审核原则

1. 商品方向只能选一个，无法确定时进入待复核。
2. 场景和开发方法可以多选，但必须有标题或数据事实支持。
3. “团队以前做过”不等于“现在值得开”。
4. 每个关键结论都必须标明数据来源。
5. 推断不得写成事实；缺失信息必须明确列出。
6. 第一层审核结论只能是：符合历史方向、部分符合、信息不足或明显不符合。
"""


def ai_audit_output_template_document() -> str:
    return """# AI第一层审核输出模板

## 一、为什么值得继续看

- 第一层结论：符合历史方向 / 部分符合 / 信息不足 / 明显不符合。
- 对应商品方向知识卡：编号、名称和匹配理由。
- 对应场景Skill：如无明确场景则写“无”。
- 对应开发方法Skill：列出有事实支持的方法。
- 历史相似产品方案：数量、月份、开发人和代表商品。
- 当前值得进入下一步的理由：只能引用已有证据，不得用空泛表述。
- 当前不支持继续的理由或主要风险。

## 二、数据从哪里来

- 用户提供的数据源：文件或数据库表。
- 数据时间范围。
- 实际使用字段。
- 原始记录数、有效记录数和排除记录数。
- 关联的产品方案ID、SKU、ASIN或历史Skill证据。
- 关键结论对应的来源记录。

## 三、信息质量怎样

- 直接事实：标题、字段或关联数据直接证明的内容。
- AI推断：根据商品常识或历史案例推断的内容及依据。
- 缺失信息：图片、规格、成本、适配、上架或经营信息。
- 数据冲突与异常。
- 判断置信度：高 / 中 / 低。
- 下一步需要补充的数据和审核动作。

## 最终交付口径

第一层只决定是否值得进入图片、上架或经营数据复核，不直接作最终开品、采购或盈利承诺。
"""


def skill_collection_navigation_document(months: list[str]) -> str:
    monthly_links = "\n".join(
        f"- [{month_display(month)}Skill变化记录]"
        f"(05_证据演化/01_月度演化/{month_record_filename(month)})"
        for month in months
    )
    return f"""# 持续更新团队开品Skill集合导航

## 先了解口径

- [集合说明](00_持续更新团队开品Skill集合说明.md)
- [第一层开发Skill提取分析流程](../第一层开发skll提取/00_开发Skill提取分析流程.md)
- [第一层开发Skill提取分析质量审核](../第一层开发skll提取/00_开发Skill提取分析质量审核.md)
- [全月份AI审核总结](../第一层开发skll提取/00_全月份AI审核总结_2025-07至2026-06.md)
- [第一层Skill提取结果总览](../第一层开发skll提取/00_第一层Skill提取结果总览.md)

## AI审核入口

1. [AI第一层开品审核入口](01_AI审核入口/00_AI第一层开品审核入口.md)
2. [AI第一层审核输出模板](01_AI审核入口/01_AI第一层审核输出模板.md)

## 按需读取的知识与Skill

1. [商品方向知识卡](02_商品方向知识卡/00_商品方向知识卡.md)
2. [跨产品场景Skill](03_核心开发Skill/01_跨产品场景Skill.md)
3. [核心开发方法Skill](03_核心开发Skill/02_开发方法Skill.md)
4. [Skill定义与边界](03_核心开发Skill/00_Skill定义与边界.md)
5. [组合打法案例](04_组合打法案例/00_组合打法案例.md)

## 月度Skill演化

{monthly_links}

## 开发人画像

- [陈杨Skill画像](05_证据演化/02_开发人画像/陈杨_Skill画像.md)
- [蒋舒Skill画像](05_证据演化/02_开发人画像/蒋舒_Skill画像.md)
- [宋凤莉Skill画像](05_证据演化/02_开发人画像/宋凤莉_Skill画像.md)
- [候选与待确认](05_证据演化/03_候选与待确认/尚未形成稳定能力的方向.md)

## 当前证据阶段

目前主要完成第一层标题与产品方案证据。AI应从审核入口开始，只加载与当前数据相关的方向、场景和方法。商品图片、ASIN上架和利润经营证据将在后续阶段逐步接入。
"""


def data_processing_document() -> str:
    return """# 数据处理底表说明

本文件夹只存放第一层Skill提取、统计和证据追溯所需的结构化数据，不作为主阅读入口，也不代表最终团队Skill结论。

## 文件说明

- `00_开发Skill总表.csv`：每个Skill一行，记录层级、归属、成熟度、证据数量和三位开发人的分布。
- `00_开发Skill证据账本.csv`：每个Skill与产品方案的逐条映射，可反查月份、开发人、SKU和完整标题。

## 使用规则

1. 日常阅读从上级目录的四层Skill库导航和总览进入。
2. 需要筛选、统计、追溯商品证据或给脚本读取时，再使用这里的CSV。
3. 后续月份由生成脚本统一更新，不手工复制到主目录。
4. 这两张表是第一层分析底表，不直接代表上架率、销量或盈利能力。
"""


def boundary_document() -> str:
    return """# Skill定义与边界

## 正式观察起点

2025年7月是陈杨、蒋舒、宋凤莉第一次在同一个月都有开品记录。2025年4—6月不进入Skill提炼、成熟度升级和三人横向比较。

## 四类内容不可混用

- 商品方向知识卡回答开发什么，不作为独立执行Skill。
- 场景Skill回答为什么在这个时间和场景开发。
- 开发方法Skill回答怎样组织产品。
- 组合打法案例必须同时满足明确方向、场景和方法，经营验证前不作为基础Skill。

## 产品方案口径

- SKU保留工作量事实。
- 颜色、尺寸、数量和组件变体合并为产品方案。
- 组合组件并回组合主SKU。
- Skill证据以产品方案计数，不用重复SKU放大能力。

## 归属规则

- 团队共同：三人各至少3个产品方案证据。
- 个人标志候选：一个开发人的证据占该Skill总证据65%以上，且总证据不少于5个方案。
- 团队共享候选：至少两人提供证据，但未达到团队共同。
- 个人候选：目前只有一个人提供证据。

## 成熟度规则

- 1个月：候选。
- 2个月：形成中。
- 3个月及以上：稳定。
- 第二层上架验证后才能认定核心。
- 第三层经营验证后才能认定有效经营Skill。
"""


def profile_document(
    developer: str,
    rows: list[dict[str, Any]],
    summaries: list[dict[str, Any]],
    evidence_by_skill: dict[str, list[dict[str, Any]]],
) -> str:
    months = observed_months(rows)
    latest_month = months[-1] if months else ""
    schemes = group_schemes(
        [row for row in rows if row.get("开发人") == developer]
    )
    developer_skills = []
    for summary in summaries:
        count = int(summary[f"{developer}方案数"])
        if count:
            developer_skills.append((summary, count))
    developer_skills.sort(
        key=lambda item: (
            LAYER_ORDER.index(item[0]["Skill层级"]),
            -item[1],
        )
    )
    top_skill_names = [
        summary["Skill名称"]
        for summary, _ in sorted(developer_skills, key=lambda item: -item[1])[:5]
    ]
    interpretation = (
        "当前证据较集中于：" + "、".join(top_skill_names) + "。"
        if top_skill_names
        else "当前尚无通过质量门槛的正式Skill证据。"
    )
    lines = [
        f"# {developer} Skill画像",
        "",
        f"> 正式观察从2025年7月开始；当前证据更新至{month_display(latest_month) if latest_month else '暂无月份'}。",
        "",
        f"- 当前产品方案数：{len(schemes)}。",
        f"- 当前综合判断：{interpretation}",
        "",
        "## 方向与Skill证据",
        "",
        "| 编号 | 名称 | 层级 | 本人方案 | 团队归属 | 本人角色 |",
        "|---|---|---|---:|---|---|",
    ]
    for summary, count in developer_skills:
        role = (
            "主要贡献者"
            if summary["主要贡献者"] == developer
            else "共同参与"
        )
        if (
            summary["归属类型"] == "个人标志候选"
            and summary["主要贡献者"] == developer
        ):
            role = "个人标志候选"
        lines.append(
            f"| {summary['Skill编号']} | {summary['Skill名称']} | "
            f"{summary['Skill层级']} | {count} | {summary['归属类型']} | "
            f"{role} |"
        )
    lines.extend(["", "## 代表产品", ""])
    representative_titles: list[str] = []
    for summary, _ in developer_skills:
        if summary["主要贡献者"] != developer:
            continue
        for evidence in evidence_by_skill[summary["Skill编号"]]:
            if (
                evidence["开发人"] == developer
                and evidence["代表标题"] not in representative_titles
            ):
                representative_titles.append(evidence["代表标题"])
            if len(representative_titles) >= 10:
                break
        if len(representative_titles) >= 10:
            break
    for title in representative_titles:
        lines.append(f"- {title}")
    lines.extend([
        "",
        "## 后续验证",
        "",
        f"- 继续观察{month_display(latest_month) if latest_month else '后续月份'}以后相同Skill是否持续复现。",
        "- 第二层检查对应产品方案是否完成FBA首次可售。",
        "- 第三层检查销量、利润、留存、淘汰和回本。",
    ])
    return "\n".join(lines)


def overview_document(
    rows: list[dict[str, Any]],
    summaries: list[dict[str, Any]],
) -> str:
    months = observed_months(rows)
    schemes = group_schemes(rows)
    eligible_schemes = group_schemes(
        [
            row
            for row in rows
            if str(row.get("分析置信度") or "") != "低"
            and str(row.get("是否待复核") or "") != "是"
        ]
    )
    scheme_counts = Counter(
        items[0].get("开发人", "") for items in schemes.values()
    )
    layer_counts = Counter(item["Skill层级"] for item in summaries)
    common = [
        item for item in summaries if item["归属类型"] == "团队共同"
    ]
    signature = [
        item
        for item in summaries
        if item["归属类型"] == "个人标志候选"
    ]
    lines = [
        "# 第一层开品知识与Skill提取结果总览",
        "",
        "> 正式观察起点：2025年7月。第一层只分析开发方向和方法，不代表上架或盈利。",
        "",
        "## 当前基础",
        "",
        f"- 逐标题记录：{len(rows)}条。",
        f"- 去组件和变体后的产品方案：{len(schemes)}个。",
        f"- 通过质量门槛并进入正式知识与Skill证据：{len(eligible_schemes)}个；"
        f"待复核或低置信度方案：{len(schemes) - len(eligible_schemes)}个。",
        f"- 产品方案分布：陈杨{scheme_counts.get('陈杨', 0)}、"
        f"蒋舒{scheme_counts.get('蒋舒', 0)}、"
        f"宋凤莉{scheme_counts.get('宋凤莉', 0)}。",
        f"- 当前分层条目：商品方向知识卡{layer_counts['商品方向']}、"
        f"场景主题{layer_counts['场景主题']}、"
        f"开发方法{layer_counts['开发方法']}、"
        f"组合打法案例{layer_counts['组合打法']}。这些不是39个同级执行Skill。",
        f"- 当前有效观察月份：{'、'.join(months)}，共{len(months)}个月；"
        "各Skill成熟度按自身实际复现月份计算。",
        "",
        "## 团队共同条目",
        "",
        "| 编号 | 名称 | 层级 | 产品方案 | 三人分布 | 主要贡献者 |",
        "|---|---|---|---:|---|---|",
    ]
    for item in common:
        lines.append(
            f"| {item['Skill编号']} | {item['Skill名称']} | "
            f"{item['Skill层级']} | {item['产品方案证据数']} | "
            f"{distribution(item)} | {item['主要贡献者']} |"
        )
    lines.extend([
        "",
        "## 个人标志候选",
        "",
        "| Skill编号 | Skill名称 | 层级 | 产品方案 | 主要贡献者 | 三人分布 |",
        "|---|---|---|---:|---|---|",
    ])
    for item in signature:
        lines.append(
            f"| {item['Skill编号']} | {item['Skill名称']} | "
            f"{item['Skill层级']} | {item['产品方案证据数']} | "
            f"{item['主要贡献者']} | {distribution(item)} |"
        )
    lines.extend([
        "",
        "## 阅读顺序",
        "",
        "1. 先看[设计思考](00_第一层Skill提取设计思考.md)。",
        "2. 再看[开发Skill提取分析流程](00_开发Skill提取分析流程.md)。",
        "3. 用[开发Skill提取分析质量审核](00_开发Skill提取分析质量审核.md)检查结果。",
        "4. 通过[第一层Skill提取导航](00_第一层Skill提取导航.md)进入分析数据和长期Skill集合。",
        "5. 进入[持续更新团队开品Skill集合](../持续更新团队开品skll集合/00_持续更新团队开品Skill集合导航.md)，从AI审核入口按需查看方向知识卡、核心Skill和开发人画像。",
        "6. 需要核对具体商品时，进入证据账本或逐标题分析导航。",
    ])
    return "\n".join(lines)


def monthly_document(
    rows: list[dict[str, Any]],
    cumulative_summaries: list[dict[str, Any]],
    month: str,
    first_month: str,
) -> str:
    eligible_rows = [
        row
        for row in rows
        if str(row.get("分析置信度") or "") != "低"
        and str(row.get("是否待复核") or "") != "是"
    ]
    schemes = group_schemes(eligible_rows)
    counts = Counter(
        items[0].get("开发人", "") for items in schemes.values()
    )
    month_evidence, _ = build_evidence(rows)
    month_summaries = summarize_skills(month_evidence)
    cumulative_by_id = {
        item["Skill编号"]: item for item in cumulative_summaries
    }
    new_skills = [
        item
        for item in month_summaries
        if cumulative_by_id[item["Skill编号"]]["首次证据月份"] == month
    ]
    repeated_skills = [
        item
        for item in month_summaries
        if cumulative_by_id[item["Skill编号"]]["首次证据月份"] < month
    ]
    pending_rows = [
        row
        for row in rows
        if str(row.get("分析置信度") or "") == "低"
        or str(row.get("是否待复核") or "") == "是"
    ]
    introduction = (
        "这是第一个有效观察月，本月负责建立候选Skill和边界。"
        if month == first_month
        else "本月复用既有Skill编号，重点记录跨月复现、新增方向和待复核记录。"
    )
    lines = [
        f"# {month_display(month)}开品知识与Skill变化记录",
        "",
        f"> {introduction}第一层结论不代表已经上架或盈利。",
        "",
        f"- 通过质量门槛的产品方案：{len(schemes)}。",
        f"- 待复核标题：{len(pending_rows)}条，不进入正式Skill证据。",
        f"- 陈杨{counts.get('陈杨', 0)}、蒋舒{counts.get('蒋舒', 0)}、"
        f"宋凤莉{counts.get('宋凤莉', 0)}。",
        "",
        "## 本月跨月复现条目",
        "",
    ]
    if not repeated_skills:
        lines.append("- 首月暂无跨月复现条目。")
    for item in repeated_skills:
        cumulative = cumulative_by_id[item["Skill编号"]]
        lines.append(
            f"- {item['Skill编号']} {item['Skill名称']}："
            f"本月{item['产品方案证据数']}个方案；累计成熟度"
            f"{cumulative['成熟状态']}；{distribution(item)}。"
        )
    lines.extend(["", "## 本月新增候选条目", ""])
    if not new_skills:
        lines.append("- 本月没有新增正式条目，全部复用既有编号。")
    for item in new_skills:
        lines.append(
            f"- {item['Skill编号']} {item['Skill名称']}："
            f"本月{item['产品方案证据数']}个方案；"
            f"{distribution(item)}。"
        )
    lines.extend([
        "",
        "## 本月质量状态",
        "",
        f"- 低置信度或待复核标题共{len(pending_rows)}条，已从正式证据排除。",
        "- 新Skill必须有清晰边界和具体产品方案证据。",
        "- 第二层上架和第三层利润验证尚未接入，本月只更新开发能力证据。",
        "",
        "## 下月任务",
        "",
        "1. 继续复用现有Skill编号，不重复创建同义Skill。",
        "2. 检查形成中Skill是否在下一月继续复现。",
        "3. 对待复核标题补充商品图片或更完整产品信息。",
    ])
    return "\n".join(lines)


def candidate_document(
    summaries: list[dict[str, Any]],
    months: list[str],
) -> str:
    weak = [
        item
        for item in summaries
        if int(item["产品方案证据数"]) < 5
        or int(item["活跃月份数"]) < 2
    ]
    lines = [
        "# 候选与待确认Skill",
        "",
        f"> 当前证据覆盖{'、'.join(months)}。本页重点列出证据量较少、"
        "尚未跨月复现或边界仍需继续拆分的方向。",
        "",
        "| Skill编号 | Skill名称 | 层级 | 方案数 | 归属 | 主要贡献者 | 最相似已有Skill | 边界对比 |",
        "|---|---|---|---:|---|---|---|---|",
    ]
    for item in weak:
        comparison = NEW_SKILL_BOUNDARY_COMPARISONS.get(
            item["Skill编号"],
            ("—", "现有Skill复现或证据量不足，暂不新建近义Skill。"),
        )
        lines.append(
            f"| {item['Skill编号']} | {item['Skill名称']} | "
            f"{item['Skill层级']} | {item['产品方案证据数']} | "
            f"{item['归属类型']} | {item['主要贡献者']} | "
            f"{comparison[0]} | {comparison[1]} |"
        )
    lines.extend([
        "",
        "## 重点边界问题",
        "",
        "- 通用工具必须排除美甲工具、手机支架等被单个关键词误伤的商品。",
        "- 首饰与身体饰品、发饰服装造型、功能穿戴配件必须分开。",
        "- 万圣节属于场景主题，不再与商品类目平铺。",
        "- 家居、厨房与电子功能用品当前证据分散，后续月份再决定是否拆分。",
    ])
    return "\n".join(lines)


def apply_summary_to_ledger(
    ledger: list[dict[str, Any]],
    summaries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    summary_by_id = {
        item["Skill编号"]: item for item in summaries
    }
    return [
        {
            **item,
            "归属类型": summary_by_id[item["Skill编号"]]["归属类型"],
            "成熟状态": summary_by_id[item["Skill编号"]]["成熟状态"],
        }
        for item in ledger
    ]


def clean_obsolete_files(
    output_root: Path,
    collection_root: Path,
) -> None:
    obsolete = [
        collection_root / "01_团队统一Skill库" / "01_方向型Skill.md",
        collection_root / "01_团队统一Skill库" / "02_开发方法Skill.md",
        collection_root / "01_团队统一Skill库" / "03_组合打法Skill.md",
        collection_root / "01_团队统一Skill库" / "04_Skill定义与边界.md",
        output_root / "00_开发Skill总表.csv",
        output_root / "00_开发Skill证据账本.csv",
        output_root / "00_四层Skill库设计思考.md",
        output_root / "00_四层Skill库导航.md",
        output_root / "00_开发Skill库总览.md",
    ]
    for path in obsolete:
        if path.exists():
            path.unlink()
    obsolete_directories = [
        collection_root / "01_团队统一Skill库",
        collection_root / "02_月度Skill演化",
        collection_root / "03_开发人Skill画像",
        collection_root / "04_候选与待确认Skill",
    ]
    collection_resolved = collection_root.resolve()
    for directory in obsolete_directories:
        if (
            directory.exists()
            and directory.resolve().parent == collection_resolved
        ):
            shutil.rmtree(directory)


def build_four_layer_skill_library(
    rows: list[dict[str, Any]],
    output_root: Path = OUTPUT_ROOT,
    collection_root: Path = SKILL_COLLECTION_ROOT,
) -> dict[str, Path]:
    months = observed_months(rows)
    if not months:
        raise ValueError("没有可用于Skill提取的创建月份")
    evidence_by_skill, ledger = build_evidence(rows)
    summaries = summarize_skills(evidence_by_skill)
    validate_skill_library(summaries, ledger, months)
    complete_ledger = apply_summary_to_ledger(ledger, summaries)

    write_text(
        output_root / "00_第一层Skill提取设计思考.md",
        design_document(),
    )
    write_text(
        output_root / "00_第一层Skill提取导航.md",
        navigation_document(months[-1]),
    )
    write_text(
        output_root / "00_第一层Skill提取结果总览.md",
        overview_document(rows, summaries),
    )
    write_text(
        output_root / "00_开发Skill提取分析流程.md",
        analysis_process_document(),
    )
    write_text(
        output_root / "00_开发Skill提取分析质量审核.md",
        analysis_quality_document(),
    )
    data_root = output_root / "06_数据处理底表"
    write_text(
        data_root / "00_数据处理底表说明.md",
        data_processing_document(),
    )
    write_csv(
        data_root / "00_开发Skill总表.csv",
        SUMMARY_HEADERS,
        summaries,
    )
    write_csv(
        data_root / "00_开发Skill证据账本.csv",
        LEDGER_HEADERS,
        complete_ledger,
    )
    write_text(
        collection_root / "00_持续更新团队开品Skill集合说明.md",
        skill_collection_description_document(),
    )
    write_text(
        collection_root / "00_持续更新团队开品Skill集合导航.md",
        skill_collection_navigation_document(months),
    )
    write_text(
        collection_root / "01_AI审核入口" / "00_AI第一层开品审核入口.md",
        ai_audit_entry_document(),
    )
    write_text(
        collection_root / "01_AI审核入口" / "01_AI第一层审核输出模板.md",
        ai_audit_output_template_document(),
    )
    write_text(
        collection_root / "02_商品方向知识卡" / "00_商品方向知识卡.md",
        layer_document("商品方向", summaries, evidence_by_skill),
    )
    write_text(
        collection_root / "03_核心开发Skill" / "01_跨产品场景Skill.md",
        layer_document("场景主题", summaries, evidence_by_skill),
    )
    write_text(
        collection_root / "03_核心开发Skill" / "02_开发方法Skill.md",
        layer_document("开发方法", summaries, evidence_by_skill),
    )
    write_text(
        collection_root
        / "03_核心开发Skill"
        / "00_Skill定义与边界.md",
        boundary_document(),
    )
    write_text(
        collection_root / "04_组合打法案例" / "00_组合打法案例.md",
        layer_document("组合打法", summaries, evidence_by_skill),
    )
    for month in months:
        month_rows = [
            row for row in rows if str(row.get("创建月份") or "") == month
        ]
        write_text(
            collection_root
            / "05_证据演化"
            / "01_月度演化"
            / month_record_filename(month),
            monthly_document(month_rows, summaries, month, months[0]),
        )
    for developer in DEVELOPERS:
        write_text(
            collection_root
            / "05_证据演化"
            / "02_开发人画像"
            / f"{developer}_Skill画像.md",
            profile_document(
                developer,
                rows,
                summaries,
                evidence_by_skill,
            ),
        )
    write_text(
        collection_root
        / "05_证据演化"
        / "03_候选与待确认"
        / "尚未形成稳定能力的方向.md",
        candidate_document(summaries, months),
    )
    clean_obsolete_files(output_root, collection_root)
    return {
        "design": output_root / "00_第一层Skill提取设计思考.md",
        "navigation": output_root / "00_第一层Skill提取导航.md",
        "summary": data_root / "00_开发Skill总表.csv",
        "ledger": data_root / "00_开发Skill证据账本.csv",
        "collection": collection_root,
        "collection_navigation": (
            collection_root
            / "00_持续更新团队开品Skill集合导航.md"
        ),
    }


def load_title_index(path: Path = TITLE_INDEX_CSV) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="根据逐标题总索引重建第一层Skill提取结果和长期Skill集合"
    )
    parser.add_argument("--source", type=Path, default=TITLE_INDEX_CSV)
    parser.add_argument("--output-root", type=Path, default=OUTPUT_ROOT)
    parser.add_argument(
        "--collection-root",
        type=Path,
        default=SKILL_COLLECTION_ROOT,
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = load_title_index(args.source)
    if not rows:
        raise ValueError(f"逐标题总索引没有数据：{args.source}")
    result = build_four_layer_skill_library(
        rows,
        args.output_root,
        args.collection_root,
    )
    print(f"已重建第一层Skill提取结果：{args.output_root}")
    print(f"设计思考：{result['design']}")
    print(f"导航：{result['navigation']}")
    print(f"Skill总表：{result['summary']}")
    print(f"证据账本：{result['ledger']}")
    print(f"持续更新团队开品Skill集合：{result['collection']}")


if __name__ == "__main__":
    main()
