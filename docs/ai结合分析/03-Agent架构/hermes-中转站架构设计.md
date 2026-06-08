# Hermes 中转站架构设计 v1

> **定位**：Java 后端作为「中转站」，连接前端用户界面与 Hermes AI Agent。
> **核心原则**：Hermes 是通用 AI 大脑，选品只是第一个 Skill。架构必须支持未来多功能扩展。

---

## 一、整体架构全景

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户交互层                                      │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Vue Web 前端 │    │ Electron 桌面│    │  CLI (开发调试)           │  │
│  │  (现有项目)   │    │  (未来)      │    │                          │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────────┘  │
│         │                   │                        │                  │
│  ───────┴───────────────────┴────────────────────────┴────────────────  │
│                      统一 API 层 (Java Spring Boot)                       │
│                                                                         │
│  ════════════════════════════════════════════════════════════════════  │
│                    ★ 中转站核心：AI Assistant 模块 ★                     │
│  ════════════════════════════════════════════════════════════════════  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  现有业务模块              │  新增：AI Assistant Bridge            │   │
│  │  ─────────────             │  ─────────────────────               │   │
│  │  CompetitorController      │  AiAssistantController               │   │
│  │  DengZongShopController    │  ├── POST /api/v1/ai/chat           │   │
│  │  ScoringEngine             │  ├── GET  /api/v1/ai/sessions        │   │
│  │  FilterPreset              │  ├── GET  /api/v1/ai/sessions/{id}   │   │
│  │  AsinImport               │  ├── POST /api/v1/ai/tasks          │   │
│  │                           │  ├── GET  /api/v1/ai/tasks/{id}      │   │
│  │  新增：ProductLine模块     │  ├── GET  /api/v1/ai/status         │   │
│  │  ─────────────             │  └── WebSocket /ws/ai/stream        │   │
│  │  ProductLineController     │                                       │   │
│  │  ProductLineService        │  AiAssistantService (中转逻辑)       │   │
│  │  product_line_guidance表   │  ├── 会话管理 (Session CRUD)        │   │
│  │                           │  ├── 消息转发 (→Hermes API Server)   │   │
│  │                           │  ├── 流式SSE桥接 (WebSocket↔SSE)      │   │
│  │                           │  ├── 任务队列 (异步分析任务)          │   │
│  │                           │  └── 结果缓存 (分析报告持久化)        │   │
│  │                           │                                       │   │
│  └────────────────────────────┼──────────────────────────────────────┘   │
│                             │                                           │
│  ────────────────────────────┼───────────────────────────────────────   │
│                    HTTP Bridge (Java → Hermes)                          │
│                             │                                           │
│  ┌──────────────────────────▼──────────────────────────────────────┐   │
│  │                                                                  │   │
│  │              Hermes Agent (独立进程)                              │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  API Server (gateway/platforms/api_server.py)              │  │   │
│  │  │  监听端口: 8642 (默认)                                     │  │   │
│  │  │                                                             │  │   │
│  │  │  POST /v1/chat/completions     ← Java调用的核心接口         │  │   │
│  │  │  POST /v1/responses            ← 带状态的对话               │  │   │
│  │  │  GET  /api/sessions             ← 会话列表                   │  │   │
│  │  │  POST /api/sessions             ← 创建会话                   │  │   │
│  │  │  GET  /api/sessions/{id}        ← 会话详情+消息历史          │  │   │
│  │  │  POST /api/sessions/{id}/chat   ← 对话(支持流式)            │  │   │
│  │  │  POST /v1/runs                 ← 异步任务启动                │  │   │
│  │  │  GET  /v1/runs/{id}             ← 任务状态查询                │  │   │
│  │  │  GET  /health                   ← 健康检查                    │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                             │                                    │   │
│  │  ┌──────────────────────────▼───────────────────────────────┐  │   │
│  │  │  AIAgent 核心引擎                                         │  │   │
│  │  │  ├─ LLM 对话循环 (tool calling 迭代)                      │  │   │
│  │  │  ├─ Tool 调度 (model_tools.py)                            │  │   │
│  │  │  └─ Session 管理 (hermes_state.py → SQLite)               │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                             │                                    │   │
│  │  ┌──────────────────────────▼───────────────────────────────┐  │   │
│  │  │  Skills & Tools (可插拔能力集)                            │  │   │
│  │  │                                                         │  │   │
│  │  │  ★ 当前: selection-agent (选品分析)                      │  │   │
│  │  │    ├─ fetch_aggregated_data     → Java ProductLine API    │  │   │
│  │  │    ├─ submit_analysis_results    → Java ProductLine API    │  │   │
│  │  │    └─ query_guidance            → Java ProductLine API    │  │   │
│  │  │                                                         │  │   │
│  │  │  未来可扩展:                                              │  │   │
│  │  │    ├─ data-analyst (数据分析)                             │  │   │
│  │  │    ├─ document-manager (文档读写)                         │  │   │
│  │  │    ├─ system-advisor (系统顾问)                           │  │   │
│  │  │    └─ ... (更多自定义Skill)                               │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  数据源层                                                                │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │deng_zong │  │ competitor │  │  MySQL   │  │ 文件系统              │  │
│  │_shop 表  │  │ _products  │  │  数据库   │  │ docs/ 选品算法/       │  │
│  │          │  │  表        │  │          │  │ ai结合分析/ 产品数据/  │  │
│  └────▲─────┘  └─────▲──────┘  └────▲─────┘  └──────────▲───────────┘  │
│       │               │               │                    │           │
│  ─────┴───────────────┴───────────────┴────────────────────┴──────────  │
│                    Java MyBatis-Plus / 文件IO                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、为什么需要"中转站"？直接连Hermes不行吗？

| 方案 | 可行性 | 问题 |
|------|-------|------|
| **前端直连Hermes API Server(8642)** | 技术可行 | ① 跨域问题 ② 认证分散 ③ 无法注入业务上下文 ④ 前端要同时连两个后端 |
| **Hermes直连MySQL** | 技术可行 | ① 违反分层原则 ② Hermes不熟悉我们的表结构 ③ 安全风险 |
| **Java中转站（推荐）** | 最佳方案 | ① 统一入口 ② 注入业务上下文 ③ 权限控制 ④ 缓存/限流 ⑤ 解耦前后端与Agent |

### 中转站的5大职责

```
┌─────────────────────────────────────────────────────┐
│              AiAssistantService 职责                 │
│                                                     │
│  ① 会话代理                                          │
│     前端不直接操作Hermes Session，而是通过Java代理     │
│     → 可以做权限校验、会话隔离、多租户支持              │
│                                                     │
│  ② 上下文注入                                        │
│     在转发给Hermes之前，自动附加业务上下文：            │
│     → 当前用户信息、店铺权限、数据范围                 │
│     → 系统状态（最近同步时间、待处理任务数等）          │
│                                                     │
│  ③ 协议转换                                          │
│     前端用WebSocket → Java转换 → HTTP(SSE) → Hermes  │
│     → 统一流式输出格式                                │
│                                                     │
│  ④ 任务编排                                          │
│     "帮我分析所有品类" → 拆分为N个子任务               │
│     → 并行发给Hermes → 汇总结果 → 回写数据库           │
│                                                     │
│  ⑤ 结果持久化                                        │
│     Hermes的分析结果不只是内存中的对话                 │
│     → 通过中转站写入 product_line_guidance 等表        │
│     → 前端随时可查，不依赖Hermes在线                   │
└─────────────────────────────────────────────────────┘
```

---

## 三、API 接口设计

### 3.1 接口总览

| 方法 | 路径 | 功能 | 对应Hermes接口 |
|------|------|------|---------------|
| POST | `/api/v1/ai/chat` | 发送消息并获取回复（非流式） | `POST /v1/chat/completions` |
| POST | `/api/v1/ai/chat/stream` | 发送消息并流式回复 | `POST /api/sessions/{id}/chat` (streaming) |
| WS | `/ws/ai/stream` | WebSocket长连接实时对话 | 同上（协议转换） |
| GET | `/api/v1/ai/sessions` | 获取会话列表 | `GET /api/sessions` |
| POST | `/api/v1/ai/sessions` | 创建新会话 | `POST /api/sessions` |
| GET | `/api/v1/ai/sessions/{id}` | 获取会话详情+历史消息 | `GET /api/sessions/{id}` |
| DELETE | `/api/v1/ai/sessions/{id}` | 删除会话 | `DELETE /api/sessions/{id}` |
| POST | `/api/v1/ai/tasks` | 提交异步分析任务 | 内部调度 → Hermes batch |
| GET | `/api/v1/ai/tasks/{id}` | 查询任务状态和结果 | 内部查询 |
| GET | `/api/v1/ai/status` | AI服务健康状态 | `GET /health` |

### 3.2 核心 DTO 设计

```java
/**
 * AI聊天请求
 */
@Data
public class AiChatRequest {
    /** 会话ID，为空则创建新会话 */
    private String sessionId;

    /** 用户消息内容 */
    private String message;

    /** 是否流式输出 */
    private Boolean stream = false;

    /** 可选：指定使用的Skill */
    private String skill;           // "selection-agent" | "data-analyst" | null(自动)

    /** 可选：附加的业务上下文 */
    private Map<String, Object> context;
}

/**
 * AI聊天响应
 */
@Data
public class AiChatResponse {
    private String sessionId;
    private String message;           // 助手回复文本
    private List<AiToolCall> toolCalls; // 本次调用过的工具
    private Long tokensUsed;
    private Long latencyMs;
}

/**
 * 工具调用记录
 */
@Data
public class AiToolCall {
    private String toolName;          // 如 "fetch_aggregated_data"
    private Map<String, Object> args; // 调用参数
    private String resultSummary;     // 结果摘要（截断）
    private Long durationMs;
}

/**
 * 异步分析任务请求
 */
@Data
public class AiAnalysisTaskRequest {
    /** 任务类型 */
    private String taskType;          // "FULL_BATCH_ANALYSIS" | "SINGLE_CATEGORY"

    /** 分析参数 */
    private String marketplace;       // UK / DE / US
    private String month;             // 如 "202606"
    private String bsrIdFilter;       // 可选：只分析指定品线
    private String nodeIdFilter;       // 可选：只分析指定小类

    /** 完成后的回调通知方式 */
    private NotifyConfig notifyConfig;
}

/**
 * 异步分析任务响应/状态
 */
@Data
public class AiAnalysisTask {
    private String taskId;
    private String taskType;
    private TaskStatus status;         // PENDING / RUNNING / COMPLETED / FAILED
    private Integer totalCategories;   // 待分析小类总数
    private Integer completedCount;    // 已完成数
    private String resultBatchId;      // 完成后回写的批次ID
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
```

### 3.3 中转站核心流程

```
用户发消息: "帮我分析 Beauty 品线的选品机会"
        │
        ▼
┌─ Java AiAssistantController.chat() ─────────────────────┐
│                                                           │
│  Step 1: 准备请求                                          │
│    ├─ 创建/复用 Session                                   │
│    ├─ 注入 System Prompt（含业务上下文）                     │
│    │   "你是思觉智贸系统的AI选品顾问。当前用户: {userName}"     │
│    │   "可用数据范围: deng_zong_shop表, {marketplace}站点"    │
│    │   "请使用 selection-agent Skill 进行分析..."             │
│    └─ 如果指定了skill → 加载对应SKILL.md到system prompt      │
│                                                           │
│  Step 2: 转发到 Hermes API Server                          │
│    POST http://hermes:8642/v1/chat/completions              │
│    Body: {                                                 │
│      model: "hermes-agent",                                 │
│      messages: [system, {role:"user", content:message}],    │
│      tools: [...],          // 从Hermes动态获取当前可用工具    │
│      stream: false,                                         │
│      user: sessionUserId,                                   │
│    }                                                       │
│                                                           │
│  Step 3: 处理 Tool Calling 循环（如果Hermes返回tool_calls）    │
│    WHILE response.has_tool_calls():                         │
│      FOR each tool_call in response.tool_calls:             │
│        ├─ 特殊处理：如果是 product_line 相关工具               │
│        │   → 直接在Java内部调用ProductLineService（不走Hermes）│
│        │   → 减少一次HTTP往返，提高性能                       │
│        │                                                      │
│        └─ 其他工具 → 转发给Hermes执行                       │
│      将 tool_result 返回给 Hermes 继续对话循环                │
│                                                           │
│  Step 4: 返回最终结果给前端                                  │
│    { sessionId, message, toolCalls[], tokensUsed }          │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 3.4 流式输出（WebSocket）

```
前端 WebSocket ──→ Java /ws/ai/stream
                      │
                      ▼
              建立 WebSocket 连接
              (携带sessionId + token)
                      │
                      ▼
         Java 转发到 Hermes (HTTP SSE)
         POST /api/sessions/{id}/chat?stream=true
                      │
                      ▼
         ┌── Hermes 流式返回 ──┐
         │  {"type":"message_delta","content":"成熟"}  │
         │  {"type":"message_delta","content":"美甲"}  │
         │  {"type":"tool_start","tool":"fetch..."}   │
         │  {"type":"tool_end","result":"{...}"}       │
         │  {"type":"message_delta","content":"..."}    │
         │  {"type":"done"}                             │
         └────────────────────────────────────────────┘
                      │
                      ▼
         Java 转换为 WebSocket帧推送给前端
         WS: {"type":"content","text":"成熟美甲"}
         WS: {"type":"tool_call","name":"fetch_aggregated_data","status":"running"}
         WS: {"type":"tool_result","name":"fetch_aggregated_data","summary":"获取35个商品..."}
         WS: {"type":"content","text":"..."}
         WS: {"type":"done"}
```

---

## 四、Hermes 配置（Agent侧）

### 4.1 config.yaml 关键配置

```yaml
# ~/.hermes/config.yaml (Hermes配置)

# API Server 启用
gateway:
  enabled: true
  api_server:
    enabled: true
    host: "127.0.0.1"
    port: 8642
    api_key: "${HERMES_API_KEY}"          # 从环境变量读取

# 默认模型配置
model:
  provider: "openrouter"                   # 或 anthropic / openai / deepseek
  model: "anthropic/claude-sonnet-4"       # 推荐：推理能力强

# 工具集：启用product_line工具
tools:
  platforms:
    default:
      enabled:
        - "product_line"                   # 我们的选品工具
        - "file"                            # 文件读写（文档管理用）
        - "web_search"                      # 网络搜索（市场调研用）
        - "terminal"                        # 终端（调试用）
      disabled:
        - "browser"                         # 不需要浏览器自动化
        - "spotify"                         # 不相关
        - "google_meet"                     # 不相关
        # ... 其他不需要的工具

# Skill: 默认加载 selection-agent
skills:
  auto_load:
    - "selection-agent"

# Cron: 定时分析任务
cron:
  enabled: true
  jobs:
    - name: "weekly-selection-analysis"
      schedule: "every monday 09:00"
      skills: ["selection-agent"]
      script: |
        1. 调用 fetch_aggregated_data(marketplace="UK")
        2. 遍历每个 subCategory 执行8大能力分析
        3. 调用 submit_analysis_results 批量提交
        4. 输出分析摘要
```

### 4.2 环境变量 (.env)

```bash
# Hermes .env (敏感信息)

# API Server 密钥（Java中转站连接时使用）
HERMES_API_KEY=sk-sijue-zhimao-internal-2026

# LLM API Key
OPENROUTER_API_KEY=sk-or-xxx              # 或 ANTHROPIC_API_KEY 等

# Java 后端地址（供 product_line_tool 使用）
SELECTION_JAVA_BACKEND=http://localhost:8080
```

---

## 五、前端对接设计（预留）

### 5.1 新增页面路由

```typescript
// frontend/src/router/index.ts 新增
{
  path: '/ai-assistant',
  component: () => import('@/views/ai/AiAssistant.vue'),
  meta: { title: 'AI 助手', icon: 'Monitor' }
}
```

### 5.2 AI 对话页面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [AI 助手]                    [选择 Skill: ▼] [新建会话] [历史] │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                      │
│  会话历史              │  对话区域                             │
│  ┌────────────────┐  │  ┌──────────────────────────────────┐ │
│  │ 📋 品线分析-0608│  │  │ 👤 帮我分析Beauty品线             │ │
│  │ 📋 销量趋势分析 │  │  │                                  │ │
│  │ 📋 文档更新建议 │  │  │ 🤖 正在分析中...                  │ │
│  │ 📋 系统问答     │  │  │    🔧 fetch_aggregated_data      │ │
│  │                │  │  │       ✅ 获取520个商品数据          │ │
│  │                │  │  │    🔧 能力1: 语义品类理解...        │ │
│  │                │  │  │       ✅ 判定原型=FP(时尚个人)      │ │
│  │                │  │  │    🔧 能力2: 竞争格局解剖...        │ │
│  │                │  │  │                                  │ │
│  └────────────────┘  │  └──────────────────────────────────┘ │
│                      │                                      │
│                      │  ┌──────────────────────────────────┐ │
│  快捷操作              │  │ 输入消息...               [发送] │ │
│  ┌────────────────┐  │  └──────────────────────────────────┘ │
│  │ 🔄 全量分析    │  │                                      │
│  │ 📊 查看推送卡片 │  │  推荐结果面板（分析完成后展示）         │
│  │ 📁 查看文档     │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ ⚙️ 设置        │  │  │Card│ │Card│ │Card│ │Card│       │
│  └────────────────┘  │  └────┘ └────┘ └────┘ └────┘       │
└──────────────────────┴──────────────────────────────────────┘
```

### 5.3 前端 API 封装

```typescript
// frontend/src/api/ai.ts

import request from '@/utils/request'

/** AI聊天（非流式） */
export function chat(data: { message: string; sessionId?: string; skill?: string }) {
  return request.post('/ai/chat', data)
}

/** AI聊天（流式）— 返回EventSource或使用WebSocket */
export function chatStream(data: { message: string; sessionId?: string }, onMessage: (data: any) => void) {
  // 使用WebSocket连接 /ws/ai/stream
  // 或使用EventSource（需后端支持SSE）
}

/** 获取会话列表 */
export function getSessions(params?: { page?: number; size?: number }) {
  return request.get('/ai/sessions', { params })
}

/** 获取会话详情（含历史消息） */
export function getSession(sessionId: string) {
  return request.get(`/ai/sessions/${sessionId}`)
}

/** 创建新会话 */
export function createSession(skill?: string) {
  return request.post('/ai/sessions', { skill })
}

/** 提交异步分析任务 */
export function submitAnalysisTask(data: AiAnalysisTaskRequest) {
  return request.post('/ai/tasks', data)
}

/** 查询任务状态 */
export function getTaskStatus(taskId: string) {
  return request.get(`/ai/tasks/${taskId}`)
}

/** 获取AI服务状态 */
export function getAiStatus() {
  return request.get('/ai/status')
}
```

---

## 六、选品功能的具体集成路径

### 6.1 第一步：最小可用（MVP）

```
时间线: Week 1-2

Java端:
  ✅ AiAssistantController (chat + sessions基础CRUD)
  ✅ AiAssistantService (HTTP Client → Hermes API Server)
  ✅ ProductLineController (聚合数据 + 回写 + 查询)
  ✅ ProductLineService (SQL聚合引擎)
  ✅ product_line_guidance 表DDL

Hermes端:
  ✅ tools/product_line_tool.py (3个工具)
  ✅ skills/selection-agent/SKILL.md (分析方法论)
  ✅ toolsets.py 追加 product_line toolset
  ✅ config.yaml 启用 api_server

验证路径:
  CLI测试: hermes → 加载skill → 手动触发分析 → 查看回写结果
  API测试: Postman → Java /api/v1/product-line/aggregated-data → 检查数据
  E2E测试: Java /api/v1/ai/chat → "分析beauty品线" → 自动完成全流程
```

### 6.2 第二步：前端展示

```
时间线: Week 3-4

前端:
  ✅ AI对话页面 (/ai-assistant)
  ✅ 品线推送卡片组件 (复用UniversalCard风格)
  ✅ WebSocket流式输出
  ✅ 分析报告展开/折叠

新页面:
  /product-line/guidance     → 品线推送看板（推荐等级筛选）
  /product-line/detail/:id  → 单个小类详细分析报告
```

### 6.3 第三步：定时任务 + 推送

```
时间线: Week 5-6

Hermes:
  ✅ Cron 定时任务 (每周一9点自动全量分析)
  ✅ 分析结果自动回写 guidance 表

Java:
  ✅ 推送服务 (飞书/企微webhook)
  ✅ "今日新品报告" Dashboard

前端:
  ✅ 推送通知接收
  ✅ 分析结果对比（本月 vs 上月）
```

### 6.4 第四步：多功能扩展

```
时间线: Week 7+

新增 Skill 示例:
  📊 data-analyst      → "帮我看看上个月销量TOP20的变化趋势"
  📄 document-manager  → "更新选品算法08文档的权重矩阵"
  🔧 system-advisor    → "解释一下品线和子类目的关系"
  📦 supply-chain      → "评估Nail Tips的供应链难度"

每个新 Skill = 1个 tools/xxx_tool.py + 1个 skills/xxx/SKILL.md
不需要改Java中转站代码（通用chat接口已支持任意skill）
```

---

## 七、安全与隔离

### 7.1 认证链路

```
前端请求 → JWT Token (现有认证体系)
       ↓
Java AiAssistantController → @PreAuthorize("hasRole('USER')")
       ↓
提取 userId + shopScope (用户可见的店铺范围)
       ↓
注入到发给Hermes的 system prompt:
  "当前用户: {userId}, 数据范围: {shopScope}"
       ↓
Hermes API Server → API Key认证 (HERMES_API_KEY)
       ↓
AIAgent → 在该安全上下文中运行
```

### 7.2 数据隔离

| 隔离维度 | 实现方式 |
|---------|---------|
| **用户级** | Java注入shopScope到prompt，Hermes只查询允许的数据 |
| **会话级** | 每个sessionId对应Hermes的一个session，互不干扰 |
| **任务级** | 异步任务有独立的taskId，结果独立存储 |
| **工具级** | product_line_tool 的Java地址可通过配置区分环境 |

### 7.3 限流与防护

```
Java中转站层面:
  └─ @RateLimiter(value = 30)  // 每用户每分钟最多30条消息
  └─ 最大单次消息长度: 10000字符
  └─ 最大会话历史: 200条消息
  └─ 并发任务上限: 每用户同时最多3个分析任务

Hermes层面:
  └─ max_iterations: 90 (单次对话最大工具调用次数)
  └─ budget控制 (token消耗上限)
  └─ 3分钟硬中断 (防死循环)
```

---

## 八、部署拓扑

### 开发环境

```
开发者机器:
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │  VS Code    │   │  Terminal   │   │  Browser    │
  │  (前端开发)  │   │  (Java:8080)│   │  (:5173)    │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         │                  │                  │
         │    ┌─────────────▼──────────────────┘
         │    │         Vite Proxy (/api → :8080)
         │    │
         │    ▼
         │  ┌─────────────┐
         │  │  Java 后端   │  localhost:8080
         │  │  (Spring Boot)│
         │  └──────┬──────┘
         │         │ HTTP (→ Hermes :8642)
         │         ▼
         │  ┌─────────────┐
         │  │  Hermes Agent │  localhost:8642
         │  │  (Python)    │
         │  └─────────────┘
         │
         ▼
    MySQL (Docker) :3306
```

### 生产环境

```
服务器:
  ┌──────────────────────────────────────────────────┐
  │  Nginx (反向代理 + SSL终止)                       │
  │    /api/*      → Java Backend (:8080)             │
  │    /ws/*       → Java Backend (:8080)             │
  │    /*          → Frontend静态文件                 │
  └──────────────────────┬───────────────────────────┘
                         │
  ┌──────────────────────▼───────────────────────────┐
  │  Docker Compose                                │
  │                                                  │
  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
  │  │ java-backend │  │ hermes-agent│  │ mysql    │ │
  │  │ :8080        │  │ :8642       │  │ :3306    │ │
  │  │ (Spring Boot)│  │ (Python)    │  │ (MySQL)  │ │
  │  └──────┬───────┘  └──────┬──────┘  └────▲─────┘
  │         │                 │               │
  │         └────────┬────────┘               │
  │                  │  internal network     │
  │                  ▼                        │
  │         ┌──────────────┐                  │
  │         │ Redis (:6379)│ ◄─────────────────┘
  │         │ (缓存/会话)  │
  │         └──────────────┘
  └──────────────────────────────────────────────┘
```

---

## 九、文件变更清单

### Java 后端（本项目）

| 操作 | 文件 | 说明 |
|------|------|------|
| **新建** | `sjzm-ai/src/.../controller/AiAssistantController.java` | AI对话/会话/任务接口 |
| **新建** | `sjzm-ai/src/.../service/AiAssistantService.java` | 中转核心逻辑 |
| **新建** | `sjzm-ai/src/.../dto/AiChatRequest.java` | 聊天请求DTO |
| **新建** | `sjzm-ai/src/.../dto/AiChatResponse.java` | 聊天响应DTO |
| **新建** | `sjzm-ai/src/.../dto/AiAnalysisTask*.java` | 异步任务DTO |
| **新建** | `sjzm-ai/src/.../config/HermesProperties.java` | Hermes连接配置 |
| **新建** | `sjzm-ai/src/.../config/WebSocketConfig.java` | WebSocket配置 |
| **新建** | `sjzm-ai/src/.../handler/AiStreamHandler.java` | WebSocket处理器 |
| **新建** | `sjzm-product/src/.../controller/ProductLineController.java` | 品线聚合API |
| **新建** | `sjzm-product/src/.../service/ProductLineService.java` | 聚合引擎 |
| **新建** | `sql/product_line_guidance.sql` | DDL |
| **修改** | `pom.xml` (父或sjzm-ai) | 添加 sjzm-ai 模块依赖 |
| **修改** | `application.yml` | 添加 hermes.* 配置段 |

### Hermes Agent（外部项目）

| 操作 | 文件 | 说明 |
|------|------|------|
| **新建** | `tools/product_line_tool.py` | 3个选品工具 |
| **修改** | `toolsets.py` | 追加 product_line toolset + 3个工具名 |
| **新建** | `skills/selection-agent/SKILL.md` | 选品分析Skill |
| **修改** | `~/.hermes/config.yaml` | 启用api_server + 配置工具集 |
| **修改** | `~/.hermes/.env` | 设置 API keys |

### 前端（本项目）

| 操作 | 文件 | 说明 |
|------|------|------|
| **新建** | `src/views/ai/AiAssistant.vue` | AI对话主页面 |
| **新建** | `src/api/ai.ts` | AI相关API封装 |
| **新建** | `src/views/product-line/GuidanceBoard.vue` | 品线推送看板 |
| **修改** | `src/router/index.ts` | 添加路由 |
| **修改** | `src/layout/` | 添加侧边栏入口 |

---

## 十、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| **Hermes 进程崩溃** | AI功能完全不可用 | Java中转站检测 health endpoint → 降级为只读模式（展示已有分析结果） |
| **LLM API 限额/费用** | 分析任务无法执行 | 任务队列 + 重试机制；设置每日token预算上限 |
| **Hermes 版本升级不兼容** | API接口变化 | 中转站抽象 HermesClient 接口，版本适配在实现层 |
| **分析质量不稳定** | 推荐结果不可信 | 14文档反馈闭环 → 多轮校准 → 置信度阈值过滤低置信结果 |
| **并发分析耗尽资源** | 系统变慢 | 任务排队 + 并发限制(3) + 优先级队列 |
| **前端WebSocket断连** | 流式中断 | 自动重连 + 消息缓存 + 断点续传 |
