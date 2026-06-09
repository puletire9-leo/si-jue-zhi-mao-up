"""节点: seller_profiling — 卖家行为画像增强。

对应能力: §三 3维聪明卖家评分 + 品类热度 + 跟品信号
输入: 前面所有节点的输出（marketplace, current_archetype, sub_categories）
输出: State.seller_profiling, State.seller_heat_signal, State.seller_recommendations

模式: 算法先算（确定性）→ LLM增强解读
  1. 从 Java 读取预计算卖家画像 → 筛选当前品类活跃卖家
  2. 调用 build_category_heat_matrix() (单品类)
  3. 调用 detect_follow_signals() (单品类)
  4. LLM 生成自然语言卖家洞察摘要
"""

import logging
from typing import Any, Dict, List, Optional

from selection.state import SelectionState
from selection.algorithms.seller_profiling import (
    build_category_heat_matrix,
    detect_follow_signals,
    generate_smart_recommendations,
    SellerProfile,
    CategoryHeatRow,
    FollowSignal,
)

logger = logging.getLogger(__name__)


async def seller_profiling_node(state: SelectionState) -> Dict[str, Any]:
    """单品类卖家行为画像增强节点。

    按 risk_radar.py 模式: 算法先算 → LLM增强解读。
    从 Java 读取预计算画像，筛选当前品类活跃卖家，
    计算热度矩阵+跟品信号，LLM生成洞察摘要。
    """
    logger.info("[能力7] 卖家行为画像 — 开始")

    marketplace = state.get("marketplace", "UK")
    subs = state.get("sub_categories", [])
    sub = subs[0] if subs else {}
    category_label = sub.get("nodeName", "")

    errors: List[str] = []

    # ── Step 1: 尝试从 Java 获取预计算的卖家画像 ──
    seller_profiles: List[SellerProfile] = []
    external_profiles: List[SellerProfile] = []
    dengzong_names: set = set()
    seller_grades: Dict[str, str] = {}
    products_by_category: Dict[str, List[Dict[str, Any]]] = {}

    try:
        from selection.java_client import get_java_client
        client = get_java_client()

        # 获取郑总店铺名单
        try:
            dengzong_shops = await client.get_dengzong_shops(marketplace)
            dengzong_names = set(dengzong_shops)
        except Exception as e:
            logger.debug(f"[seller_profiling] 无法获取郑总名单: {e}")

        # 获取当前品类卖家原始数据
        try:
            raw_sellers = await client.get_seller_profiles_by_category(
                marketplace=marketplace,
                category=category_label,
            )
            if raw_sellers:
                # 组装 products_by_category 用于算法
                for s in raw_sellers:
                    cat = s.get("category", category_label)
                    if cat not in products_by_category:
                        products_by_category[cat] = []
                    products_by_category[cat].append(s)

                # 构建简化的 SellerProfile 列表
                for s_data in raw_sellers:
                    sn = s_data.get("seller_name", s_data.get("sellerName", ""))
                    grade = s_data.get("grade", "C")
                    seller_grades[sn] = grade

                    profile = SellerProfile(
                        seller_name=sn,
                        marketplace=marketplace,
                        month=s_data.get("month", ""),
                        is_dengzong=sn in dengzong_names,
                        smart_score=s_data.get("smart_score", 0),
                        vision_score=s_data.get("vision_score", 0),
                        new_success_rate=s_data.get("new_success_rate", 0),
                        profit_percentile=s_data.get("profit_percentile", 0),
                        grade=grade,
                        archetype=s_data.get("archetype", "UNKNOWN"),
                        product_count=s_data.get("product_count", 0),
                        new_product_count=s_data.get("new_product_count", 0),
                        avg_units=s_data.get("avg_units", 0),
                        avg_bsr=s_data.get("avg_bsr", 0),
                        category_focus=s_data.get("category_focus", {}),
                    )
                    if sn in dengzong_names:
                        seller_profiles.append(profile)
                    else:
                        external_profiles.append(profile)

                logger.info(
                    f"[seller_profiling] 获取到 {len(raw_sellers)} 条卖家数据"
                )
        except Exception as e:
            logger.debug(f"[seller_profiling] Java 卖家数据不可用: {e}")

    except Exception as e:
        logger.warning(f"[seller_profiling] Java 客户端不可用: {e}")

    # ── Step 2: 确定性算法 ──
    # 品类热度矩阵
    heat_rows: List[CategoryHeatRow] = []
    if seller_profiles or external_profiles or products_by_category:
        try:
            heat_rows = build_category_heat_matrix(
                dengzong_profiles=seller_profiles,
                external_profiles=external_profiles,
                products_by_category=products_by_category,
            )
            logger.info(f"[seller_profiling] 热度矩阵: {len(heat_rows)} 行")
        except Exception as e:
            errors.append(f"热度矩阵计算失败: {e}")
            logger.warning(f"[seller_profiling] 热度矩阵失败: {e}")

    # 跟品信号
    follow_signals: List[FollowSignal] = []
    if products_by_category and seller_grades:
        try:
            follow_signals = detect_follow_signals(
                products_by_category=products_by_category,
                seller_grades=seller_grades,
                dengzong_names=dengzong_names,
            )
            logger.info(
                f"[seller_profiling] 跟品信号: {len(follow_signals)} 条"
            )
        except Exception as e:
            errors.append(f"跟品信号检测失败: {e}")
            logger.warning(f"[seller_profiling] 跟品信号失败: {e}")

    # 智能推荐
    recommendations: List[Dict[str, Any]] = []
    if heat_rows or follow_signals:
        try:
            recs = generate_smart_recommendations(
                heat_matrix=heat_rows,
                follow_signals=follow_signals,
            )
            recommendations = [r.to_dict() for r in recs]
        except Exception as e:
            errors.append(f"智能推荐生成失败: {e}")
            logger.warning(f"[seller_profiling] 推荐失败: {e}")

    # 热度信号（取当前品类的热度）
    current_heat = next(
        (r for r in heat_rows if r.category == category_label),
        None,
    )
    heat_signal = current_heat.heat_signal if current_heat else "📊"

    # 卖家画像结果
    profiling_result: Dict[str, Any] = {
        "category": category_label,
        "marketplace": marketplace,
        "total_sellers": len(seller_profiles) + len(external_profiles),
        "dengzong_count": len(seller_profiles),
        "external_s_count": sum(
            1 for p in external_profiles if p.grade in ("S", "A")
        ),
        "heat_signal": heat_signal,
        "heat_matrix": [r.to_dict() for r in heat_rows],
        "follow_signals": [s.to_dict() for s in follow_signals],
        "recommendations": recommendations,
    }

    # ── Step 3: LLM 增强解读 ──
    seller_insight_summary = ""
    if profiling_result["total_sellers"] > 0:
        try:
            from selection.llm_utils import call_llm_json
            from selection.prompt_templates import SELLER_PROFILING_PROMPT

            llm_input = {
                "category": category_label,
                "archetype": state.get("current_archetype", "UNKNOWN"),
                "profiling": profiling_result,
                "blue_ocean": (
                    state.get("competition_structure", {})
                    .get("blueOcean", {})
                ),
            }

            llm_result = await call_llm_json(
                SELLER_PROFILING_PROMPT, llm_input, "seller_profiling"
            )

            if llm_result and isinstance(llm_result, dict):
                seller_insight_summary = llm_result.get(
                    "summary", llm_result.get("insight", "")
                )
                if isinstance(seller_insight_summary, str) and seller_insight_summary:
                    logger.info(
                        f"[seller_profiling] LLM 解读: "
                        f"{seller_insight_summary[:80]}..."
                    )
            else:
                seller_insight_summary = _fallback_insight(profiling_result)

        except Exception as e:
            logger.warning(f"[seller_profiling] LLM 调用失败: {e}")
            seller_insight_summary = _fallback_insight(profiling_result)
    else:
        seller_insight_summary = (
            f"暂无{category_label}品类的卖家行为画像数据（Java 端点未就绪），"
            f"将在月度扫描任务完成后补全。"
        )

    return {
        "seller_profiling": profiling_result,
        "seller_heat_signal": heat_signal,
        "seller_recommendations": recommendations,
        "analysis_errors": state.get("analysis_errors", []) + errors,
        # 注入 seller_insight_summary 到 risk_radar 供后续展示
        "risk_radar": {
            **state.get("risk_radar", {}),
            "seller_insight": seller_insight_summary,
        },
    }


def _fallback_insight(profiling: Dict[str, Any]) -> str:
    """LLM 不可用时的确定性摘要。"""
    heat = profiling.get("heat_signal", "📊")
    total = profiling.get("total_sellers", 0)
    dz = profiling.get("dengzong_count", 0)
    ext_s = profiling.get("external_s_count", 0)
    signals = profiling.get("follow_signals", [])
    recs = profiling.get("recommendations", [])

    parts = []
    if heat == "🔥":
        parts.append(f"郑总重仓信号{heat}（{dz}店），聪明卖家密集")
    elif heat == "🌊":
        parts.append(f"冷门品类{heat}（共{total}卖家），先发优势窗口")
    elif heat == "⚡":
        parts.append(f"外部聪明卖家活跃{heat}（{ext_s}个S/A级），郑总暂未布局")
    else:
        parts.append(f"品类热度一般{heat}（{total}卖家，郑总{dz}店）")

    if signals:
        strong = [s for s in signals if s.get("signal_strength") == "strong"]
        if strong:
            parts.append(f"检测到{len(strong)}个强跟品信号")

    if recs:
        parts.append(f"共{len(recs)}条智能推荐")

    return "；".join(parts) if parts else "暂无卖家行为数据"
