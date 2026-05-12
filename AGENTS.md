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
| Java 后端 | Spring Boot + MyBatis-Plus + Undertow | 3.2.5 / Java 17 |
| Python 后端 | FastAPI + Celery + Qdrant | Python 3.11 |
| 前端 | Vue 3 + TypeScript + Element Plus + Vite | Node 20 |
| 数据库 | MySQL 8.0 + Redis 7 | - |
| 部署 | Docker Compose（dev/prod override） | - |

## 文档导航

| 文档 | 路径 | 说明 |
|------|------|------|
| 系统架构 | [docs/architecture/README.md](docs/architecture/README.md) | 双后端架构、服务拓扑、数据流 |
| API 路由分流 | [docs/api/README.md](docs/api/README.md) | Nginx 路由规则、Java/Python 职责划分 |
| 数据库设计 | [docs/database/README.md](docs/database/README.md) | 表结构、迁移记录、ER 关系 |
| 开发规范 | [docs/development/standards.md](docs/development/standards.md) | 编码规范、提交规范、分支策略 |
| 部署指南 | [DOCKER_DEPLOY.md](DOCKER_DEPLOY.md) | Docker 部署完整流程 |
| AI 能力分析 | [docs/AI能力差距综合分析报告.md](docs/AI能力差距综合分析报告.md) | 岗位差距与学习路线 |

## 模块索引

| 模块 | AGENTS.md | 说明 |
|------|-----------|------|
| Java 后端 | [java-backend/AGENTS.md](java-backend/AGENTS.md) | 核心业务（产品/选品/定稿/素材/运营商/认证） |
| Python 后端 | [backend/AGENTS.md](backend/AGENTS.md) | AI 功能（向量检索/图像识别/评分/LLM） |
| 前端 | [frontend/AGENTS.md](frontend/AGENTS.md) | Vue 3 管理后台（27 个页面） |

## 铁律（Agent 必须遵守）

1. **代码仓库是唯一事实来源** — 不信任任何脱离代码的口头描述
2. **分层依赖单向** — Controller → Service → Mapper，禁止反向调用
3. **配置走环境变量** — 禁止硬编码任何环境相关值（数据库地址、密钥、端口）
4. **Java 包名用 jakarta.*** — Spring Boot 3.x 要求，禁止 javax.*
5. **API 路径约定** — Java 后端 `/api/{resource}/`，Python 后端 `/api/v1/{resource}/`
6. **修改前先读** — 改任何模块前，先读对应 AGENTS.md 了解上下文
7. **保持文档同步** — 代码变更后同步更新相关文档

## 快速命令

```bash
# 开发环境启动
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 生产环境启动
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f java-backend
docker compose logs -f backend
```

## 环境变量

所有环境变量见 [.env.example](.env.example)，敏感信息勿提交 Git。
