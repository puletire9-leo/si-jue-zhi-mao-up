# 智能体调用方法

> Claude = 技术总管（规划+审查+决策），智能体 = 执行者（编码+搜索+分析）

---

## 一、可用智能体

| Agent | 版本 | 路径 | 类型 |
|-------|------|------|------|
| mimo | 0.1.0 | `/root/.mimocode/bin/mimo` | CLI AI 编码助手 |
| opencode | 1.17.3 | `/usr/local/bin/opencode` | CLI AI 编码助手 |

**身份**: 两者都是执行者，Claude 决策它们执行。

---

## 二、mimo 调用

### 前置
```bash
export PATH=/root/.mimocode/bin:$PATH
```

### 基本用法
```bash
mimo run "任务描述"
```

### 多任务并行
```bash
mimo run "任务A" & mimo run "任务B" & mimo run "任务C" & wait
```

### 在 Bash 工具中调用
```bash
export PATH=/root/.mimocode/bin:$PATH && mimo run "..." 2>&1 &
```

### 已知特性
- 版本 0.1.0，API: `https://token-plan-cn.xiaomimimo.com/anthropic`
- 模型: `mimo-v2.5-pro`
- 支持多模态（图片输入）
- 长时间任务可能 build 较久，带 `timeout=600000` 保险
- 输出到文件时可能前期为空（内部 build 阶段）

---

## 三、opencode 调用

### 基本用法
```bash
opencode run "任务描述"
```

### 多任务并行
```bash
opencode run "任务A" & opencode run "任务B" & opencode run "任务C" & wait
```

### 已知特性
- 版本 1.17.3
- 响应速度比 mimo 快
- 命令接口与 mimo 基本一致 (`run`, `agent`, `mcp`, `serve`, `models`, `stats`...)

### 安装
```bash
npm install -g opencode-linux-x64
ln -sf /root/.nvm/versions/node/.../lib/node_modules/opencode-linux-x64/bin/opencode /usr/local/bin/opencode
```

---

## 四、给智能体的任务规范

### 必须包含
1. **具体任务** — 做什么、改哪个文件、什么逻辑
2. **输出要求** — 写代码 / 分析 / 审查，结果放哪里
3. **边界限制** — 不改什么、不碰什么、范围

### 安全边界（绝对不给）

| 禁止 | 原因 |
|------|------|
| ❌ 删除文件 | 误删不可逆 |
| ❌ Docker / Git 写操作 | 影响环境/仓库 |
| ❌ 修改系统配置 | 影响稳定性 |
| ❌ 安装软件 | 未审查的变更 |
| ❌ 修改 .env / docker-compose / .gitignore | 配置影响面大 |

### 任务模板

```
创建/修改 {文件路径}。

功能: {一句话描述}

具体要求:
1. {具体点1}
2. {具体点2}
3. {具体点3}

约束:
- 只改这个文件
- 保持现有风格
- 代码规范: type hints, docstring
```

---

## 五、并行工作模式

```
Claude 拆解任务
  ├── Agent 1: 独立任务 A
  ├── Agent 2: 独立任务 B
  ├── Agent 3: 独立任务 C
  └── Agent 4: 独立任务 D
        ↓ (全部并行执行)
  Claude 继续做规划/审查/其他工作
        ↓ (Agent 完成后)
  Claude 审查所有结果 → 合入
```

### 关键原则
1. **Claude 不等 Agent** — Agent 运行期间 Claude 继续工作
2. **任务独立** — 每个 Agent 任务必须互不冲突（不同文件或不同区域）
3. **先审查再用** — 所有 Agent 输出必须经过 Claude 审查
4. **内容内联** — 需要 Agent 读的文件，内容直接放进 prompt，不让它自己读（避免权限弹窗）
