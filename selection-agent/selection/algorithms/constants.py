"""全局常量 — 站点配置、品类原型映射、阈值定义。

所有算法模块共享的常量，集中管理便于维护。
"""

# ═══ 站点配置（来自利润计算器_最终版.py） ═══

SITE_CONFIG = {
    "UK": {
        "name": "英国",
        "currency": "GBP",
        "usd_to_local": 0.79,       # USD → GBP
        "local_to_cny": 8.54,       # GBP → CNY
        "vat_rate": 0.2,            # VAT 20%
        "comm_rate": 0.15,          # 佣金 15%
        "air_freight_rate": 45.0,   # 空运 ¥/kg
        "sea_freight_rate": 15.0,   # 海运 ¥/kg
    },
    "DE": {
        "name": "德国",
        "currency": "EUR",
        "usd_to_local": 0.92,       # USD → EUR
        "local_to_cny": 7.5,        # EUR → CNY
        "vat_rate": 0.2,
        "comm_rate": 0.15,
        "air_freight_rate": 55.0,   # DE空运更贵
        "sea_freight_rate": 15.0,
    },
    "US": {
        "name": "美国",
        "currency": "USD",
        "usd_to_local": 1.0,        # USD 基准
        "local_to_cny": 7.25,       # USD → CNY
        "vat_rate": 0.0,            # 美国无VAT（州销售税简化为0）
        "comm_rate": 0.15,          # 佣金 15%
        "air_freight_rate": 40.0,   # 空运 ¥/kg
        "sea_freight_rate": 12.0,   # 海运 ¥/kg
    },
}


# ═══ 品类原型映射（51条，来自 08-品类专属评分模型.md §2.3） ═══

ARCHETYPE_MAP = {
    # DA: 装饰艺术型（9条）— 视觉驱动，图案裂变
    "Wall Art": "DA",
    "Light": "DA",
    "Wall Sticker": "DA",
    "Cushion": "DA",
    "Banner": "DA",
    "Rug": "DA",
    "Vase & Plant": "DA",
    "Garden": "DA",
    "Bedding": "DA",
    # FH: 功能家居型（14条）— 实用驱动，性价比
    "Storage": "FH",
    "Bathroom": "FH",
    "Tool": "FH",
    "Cookware": "FH",
    "Towel": "FH",
    "Dog": "FH",
    "Cat": "FH",
    "Plate & Bowl": "FH",
    "Shelf": "FH",
    "Outdoor Toy": "FH",
    "Feeding": "FH",
    "Curtain": "FH",
    "Car Freshener": "FH",
    "Charger": "FH",
    # FP: 时尚个人型（12条）— 风格驱动，身份认同
    "Jewellery": "FP",
    "Tote Bag": "FP",
    "Backpack": "FP",
    "Sock": "FP",
    "Key Chain": "FP",
    "Hat": "FP",
    "Makeup Bag": "FP",
    "Hair Accessory": "FP",
    "Wallet": "FP",
    "Dress Up": "FP",
    "Guitar": "FP",
    "Sunglasses": "FP",
    # TN: 趋势潮流型（3条）— 热度驱动，快速迭代
    "Fidget Toy": "TN",
    "Puzzle": "TN",
    "Slime & Clay": "TN",
    # PE: 派对活动型（4条）— 文化驱动，高销量
    "Party Supply": "PE",
    "Card": "PE",
    "Mug": "PE",
    "Balloon": "PE",
    # PS: 纸品文具型（8条）— 极轻，图案裂变
    "Pen": "PS",
    "Notebook": "PS",
    "Paper": "PS",
    "Bookmark": "PS",
    "Stamp": "PS",
    "Coaster": "PS",
    "Envelope": "PS",
    "Sticker": "PS",
}


# ═══ 生命周期阶段阈值 ═══

LIFECYCLE_THRESHOLDS = {
    "EMERGING": {
        "unitsGrowthRate_min": 30,
        "avgRatings_max": 50,
    },
    "GROWTH": {
        "unitsGrowthRate_min": 10,
    },
    "MATURITY_STABLE": {
        "unitsGrowthRate_min": -10,
        "unitsGrowthRate_max": 10,
    },
    "MATURITY_WITH_DECLINE": {
        "unitsGrowthRate_min": -20,
        "unitsGrowthRate_max": -10,
    },
    "SATURATION": {
        "unitsGrowthRate_max": -20,
        "cr3_min": 0.8,
    },
    "DECLINE": {
        "unitsGrowthRate_max": -30,
    },
}


# ═══ 利润判定阈值 ═══

PROFIT_THRESHOLDS = {
    "monthly_fixed_cost": 500.0,    # 月固定成本（当地货币），用于盈亏平衡估算
    "profitable_margin": 30,        # typical_margin >= 30% → PROFITABLE
    "marginal_margin": 15,          # 15% <= margin < 30% → MARGINAL
    # margin < 15% → UNPROFITABLE
}


# ═══ FBA费用估算默认值（当地货币） ═══

FBA_DEFAULTS = {
    "VERY_LIGHT": 1.5,
    "LIGHT_SMALL": 2.5,
    "MEDIUM": 4.0,
    "HEAVY": 7.0,
    "_fallback": 2.5,
}


# ═══ 信号阈值（生命周期检测） ═══

SIGNAL_THRESHOLDS = {
    "density": {
        "high_product_count": 200,       # > 200 个产品 → UP
        "low_product_count": 50,         # < 50 个产品 → DOWN
        "very_high_product_count": 500,  # > 500 → HIGH urgency
    },
    "quality": {
        "high_avg_ratings": 200,         # > 200 条评论 → 壁垒高
        "low_avg_ratings": 50,           # < 50 条评论 → 壁垒低
        "very_high_avg_ratings": 500,    # > 500 → HIGH urgency
    },
    "follow": {
        "bsr_change_high": -15,          # < -15% → UP（更多关注）
        "bsr_change_very_high": -30,     # < -30% → HIGH urgency
        "bsr_change_decline": 15,        # > 15% → DOWN
    },
}


# ═══ 价格带定义（UK站£，DE站€） ═══

PRICE_BANDS = [
    {"label": "BUDGET", "min": 4.99, "max": 5.99},
    {"label": "LOW", "min": 5.99, "max": 7.99},
    {"label": "MID", "min": 7.99, "max": 9.99},
    {"label": "PREMIUM", "min": 9.99, "max": 16.99},
]

# US站价格带（$，区间更宽，US客单价更高）
PRICE_BANDS_US = [
    {"label": "BUDGET", "min": 5.99, "max": 7.99},
    {"label": "LOW", "min": 7.99, "max": 11.99},
    {"label": "MID", "min": 11.99, "max": 17.99},
    {"label": "PREMIUM", "min": 17.99, "max": 29.99},
]


# ═══ CR3 竞争格局阈值 ═══

CR3_THRESHOLDS = {
    "FRAGMENTED": 0.3,   # CR3 < 0.3 → 分散市场
    "MODERATE": 0.6,     # 0.3 <= CR3 < 0.6 → 适度集中
    "OLIGOPOLY": 0.8,    # 0.6 <= CR3 < 0.8 → 寡头
    "MONOPOLY": 1.0,     # CR3 >= 0.8 → 高度集中
}


# ═══ 机会评分维度满分 ═══

SCORE_DIMENSIONS = {
    "demand": 25,           # 需求/市场容量
    "profitability": 20,    # 利润率
    "competition": 20,      # 竞争可进入性（越容易分越高）
    "differentiation": 15,  # 差异化机会
    "timing": 10,           # 时机
    "riskPenalty": 10,      # 风险扣分项
}


# ═══ 品类专属8维权重（来自 08-品类专属评分模型.md §3.1） ═══

ARCHETYPE_WEIGHTS = {
    "DA": {"size": 15, "volume": 10, "profit": 15, "emotion": 10,
           "decor": 20, "fission": 20, "culture": 5, "market": 5},
    "FH": {"size": 20, "volume": 20, "profit": 25, "emotion": 3,
           "decor": 0, "fission": 5, "culture": 2, "market": 25},
    "FP": {"size": 10, "volume": 10, "profit": 20, "emotion": 20,
           "decor": 5, "fission": 10, "culture": 10, "market": 15},
    "TN": {"size": 10, "volume": 10, "profit": 20, "emotion": 20,
           "decor": 0, "fission": 5, "culture": 5, "market": 30},
    "PE": {"size": 15, "volume": 10, "profit": 20, "emotion": 20,
           "decor": 10, "fission": 10, "culture": 15, "market": 10},
    "PS": {"size": 25, "volume": 15, "profit": 20, "emotion": 5,
           "decor": 0, "fission": 25, "culture": 5, "market": 5},
    "BASIC": {"size": 15, "volume": 15, "profit": 20, "emotion": 15,
              "decor": 10, "fission": 10, "culture": 5, "market": 10},
}

# 跳过LLM的维度（权重<5%的维度不需要LLM评分，赋默认50分）
ARCHETYPE_SKIP_DIMS = {
    "DA": [],
    "FH": ["emotion", "decor", "culture"],
    "FP": [],
    "TN": ["decor"],
    "PE": [],
    "PS": ["decor"],
    "BASIC": [],
}

# 情绪价值的Prompt变体（08文档 §4.4）
ARCHETYPE_EMOTION_VARIANT = {
    "DA": "gift_scene",       # 礼品场景
    "FP": "identity",         # 身份认同
    "TN": "stress_relief",    # 解压/成瘾
    "PE": "celebration",      # 庆祝/祝福
}

# Agent层评分维度权重（按原型适配，总和100%）
AGENT_SCORE_WEIGHTS = {
    "DA":    {"demand": 20, "profitability": 15, "competition": 20, "differentiation": 25, "timing": 10, "riskPenalty": 10},
    "FH":    {"demand": 25, "profitability": 25, "competition": 20, "differentiation": 5,  "timing": 10, "riskPenalty": 15},
    "FP":    {"demand": 20, "profitability": 20, "competition": 15, "differentiation": 20, "timing": 10, "riskPenalty": 15},
    "TN":    {"demand": 30, "profitability": 20, "competition": 15, "differentiation": 10, "timing": 15, "riskPenalty": 10},
    "PE":    {"demand": 20, "profitability": 20, "competition": 15, "differentiation": 15, "timing": 15, "riskPenalty": 15},
    "PS":    {"demand": 15, "profitability": 20, "competition": 20, "differentiation": 25, "timing": 10, "riskPenalty": 10},
    "BASIC": {"demand": 25, "profitability": 20, "competition": 20, "differentiation": 15, "timing": 10, "riskPenalty": 10},
}


# ═══ 风险规则 — 价格窄幅阈值（按站点） ═══

RISK_NARROW_PRICE_THRESHOLDS = {
    "UK": 1.0,   # £1.0
    "DE": 1.0,   # €1.0
    "US": 1.5,   # $1.5（US价格范围更宽）
}
