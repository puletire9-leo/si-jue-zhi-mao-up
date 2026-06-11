"""品类原型映射器 — 三级匹配（精确→关键词→UNKNOWN），纯函数。

品类原型体系（6类，来自 08-品类专属评分模型 §2.3）：
- DA (装饰艺术型): 视觉驱动、图案裂变
- FH (功能家居型): 实用驱动、性价比
- FP (时尚个人型): 风格驱动、身份认同
- TN (趋势潮流型): 热度驱动、快速迭代
- PE (派对活动型): 文化驱动、高销量
- PS (纸品文具型): 极轻、图案裂变

公开函数:
    map_archetype
"""

import logging
import re
from dataclasses import dataclass
from typing import Optional

from selection.algorithms.constants import ARCHETYPE_MAP

logger = logging.getLogger(__name__)


@dataclass
class ArchetypeMatch:
    """原型匹配结果。"""
    archetype: str          # DA/FH/FP/TN/PE/PS/UNKNOWN
    confidence: float       # 1.0=精确, 0.6=关键词, 0.0=未命中
    match_method: str       # EXACT / KEYWORD / UNKNOWN
    matched_keyword: str    # 命中的关键词（或空）


# ─── 关键词回退表（英德双语） ──────────────────────────────────────────────────

_KEYWORD_FALLBACK = {
    "DA": [
        # English
        "wall art", "poster", "canvas", "decoration", "decor", "home decor",
        "lamp", "light", "candle", "cushion", "pillow", "rug", "carpet",
        "curtain", "vase", "plant pot", "banner", "flag", "garden",
        "bedding", "duvet", "bedspread", "photo frame",
        # German
        "wandkunst", "poster", "deko", "dekoration", "lampe", "leuchte",
        "kissen", "teppich", "vorhang", "vase", "garten", "bettwäsche",
    ],
    "FH": [
        # English
        "storage", "organizer", "bathroom", "kitchen", "tool", "cookware",
        "towel", "dog", "cat", "pet", "plate", "bowl", "shelf", "rack",
        "charger", "cable", "car freshener", "cleaning", "brush",
        "feeding", "baby", "outdoor toy", "garden tool",
        # German
        "aufbewahrung", "bad", "küche", "werkzeug", "geschirr", "handtuch",
        "hund", "katze", "haustier", "regal", "ladung", "reinigung",
    ],
    "FP": [
        # English
        "jewellery", "jewelry", "ring", "necklace", "bracelet", "earring",
        "tote bag", "backpack", "bag", "sock", "hat", "cap", "scarf",
        "wallet", "purse", "keychain", "key chain", "hair", "makeup",
        "sunglasses", "glasses", "watch", "dress up", "costume", "guitar",
        # German
        "schmuck", "halskette", "armband", "ohrring", "tasche", "rucksack",
        "socke", "hut", "mütze", "geldbörse", "schlüsselanhänger",
        "sonnenbrille", "uhr", "kostüm",
    ],
    "TN": [
        # English
        "fidget", "spinner", "puzzle", "slime", "clay", "trend", "viral",
        "tiktok", "novelty", "gadget", "squishy", "pop it",
        # German
        "zappeln", "rätsel", "schleim", "knete", "trend", "viral",
    ],
    "PE": [
        # English
        "party", "balloon", "card", "greeting card", "invitation",
        "mug", "cup", "celebration", "birthday", "wedding", "christmas",
        "halloween", "easter", "valentine", "event",
        # German
        "party", "ballon", "karte", "grußkarte", "einladung", "tasse",
        "feier", "geburtstag", "hochzeit", "weihnachten",
    ],
    "PS": [
        # English
        "pen", "pencil", "notebook", "journal", "paper", "bookmark",
        "stamp", "coaster", "envelope", "sticker", "stationery",
        "planner", "diary", "notepad", "marker",
        # German
        "stift", "bleistift", "notizbuch", "tagebuch", "papier",
        "lesezeichen", "briefmarke", "untersetzer", "umschlag",
        "aufkleber", "schreibwaren",
    ],
    "UNKNOWN": [],  # placeholder
}

# ── 品类→原型直接映射（优先于关键词匹配）──
_CATEGORY_TO_ARCHETYPE = {
    "Automotive": "FH",           # 汽车配件→功能型
    "Sports & Outdoors": "FH",    # 运动户外→功能型
    "Car & Motorbike": "FH",
    "Electronics & Photo": "FH",
    "Computers & Accessories": "FH",
    "Health & Personal Care": "FH",
    "Pet Supplies": "FH",
    "DIY & Tools": "FH",
    "Large Appliances": "FH",
    "Business, Industry & Science": "FH",
    "Musical Instruments & DJ": "FP",
}


def map_archetype(
    node_name: str,
    node_full_path: str = "",
) -> ArchetypeMatch:
    """品类原型三级匹配。

    匹配策略：
    1. 精确匹配 ARCHETYPE_MAP（51条），confidence=1.0
    2. 关键词回退（英德双语），confidence=0.6
    3. 未命中 → UNKNOWN，confidence=0.0

    Args:
        node_name:      品类节点名（如 "Wall Art"）
        node_full_path: 完整路径（如 "Home > Wall Art"），辅助匹配

    Returns:
        ArchetypeMatch
    """
    if not node_name:
        return ArchetypeMatch(archetype="UNKNOWN", confidence=0.0,
                              match_method="UNKNOWN", matched_keyword="")

    # ── Level 1: 精确匹配 ──
    # 尝试原key，以及去除大小写差异
    for key, archetype in ARCHETYPE_MAP.items():
        if key.lower() == node_name.lower():
            logger.info(f"[archetype_mapper] 精确匹配: '{node_name}' → {archetype}")
            return ArchetypeMatch(
                archetype=archetype, confidence=1.0,
                match_method="EXACT", matched_keyword=key,
            )

    # ── Level 1.5: 品类名直接映射 ──
    category_key = _CATEGORY_TO_ARCHETYPE.get(node_name)
    if not category_key:
        # 尝试模糊匹配
        for cat, arch in _CATEGORY_TO_ARCHETYPE.items():
            if cat.lower() in node_name.lower() or node_name.lower() in cat.lower():
                category_key = arch
                break
    if category_key:
        logger.info(f"[archetype_mapper] 品类映射: '{node_name}' → {category_key}")
        return ArchetypeMatch(
            archetype=category_key, confidence=0.7,
            match_method="CATEGORY_MAP", matched_keyword=node_name,
        )

    # ── Level 2: 关键词回退 ──
    # 在 node_name 和 node_full_path 中搜索关键词（使用词边界避免误匹配）
    search_text = f"{node_name} {node_full_path}".lower()

    best_match = ""
    best_archetype = "UNKNOWN"
    best_len = 0  # 优先匹配更长的关键词（更精确）

    for archetype, keywords in _KEYWORD_FALLBACK.items():
        for kw in keywords:
            kw_lower = kw.lower()
            # 使用 \b 词边界防止子串误匹配（如 "cap" 匹配 "capacitor"）
            pattern = r'\b' + re.escape(kw_lower) + r'\b'
            if re.search(pattern, search_text) and len(kw_lower) > best_len:
                best_match = kw
                best_archetype = archetype
                best_len = len(kw_lower)

    if best_archetype != "UNKNOWN":
        logger.info(f"[archetype_mapper] 关键词匹配: '{node_name}' "
                    f"(keyword='{best_match}') → {best_archetype}")
        return ArchetypeMatch(
            archetype=best_archetype, confidence=0.6,
            match_method="KEYWORD", matched_keyword=best_match,
        )

    # ── Level 3: 未命中 ──
    logger.warning(f"[archetype_mapper] 未命中: '{node_name}' → UNKNOWN")
    return ArchetypeMatch(
        archetype="UNKNOWN", confidence=0.0,
        match_method="UNKNOWN", matched_keyword="",
    )
