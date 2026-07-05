# 思觉智贸 - 跨境电商产品数据管理系统

**GitHub**: https://github.com/puletire9-leo/si-jue-zhi-mao-up

跨境电商选品 / 竞品分析 / 数据对接平台。**双后端微服务架构**：Java 微服务承担认证、竞品分析、评分、ASIN 导入、领星数据对接；Python（FastAPI）承担 AI 功能（向量 / 图像识别）及部分业务 CRUD。

> 面向开发者的模块上下文见各级 `CLAUDE.md` / `AGENTS.md`（根 → 模块）。本文件只做总览与部署入口。

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

Java 后端与前端采用 **volume 挂载**（宿主机构建产物挂进容器），构建必须在宿主机完成。

### 生产环境

```bash
docker compose -f docker-compose.prod.yml up -d
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

### 开发环境

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 构建与更新（宿主机执行）

```powershell
# Java（Docker Maven 构建，勿用 mvn clean——会删 app.jar）
cd java-backend
docker run --rm -v "${PWD}:/app" -v "$env:TEMP\m2:/root/.m2" -w /app `
  maven:3.9-eclipse-temurin-21 mvn package -DskipTests -T 4 -pl sjzm-product -am
Copy-Item sjzm-product/target/sjzm-product-1.0.0-SNAPSHOT.jar sjzm-product/target/app.jar -Force
docker restart prod-java-product

# 前端（宿主机构建，Docker 内 OOM；产物到 static/vue-dist/）
cd frontend
$env:NODE_OPTIONS="--max-old-space-size=2048"
npx vite build --mode production --minify false
docker restart prod-frontend

# Python（小改动直接 cp）
docker cp backend/app/. prod-backend:/app/app/
docker restart prod-backend
```

---

## ⚠️ 运维铁律

- **禁止 `docker compose down`**（会销毁容器 + 数据卷）。生产只用 `restart` / `start` / `stop`。
- **Java 构建禁止 `mvn clean`**（会删除挂载的 `app.jar` 导致容器起不来），只用 `package` / `install`。
- **前端构建禁止在 Docker 内执行**（内存不足 OOM），在宿主机 `npm run build`（OOM 时加 `--minify false`）。
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
