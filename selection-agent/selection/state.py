"""选品分析状态定义 — SelectionState TypedDict。

所有字段标注生命周期:
  @producer: 写入该字段的节点
  @consumer: 读取该字段的节点

参考 SuperMew RAG 的 state.py v4.7 模式。
"""

from typing import Any, Dict, List, Optional, TypedDict


class SelectionState(TypedDict, total=False):
    """选品分析完整状态 — 约25字段。

    数据流: data_fetch → 8能力节点 → final_verdict
    """

    # ═══ 输入 (由前端/runner设置) ═══
    # @producer: runner.create_initial_state()
    # @consumer: data_fetch
    batch_id: str
    marketplace: str           # UK / DE / US

    # ═══ 节点0: data_fetch ═══
    # @producer: data_fetch
    # @consumer: 所有能力节点（作为原始数据源）
    raw_data: Dict[str, Any]   # Java返回的完整聚合JSON
    sub_categories: List[Dict] # 解析后的小类列表

    # ═══ 节点1: 语义品类理解 ═══
    # @producer: semantic_understanding
    # @consumer: profit_estimation, differentiation_*, risk_radar
    category_understanding: Dict   # 原型 + 消费者画像 + 使用场景
    current_archetype: str         # FP/TN/PS/DC/SP/AS

    # ═══ 节点2: 竞争格局 ═══
    # @producer: competition_analysis
    # @consumer: risk_radar, final_verdict
    competition_structure: Dict    # 格局类型 + CR3 + 价格空白 + 品牌定位

    # ═══ 节点3: 生命周期 ═══
    # @producer: lifecycle_judgment
    # @consumer: risk_radar, final_verdict
    lifecycle_stage: Dict          # 阶段 + 信号 + 紧急度

    # ═══ 节点4: 利润推算 ═══
    # @producer: profit_estimation
    # @consumer: differentiation_* (条件分支), risk_radar, final_verdict
    profit_feasibility: Dict       # 三场景利润率 + 盈亏平衡
    profit_margin_typical: float   # 典型利润率（条件分支判断用）

    # ═══ 节点5: 差异化切入点 (二选一) ═══
    # @producer: differentiation_full 或 differentiation_quick
    # @consumer: risk_radar, final_verdict
    differentiation_result: Dict   # 切入角度 + 方案 + 推荐

    # ═══ 节点6: 风险雷达 ═══
    # @producer: risk_radar
    # @consumer: final_verdict
    risk_radar: Dict               # 6类风险 + 严重度 + GoNoGo
    go_no_go: str                  # GO / CONDITIONAL_GO / NO_GO / WAIT_AND_SEE

    # ═══ 节点7: 跨品线关联 ═══
    # @producer: cross_line_discovery
    # @consumer: final_verdict
    cross_line_insights: Dict      # 关联类型 + 捆绑机会

    # ═══ 节点8: 最终裁决 ═══
    # @producer: final_verdict
    # @consumer: runner (回写Java)
    final_verdict: Dict            # 完整裁决JSON
    recommend_level: str           # STRONGLY_RECOMMEND / RECOMMEND / WATCH / AVOID
    opportunity_score: int         # 0-100

    # ═══ 元数据 ═══
    # @producer: runner / 各节点
    # @consumer: runner (SSE推送 + 错误上报)
    analysis_errors: List[str]     # 错误日志（不阻断流程，记录后继续）
    sse_events: List[Dict]         # SSE进度事件队列
    processing_time_ms: int        # 总处理耗时
    model_version: str             # LLM版本信息
