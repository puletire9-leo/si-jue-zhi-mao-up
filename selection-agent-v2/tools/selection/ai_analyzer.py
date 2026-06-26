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
import time as _time
from dataclasses import dataclass, field
from typing import Any

import httpx
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
                    http_client=httpx.Client(limits=httpx.Limits(max_connections=200, max_keepalive_connections=50)),
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


VALID_FILTER_FIELDS = {"listingDays", "weightG", "units", "bsr"}
VALID_FILTER_OPS = {"lt", "le", "eq", "ge", "gt"}


def _validate_filter_rules(rules: list) -> list:
    """Validate filter_rules against whitelist, discard invalid items."""
    validated = []
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        conditions = rule.get("conditions", [])
        if not isinstance(conditions, list) or not conditions:
            continue
        valid_conds = []
        for cond in conditions:
            if not isinstance(cond, dict):
                continue
            field = cond.get("field")
            op = cond.get("op")
            value = cond.get("value")
            if field not in VALID_FILTER_FIELDS:
                continue
            if op not in VALID_FILTER_OPS:
                continue
            if not isinstance(value, (int, float)):
                continue
            valid_conds.append({"field": field, "op": op, "value": value})
        if valid_conds:
            validated.append({"conditions": valid_conds})
    return validated


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
    search_keywords: dict = field(default_factory=dict)
    element_saturation: list[dict] = field(default_factory=list)
    price_gaps: list[dict] = field(default_factory=list)
    lightweight_summary: str = ""
    filter_rules: list[dict] = field(default_factory=list)
    raw_response: str = ""


# ── Prompt 构建 ──────────────────────────────────────────────

SYSTEM_PROMPT = """你是亚马逊选品分析专家。你的任务是从郑总店铺已验证的商品数据中，提取可复用的选品模型。

## 核心原则
**脚本已预计算数值（priceBand/qualityBenchmark/reviewMoats/sellerStats），直接引用这些聚合数据，不要逐品重新计算。**
你的价值在于脚本做不到的事：从标题中提取元素/载体/场景、推断语义、发现跨品模式、生成搜索词、做出策略判断。

## 数据说明
- 数据源: deng_zong_shop（郑总28家英国亚马逊店铺），已验证样本
- 字段: asin, title, price, signals[]

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

### 4. carrier_summary (注意：不再是 carrier_detail)
仅输出载体名称列表，数值统计由脚本后处理。
格式: ["Poster", "Shelf Sign", "Wall Art"]

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

### 11. filter_rules (自动筛选规则)
将分析结果转化为可执行的筛选规则。每条规则内条件为 AND 关系，规则之间为 OR 关系。
字段仅限: listingDays(上架天数), weightG(重量g), units(月销量), bsr(BSR排名)
运算符仅限: lt(<), le(≤), eq(=), ge(≥), gt(>)
value 必须为数字。

示例:
"filter_rules": [
  {"conditions": [{"field": "listingDays", "op": "le", "value": 90}, {"field": "units", "op": "gt", "value": 50}]},
  {"conditions": [{"field": "weightG", "op": "le", "value": 500}]}
]

## 约束
- 元素/载体/场景保留英文原文，keywords_en/keywords_cn 是独立的搜索词
- 不在DEAD品中提取元素推荐
- 数值引用脚本预计算数据，不要自己重算
- filter_rules 只使用白名单字段(4个)和运算符(5个)，value 为数字
- 输出严格JSON，不要markdown包裹"""


def build_analysis_prompt(analysis: SubCategoryAnalysis) -> str:
    """构建单小类的分析 prompt."""
    ctx = analysis.to_ai_context()
    products_compact = [
        {"asin": p["asin"], "title": p["title"], "price": p["price"], "signals": p["signals"]}
        for p in ctx["products"]
    ]
    products_json = json.dumps(products_compact, ensure_ascii=False, indent=2)
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
        raise ValueError("AI response is not valid JSON")

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
        filter_rules=_validate_filter_rules(data.get("filter_rules", [])),
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


# ── 主入口 ───────────────────────────────────────────────────

def ai_analyze(analysis: SubCategoryAnalysis, model: str = "deepseek-v4-flash", batch_id: str = "", max_retries: int = 3) -> AIResult | None:
    """
    对单个小类执行 AI 分析.

    Args:
        analysis: 预处理后的子品类数据
        model: DeepSeek 模型名
        batch_id: 批次标识(用于AI侧追踪)
        max_retries: 最大重试次数

    Returns:
        AIResult or None on failure
    """
    client = _get_client()
    prompt = build_analysis_prompt(analysis)

    logger.info(f"  AI分析: {analysis.node_name} ({len(analysis.sampled_products)} products)")

    for attempt in range(max_retries + 1):  # +1 for initial call, then retries
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=32768,
                reasoning_effort="medium",
                extra_body={
                    "thinking": {"type": "enabled"},
                    "user_id": batch_id.replace("/", "_") if batch_id else "",
                },
            )
            raw = response.choices[0].message.content or ""
            logger.info(f"  AI返回: {len(raw)} chars, {response.usage.total_tokens if response.usage else '?'} tokens")

            result = parse_ai_response(raw)
            result.sub_category = analysis.node_name
            result.bsr_id = analysis.bsr_id
            return result

        except Exception as e:
            if attempt == max_retries:  # last attempt
                logger.error(f"  AI分析失败(已重试{max_retries}次) [{analysis.node_name}]: {e}")
                return None
            wait = min(2 ** (attempt + 1), 30)
            logger.warning(f"  AI调用失败(第{attempt+1}次)，{wait}s后重试 [{analysis.node_name}]: {e}")
            _time.sleep(wait)
    return None
