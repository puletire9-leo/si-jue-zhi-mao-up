# 思觉智贸 - Agent 开发索引

> **Humans direct, Agents execute.（人类负责掌舵，Agent 负责干活）**
>
> 本文件是 AI Agent 进入本项目时的唯一入口。保持 ≤100 行，只做索引。

---

## 项目概述

跨境电商产品数据管理系统。双后端并行架构：Java 处理核心业务，Python 处理 AI 功能。

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| Java 后端 | Spring Boot + MyBatis-Plus + Spring Cloud Gateway | 4.0.4 / Java 17 |
| Python 后端 | FastAPI + Celery + Qdrant | Python 3.11 |
| 前端 | Vue 3 + TypeScript + Element Plus + Vite | Node 20 |
| 数据库 | MySQL 8.0 + Redis 7 | - |
| 部署 | Docker Compose 生产栈 | - |

## 文档导航

| 文档 | 路径 | 说明 |
|------|------|------|
| 系统架构 | [docs/architecture/README.md](docs/architecture/README.md) | 双后端架构、服务拓扑、数据流 |
| API 路由分流 | [docs/api/README.md](docs/api/README.md) | Nginx 路由规则、Java/Python 职责划分 |
| 数据库设计 | [docs/database/README.md](docs/database/README.md) | 表结构、迁移记录、ER 关系 |
| RDS 中心 | [docs/rds中心/README.md](docs/rds中心/README.md) | 远程库现状：已有/过时/未落地文件总账 |
| 财务/运营自动化 | [docs/架构/财务与运营自动化任务完整实施记录.md](docs/架构/财务与运营自动化任务完整实施记录.md) | 财务日报与运营物流自动化统一实施索引 |
| 开发规范 | [docs/development/standards.md](docs/development/standards.md) | 编码规范、提交规范、分支策略 |
| 生产部署唯一流程 | [docs/docker使用经验/部署流程.md](docs/docker使用经验/部署流程.md) | 唯一权威，其他文档不得覆盖 |
| 日常更新 Docker | [docs/docker使用经验/日常更新docker.md](docs/docker使用经验/日常更新docker.md) | 已在跑的栈只更新单个组件 |
| 部署索引 | [DOCKER_DEPLOY.md](DOCKER_DEPLOY.md) | 只做入口索引 |
| AI 能力分析 | [docs/AI能力差距综合分析报告.md](docs/AI能力差距综合分析报告.md) | 岗位差距与学习路线 |

## 模块索引

| 模块 | AGENTS.md | 说明 |
|------|-----------|------|
| Java 后端 | [java-backend/AGENTS.md](java-backend/AGENTS.md) | 认证/用户 + 竞品分析/评分/ASIN导入/筛选预设 + 领星/财务运营自动化 |
| Python 后端 | [backend/AGENTS.md](backend/AGENTS.md) | AI 功能（向量检索/图像识别/评分/LLM） |
| 前端 | [frontend/AGENTS.md](frontend/AGENTS.md) | Vue 3 管理后台（含自动化/领星运行/飞书对接中心） |

## 铁律（Agent 必须遵守）

1. **代码仓库是唯一事实来源** — 不信任任何脱离代码的口头描述
2. **分层依赖单向** — Controller → Service → Mapper，禁止反向调用
3. **配置走环境变量** — 禁止硬编码任何环境相关值（数据库地址、密钥、端口）
4. **Java 包名用 jakarta.*** — Spring Boot 3.x 要求，禁止 javax.*
5. **API 路径约定** — Java 后端 `/api/{resource}/`，Python 后端 `/api/v1/{resource}/`
6. **修改前先读** — 改任何模块前，先读对应 AGENTS.md 了解上下文
7. **保持文档同步** — 代码变更后同步更新相关文档
8. **PowerShell 编码禁令** — 禁止用 PowerShell here-string/管道传递含中文路径或中文内容的 Python/Node 源码；必须使用脚本文件、UTF-8 文件或 ASCII/Unicode escape 路径，并设置 UTF-8 输出环境
9. **生产部署不得跳过主流程** — 部署前必须完整读取 `docs/docker使用经验/部署流程.md`；禁止从 README、日志、问题记录或旧架构文档复制生产命令
10. **生产分线下/线上** — 线下本机必须 `scripts/deploy/deploy_prod.ps1`；线上改 `/root/woeau_web/ai-selection-deploy/.env` 后 `docker compose up -d`。命令只从 `docs/docker使用经验/部署流程.md` 抄，禁止混用
11. **验证优先复用缓存** — Agent/模型测试先跑最小范围静态检查和单测；确需 Docker 编译时只做一次正常缓存构建，禁止为“更干净”清 Maven/npm/pip 热缓存

## 快速命令

```bash
# 生产发布（必须先读 docs/docker使用经验/部署流程.md）
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java

# 查看服务状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f java-backend
docker compose -f docker-compose.prod.yml logs -f backend
```

## 环境变量

所有环境变量见 [config/](config/)，敏感信息勿提交 Git（`config/secrets/*.env` 已被 .gitignore 屏蔽）。
