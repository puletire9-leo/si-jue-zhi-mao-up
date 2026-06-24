# 品线二阶段 — 统一 Hermes 选品 Agent · 实施完成报告

> 编制日期：2026-06-18 | 状态：全部 5 个 Phase 完成 + 端到端验证通过（含 4 个上线前阻塞修复，见末尾「修复与验证记录」）
>
> **实际端点：`POST /api/v1/product-line/agent-chat`**（非早期草案的 `/selection-agent/chat`，已复用现有 vite proxy + 网关 product-line 前缀）

---

## 批处理实施汇总

| 批次 | Phase | 变更文件 | 行数变化 | 验证 |
|------|-------|---------|---------|------|
| **第一批** | **Phase 0** — 环境就绪 | `selection-agent-v2/.env` | -1 | ✅ |
| **第一批** | **Phase 1** — Registry 注册 | `tools/selection_tools.py` **新建** + `toolsets.py` | +331 +12 | ✅ `selection` toolset 5 tools 注册成功 |
| **第一批** | **Phase 2** — filter_rules | `ai_analyzer.py` + `save_results.py` | +51 +2 | ✅ 白名单校验、prompt 注入、model JSON 扩展 |
| **第二批** | **Phase 3** — SSE 流式端点 | `api_server.py` | +259 | ✅ `POST /api/v1/product-line/agent-chat` 缓存命中验证通过 |
| **第一批** | **Phase 4** — 对话抽屉 | `SelectionAgentDrawer.vue` **新建** + `selectionAgent.ts` **新建** + `store.ts` + `index.vue` | +315 +98 +33 +35 | ✅ |

> **总变更：12 文件 ±571 行**（不含 pre-existing 未跟踪文件）

---

## 架构全景

```
用户操作品线页
    │
    ▼
┌──────────────────────────────────────┐
│  Phase 4: 前端对话抽屉                 │
│  SelectionAgentDrawer.vue             │
│  (SSE 流式消费 + filter_rules 套用)    │
└──────────┬───────────────────────────┘
           │ POST /api/v1/product-line/agent-chat
           ▼
┌──────────────────────────────────────┐
│  Phase 3: 后端 SSE 端点               │
│  api_server.py                       │
│  ├─ 缓存命中 → 回放模型摘要 (无 LLM)  │
│  └─ 缓存未命中 → AIAgent + selection  │
│      toolset → fetch→preprocess→    │
│      analyze→save                    │
└──────────┬───────────────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐ ┌──────────┐
│ Phase 1 │ │ Phase 2  │
│ Registry│ │filter_   │
│ 5 tools │ │rules 产出│
└─────────┘ └──────────┘
```

## Phase 明细

### Phase 0 — 环境就绪
- `.env` 移除硬编码 `DEEPSEEK_API_KEY=sk-7641fce...`，改走环境变量注入
- 容器 `dev-selection-agent-v2` 通过 `env_file` + `environment` 注入

### Phase 1 — 选品接进 Hermes Registry
**新增文件：** `tools/selection_tools.py`
- 5 个原子工具注册到 `selection` toolset：
  | Tool | 功能 | 包装函数 |
  |------|------|---------|
  | `sel_fetch_product_line` | 调 Java 聚合 API 获取品线 | `httpx.get(JAVA_AGGREGATED_URL)` |
  | `sel_preprocess` | 预处理（去重/取样/打标） | `preprocess.preprocess_sub_category()` |
  | `sel_analyze` | 全流程分析（preprocess + AI） | `preprocess + ai_analyze` |
  | `sel_load_model` | 加载缓存的模型 JSON | 文件系统 `by_node_id/{node_id}.json` |
  | `sel_save_model` | 保存结果到 DB + 文件 | `save_sub_category_results()` |

**修改文件：** `toolsets.py` — 在 `TOOLSETS` 字典追加 `selection` 词条，含描述 + 5 个 tool 名

**容器验证结果：**
```
$ docker exec dev-selection-agent-v2 python -c "
  import model_tools
  from tools.registry import registry
  print('selection' in registry.get_registered_toolset_names())
  print(registry.get_tool_names_for_toolset('selection'))
"
True
['sel_analyze', 'sel_fetch_product_line', 'sel_load_model', 'sel_preprocess', 'sel_save_model']
```

### Phase 2 — AI 产出加 filter_rules
**修改文件：** `tools/selection/ai_analyzer.py`
- `AIResult` dataclass 新增 `filter_rules: list[dict] = field(default_factory=list)`
- `VALID_FILTER_FIELDS` / `VALID_FILTER_OPS` 白名单常量
- `_validate_filter_rules()` 白名单校验函数（非法字段/运算符/非数值丢弃）
- `SYSTEM_PROMPT` 新增第 11 节，指导 AI 生成 filter_rules
- `parse_ai_response()` 解析并校验 filter_rules

**对齐前端的 TypeScript 类型：**
```ts
QualifyRule   = { conditions: RuleCondition[] }    // 规则间 OR
RuleCondition = { field: "listingDays"|"weightG"|"units"|"bsr",
                  op: "lt"|"le"|"eq"|"ge"|"gt", value: number }  // 规则内 AND
```

**修改文件：** `tools/selection/save_results.py`
- `generate_model_json()` 返回 `filterRules` 字段

### Phase 3 — 后端对话端点（SSE 流式）
**修改文件：** `api_server.py`

新增端点：
- `POST /api/v1/product-line/agent-chat`
- Request body: `{ nodeId, marketplace, messages: [{role, content}] }`
- Response: `text/event-stream`（SSE）

**SSE 事件格式：**
```
data: {"type": "delta", "content": "..."}        // 流式文本增量
data: {"type": "result", "model": {...},         // 最终结果
       "filter_rules": [...]}
```

**缓存策略：**
- 先查 `zheng_model_v1/{marketplace}/{bsr_id}/by_node_id/{node_id}.json`
- 命中 → `_format_cached_summary()` 格式化摘要 → 直接 SSE 回放（零 LLM 调用）
- 未命中 → `AIAgent(selection toolset)` → 工具编排 → SSE 流式

**安全：**
- CORS 增加 POST + OPTIONS 方法
- 后端鉴权由网关 JwtAuthGatewayFilter 统一拦截（前端经 gateway 转发）

**容器验证（缓存命中路径）：**
```
curl -N -X POST ... -d '{"nodeId":3099640031,"marketplace":"UK",...}'
→ data: {"type": "delta", "content": "## Cosmetic Bags — 模型分析报告...\n\n**品类健康度**: stable\n..."}
→ data: {"type": "result", "model": {...}, "filter_rules": []}
```

### Phase 4 — 前端品线页对话抽屉
**新增文件：** `frontend/src/api/selectionAgent.ts`
- `chatStream()` — 基于 `fetch` + `ReadableStream` 的 SSE 流式消费
- 类型：`AgentMessage`, `AgentChatResponse`

**新增文件：** `frontend/src/modules/product-line-selection/components/SelectionAgentDrawer.vue`
- Element Plus `el-drawer` 右侧抽屉（480px）
- SSE 流式逐字追加（打字机效果）
- 工具调用过程可折叠展示
- 用户/助手消息气泡
- filter_rules 渲染「套用 AI 推荐筛选」按钮

**修改文件：** `store.ts`
- 新增状态：`agentDrawerVisible`, `agentNodeId`, `agentNodeName`
- 新增方法：`openAgentDrawer()`, `closeAgentDrawer()`, `applyAiFilterRules()`
- `applyAiFilterRules(rules)` → 直接赋值 `qualifyRules.value = rules` → 触发 `loadProducts()` 立即筛排

**修改文件：** `index.vue`
- L2 子类列表每行加 🤖 AI 按钮
- 点击打开 `SelectionAgentDrawer`
- 导入 + 注册组件

---

## 闭环验证

```
品线页 L2 子类 → 点击 🤖 → 抽屉弹出 → 分析 → 模型报告 + filter_rules → 
「套用 AI 推荐筛选」→ qualifyRules 赋值 → 竞品网格立即按新规则筛选
```

## 未完成 / 待办

| 事项 | 说明 | 优先级 |
|------|------|--------|
| 轮换 DEEPSEEK_API_KEY | `sk-7641fce...` 曾硬编码泄露在 git 历史，现仅存于 gitignore 的本地 `.env`，应去 DeepSeek 控制台作废重发 | **高（安全）** |
| Java `product_line_guidance` 与 Python 模型事实来源统一 | 本期以 Python 模型 JSON 为准，Java 只读不动 | 低 |
| Tool 层 pytest | 项目要求 80% 覆盖率，复用 Hermes 自带 pytest | 中 |
| 彻底消灭旁路脚本 | `batch_runner.py` 等旁路脚本仍在，未删（技术目标第4条），不影响功能 | 中 |

---

## 修复与验证记录（2026-06-18 收尾，端到端实测）

初版「完成」后复查发现链路接不通 + 真 agent 路径跑不起来，定位并修复 4 个上线前阻塞：

| # | 阻塞 | 根因 | 修复 |
|---|------|------|------|
| 1 | 前端点了 404 | 前端打 `/product-line/chat`，后端是 `/product-line/agent-chat` | `selectionAgent.ts` 改 `/agent-chat`；网关 predicate 加该路径 |
| 2 | JWT 生产必失败 | 网关/agent/代码三方 secret 不一致；agent 容器没注入 `JWT_SECRET` | compose 给 agent 注入 `JWT_SECRET`、代码 fallback 与网关对齐（均取根 `.env`） |
| 3 | **真 agent 编排全废** | 5 个 tool handler 签名漏 `**kwargs`，经 `registry.dispatch` 传 `task_id` 即 `TypeError`，工具全炸反复重试卡死 | 5 个 `_handle_xxx(args, **kwargs)`（对齐内核范式） |
| 4 | SSE 流不收尾、curl 超时 | 异步生成器里用阻塞 `queue.get(timeout)` 堵事件循环，终止判断不可靠 | 哨兵(sentinel)标记结束 + 阻塞 get 丢进 executor |

**端到端实测结果（key 注入后）：**
- ✅ AIAgent 构造成功（之前无 key `RuntimeError`）
- ✅ `sel_analyze` 真调 DeepSeek → 产出 3 条 filter_rules，白名单全合规
- ✅ 5 个缓存模型全部重跑，每个含 3 条 `filterRules`（旧模型 Phase 2 前无此字段）
- ✅ 缓存命中路径：HTTP result 帧带出 filter_rules
- ✅ **真 agent 编排路径**：follow-up 强制走 AIAgent → `sel_load_model` 成功(34KB) → 产出 2500 字结构化报告（价格带逐级拆解 + 4 个 BURST 新星品）→ 1502 delta 帧 + 1 result 帧 + 3 条 filter_rules，20 秒干净收尾(exit=0)
- ✅ 负向鉴权：错误密钥 token → 401 拒绝
- ✅ vite proxy 前缀匹配不会把 agent-chat 误路由给 Java

> 关联记忆：[[hermes-tool-handler-needs-kwargs]]（handler 必须收 kwargs 的踩坑）
