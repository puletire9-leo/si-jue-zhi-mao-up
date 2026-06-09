"""Selection Graph — 11节点分析图 LangGraph StateGraph 构建。

图结构:
```
分析图（每个小类独立运行一次）:
START → semantic_understanding → competition_analysis
  → lifecycle_judgment → profit_estimation
    ├─ margin ≥ 30% → differentiation_full  ─┐
    └─ margin < 30% → differentiation_quick ─┤
                                              ├→ risk_radar → seller_profiling → cross_line_discovery → burst_signal_detection → final_verdict → END
```
data_fetch 是纯数据操作，在 runner 层调用一次，不进分析图。

参考 SuperMew RAG 的 graph.py 单例锁懒加载模式。
"""

import logging
import threading
from typing import Any, Dict

from langgraph.graph import StateGraph, END

from selection.state import SelectionState
from selection.nodes.semantic_understanding import semantic_understanding_node
from selection.nodes.competition_analysis import competition_analysis_node
from selection.nodes.lifecycle_judgment import lifecycle_judgment_node
from selection.nodes.profit_estimation import profit_estimation_node
from selection.nodes.differentiation_full import differentiation_full_node
from selection.nodes.differentiation_quick import differentiation_quick_node
from selection.nodes.risk_radar import risk_radar_node
from selection.nodes.seller_profiling_node import seller_profiling_node
from selection.nodes.cross_line_discovery import cross_line_discovery_node
from selection.nodes.burst_signal_detection import burst_signal_detection_node
from selection.nodes.final_verdict import final_verdict_node

logger = logging.getLogger(__name__)


# ═══ 条件路由函数 ═══


def route_differentiation(state: SelectionState) -> str:
    """根据典型利润率决定走哪个差异化分支。

    - margin >= 30% → 完整版（3个方案）
    - margin < 30%  → 快速版（1个建议）
    """
    margin = state.get("profit_margin_typical", 0.0)
    if margin >= 30.0:
        return "differentiation_full"
    return "differentiation_quick"


# ═══ 图构建 ═══


def _build_screening_graph() -> StateGraph:
    """构建初筛图（能力1-4）。

    只运行语义理解→竞争→生命周期→利润推算，
    用于快速评分决定是否进行深度分析。
    """
    graph = StateGraph(SelectionState)

    graph.add_node("semantic_understanding", semantic_understanding_node)
    graph.add_node("competition_analysis", competition_analysis_node)
    graph.add_node("lifecycle_judgment", lifecycle_judgment_node)
    graph.add_node("profit_estimation", profit_estimation_node)

    graph.set_entry_point("semantic_understanding")
    graph.add_edge("semantic_understanding", "competition_analysis")
    graph.add_edge("competition_analysis", "lifecycle_judgment")
    graph.add_edge("lifecycle_judgment", "profit_estimation")
    graph.add_edge("profit_estimation", END)

    return graph


def _build_deep_graph() -> StateGraph:
    """构建深度分析图（能力5-8）。

    从差异化→风险→跨品线→最终裁决。
    假设 state 中已有能力1-4的输出。
    使用 differentiation_router 节点做利润率分支判定。
    """
    graph = StateGraph(SelectionState)

    # 路由器节点：根据利润率决定走 full 还是 quick
    async def differentiation_router(state: SelectionState) -> Dict[str, Any]:
        """纯路由，不修改 state，仅返回路由标记。"""
        return {}  # 不修改任何状态

    graph.add_node("differentiation_router", differentiation_router)
    graph.add_node("differentiation_full", differentiation_full_node)
    graph.add_node("differentiation_quick", differentiation_quick_node)
    graph.add_node("risk_radar", risk_radar_node)
    graph.add_node("seller_profiling", seller_profiling_node)
    graph.add_node("cross_line_discovery", cross_line_discovery_node)
    graph.add_node("burst_signal_detection", burst_signal_detection_node)
    graph.add_node("final_verdict", final_verdict_node)

    graph.set_entry_point("differentiation_router")
    graph.add_conditional_edges(
        "differentiation_router",
        route_differentiation,
        {
            "differentiation_full": "differentiation_full",
            "differentiation_quick": "differentiation_quick",
        },
    )

    graph.add_edge("differentiation_full", "risk_radar")
    graph.add_edge("differentiation_quick", "risk_radar")
    graph.add_edge("risk_radar", "seller_profiling")
    graph.add_edge("seller_profiling", "cross_line_discovery")
    graph.add_edge("cross_line_discovery", "burst_signal_detection")
    graph.add_edge("burst_signal_detection", "final_verdict")
    graph.add_edge("final_verdict", END)

    return graph


def _build_full_graph() -> StateGraph:
    """构建完整分析图（11节点，新增卖家行为画像）。"""
    graph = StateGraph(SelectionState)

    graph.add_node("semantic_understanding", semantic_understanding_node)
    graph.add_node("competition_analysis", competition_analysis_node)
    graph.add_node("lifecycle_judgment", lifecycle_judgment_node)
    graph.add_node("profit_estimation", profit_estimation_node)
    graph.add_node("differentiation_full", differentiation_full_node)
    graph.add_node("differentiation_quick", differentiation_quick_node)
    graph.add_node("risk_radar", risk_radar_node)
    graph.add_node("seller_profiling", seller_profiling_node)
    graph.add_node("cross_line_discovery", cross_line_discovery_node)
    graph.add_node("burst_signal_detection", burst_signal_detection_node)
    graph.add_node("final_verdict", final_verdict_node)

    graph.set_entry_point("semantic_understanding")

    graph.add_edge("semantic_understanding", "competition_analysis")
    graph.add_edge("competition_analysis", "lifecycle_judgment")
    graph.add_edge("lifecycle_judgment", "profit_estimation")

    graph.add_conditional_edges(
        "profit_estimation",
        route_differentiation,
        {
            "differentiation_full": "differentiation_full",
            "differentiation_quick": "differentiation_quick",
        },
    )

    graph.add_edge("differentiation_full", "risk_radar")
    graph.add_edge("differentiation_quick", "risk_radar")
    graph.add_edge("risk_radar", "seller_profiling")
    graph.add_edge("seller_profiling", "cross_line_discovery")
    graph.add_edge("cross_line_discovery", "burst_signal_detection")
    graph.add_edge("burst_signal_detection", "final_verdict")
    graph.add_edge("final_verdict", END)

    return graph


# ═══ 全局单例（参考 SuperMew graph.py 的 threading.Lock 模式） ═══

_lock = threading.Lock()
_compiled_full_graph = None
_compiled_screening_graph = None
_compiled_deep_graph = None


def get_selection_graph():
    """获取全局编译好的完整 Selection Graph 单例（懒加载）。"""
    global _compiled_full_graph
    if _compiled_full_graph is None:
        with _lock:
            if _compiled_full_graph is None:
                logger.info("首次构建 Selection Graph...")
                _compiled_full_graph = _build_full_graph().compile()
                logger.info("Selection Graph 构建完成 (11分析节点 + 1条件边)")
    return _compiled_full_graph


def get_screening_graph():
    """获取初筛图（能力1-4），用于快速评分。"""
    global _compiled_screening_graph
    if _compiled_screening_graph is None:
        with _lock:
            if _compiled_screening_graph is None:
                logger.info("构建初筛 Graph (能力1-4)...")
                _compiled_screening_graph = _build_screening_graph().compile()
    return _compiled_screening_graph


def get_deep_graph():
    """获取深度分析图（能力5-8），用于初筛后的深度分析。"""
    global _compiled_deep_graph
    if _compiled_deep_graph is None:
        with _lock:
            if _compiled_deep_graph is None:
                logger.info("构建深度分析 Graph (能力5-8)...")
                _compiled_deep_graph = _build_deep_graph().compile()
    return _compiled_deep_graph
