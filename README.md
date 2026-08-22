# 思觉智贸 - 跨境电商产品数据管理系统

**GitHub**: https://github.com/puletire9-leo/si-jue-zhi-mao-up

跨境电商选品 / 竞品分析 / 数据对接平台。**双后端微服务架构**：Java 微服务承担认证、竞品分析、评分、ASIN 导入、领星数据对接；Python（FastAPI）承担 AI 功能（向量 / 图像识别）及部分业务 CRUD。

> 面向开发者的模块上下文见各级 `CLAUDE.md` / `AGENTS.md`（根 → 模块）。生产部署唯一权威是 [`docs/docker使用经验/部署流程.md`](docs/docker使用经验/部署流程.md)，本文件不提供可替代的生产步骤。

---

## 技术栈

| 层 | 技术 |
|----|------|
| Java 后端 | Spring Boot 4.0.4 + MyBatis-Plus 3.5.15 + Spring Cloud Gateway |
| Python 后端 | FastAPI + Celery + Qdrant（AI 功能） |
| 前端 | Vue 3 + TypeScript + Element Plus + Vite + Pinia |
| 基础设施 | MySQL 8.0 + Redis 7 + Nacos + Docker Compose |

## 架构

```
                         前端 (Nginx, prod-frontend)
                                    │
                         网关 (Spring Cloud Gateway, prod-gateway)
                          JWT 鉴权 + RBAC + 路由
                    ┌───────────────┼────────────────┐
              Java User        Java Product         Python (FastAPI)
          认证 / 用户管理   竞品/评分/ASIN导入/领星    AI / 向量 / 图像识别
                    └───────────────┼────────────────┘
                         MySQL · Redis · Nacos · Qdrant
```

### 双后端分工

| 职责 | 后端 |
|------|------|
| 认证 + 用户管理 | Java（sjzm-user） |
| 竞品分析 + 评分 + ASIN 导入 + 领星数据对接 | Java（sjzm-product） |
| 产品/选品/定稿/素材/运营商 CRUD | Python（待迁移） |
| 图片管理 / 导入导出 / 报表 / 领星导入(Excel/COS) / AI 分析 | Python（保留） |

---

## 部署

生产代码构建进镜像。禁止使用历史的宿主 Maven + `docker restart`、`docker cp` 热替换或 `up -d --build` 作为正式发布流程。

### 生产环境

```powershell
# 先完整阅读 docs/docker使用经验/部署流程.md，再按受影响组件执行
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
```

服务端口（宿主机 → 容器）：

| 服务 | 容器名 | 端口 |
|------|--------|------|
| 前端 | prod-frontend | 5173 → 80 |
| 网关 | prod-gateway | 9003 → 9000 |
| Java User | prod-java-user | 8014 → 8001 |
| Java Product | prod-java-product | 8025 → 8002 |
| Python | prod-backend | 7093 → 8090 |
| MySQL | prod-mysql | 3310 → 3306 |
| Redis | prod-redis | 6383 → 6379 |
| Nacos | prod-nacos | 8852 → 8848 |

### 构建与更新

统一脚本根据 `-Component java|frontend|backend|ai-center` 完成预检、双版本轮换、单次缓存构建、无隐式构建重建、验证和旧缓存收尾。具体命令与回滚方法只在主部署流程维护。

---

## ⚠️ 运维铁律

- **禁止跳过主部署流程**，生产发布只走 `scripts/deploy/deploy_prod.ps1`。
- **禁止 `-p sijuelishi-prod`、`up -d --build`、生产 `--no-cache` 和无条件全量 prune**。
- **模型/Agent 验证先跑最小范围测试并复用缓存**；同一组件一次任务最多进行一次生产镜像构建。
- **成品常态只留 `current + previous`**；Java 历史源码编译缓存只留最新两条，Maven/npm/pip 热依赖缓存不得随意清除。
- 配置走环境变量（`config/secrets/*.env`），禁止硬编码；`.env` 不提交 Git。

## 常用命令

```bash
docker compose -f docker-compose.prod.yml ps        # 服务状态
docker compose -f docker-compose.prod.yml logs -f   # 查看日志
docker restart <容器名>                              # 重启单个服务
```

---

## 模块文档入口

| 模块 | 文档 |
|------|------|
| 总览 | [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) |
| Java 后端 | [java-backend/CLAUDE.md](java-backend/CLAUDE.md) |
| Python 后端 | [backend/CLAUDE.md](backend/CLAUDE.md) |
| 前端 | [frontend/CLAUDE.md](frontend/CLAUDE.md) |
| 领星数据对接 | [modules/lingxing/README.md](java-backend/sjzm-product/src/main/java/com/sjzm/product/modules/lingxing/README.md) |

---

MIT License
