# AI 选品 Agent — 实施方案 v4

## 核心理念

**对话建管道，管道可持久，每人有自己的选品方法。**

用户不会直接说"帮我查 UK 家电"。他们会说：
> "我做英国家电，一般先看 BSR 前 500 的新品，价格 20-50 英镑，ROAS 要大于 2，然后对比同类产品的广告花费，最后挑利润最高的几个深入分析。"

这是一套**个人选品方法论**。Agent 的工作是：
1. 通过对话理解用户的方法
2. 把方法转成可执行的管道
3. 管道持久化，用户随时重跑
4. 用户想改方法时，对话修改管道

---

## 两层架构

```
┌─────────────────────────────────────────────┐
│               对话层（Agent）                 │
│  用户 ↔ LLM 对话                            │
│  → 理解需求、构建/修改管道、解读结果          │
└─────────────────┬───────────────────────────┘
                  │ 创建/修改/运行
                  ↓
┌─────────────────────────────────────────────┐
│              管道层（Pipeline）               │
│  每个用户有自己的选品管道                     │
│  管道 = 有序步骤链                           │
│  步骤 = 过滤 | 评分 | 分析 | 对比 | 推荐     │
│  管道持久化到数据库，可重跑、可分享           │
└─────────────────┬───────────────────────────┘
                  │ 执行步骤
                  ↓
┌─────────────────────────────────────────────┐
│              工具层（Tools）                  │
│  query_products / analyze_competition /      │
│  get_trend / analyze_profit / compare / ...  │
│  每个工具是独立的能力，管道步骤调用工具       │
└─────────────────────────────────────────────┘
```

---

## 管道（Pipeline）设计

### 数据模型

```sql
CREATE TABLE selection_pipelines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,           -- "英国家电选品法"
    description TEXT,                      -- 方法论描述
    steps JSON NOT NULL,                   -- 管道步骤定义
    category VARCHAR(100),                 -- 分类（家电/厨房/3C等）
    tags VARCHAR(500),                     -- 标签（英国/FBA/新品等）
    created_by INT,                        -- 创建者（谁建的）
    is_public BOOLEAN DEFAULT TRUE,        -- 全员可见
    is_default BOOLEAN DEFAULT FALSE,      -- 是否系统默认管道
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    last_run_at DATETIME,
    run_count INT DEFAULT 0
);

CREATE TABLE selection_pipeline_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pipeline_id INT NOT NULL,
    user_id INT NOT NULL,                  -- 谁跑的
    input_params JSON,                     -- 运行时参数覆盖
    result_summary JSON,
    products_found INT,
    execution_time_ms INT,
    created_at DATETIME DEFAULT NOW()
);
```

**管道库是全员共享的。** 谁建的管道，所有人都能用、能跑、能 fork 改进。

### 管道步骤定义

```json
{
  "name": "英国家电选品法",
  "steps": [
    {
      "id": "filter_category",
      "type": "filter",
      "tool": "query_products",
      "params": {
        "country": "UK",
        "category": "家电",
        "product_type": "new",
        "main_category_rank_max": 500
      },
      "description": "先筛出英国家电类 BSR 前 500 的新品"
    },
    {
      "id": "filter_price",
      "type": "filter",
      "tool": "query_products",
      "params": { "price_min": 20, "price_max": 50 },
      "description": "价格 20-50 英镑"
    },
    {
      "id": "score",
      "type": "score",
      "tool": "score_product",
      "params": {},
      "description": "计算综合评分"
    },
    {
      "id": "trend",
      "type": "analysis",
      "tool": "get_trend_summary",
      "params": { "period": "7d" },
      "description": "看近 7 天趋势"
    },
    {
      "id": "competition",
      "type": "analysis",
      "tool": "analyze_competition",
      "params": {},
      "description": "分析竞争密度"
    },
    {
      "id": "profit",
      "type": "analysis",
      "tool": "analyze_profit",
      "params": {},
      "description": "估算利润空间"
    },
    {
      "id": "rank",
      "type": "rank",
      "tool": "rank_products",
      "params": {
        "sort_by": "composite_score",
        "limit": 10
      },
      "description": "按综合分数排序，取 Top 10"
    },
    {
      "id": "recommend",
      "type": "llm_analysis",
      "tool": "llm_recommend",
      "params": {},
      "description": "LLM 分析 Top 10，给出推荐理由"
    }
  ]
}
```

### 管道执行器

```python
class PipelineExecutor:
    async def run(self, pipeline: dict, override_params: dict = None) -> dict:
        """执行管道，返回结果"""
        context = {}  # 上下文，步骤间传递数据
        
        for step in pipeline['steps']:
            params = {**step['params'], **(override_params or {})}
            
            # 如果上一步有输出，传入下一步
            if context.get('products'):
                params['products'] = context['products']
            
            tool_func = self.tools[step['tool']]
            result = await tool_func(**params)
            
            context[step['id']] = result
            if step['type'] == 'filter':
                context['products'] = result  # 过滤结果传给下一步
        
        return context
```

---

## 对话层（Agent）设计

Agent 有两个模式：

### 模式 1：建管道

用户描述选品方法 → Agent 解析成管道步骤 → 确认 → 持久化

```
用户: 我做英国家电，先看 BSR 前 500 的新品，价格 20-50，然后看趋势和利润
Agent: 我帮你建一个选品管道：
  1. 筛选：UK + 家电 + 新品 + BSR < 500 + 价格 20-50
  2. 趋势分析：近 7 天销量变化
  3. 利润分析：估算毛利
  4. 按综合分数排序，取 Top 10
  5. LLM 推荐分析
  要保存吗？
用户: 保存，名字叫"家电基础选品"
Agent: 已保存。下次直接说"跑家电基础选品"就行。
```

### 模式 2：跑管道

用户说"跑 XX 管道" → Agent 执行 → 解读结果 → 用户追问 → Agent 继续分析

```
用户: 跑家电基础选品
Agent: 正在执行...
  [调用 query_products → get_trend_summary → analyze_profit → rank_products → llm_recommend]
  
  结果：找到 8 个推荐产品
  1. B0XXX - 智能插座 - £29.99 - BSR 127 - 趋势↑23% - 毛利38% - S级
  2. B0YYY - 空气净化器 - £39.99 - BSR 89 - 趋势↑15% - 毛利32% - A级
  ...
  
  要深入分析哪个？
用户: 第一个，看看竞品情况
Agent: [调用 analyze_competition(asin=B0XXX) + compare_products(asins=[B0XXX, 竞品1, 竞品2])]
  B0XXX 竞品分析：同类产品 12 个，价格集中在 £25-35...
```

### 模式 3：改管道

```
用户: 家电基础选品加一个条件，ROAS 要大于 2
Agent: [修改管道步骤 filter_price 后面加 filter_roas]
  已更新。加了"ROAS > 2"的筛选。要重新跑吗？
```

---

## LLM Agent 实现

用 MCP 工具暴露管道操作 + 数据查询 + 分析能力。

### Agent 工具（MCP）

**管道操作：**
| 工具 | 说明 |
|------|------|
| `list_pipelines` | 列出用户的所有管道 |
| `get_pipeline` | 获取管道详情 |
| `create_pipeline` | 创建新管道 |
| `update_pipeline` | 修改管道步骤 |
| `run_pipeline` | 执行管道，返回结果 |
| `get_run_history` | 查看历史运行记录 |

**数据查询：**
| 工具 | 说明 |
|------|------|
| `query_products` | 按条件查选品库 |
| `get_product_detail` | 单品全量数据 |
| `get_category_stats` | 品类统计 |

**分析：**
| 工具 | 说明 |
|------|------|
| `analyze_competition` | 竞争分析 |
| `get_trend_summary` | 趋势摘要 |
| `analyze_profit` | 利润分析 |
| `compare_products` | 产品对比 |
| `find_similar` | 语义搜索相似产品 |
| `llm_recommend` | LLM 深度推荐分析 |

### Agent System Prompt

```
你是选品助手。用户通过你建立和执行选品方法。

核心流程：
1. 用户描述选品思路时 → 用 create_pipeline 建管道
2. 用户说"跑 XX"时 → 用 run_pipeline 执行，然后解读结果
3. 用户想改方法时 → 用 update_pipeline 修改
4. 用户问具体产品时 → 用 get_product_detail + 分析工具
5. 用户随便聊选品时 → 用 query_products + 分析工具回答

规则：
- 先理解用户意图，再决定调什么工具
- 结果要用人话说，不要列原始数据
- 发现好产品时主动提醒风险
- 管道步骤要跟用户确认再保存
```

---

## 实施步骤

### Phase 1: 管道基础设施

1. **数据库迁移** — 创建 `selection_pipelines` 和 `selection_pipeline_runs` 表
2. **Pipeline 模型** — `backend/app/models/pipeline.py`
3. **Pipeline 服务** — `backend/app/services/pipeline_service.py` — CRUD + 执行
4. **Pipeline 执行器** — `backend/app/services/pipeline_executor.py` — 步骤链执行

### Phase 2: MCP 工具

5. **MCP Server 框架** — `backend/app/mcp/server.py`
6. **管道工具** — `backend/app/mcp/tools/pipeline_tools.py` — list/get/create/update/run
7. **查询工具** — `backend/app/mcp/tools/query_tools.py` — query_products/get_detail/get_stats
8. **分析工具** — `backend/app/mcp/tools/analysis_tools.py` — competition/trend/profit/compare/similar/recommend

### Phase 3: 集成

9. **MCP 路由挂载** — `main.py` 添加 `/mcp` 端点
10. **Open WebUI 配置** — 注册 MCP Server
11. **Agent System Prompt** — 在 Open WebUI 中配置选品 Agent 的 system prompt

### Phase 4: 前端（可选）

12. **管道管理页面** — 查看/编辑/运行自己的管道
13. **运行结果页面** — 展示管道执行结果 + 可视化

---

## 关键文件

| 操作 | 文件 |
|------|------|
| 新建 | `backend/app/models/pipeline.py` |
| 新建 | `backend/app/services/pipeline_service.py` |
| 新建 | `backend/app/services/pipeline_executor.py` |
| 新建 | `backend/app/mcp/__init__.py` |
| 新建 | `backend/app/mcp/server.py` |
| 新建 | `backend/app/mcp/tools/__init__.py` |
| 新建 | `backend/app/mcp/tools/pipeline_tools.py` |
| 新建 | `backend/app/mcp/tools/query_tools.py` |
| 新建 | `backend/app/mcp/tools/analysis_tools.py` |
| 修改 | `backend/app/main.py` |
| 修改 | `backend/app/config.py` |
| 新建 | `backend/migrations/create_pipeline_tables.sql` |

## 复用

- `selection_service.py` → query_products 的底层实现
- `polars_data_service.py` → 趋势/广告数据
- `scoring_engine.py` → score_product 工具
- `qdrant_repo.py` → find_similar 向量检索
