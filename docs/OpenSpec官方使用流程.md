# OpenSpec 官方使用流程

> 版本：OpenSpec v1.3.1  
> 文档来源：官方仓库 Fission-AI/OpenSpec  
> 最后更新：2026-05-06

---

## 目录

1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [两种工作模式](#两种工作模式)
4. [完整命令参考](#完整命令参考)
5. [典型工作流](#典型工作流)
6. [CLI 命令](#cli-命令)
7. [配置与定制](#配置与定制)
8. [故障排除](#故障排除)

---

## 快速开始

### 安装

```bash
# npm
npm install -g @fission-ai/openspec@latest

# pnpm
pnpm add -g @fission-ai/openspec@latest

# yarn
yarn global add @fission-ai/openspec@latest

# nix (无需安装)
nix run github:Fission-AI/OpenSpec -- init
```

**要求**：Node.js >= 20.19.0

### 初始化项目

```bash
cd your-project
openspec init
```

选择 Claude Code 作为工具：
```bash
openspec init --tools claude
```

### 生成目录结构

```
your-project/
├── openspec/
│   ├── specs/              # 规范定义（source of truth）
│   ├── changes/            # 活跃变更
│   │   └── archive/        # 归档变更
│   └── config.yaml         # 项目配置
├── .claude/
│   ├── skills/openspec-*/  # Agent Skills
│   └── commands/opsx/      # Slash Commands
└── ...
```

---

## 核心概念

### 四大设计原则

```
fluid not rigid         — 无阶段门控，按需工作
iterative not waterfall — 边做边学，持续 refine
easy not complex        — 轻量设置，最小仪式
brownfield-first        — 支持现有代码库，不只是新项目
```

### 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                        openspec/                             │
│                                                              │
│   ┌─────────────────────┐      ┌─────────────────────────┐   │
│   │       specs/        │      │        changes/         │   │
│   │                     │      │                         │   │
│   │  Source of truth    │◄─────│  Proposed modifications │   │
│   │  系统当前行为描述    │ merge│  每个变更 = 一个文件夹   │   │
│   │                     │      │  包含产物 + delta specs │   │
│   └─────────────────────┘      └─────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 变更（Change）结构

```
openspec/changes/add-dark-mode/
├── proposal.md           # 为什么做、做什么
├── design.md             # 怎么做（技术方案）
├── tasks.md              # 实现清单
├── .openspec.yaml        # 变更元数据（可选）
└── specs/                # Delta specs
    └── ui/
        └── spec.md       # 对 ui/spec.md 的修改
```

### Delta Spec 格式

```markdown
# Delta for Auth

## ADDED Requirements

### Requirement: Two-Factor Authentication
The system MUST support TOTP-based 2FA.

#### Scenario: 2FA enrollment
- GIVEN a user without 2FA enabled
- WHEN the user enables 2FA in settings
- THEN a QR code is displayed for authenticator app setup

## MODIFIED Requirements

### Requirement: Session Expiration
The system MUST expire sessions after 15 minutes of inactivity.
(Previously: 30 minutes)

## REMOVED Requirements

### Requirement: Remember Me
(Deprecated in favor of 2FA)
```

| Section | 含义 | Archive 时操作 |
|---------|------|----------------|
| `ADDED` | 新增行为 | 追加到主 spec |
| `MODIFIED` | 修改行为 | 替换现有 requirement |
| `REMOVED` | 废弃行为 | 从主 spec 删除 |

---

## 两种工作模式

### 模式一：Quick Path（默认 `core` profile）

适合：快速开发、明确需求

```
/opsx:propose ──► /opsx:apply ──► /opsx:archive
```

| 命令 | 用途 |
|------|------|
| `/opsx:propose "想法"` | 一次性生成 proposal、specs、design、tasks |
| `/opsx:explore "问题"` | 探索想法、调研问题 |
| `/opsx:apply` | 按 tasks.md 逐项实现代码 |
| `/opsx:sync` | 将 delta specs 合并到主 specs |
| `/opsx:archive` | 归档已完成的变更 |

### 模式二：Expanded Workflow（完整工作流）

启用方式：
```bash
openspec config profile
# 选择 expanded workflows
openspec update
```

```
/opsx:new ──► /opsx:ff ──► /opsx:apply ──► /opsx:verify ──► /opsx:archive
```

| 命令 | 用途 |
|------|------|
| `/opsx:new` | 创建变更脚手架 |
| `/opsx:continue` | 创建下一个 artifact（按依赖顺序） |
| `/opsx:ff` | Fast-forward：一次性创建所有规划产物 |
| `/opsx:verify` | 验证实现是否符合规范 |
| `/opsx:bulk-archive` | 批量归档多个变更 |
| `/opsx:onboard` | 引导式教程 |

---

## 完整命令参考

### `/opsx:propose`（推荐起点）

**语法**：
```
/opsx:propose [change-name-or-description]
```

**作用**：
- 创建 `openspec/changes/<change-name>/`
- 生成所有规划产物（proposal、specs、design、tasks）
- 停止在准备实现的状态

**示例**：
```
You: /opsx:propose add-dark-mode

AI:  Created openspec/changes/add-dark-mode/
     ✓ proposal.md
     ✓ specs/ui/spec.md
     ✓ design.md
     ✓ tasks.md
     Ready for implementation. Run /opsx:apply.
```

---

### `/opsx:explore`

**语法**：
```
/opsx:explore [topic]
```

**作用**：
- 无结构要求的探索性对话
- 调查代码库回答问题
- 比较选项和方案
- 创建可视化图表澄清思路

**示例**：
```
You: /opsx:explore

AI:  What would you like to explore?

You: How should we handle authentication for the mobile app?

AI:  Let me investigate your current auth setup...
     [Analyzes codebase]

     I see three main options:
     1. JWT tokens (stateless, works offline)
     2. OAuth2 (if you need third-party login)
     3. Extend current sessions (simpler)

     Which direction interests you?
```

---

### `/opsx:apply`

**语法**：
```
/opsx:apply [change-name]
```

**作用**：
- 读取 `tasks.md` 识别未完成任务
- 逐项处理任务
- 编写代码、创建文件、运行测试
- 用 `[x]` 标记完成的任务

**示例**：
```
You: /opsx:apply

AI:  Implementing add-dark-mode...

     Reading tasks.md:
     - [ ] 1.1 Create ThemeContext
     - [ ] 1.2 Add CSS custom properties
     - [ ] 1.3 Implement localStorage persistence

     Working on 1.1: Create ThemeContext...
     [Creates src/context/ThemeContext.tsx]

     ✓ 1.1 Complete
     ...
```

---

### `/opsx:verify`（Expanded 模式）

**语法**：
```
/opsx:verify [change-name]
```

**验证维度**：

| 维度 | 验证内容 |
|------|----------|
| **Completeness** | 所有任务完成、所有 requirement 实现、scenario 覆盖 |
| **Correctness** | 实现符合 spec 意图、边界条件处理 |
| **Coherence** | 设计决策反映在代码中、模式一致 |

**示例**：
```
You: /opsx:verify

AI:  Verifying add-dark-mode...

     COMPLETENESS
     ✓ All 8 tasks in tasks.md are checked
     ✓ All requirements in specs have corresponding code
     ⚠ Scenario "System preference detection" has no test coverage

     CORRECTNESS
     ✓ Implementation matches spec intent
     ✓ Edge cases from scenarios are handled

     COHERENCE
     ✓ Design decisions reflected in code structure
     ⚠ Design mentions "CSS variables" but implementation uses Tailwind

     SUMMARY
     ─────────────────────────────
     Critical issues: 0
     Warnings: 2
     Ready to archive: Yes (with warnings)
```

---

### `/opsx:archive`

**语法**：
```
/opsx:archive [change-name]
```

**作用**：
1. 检查 artifact 完成状态
2. 检查任务完成（未完成会警告）
3. 提供同步 delta specs 的选项
4. 将变更文件夹移动到 `changes/archive/YYYY-MM-DD-<name>/`
5. 保留完整上下文用于审计

**示例**：
```
You: /opsx:archive

AI:  Archiving add-dark-mode...

     Artifact status:
     ✓ proposal.md exists
     ✓ specs/ exists
     ✓ design.md exists
     ✓ tasks.md exists (8/8 tasks complete)

     Delta specs: Not yet synced
     → Sync now? (recommended)

You: Yes

AI:  ✓ Synced specs to openspec/specs/ui/spec.md
     ✓ Moved to openspec/changes/archive/2025-01-24-add-dark-mode/

     Change archived successfully.
```

---

## 典型工作流

### 工作流 1：快速功能开发

```
/opsx:propose add-dark-mode
    ↓
[AI 生成 proposal、specs、design、tasks]
    ↓
/opsx:apply
    ↓
[AI 逐项实现 tasks]
    ↓
/opsx:archive
    ↓
[变更归档，specs 更新]
```

**适用场景**：小到中型功能、bug 修复、明确的需求

---

### 工作流 2：探索式开发

```
/opsx:explore
    ↓
[调查代码库，比较方案]
    ↓
/opsx:propose optimize-product-list
    ↓
[生成规划产物]
    ↓
/opsx:apply
    ↓
/opsx:archive
```

**适用场景**：性能优化、调试、架构决策、需求不明确

---

### 工作流 3：并行变更

```
Change A: /opsx:propose add-dark-mode
              ↓
         /opsx:apply (进行中)
              ↓
         [上下文切换]
              ↓
Change B: /opsx:propose fix-login-bug
              ↓
         /opsx:apply
              ↓
         /opsx:archive
              ↓
         [回到 Change A]
              ↓
         /opsx:apply add-dark-mode
              ↓
         /opsx:archive
```

**批量归档**：
```
/opsx:bulk-archive

AI:  Found 3 completed changes:
     - add-dark-mode
     - fix-login-bug
     - update-footer

     Checking for spec conflicts...
     ⚠ add-dark-mode and update-footer both touch specs/ui/

     Inspecting codebase to resolve...
     Both changes are implemented. Will merge in chronological order.

     Archive all 3 changes?
```

---

### 工作流 4：完整 Expanded 模式

```
/opsx:new add-dark-mode
    ↓
[创建变更文件夹]
    ↓
/opsx:ff
    ↓
[一次性创建所有规划产物]
    ↓
/opsx:apply
    ↓
[实现代码]
    ↓
/opsx:verify
    ↓
[验证实现质量]
    ↓
/opsx:archive
    ↓
[归档完成]
```

---

## CLI 命令

### 设置类

```bash
# 初始化项目
openspec init
openspec init --tools claude,cursor
openspec init --tools all

# 更新配置（升级 CLI 后执行）
openspec update
```

### 浏览类

```bash
# 列出变更/specs
openspec list
openspec list --specs

# 查看详情
openspec show add-dark-mode
openspec show auth --type spec

# 交互式仪表板
openspec view
```

### 验证类

```bash
# 验证变更
openspec validate
openspec validate add-dark-mode
openspec validate --all --json
```

### 工作流类

```bash
# 查看 artifact 状态
openspec status
openspec status --change add-dark-mode --json

# 获取指令
openspec instructions
openspec instructions design --change add-dark-mode

# 查看模板路径
openspec templates

# 列出可用 schemas
openspec schemas
```

### 生命周期类

```bash
# 归档变更
openspec archive
openspec archive add-dark-mode --yes
openspec archive add-dark-mode --skip-specs  # 不更新 specs（纯工具/文档变更）
```

### 配置类

```bash
# 查看配置路径
openspec config path

# 查看/修改配置
openspec config list
openspec config get telemetry.enabled
openspec config set telemetry.enabled false
openspec config edit

# 配置 profile（core vs custom）
openspec config profile
openspec config profile core
```

### Schema 类

```bash
# 创建自定义 schema
openspec schema init research-first
openspec schema init rapid --artifacts "proposal,tasks" --default

# Fork 现有 schema
openspec schema fork spec-driven my-workflow

# 验证 schema
openspec schema validate my-workflow
```

### Workspace 类（Beta）

```bash
# 设置跨仓库工作区
openspec workspace setup
openspec workspace setup --name platform --link /repos/api --link web=/repos/web

# 列出工作区
openspec workspace list

# 链接/重新链接仓库
openspec workspace link /repos/api
openspec workspace relink api-service /new/path

# 诊断
openspec workspace doctor
```

---

## 配置与定制

### 项目配置（openspec/config.yaml）

```yaml
version: 1
schema: spec-driven

# 项目上下文（帮助 AI 理解）
context:
  language: typescript
  framework: react
  testing: vitest

# Per-artifact 规则
rules:
  proposal:
    - Keep scope focused and achievable
  specs:
    - Use GIVEN/WHEN/THEN format for scenarios
  design:
    - Include data flow diagrams
  tasks:
    - Make tasks small enough for one session
```

### 全局配置

```bash
# 查看配置位置
openspec config path

# 常用设置
openspec config set telemetry.enabled false
openspec config set user.name "Your Name" --string
```

### 自定义 Schema

```yaml
# openspec/schemas/research-first/schema.yaml
name: research-first
artifacts:
  - id: research
    generates: research.md
    requires: []

  - id: proposal
    generates: proposal.md
    requires: [research]

  - id: tasks
    generates: tasks.md
    requires: [proposal]
```

---

## 故障排除

### "Change not found"

**解决**：
- 显式指定变更名：`/opsx:apply add-dark-mode`
- 检查变更是否存在：`openspec list`
- 确认在项目根目录

### "No artifacts ready"

**解决**：
- 查看状态：`openspec status --change <name>`
- 检查依赖 artifact 是否存在
- 先创建缺失的依赖

### Commands not recognized

**解决**：
- 确认已初始化：`openspec init`
- 重新生成 skills：`openspec update`
- 检查 `.claude/skills/` 目录是否存在
- 重启 AI 工具

### Artifacts 生成不正确

**解决**：
- 在 `openspec/config.yaml` 中添加项目上下文
- 为特定 artifact 添加规则
- 在变更描述中提供更多细节
- 使用 `/opsx:continue` 替代 `/opsx:ff` 获得更细粒度控制

---

## 最佳实践

### 1. 模型选择

OpenSpec 推荐高推理模型：
- **Opus 4.5+**（推荐）
- **GPT 5.2+**

复杂规划任务对模型能力有要求。

### 2. 上下文卫生

- 开始新变更前清空上下文窗口
- 避免旧对话干扰规范理解
- 保持良好的上下文管理

### 3. 变更命名

| Good | Avoid |
|------|-------|
| `add-dark-mode` | `feature-1` |
| `fix-login-redirect` | `update` |
| `optimize-product-query` | `changes` |
| `implement-2fa` | `wip` |

### 4. 何时更新 vs 新建变更

**更新现有变更**：
- 相同意图，细化执行
- 范围缩小（MVP 优先）
- 基于代码库发现的修正

**新建变更**：
- 意图根本改变
- 范围爆炸到完全不同的工作
- 原始变更可以独立"完成"

### 5. 先 propose 再 apply

不要跳过对齐直接写代码 — 这是 OpenSpec 的核心价值。

---

## 参考资源

- [OpenSpec GitHub](https://github.com/Fission-AI/OpenSpec)
- [Discord 社区](https://discord.gg/YctCnvvshC)
- [官方文档](https://www.openspec.cn/)

---

*本文档基于 OpenSpec v1.3.1 官方文档整理*
