"""
AI 分析引擎 — DeepSeek 调用 + Prompt + 结果解析

从预处理后的商品数据中提取元素/载体/场景，判断好品，推荐组合。

使用: tools/selection/preprocess.py → SubCategoryAnalysis → ai_analyze() → AIResult
"""

from __future__ import annotations

import atexit
import json
import logging
import os
import sys
import threading
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI

from .preprocess import SubCategoryAnalysis

logger = logging.getLogger(__name__)

# ── DeepSeek 客户端 ──────────────────────────────────────────

_client: OpenAI | None = None
_client_lock = threading.Lock()
# FIXED: MED-11 register cleanup on interpreter exit
atexit.register(lambda: _client.close() if _client else None)


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:  # double-check
                _client = OpenAI(
                    api_key=os.environ["DEEPSEEK_API_KEY"],  # FIXED: CRIT-6
                    base_url="https://api.deepseek.com",
                )
    return _client


# ── AI 输出模型 ──────────────────────────────────────────────

@dataclass
class GoodProduct:
    asin: str = ""
    is_good: bool = True
    reason: str = ""
    elements: list[str] = field(default_factory=list)
    carriers: list[str] = field(default_factory=list)
    scenes: list[str] = field(default_factory=list)
    keywords_en: list[str] = field(default_factory=list)
    keywords_cn: list[str] = field(default_factory=list)
    lightweight: str = ""
    lightweight_reason: str = ""


@dataclass
class RecommendedCombo:
    elements: list[str] = field(default_factory=list)
    carriers: list[str] = field(default_factory=list)
    scenes: list[str] = field(default_factory=list)
    keywords_en: list[str] = field(default_factory=list)
    keywords_cn: list[str] = field(default_factory=list)
    heat: str = ""
    reason: str = ""


@dataclass
class ProvenElement:
    name: str = ""
    frequency: int = 0
    carriers: list[str] = field(default_factory=list)
    signal_tags: list[str] = field(default_factory=list)
    insight: str = ""


@dataclass
class AIResult:
    """AI 品线模型 — 只含AI判断和创造，数值引用脚本预计算"""
    sub_category: str = ""
    bsr_id: str = ""
    marketplace: str = ""
    overall_health: str = ""
    health_reason: str = ""
    good_products: list[GoodProduct] = field(default_factory=list)
    proven_elements: list[ProvenElement] = field(default_factory=list)
    carrier_detail: list[dict] = field(default_factory=list)
    emerging_elements: list[dict] = field(default_factory=list)
    recommended_combos: list[RecommendedCombo] = field(default_factory=list)
    search_keywords: dict = field(default_factory=dict)  # {en: [...], cn: [...]}
    element_saturation: list[dict] = field(default_factory=list)
    price_gaps: list[dict] = field(default_factory=list)
    lightweight_summary: str = ""
    raw_response: str = ""


# ── Prompt 构建 ──────────────────────────────────────────────

SYSTEM_PROMPT = """你是亚马逊选品分析专家。你的任务是从郑总店铺已验证的商品数据中，提取可复用的选品模型。

## 核心原则
**脚本已经算好了数值（价格带、质量基准、载体统计、评论壁垒、卖家分布），你不需要重新计算。**
你的价值在于脚本做不到的事：从标题中提取元素/载体/场景、推断语义、发现跨品模式、生成搜索词、做出策略判断。

## 数据说明
- 数据源: deng_zong_shop（郑总28家英国亚马逊店铺），已验证样本
- 字段: asin, title, price, units, bsr, rating, ratings, listingDays, weightG(克), fba(£), variations, signals[]
- 上下文已附带脚本预计算的数据: priceBand, qualityBenchmark, reviewMoats, sellerStats — 直接引用，不要重算

信号标签: BURST(需求热点) / RISING(增长新品) / STABLE(长期爆款) / DECLINING(已衰退) / DEAD(已失效) / VARIANT(裂变) / SWEET_SPOT(理想价格£5.99-8.99)

## 输出 JSON 结构

### 1. overall_health + health_reason
综合分析信号分布+质量基准+卖家活跃度，判断品类健康度(healthy/stable/declining/risky)

### 2. good_products
从标题提取元素(elements)/载体(carriers)/场景(scenes)。元素是图案/主题/情绪词，载体是物理形态，场景是使用场合/人群。保留英文原文。
每个品: asin, elements[], carriers[], scenes[], keywords_en[](亚马逊英文搜索词), keywords_cn[](中文搜索词), lightweight(true/false/uncertain), is_good(bool), reason
郑总已验证品默认 is_good=true，只有纯DEAD才false。

### 3. proven_elements
跨商品聚合。发现同一元素在多个载体上成功 = 元素本身验证通过，概念可复用。
每个: name, frequency, carriers[], signal_tags[], insight(一句话发现)

### 4. carrier_detail
基于商品列表中的 pkg_weight 和 fba 字段，做出你的载体判断、轻小件判断和变体策略命名。
每个: name, count, avg_price, avg_weight_g, avg_fba, avg_variants, variant_strategy("高变体裂变(10+)" / "中等(4-9)" / "低变体(1-3)"), lightweight, lightweight_reason

### 5. emerging_elements
BURST标签或上架<30天的新元素，有先发优势也有风险。
每个: element, asin, signal, opportunity(一句话机会判断)

### 6. recommended_combos
元素×载体×场景的可行组合，10-20个。heat(已验证/新兴/待观察)，reason引用信号。
每个: elements[], carriers[], scenes[], keywords_en[], keywords_cn[], heat, reason

### 7. search_keywords
**重要**: 直接可在亚马逊搜索框使用的英文关键词和中文关键词。
- en: 10-20个买家会搜的英文词（如"metal wall decor", "funny sign", "memorial gift for loss of loved one"）
- cn: 5-10个中文词（如"金属墙饰", "慰问礼物"）
keywords_en 用于亚马逊搜索，keywords_cn 用于理解买家意图

### 8. element_saturation
引用脚本预计算的频次，你判断饱和度等级和含义。
每个: element, frequency, saturation(high≥5/medium2-4/low1), insight(一句话策略建议)

### 9. price_gaps
基于脚本预计算的 priceBand，你判断是否存在价格空白和机会。
[{range, opportunity}]

### 10. lightweight_summary
基于商品列表中的实际重量+FBA数据，一句话总结轻小件特征

## 约束
- 元素/载体/场景保留英文原文，keywords_en/keywords_cn 是独立的搜索词
- 不在DEAD品中提取元素推荐
- 数值引用脚本预计算数据，不要自己重算
- 输出严格JSON，不要markdown包裹"""


def build_analysis_prompt(analysis: SubCategoryAnalysis) -> str:
    """构建单小类的分析 prompt."""
    ctx = analysis.to_ai_context()
    products_json = json.dumps(ctx["products"], ensure_ascii=False, indent=2)
    stats_json = json.dumps(ctx["stats"], ensure_ascii=False, indent=2)
    signals_json = json.dumps(ctx["signalDistribution"], ensure_ascii=False, indent=2)

    return f"""## 当前小类

- 品线: {ctx['bsrId']}
- 小类: {ctx['nodeName']} (node_id: {ctx['nodeId']})
- 站点: UK
- 路径: {ctx['nodeFullPath']}

## 基础统计

{stats_json}

## 信号分布

{signals_json}

## 商品列表（已去重取样，最多40个）

{products_json}

请分析以上数据，按JSON格式输出结果。只输出JSON，不要其他文字。"""


# ── 结果解析 ─────────────────────────────────────────────────

def parse_ai_response(raw: str) -> AIResult:
    """解析 AI 返回的 JSON 字符串."""
    # 清理可能的 markdown 代码块包裹
    text = raw.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"AI JSON 解析失败，原始返回: {raw[:500]}")
        return AIResult(raw_response=raw)

    # ── 归一化：如果AI返回字符串而非对象，转为最小dict ──
    raw_carrier = data.get("carrier_detail", [])
    carrier_detail = []
    for cd in raw_carrier:
        if isinstance(cd, str):
            logger.warning(f"AI returned carrier_detail as string '{cd}', normalizing to dict")
            carrier_detail.append({"name": cd, "count": "?", "avg_price": "?", "avg_weight_g": "?", "avg_fba": "?", "avg_variants": "?", "variant_strategy": "?", "lightweight": "?"})
        else:
            carrier_detail.append(cd)

    raw_es = data.get("element_saturation", [])
    element_saturation = []
    for es in raw_es:
        if isinstance(es, str):
            logger.warning(f"AI returned element_saturation as string '{es}', normalizing to dict")
            element_saturation.append({"element": es, "frequency": "?", "saturation": "?", "insight": "?"})
        else:
            element_saturation.append(es)

    raw_ee = data.get("emerging_elements", [])
    emerging_elements = []
    for ee in raw_ee:
        if isinstance(ee, str):
            logger.warning(f"AI returned emerging_elements as string '{ee}', normalizing to dict")
            emerging_elements.append({"element": ee, "asin": "?", "signal": "?", "opportunity": "?"})
        else:
            emerging_elements.append(ee)

    raw_pg = data.get("price_gaps", [])
    price_gaps = []
    for pg in raw_pg:
        if isinstance(pg, str):
            logger.warning(f"AI returned price_gaps as string '{pg}', normalizing to dict")
            price_gaps.append({"range": pg, "opportunity": "?"})
        else:
            price_gaps.append(pg)

    result = AIResult(
        sub_category=data.get("sub_category", data.get("subCategory", "")),
        bsr_id=data.get("bsr_id", data.get("bsrId", "")),
        marketplace=data.get("marketplace", "UK"),
        overall_health=data.get("overall_health", ""),
        health_reason=data.get("health_reason", ""),
        search_keywords=data.get("search_keywords", {}),
        element_saturation=element_saturation,
        price_gaps=price_gaps,
        lightweight_summary=data.get("lightweight_summary", ""),
        raw_response=raw,
    )
    # 归一化后的列表附加到结果
    result.carrier_detail = carrier_detail
    result.emerging_elements = emerging_elements

    for pe in data.get("proven_elements", []):
        result.proven_elements.append(ProvenElement(
            name=pe.get("name", pe.get("element", "")),
            frequency=pe.get("frequency", 0),
            carriers=pe.get("carriers", []),
            signal_tags=pe.get("signal_tags", []),
            insight=pe.get("insight", ""),
        ))

    for gp in data.get("good_products", []):
        elements = gp.get("elements", gp.get("element", []))
        carriers = gp.get("carriers", gp.get("carrier", []))
        scenes = gp.get("scenes", gp.get("scene", []))
        kw_en = gp.get("keywords_en", gp.get("keyword_en", []))
        kw_cn = gp.get("keywords_cn", gp.get("keyword_cn", []))
        if "element" in gp and "elements" not in gp:
            logger.warning(f"AI returned 'element' (singular) for good_product, expected 'elements'")
        if "carrier" in gp and "carriers" not in gp:
            logger.warning(f"AI returned 'carrier' (singular) for good_product, expected 'carriers'")
        if isinstance(elements, str): elements = [elements]
        if isinstance(carriers, str): carriers = [carriers]
        if isinstance(scenes, str): scenes = [scenes]
        if isinstance(kw_en, str): kw_en = [kw_en]
        if isinstance(kw_cn, str): kw_cn = [kw_cn]

        result.good_products.append(GoodProduct(
            asin=gp.get("asin", ""),
            is_good=gp.get("is_good", True),
            reason=gp.get("reason", ""),
            elements=elements,
            carriers=carriers,
            scenes=scenes,
            keywords_en=kw_en,
            keywords_cn=kw_cn,
            lightweight=str(gp.get("lightweight", "")),
            lightweight_reason=str(gp.get("lightweight_reason", "")),
        ))

    for rc in data.get("recommended_combos", []):
        kw_en = rc.get("keywords_en", rc.get("keyword_en", []))
        kw_cn = rc.get("keywords_cn", rc.get("keyword_cn", []))
        if isinstance(kw_en, str): kw_en = [kw_en]
        if isinstance(kw_cn, str): kw_cn = [kw_cn]
        result.recommended_combos.append(RecommendedCombo(
            elements=rc.get("elements", rc.get("element", [])),
            carriers=rc.get("carriers", rc.get("carrier", [])),
            scenes=rc.get("scenes", rc.get("scene", [])),
            keywords_en=kw_en,
            keywords_cn=kw_cn,
            heat=str(rc.get("heat", "")),
            reason=str(rc.get("reason", "")),
        ))

    return result


# FIXED: MED-10 env-controlled thinking disable
def should_disable_thinking() -> bool:
    """Check env DEEPSEEK_DISABLE_THINKING; default enabled (1)."""
    return os.environ.get("DEEPSEEK_DISABLE_THINKING", "1").lower() in ("1", "true", "yes")


# ── 主入口 ───────────────────────────────────────────────────

def ai_analyze(analysis: SubCategoryAnalysis, model: str = "deepseek-v4-flash") -> AIResult | None:
    """
    对单个小类执行 AI 分析.

    Args:
        analysis: 预处理后的子品类数据
        model: DeepSeek 模型名

    Returns:
        AIResult or None on failure
    """
    client = _get_client()
    prompt = build_analysis_prompt(analysis)

    logger.info(f"  AI分析: {analysis.node_name} ({len(analysis.sampled_products)} products)")

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=32768,
            extra_body=({"thinking": {"type": "disabled"}} if should_disable_thinking() else None),  # FIXED: MED-10
        )
        raw = response.choices[0].message.content or ""
        logger.info(f"  AI返回: {len(raw)} chars, {response.usage.total_tokens if response.usage else '?'} tokens")

        result = parse_ai_response(raw)
        result.sub_category = analysis.node_name
        result.bsr_id = analysis.bsr_id
        return result

    except Exception as e:
        logger.error(f"  AI分析失败 [{analysis.node_name}]: {e}")
        return None
