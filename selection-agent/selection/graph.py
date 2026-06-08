"""Selection Graph — 9节点分析图 LangGraph StateGraph 构建。

图结构:
```
分析图（每个小类独立运行一次）:
START → semantic_understanding → competition_analysis
  → lifecycle_judgment → profit_estimation
    ├─ margin ≥ 30% → differentiation_full  ─┐
    └─ margin < 30% → differentiation_quick ─┤
                                              ├→ risk_radar → cross_line_discovery → final_verdict → END
```
data_fetch 是纯数据操作，在 runner 层调用一次，不进分析图。

参考 SuperMew RAG 的 graph.py 单例锁懒加载模式。
"""

import logging
import threading

from langgraph.graph import StateGraph, END

from selection.state import SelectionState
from selection.nodes.semantic_understanding import semantic_understanding_node
from selection.nodes.competition_analysis import competition_analysis_node
from selection.nodes.lifecycle_judgment import lifecycle_judgment_node
from selection.nodes.profit_estimation import profit_estimation_node
from selection.nodes.differentiation_full import differentiation_full_node
from selection.nodes.differentiation_quick import differentiation_quick_node
from selection.nodes.risk_radar import risk_radar_node
from selection.nodes.cross_line_discovery import cross_line_discovery_node
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


def _build_graph() -> StateGraph:
    """构建分析图（9节点，不含 data_fetch）。

    data_fetch 在 runner 层单独调用一次，
    此图处理单个小类的完整分析流程。
    """
    graph = StateGraph(SelectionState)

    # 添加9个分析节点（data_fetch 在 runner 层处理）
    graph.add_node("semantic_understanding", semantic_understanding_node)
    graph.add_node("competition_analysis", competition_analysis_node)
    graph.add_node("lifecycle_judgment", lifecycle_judgment_node)
    graph.add_node("profit_estimation", profit_estimation_node)
    graph.add_node("differentiation_full", differentiation_full_node)
    graph.add_node("differentiation_quick", differentiation_quick_node)
    graph.add_node("risk_radar", risk_radar_node)
    graph.add_node("cross_line_discovery", cross_line_discovery_node)
    graph.add_node("final_verdict", final_verdict_node)

    # 入口节点
    graph.set_entry_point("semantic_understanding")

    # 线性流: 1 → 2 → 3 → 4
    graph.add_edge("semantic_understanding", "competition_analysis")
    graph.add_edge("competition_analysis", "lifecycle_judgment")
    graph.add_edge("lifecycle_judgment", "profit_estimation")

    # ★ 唯一的条件边：根据利润率选择差异化深度 ★
    graph.add_conditional_edges(
        "profit_estimation",
        route_differentiation,
        {
            "differentiation_full": "differentiation_full",
            "differentiation_quick": "differentiation_quick",
        },
    )

    # 两个分支汇合后继续: 6 → 7 → 8 → END
    graph.add_edge("differentiation_full", "risk_radar")
    graph.add_edge("differentiation_quick", "risk_radar")
    graph.add_edge("risk_radar", "cross_line_discovery")
    graph.add_edge("cross_line_discovery", "final_verdict")
    graph.add_edge("final_verdict", END)

    return graph


# ═══ 全局单例（参考 SuperMew graph.py 的 threading.Lock 模式） ═══

_lock = threading.Lock()
_compiled_graph = None


def get_selection_graph():
    """获取全局编译好的 Selection Graph 单例（懒加载）。"""
    global _compiled_graph
    if _compiled_graph is None:
        with _lock:
            if _compiled_graph is None:
                logger.info("首次构建 Selection Graph...")
                _compiled_graph = _build_graph().compile()
                logger.info("Selection Graph 构建完成 (9分析节点 + 1条件边)")
    return _compiled_graph
