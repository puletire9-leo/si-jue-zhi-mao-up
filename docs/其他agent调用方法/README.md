# mimo 使用方法

> mimo v0.1.0 — CLI AI coding 工具，多模态（支持图片），安装在 `/root/.mimocode/bin/mimo`

---

## 一、角色分工（铁律）

```
┌─────────────────────────────────────────────┐
│  Claude（我）= 技术总管                      │
│  - 分析需求、设计方案、审查代码               │
│  - 制定实现计划、评估风险                     │
│  - 审查 mimo 的输出，把关质量                 │
│  - 决策权：什么该做、怎么做、做到什么程度      │
├─────────────────────────────────────────────┤
│  mimo = 执行者                               │
│  - 执行具体编码任务                           │
│  - 读取文件、搜索代码、运行命令                │
│  - 审查代码细节（在 Claude 指导下）            │
│  - 多模态：可以看图片/截图理解 UI 和问题       │
└─────────────────────────────────────────────┘
```

**原则**: Claude 从不直接写代码时，mimo 执行；Claude 应该并行安排多个 mimo 一起干活。

---

## 二、调用方式

### 前置条件

```bash
# 确保 PATH 包含 mimo
export PATH=/root/.mimocode/bin:$PATH
```

已写入 `~/.profile`，login shell 自动加载。

### 单任务执行

```bash
export PATH=/root/.mimocode/bin:$PATH && mimo run "任务描述"
```

### 多任务并行（推荐）

mimo 支持同时启动多个实例，互不干扰。Claude 应在一次 Bash 调用中并行启动多个：

```bash
# Terminal 1: 审查代码
export PATH=/root/.mimocode/bin:$PATH && mimo run "审查 api_server.py 和 batch_runner.py" &

# Terminal 2: 写前端组件
export PATH=/root/.mimocode/bin:$PATH && mimo run "实现 ProductLineTree.vue 组件" &

# Terminal 3: 写测试
export PATH=/root/.mimocode/bin:$PATH && mimo run "为 save_results.py 写单元测试" &

wait
```

**并发数**: 至少 3 个，看任务粒度调整。

### 交互模式（TUI）

```bash
export PATH=/root/.mimocode/bin:$PATH && mimo .
```

### 其他命令

```bash
mimo agent         # 管理 agents
mimo mcp           # 管理 MCP 服务器
mimo models        # 列出可用模型
mimo stats         # Token 用量统计
mimo --help        # 完整帮助
```

---

## 三、多模态能力

mimo 支持图片输入，可以：

- **看截图**：传入页面截图，理解 UI 问题
- **看图分析**：传入架构图/流程图，理解设计意图
- **看图编码**：传入设计稿，生成前端代码
- **看图排查**：传入错误截图，定位问题

### 使用方式

在 `mimo run` 的 prompt 中引用图片路径：
```bash
mimo run "根据这个设计稿截图，实现前端页面" --image=design.png
```

或直接在交互模式中粘贴/拖入图片。

---

## 四、工作流模式

### 模式 A：审查 → 修复

```
Claude 制定审查维度 → mimo(×3) 并行审查不同模块
  → Claude 汇总发现问题 → 判断哪些需要修
  → mimo(×N) 并行修复 → Claude 最终验证
```

### 模式 B：开发 → 审查

```
Claude 制定实现方案 → mimo(×N) 并行开发不同组件
  → Claude 审查结果 → 发现问题
  → mimo 修复 → Claude 合入
```

### 模式 C：全流程

```
Claude 需求分析 → mimo 调研代码库
  → Claude 设计方案 → 用户确认
  → mimo(×N) 实现 → Claude 审查
  → mimo 修复 → Claude 最终验收
```

---

## 五、注意事项

### 🟢 应该做的
1. **多任务必须并行**：不要串行等，一次启动 3+ 个 mimo
2. **任务要明确**：每个 mimo 的任务描述要具体、边界清晰
3. **审查必须独立**：Claude 自己审查 + mimo 辅助审查，双重保险
4. **利用多模态**：涉及 UI/设计/图表时，传给 mimo 图片
5. **会话独立**：每个 mimo 实例有独立上下文，不会互相污染

### 🔴 不应该做的
1. ❌ 不要让 mimo 做决策 — Claude 做决策，mimo 只执行
2. ❌ 不要让一个 mimo 做所有事 — 拆分成并行任务
3. ❌ 不要跳过 Claude 的审查环节 — mimo 的输出必须经过 Claude 把关
4. ❌ 不要在任务描述里模糊其词 — 输入什么、输出什么、约束是什么要说清楚

### 🚫 绝对禁止给 mimo 的操作（安全边界）

mimo **只能做代码层面的操作**，以下操作绝对不允许：

| 禁止 | 原因 |
|------|------|
| ❌ 删除文件 (`rm`, `unlink`, `del`) | 误删不可逆 |
| ❌ Docker 操作 (`docker`, `docker compose`) | 影响容器和整个环境 |
| ❌ Git 写操作 (`commit`, `push`, `rebase`, `reset`, `tag`) | 污染仓库历史 |
| ❌ Git 分支操作 (`branch -D`, `checkout`, `merge`) | 可能丢失工作 |
| ❌ 修改系统配置 (`/etc/`, `systemctl`) | 影响系统稳定性 |
| ❌ 安装/卸载软件 (`apt`, `pip install -g`, `npm install -g`) | 未经审查的环境变更 |
| ❌ 数据库 DDL (`DROP`, `ALTER`, `TRUNCATE`) | 数据不可逆 |
| ❌ 修改 `.env` / `.gitignore` / `docker-compose` | 配置文件影响面大 |

**mimo 可以做的**:
- ✅ 读文件、搜索代码、分析代码
- ✅ 写新文件、编辑现有代码文件
- ✅ 运行只读命令 (`git status`, `git log`, `git diff`, `ls`, `cat`, `grep`)
- ✅ 运行测试 (`pytest`, `npm test`, `go test`)
- ✅ 运行代码格式化/静态检查 (`eslint`, `ruff`, `prettier`)

### ⚠️ 已知限制
1. **文件权限**：mimo 读文件时可能触发权限弹窗被 auto-reject，敏感文件内容直接内联到 prompt 中
2. **executemany 返回值**：pymysql 的 `executemany()` 返回 `None`，不能用返回值统计写入行数
3. **超时**：大任务给足够的 timeout（300s+）
4. **环境变量**：非交互 shell 不会 source `.bashrc`，需要显式 `export PATH`

---

## 六、环境信息

| 配置 | 值 |
|------|-----|
| 安装路径 | `/root/.mimocode/bin/mimo` |
| 版本 | 0.1.0 |
| API 端点 | `https://token-plan-cn.xiaomimimo.com/anthropic` |
| 默认模型 | `mimo-v2.5-pro` |
| PATH 配置 | `~/.profile` (login shell) + `~/.bash_env` (non-interactive) |

---

## 七、与 Claude Code 的关系

```
用户需求
   ↓
Claude Code（技术总管）
   ├── 分析 → 设计 → 规划
   ├── 决策 → 把关
   └── 调度 mimo(×N) 执行
         ├── mimo-1: 任务 A
         ├── mimo-2: 任务 B
         ├── mimo-3: 任务 C
         └── ... (更多并行)
              ↓
         结果汇总到 Claude
              ↓
         审查 → 修复 → 验收 → 交付
```

**一句话**：Claude 是大脑，mimo 是手脚。
