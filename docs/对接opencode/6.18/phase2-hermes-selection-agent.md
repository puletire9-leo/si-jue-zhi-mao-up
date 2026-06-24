# 品线二阶段 — 统一 Hermes 选品 Agent

> 状态：计划已定，逐步实现中。最后更新 2026-06-18。
> 关联记忆：phase2-hermes-selection-agent

---

## 一、最终目标（我们要实现的功能）

把散落的选品脚本，统一成一个**以 Hermes v0.16.0 为内核、我们自己的选品 Agent**，
并接进品线页面，形成「郑总标准 → AI 提炼模型 → 自动筛选竞品」的完整闭环。

### 用户视角的最终形态（对话式 Agent 面板）
1. 打开品线选品页（一阶段已完成：以郑总店铺为参考标准给竞品品线打「郑总」标签）。
2. 点击某个品线/小类 → 页面侧边弹出「**AI 选品助手**」对话抽屉，**自动带上当前品线上下文**（node_id + 商品数据）。
3. 抽屉里「**分析这个品线**」一键按钮 = 给 agent 发一条预设消息；用户也可继续**自由追问**
   （如「为什么这个品线机会分高」「再深入看价格带」「换个角度看新星品」）。
4. Agent 通过 Hermes 对话循环回复，产出两样东西：
   - **选品模型/报告**（给人看）：质量基准、proven_elements、载体画像、价格空白、推荐组合、搜索关键词等（固定模板）。
   - **自动筛选规则 filter_rules**（给机器执行）：对齐一阶段 qualifyRules 结构（字段+运算符+阈值，规则内 AND / 规则间 OR）。
5. agent 回复里渲染「**套用 AI 推荐筛选**」按钮 → filter_rules 灌进品线页的 qualifyRules → 立即筛选+排序该品线竞品（**分析→筛选闭环不断**）。
6. 结果按 node_id 缓存，重开抽屉秒回；对话历史保留可继续追问。

### 技术视角的最终形态
- 选品能力 = Hermes registry 里的 `selection` toolset（注册成 tool）。
- 由 `AIAgent` 通过工具调用驱动，固定 system prompt 引导走 `fetch→preprocess→analyze→save`。
- 入口：**前端自写轻量聊天面板（嵌品线页抽屉）→ 后端流式 HTTP 端点跑 AIAgent**；CLI（`hermes` 命令）作为开发/验证入口。三者共用同一 AIAgent + selection toolset。
- **彻底消灭旁路脚本**（现在 tools/selection/ 是绕开 agent 的脚本）。

---

## 二、现状与根因（已诊断实锤）

- `selection-agent-v2` = 基于 Hermes v0.16.0 的**瘦身 fork**，内核纯净（核对仅 CRLF 噪音 + 10 行瘦身补丁）。
- 内核完整可用：`run_agent.py`(AIAgent) / `tools/registry.py` / `toolsets.py` / provider 适配。
- **真正问题**：选品逻辑 `tools/selection/{preprocess,ai_analyzer,save_results}.py` 在**子目录**里，
  而 registry 自注册只 `glob("tools/*.py")` 顶层（registry.py:60-63），**子目录永远扫不到** →
  从没注册成 tool、没接进 AIAgent → 所以是「装在 Hermes 仓库里的脚本」，不是「Hermes agent 在做选品」。
- 源码曾被 merge PR `8ca0f81`(feat/clean-master) 删除只留 .pyc；已从历史 `3ef7116` 完整恢复，无需反编译。

### 已锁定决策
1. 复活 selection-agent-v2（不另起 SuperMew / 不内置进 Java）。
2. AI 产出 = 模型 + 自动筛选规则。
3. 单品线按需 + 缓存。
4. Tool 驱动 + 固定流程模板（不做全自主编排，也不降级成单个脚本 tool）。
5. 入口 CLI + HTTP 都要。

---

## 三、实施步骤（逐步执行，每步可验证/可回滚）

> 环境事实（已在 dev 容器实测）：
> - 容器 `dev-selection-agent-v2`，Python 3.11.15，`/app` 为 volume 挂载 `./selection-agent-v2:/app` → **改宿主代码容器即时生效，dev 不 rebuild**。
> - host 8012 → 容器 8011，`api_server.py` 跑着，`/health` 正常。
> - Hermes 内核健康：`import model_tools` 后 13 个 toolset 正常注册；`discover_builtin_tools()` 是 tool 发现入口（registry.py:57）。
> - `selection` toolset 当前未注册（根因实锤）。

### Phase 0 — 环境就绪 ✅（已完成，无需提交）
- [x] 源码已在当前分支 `feat/filter-refactor-v3`（325 个 .py 被跟踪），磁盘已与分支一致 → **无改动可提交**
- [x] 内核核对 = 纯净 v0.16.0（仅 CRLF 噪音 + run_agent.py 10 行 ImportError 防御补丁）
- [x] 容器环境验证通过（见上）
- [ ] **唯一待办（你来做）**：轮换 `.env` 明文 `DEEPSEEK_API_KEY`，改走环境变量注入（铁律#3）

---

### Phase 1 — 选品接进 Hermes registry（核心，不动内核）
**目标**：`selection` toolset 出现在注册列表，AIAgent 能调到选品 tool。

**真实函数签名（已确认）**：
- `preprocess.preprocess_sub_category(...)` / `preprocess_batch(db_conn, marketplace, month, batch_data) -> list[SubCategoryAnalysis]`
- `preprocess.fetch_products_by_node(db_conn, marketplace, month, node_id) -> list[ProductRow]`
- `ai_analyzer.ai_analyze(analysis: SubCategoryAnalysis, model="deepseek-v4-flash", batch_id="", max_retries=3) -> AIResult | None`
- `save_results.save_sub_category_results(...)` / `create_batch(...)` / `get_latest_batch(...)` / `update_batch_status(...)`

**新增** `selection-agent-v2/tools/selection_tools.py`（顶层文件，被 `discover_builtin_tools()` 自动扫到）：
- `from tools.selection import preprocess, ai_analyzer, save_results`
- 顶层 `from tools.registry import registry` + 多次 `registry.register(name, toolset="selection", schema, handler, ...)`
- 注册 5 个原子 tool（handler 内建 db_conn、复用现有函数）：
  | tool | 包装 | 入参 | 出参 |
  |------|------|------|------|
  | `sel_fetch_product_line` | 调 Java `/aggregated-data` | marketplace, month | 品线列表 JSON |
  | `sel_preprocess` | `preprocess_sub_category` | marketplace, month, node_id | SubCategoryAnalysis(精简) |
  | `sel_analyze` | `ai_analyze` | node_id（先内部 preprocess 再分析） | AIResult JSON |
  | `sel_load_model` | `get_latest_batch`+模型JSON | marketplace, node_id | 缓存模型 or null |
  | `sel_save_model` | `save_sub_category_results` | analysis+result | 写库确认 |
- 每个 tool 写 OpenAI function schema（参数 + description），check_fn 校验 env（DEEPSEEK_API_KEY/MySQL）

**修改** `selection-agent-v2/toolsets.py`：在 toolset 分组定义里加 `selection`（含 5 个 tool 名、描述、emoji）。

**验证（容器内）**：
```
docker exec dev-selection-agent-v2 python -c "import model_tools; from tools.registry import registry; print('selection' in registry.get_registered_toolset_names())"  # 期望 True
docker exec dev-selection-agent-v2 python -c "import model_tools; from tools.registry import registry; print(registry.get_tool_names_for_toolset('selection'))"
```
**回滚**：删 `selection_tools.py` + 还原 `toolsets.py`（纯增量，零侵入内核）。

---

### Phase 2 — AI 产出加 filter_rules（核心诉求）
**目标**：每次 AI 分析额外产出可执行筛选规则，结构与一阶段 qualifyRules **逐字段对齐**。

**对齐目标结构（已确认，competitor.ts:137-149）**：
```ts
QualifyRule   = { conditions: RuleCondition[] }          // 规则间 OR
RuleCondition = { field: "listingDays"|"weightG"|"units"|"bsr",
                  op: "lt"|"le"|"eq"|"ge"|"gt", value: number }  // 规则内 AND
```

**修改** `tools/selection/ai_analyzer.py`：
- `AIResult` dataclass 增加字段：`filter_rules: list[dict] = field(default_factory=list)`（每项 = 一个 QualifyRule）
- `SYSTEM_PROMPT` 增加一节，要求 AI 把模型（价格空白/新星品特征/proven_elements 阈值）转成 filter_rules，**只许用 4 个字段 + 5 个运算符**，value 为数字
- `parse_ai_response` 解析 `filter_rules`，做字段/运算符白名单校验（非法项丢弃，防 AI 乱造字段）

**修改** `tools/selection/save_results.py`：
- `generate_model_json` 把 `filter_rules` 写进模型 JSON
- `save_sub_category_results`/`finalize_batch_json` 持久化（模型 JSON 已是载体，无需改表；如需查询再评估加列）

**验证**：跑一次 `sel_analyze`，断言返回 `filter_rules` 每项符合白名单 schema。

---

### Phase 3 — 后端对话端点（流式 HTTP + CLI）
**目标**：前端能流式对话；单品线按需 + 缓存。

**真实入口（已确认）**：`AIAgent.chat(message, stream_callback)` 原生支持流式回调（run_agent.py:4880）；`run_conversation(...)` 返回 `{"final_response": ...}`。

**修改** `selection-agent-v2/api_server.py`：
- 新增 `POST /api/v1/selection-agent/chat`，body：`{ node_id, marketplace, messages: [{role, content}] }`
- handler：
  1. 先查缓存 `get_latest_batch` → 命中 `done` 且模型 JSON 存在 → 直接流式回放模型摘要，**不跑 LLM**
  2. 未命中 → 构造 AIAgent（启用 `selection` toolset + 固定 selection system prompt：fetch→preprocess→analyze→save）→ `chat(msg, stream_callback=sse_emit)`
  3. 流式：`StreamingResponse` + SSE（`text/event-stream`），每个 delta 一个 `data:` 帧；结束帧带结构化 `{model, filter_rules}`
- 固定 system prompt 引导标准流程 + 把当前 node_id 上下文注入首条消息
- 鉴权：沿用网关 JWT（前端经 gateway 转发，参考 JwtAuthGatewayFilter）
- **vite proxy + 网关路由两处同步**（见记忆 vite-proxy-sync-with-gateway，漏改 dev 404）

**CLI**：`hermes` 命令加载 `selection` toolset 即可对话验证（开发入口）。

**待确认**：Java `product_line_guidance` 与 Python `product_line_elements` 事实来源统一——本期建议 Python 模型 JSON 为准，Java guidance 暂只读/不动。

**验证**：`curl -N` 调端点看 SSE 流；缓存命中路径不触发 DeepSeek 调用（看日志无 AI 请求）。

---

### Phase 4 — 前端：品线页对话抽屉（自写轻量聊天面板）
**目标**：嵌入品线页的对话抽屉，分析→套用筛选闭环。

**新增** `frontend/src/modules/product-line-selection/components/SelectionAgentDrawer.vue`：
- Element Plus `el-drawer`（右侧），消息气泡列表（user/assistant）
- 流式输出（消费 SSE，逐字追加）
- 工具调用过程可折叠展示（fetch/preprocess/analyze 进度）
- 顶部「分析这个品线」按钮（发预设消息）+ 底部输入框（自由追问）
- assistant 消息含 `filter_rules` 时渲染「**套用 AI 推荐筛选**」按钮

**新增** `frontend/src/api/selectionAgent.ts`：流式 fetch（`ReadableStream`/EventSource）调 `/selection-agent/chat`。

**修改** `index.vue`：点品线节点时打开抽屉，传入 `node_id` + 当前上下文。

**修改** `store.ts`：
- 对话状态（按 node_id 缓存消息历史 + 结果）
- `applyAiFilterRules(rules: QualifyRule[])`：直接 `qualifyRules.value = rules` → 触发已有 `loadProducts`（store.ts:361 已读 qualifyRules）→ 立即筛排该品线竞品
- 注意：rules 结构与现有 qualifyRules 完全一致，**直接赋值即可,无需转换**

**验证**：点品线→抽屉→分析→出报告+规则→套用→竞品网格立即按新规则筛选。

---

## 四、风险与待确认
- **技术支点**：Phase 1「顶层文件 vs 子目录」注册机制已在 registry.py:57 (`discover_builtin_tools`) 实锤，非猜测。
- **闭环关键**：分析跑在对话抽屉（嵌品线页），filter_rules 经「套用筛选」按钮回灌 store.qualifyRules——结构已逐字段对齐，直接赋值。不能做独立页，否则闭环断。
- **dev 改码即时生效**（volume 挂载），但 `.pyc` 缓存偶发陈旧 → 必要时 `docker exec ... python -B` 或重启容器。
- 流式：前端需 SSE 消费；后端 `StreamingResponse`。
- 待确认：Java `product_line_guidance` vs Python `product_line_elements` 事实来源统一（Phase 3）。
- 测试：tool 层补 pytest（项目要求 80%，复用 Hermes 自带 pytest）。
- `tests/`(1362) 与 `skills/`(459 comfyui/p5js) 与选品无关，暂不纳入。
- **安全**：`.env` 明文 DEEPSEEK_API_KEY 必须轮换（Phase 0）；新对话端点无鉴权会暴露 LLM 调用 → 必须走网关 JWT。
