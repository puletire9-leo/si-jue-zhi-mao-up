# SuperMew 选品模块接入方案 v1

> **定位**：在现有 SuperMew (sijue-agengtic-rag) Agentic RAG 项目中，新增选品分析 Selection Graph 模块。
> **核心原则**：复用 SuperMew 的 LangGraph 引擎、LLM 初始化、Runner 模式、API 风格，新增独立的 selection/ 包。
> **废弃说明**：本文档替代原 `hermes-中转站架构设计.md`（Hermes 方案已放弃）。

---

## 一、为什么是 SuperMew 而不是 Hermes

| 维度 | Hermes | SuperMew（本项目已有） |
|------|--------|---------------------|
| 是否需要新部署？ | 是（独立进程+17K测试+70工具） | **否**（Python后端已运行） |
| LangGraph 成熟度 | 有 | **有（18节点RAG Graph已验证）** |
| LLM 配置 | 需要重新配置 | **复用 .env 中的 MODEL/BASE_URL/API_KEY** |
| 工具注册机制 | registry.py | **有 tool_system/registry.py** |
| API 风格 | 自带 Web/Desktop | **有 FastAPI + routers/** |
| 数据库连接 | SQLite | **有 PostgreSQL + Redis + Milvus** |
| 扩展方式 | Skill/Tool/Plugin | **新增 graph 包即可** |

**结论：SuperMew 就是我们的 LangGraph Agent 引擎。选品 = 新增一个 Graph。**

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户交互层                               │
│                                                             │
│  Vue 前端 (:5173)                                            │
│     ├─ 产品管理页面（现有）                                    │
│     ├─ 商品树页面（现有设计）                                   │
│     └─ 品线推送页面（新增 ★）                                  │
│           │ 点击 [开始分析]                                     │
│           ▼                                                  │
├─────────────────────────────────────────────────────────────┤
│                     Java 后端 (:8080)                         │
│                                                             │
│  现有模块（不变）：                                           │
│  ├─ CompetitorController / DengZongShopController            │
│  └─ deng_zong_shop 表 / competitor_products 表               │
│                                                             │
│  新增 ProductLine 模块（★）：                                 │
│  ├─ ProductLineController                                    │
│  │   ├─ GET  /api/v1/product-line/aggregated-data            │
│  │   ├─ POST /api/v1/product-line/analysis-results           │
│  │   └─ GET  /api/v1/product-line/guidance                   │
│  ├─ ProductLineService                                       │
│  │   ├─ aggregateData()      → SQL聚合 deng_zong_shop        │
│  │   ├─ saveGuidance()       → 写入 product_line_guidance    │
│  │   └─ queryGuidance()      → 分页查询推送结果              │
│  └─ product_line_guidance 表（DDL 新增）                     │
│                                                             │
├═════════════════════════════════════════════════════════════┤
│                  HTTP 调用（Java → Python）                    │
│                                                             │
│   Java:8080 ←── GET aggregated-data ──→ Python:8000          │
│   Java:8080 ←── POST analysis-results ←── Python:8000        │
│   Vue:5173  ←── GET guidance ───────────→ Java:8080          │
│                                                             │
├═════════════════════════════════════════════════════════════┤
│                Python 后端 — SuperMew (:8000)                 │
│                                                             │
│  现有模块（完全不动）：                                        │
│  ├── agent.py / agent_factory.py                             │
│  ├── agentic_rag/ (RAG Graph: 18节点)                       │
│  ├── routers/chat.py / documents.py / openai_compatible.py   │
│  ├── tool_system/registry.py                                │
│  ├── memory/, guardrails/, core/                             │
│  └── 基础设施: PostgreSQL + Redis + Milvus                   │
│                                                             │
│  新增 selection/ 模块（★）：                                   │
│  ├── selection/state.py         → SelectionState 定义        │
│  ├── selection/graph.py          → 9节点图构建                │
│  ├── selection/nodes/             → 8大能力节点                │
│  │   ├── semantic_understanding.py   能力1: 语义品类理解      │
│  │   ├── competition_analysis.py     能力2: 竞争格局解剖      │
│  │   ├── lifecycle_judgment.py       能力3: 生命周期判断      │
│  │   ├── profit_estimation.py        能力4: 利润可行性推算    │
│  │   ├── differentiation.py          能力5: 差异化切入点      │
│  │   ├── risk_assessment.py          能力6: 风险雷达          │
│  │   ├── cross_line_discovery.py     能力7: 跨品线关联        │
│  │   └── final_verdict.py            能力8: 最终裁决          │
│  ├── selection/runner.py         → 运行入口（对标rag runner）  │
│  ├── selection/java_client.py     → Java后端HTTP客户端        │
│  ├── selection/prompt_templates.py → 8能力Prompt模板          │
│  └── routers/selection.py         → FastAPI路由端点           │
│                                                             │
│  api.py 追加一行：                                           │
│    router.include_router(selection_router)  ★                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、Selection Graph 详细设计

### 3.1 图结构

```
START
  │
  ▼
┌─────────────────────┐
│ semantic_understanding │  能力1: 语义品类理解
│ (node_semantic_...   )   输入: nodeName + nodeFullPath + sampleTitles
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ competition_analysis  │  能力2: 竞争格局解剖
│ (node_competition_..)   输入: topBrands + sampleProducts(5维)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ lifecycle_judgment   │  能力3: 生命周期判断
│ (node_lifecycle_..)    输入: unitsGr + bsrCr + ratings
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ profit_estimation     │  能力4: 利润可行性推算
│ (node_profit_...)      输入: avgPrice + bsrId + units
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │ 条件分支   │  profit_margin >= 30%?
     │             │
     ▼             ▼
┌────────────┐  ┌────────────┐
│ diff_deep  │  │ diff_quick  │  能力5: 差异化切入点
│ (3个方案)   │  │ (1个建议)    │
└─────┬──────┘  └─────┬──────┘
      └──────┬───────┘
             │
             ▼
┌─────────────────────┐
│ risk_assessment      │  能力6: 风险雷达
│ (node_risk_...)        输入: 全部维度综合
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ cross_line_discovery │  能力7: 跨品线关联
│ (node_cross_line_..)   输入: 同批次其他小类数据
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ final_verdict         │  能力8: 最终裁决
│ (node_final_...)       输出: recommendLevel + actionPlan
└──────────┬──────────┘
           │
           ▼
         END  → 返回完整状态字典
```

### 3.2 与 RAG Graph 的对比

| 维度 | RAG Graph (agentic_rag/) | Selection Graph (selection/) |
|------|--------------------------|-------------------------------|
| **目的** | 回答用户问题 | 分析品线数据生成推荐报告 |
| **输入** | question (str) | aggregated_data (dict from Java) |
| **输出** | answer + citations | recommendLevel + analysisReport |
| **节点数** | 18 | 9 (8能力 + 1条件变体) |
| **条件分支** | 6个 (guardrail/grade/confidence/budget等) | 1个 (利润→深度/快速差异化) |
| **循环** | 有 (rewrite↔budget重试循环) | 无 (一次性顺序执行) |
| **外部依赖** | Milvus向量库 + PG文档库 | **Java:8080 HTTP API** |
| **LLM调用次数** | 可变(1-N次) | 固定~9次 (每节点一次) |
| **Token消耗** | 不确定 | 可预估 (~5100 tokens/小类) |
| **State字段数** | ~50 | ~25 |

### 3.3 State 定义概要

```python
class SelectionState(TypedDict):
    """选品分析状态 — 在Selection Graph各节点间传递"""

    # ═══ 输入（Java提供，不变）════
    marketplace: str                          # UK/DE/US
    month: str                                # 202606
    batch_id: str                             # 批次ID
    aggregated_data: dict                     # 完整聚合数据包
    sub_category_data: dict                   # 当前正在分析的小类数据

    # ═══ 各节点产出（逐步填充）════
    category_understanding: dict              # 能力1产出
    competition_structure: dict                # 能力2产出
    lifecycle_stage: dict                      # 能力3产出
    profit_feasibility: dict                   # 能力4产出
    differentiation_angles: list               # 能力5产出
    risk_radar: dict                           # 能力6产出
    cross_line_insights: dict                  # 能力7产出
    final_verdict: dict                        # 能力8产出

    # ═══ 元信息 ═══
    node_id: str                               # 当前分析的nodeId
    node_name: str                             # 当前分析的nodeName
    bsr_id: str                                # 所属品线
    errors: list[str]                          # 错误记录
    trace_steps: list[dict]                    # 执行追踪
```

---

## 四、Java 后端接口契约

### 4.1 接口清单

| 方法 | 路径 | 用途 | 调用方 |
|------|------|------|--------|
| GET | `/api/v1/product-line/aggregated-data` | 聚合品线数据 | Python java_client.fetch_aggregated_data() |
| POST | `/api/v1/product-line/analysis-results` | 接收分析结果入库 | Python java_client.submit_analysis_results() |
| GET | `/api/v1/product-line/guidance` | 查询推送卡片 | Python router (透传给前端) |

### 4.2 聚合数据响应格式

```json
{
  "batchId": "20260608_001",
  "generatedAt": "2026-06-08T10:00:00",
  "marketplace": "UK",
  "totalProducts": 6991,
  "productLines": [
    {
      "bsrId": "beauty",
      "bsrLabel": "Beauty",
      "productCount": 520,
      "totalUnits": 15800,
      "totalRevenue": 98540.00,
      "avgProfitRate": 32.5,
      "storeCount": 8,
      "subCategoryCount": 24,
      "subCategories": [
        {
          "nodeId": 2909187031,
          "nodeName": "Nail Tips",
          "nodeFullPath": "Beauty:Manicure & Pedicure:Nail Design:...",
          "productCount": 35,
          "totalUnits": 2850,
          "avgPrice": 6.59,
          "priceMin": 4.99,
          "priceMax": 12.99,
          "avgBsr": 13863,
          "avgRating": 4.2,
          "avgRatings": 89,
          "unitsGrowthRate": -13.26,
          "bsrChangeRate": 28.4,
          "topBrands": ["Cunegra", "Makartt", "Beetles"],
          "storeNames": ["SDGHJZ"],
          "bestSellerCount": 3,
          "amazonChoiceCount": 1,
          "sampleProducts": [
            { "asin": "...", "title": "...", "brand": "...", "price": 5.99, "units": 892, "bsr": 4521, "rating": 4.0, "ratingsTotal": 156 }
          ]
        }
      ]
    }
  ]
}
```

### 4.3 分析结果请求格式

```json
{
  "batchId": "20260608_001",
  "analyzedAt": "2026-06-08T10:30:00",
  "agentVersion": "supermew-selection-v1.0",
  "results": [
    {
      "bsrId": "beauty",
      "nodeId": 2909187031,
      "nodeName": "Nail Tips",
      "recommendLevel": "RECOMMEND",
      "opportunityScore": 72,
      "confidence": 0.82,
      "analysisReport": { /* 完整报告 */ },
      "detailReports": { /* 8能力详细输出 */ }
    }
  ]
}
```

---

## 五、Python 端新建文件清单

| # | 文件路径 | 对标RAG中的文件 | 说明 |
|---|---------|----------------|------|
| 1 | `backend/selection/__init__.py` | `agentic_rag/__init__.py` | 包初始化 |
| 2 | `backend/selection/state.py` | `agentic_rag/state.py` | SelectionState TypedDict + create_initial_state() |
| 3 | `backend/selection/graph.py` | `agentic_rag/graph.py` | 9节点图构建 + get_selection_graph() 单例 |
| 4 | `backend/selection/nodes/__init__.py` | `agentic_rag/nodes/__init__.py` | 节点包初始化 |
| 5 | `backend/selection/nodes/semantic_understanding.py` | nodes/*.py | 能力1节点函数 |
| 6 | `backend/selection/nodes/competition_analysis.py` | nodes/*.py | 能力2节点函数 |
| 7 | `backend/selection/nodes/lifecycle_judgment.py` | nodes/*.py | 能力3节点函数 |
| 8 | `backend/selection/nodes/profit_estimation.py` | nodes/*.py | 能力4节点函数 |
| 9 | `backend/selection/nodes/differentiation.py` | nodes/*.py | 能力5节点(含deep/quick两个函数) |
| 10 | `backend/selection/nodes/risk_assessment.py` | nodes/*.py | 能力6节点函数 |
| 11 | `backend/selection/nodes/cross_line_discovery.py` | nodes/*.py | 能力7节点函数 |
| 12 | `backend/selection/nodes/final_verdict.py` | nodes/*.py | 能力8节点函数 |
| 13 | `backend/selection/runner.py` | `agentic_rag/runner.py` | run_selection_sync() 入口 |
| 14 | `backend/selection/java_client.py` | 无直接对应 | HTTP客户端( fetch/submit ) |
| 15 | `backend/selection/prompt_templates.py` | `agentic_rag/prompt_builder.py` | 8能力的Prompt模板 |
| 16 | `backend/routers/selection.py` | `routers/chat.py` | POST /analyze + GET /guidance |
| 17 | 修改 `backend/api.py` | `api.py` | 追加 include_router(selection_router) |

### 复用的现有代码模式

| 从哪里复用 | 复用什么 |
|-----------|---------|
| `agent_factory.py` | LLM初始化 (`init_chat_model`) + MODEL/BASE_URL/API_KEY 环境变量 |
| `agentic_rag/runner.py` | try/except 降级返回模式 + format_result 格式化 |
| `routers/chat.py` | async + asyncio.to_thread + StreamingResponse SSE 模式 |
| `agentic_rag/graph.py` | threading.Lock 全局单例懒加载 + 函数内懒导入节点 |
| `tool_system/registry.py` | (可选) 将 analyze_product_line 注册为Agent可调用工具 |
| `.env` | 新增 SELECTION_JAVA_BACKEND 环境变量 |

---

## 六、调用流程

### 6.1 触发分析（Java → Python）

```
Vue 前端                    Java :8080              Python :8000
  │                           │                        │
  │  POST /product-line/trigger-analysis            │
  │  {marketplace:"UK"}       │                        │
  │──────────────────────────→│                        │
  │                           │                        │
  │                           │  ① 内部聚合SQL          │
  │                           │  SELECT ... FROM deng_zong_shop
  │                           │  GROUP BY bsr_id, node_id
  │                           │                        │
  │                           │  ② 调用Python分析       │
  │                           │  POST /selection/analyze
  │                           │  { aggregatedData: {...} } 
  │                           │───────────────────────→│
  │                           │                        │
  │                           │                        │  ③ Selection Graph 运行
  │                           │                        │  START → 8能力节点 → END
  │                           │                        │
  │                           │  ④ Python回写结果       │
  │                           │  ← POST /analysis-results
  │                           │  { results: [...] }
  │                           │←────────────────────────│
  │                           │                        │
  │                           │  ⑤ 写入 guidance 表     │
  │                           │  INSERT INTO product_line_guidance
  │                           │                        │
  │  200 OK                    │                        │
  │  { taskId: "xxx" }        │                        │
  │←──────────────────────────│                        │
  │                           │                        │
  │  (前端轮询或SSE推送结果)     │                        │
```

### 6.2 查看结果（前端 → Java）

```
Vue 前端                    Java :8080
  │                           │
  │  GET /product-line/guidance?batchId=latest&level=RECOMMEND
  │──────────────────────────→│
  │                           │
  │                           │  SELECT * FROM product_line_guidance
  │                           │  WHERE recommend_level='RECOMMEND'
  │                           │
  │  200 { cards: [...] }     │
  │←──────────────────────────│
  │                           │
  │  渲染推送卡片列表 ✅        │
```

---

## 七、环境变量

在 SuperMew 的 `.env` 中追加：

```bash
# ═══ 选品模块 ═══
# Java 后端地址（品线数据API）
SELECTION_JAVA_BACKEND=http://localhost:8080

# 选品分析使用的模型（可选，不设置则复用主MODEL）
# SELECTION_MODEL=deepseek-chat
# SELECTION_TEMPERATURE=0.3
```

---

## 八、与选品算法15篇文档的关系

| 文档 | 在本方案中的角色 |
|------|----------------|
| 01 总体设计 | 架构参考（L1/L2/L3三层概念保留） |
| 02 AI软评分 | 由 Selection Graph 的能力1/4 替代实现 |
| 03 Agent深度分析 | 由整个 Selection Graph 实现（升级版） |
| 04 决策模型 | 由能力8 final_verdict 节点实现 |
| 05 优化方向 | 未来扩展方向（加新节点即可） |
| 06 系统集成 | 本文档就是06的落地版本 |
| 07 动态基线 | 由 Java 聚合引擎实现（百分位计算） |
| 08 品类原型 | 由能力1 semantic_understanding 节点实现 |
| 09 蓝海V2 | 由能力2 competition_analysis + 能力5 differentiation 实现 |
| 10 卖家画像 | 未来可加新节点 seller_profiling |
| 11 差异化分析 | 由能力5 differentiation 节点实现 |
| 12 爆发信号 | 由能力3 lifecycle 节点部分实现 |
| 13 跨站套利 | 由能力7 cross_line 节点实现 |
| 14 反馈闭环 | 未来可加 feedback_loop 节点 |
| 15 问题清单 | 开发排期参考 |

---

## 九、实施优先级

| 阶段 | 内容 | 文件 |
|------|------|------|
| **P0** | Java DDL + ProductLineService + Controller | Java端3个文件 |
| **P1** | Python selection 核心 (state + graph + runner + java_client) | 4个核心文件 |
| **P2** | 8个能力节点 + prompt模板 | 10个文件 |
| **P3** | Router + API集成 + 前端页面 | 2个文件 |
