# 思觉智贸 - Claude 自动加载上下文

> 每次会话自动加载。详情见 [AGENTS.md](AGENTS.md)。

## 技术栈

| 层 | 技术 |
|----|------|
| Java 后端 | Spring Boot 4.0.4 + MyBatis-Plus 3.5.15 + Spring Cloud Gateway |
| Python 后端 | FastAPI + Celery + Qdrant（AI 功能） |
| 前端 | Vue 3 + TypeScript + Element Plus + Vite |
| 基础设施 | MySQL 8.0 + Redis 7 + Nacos + RocketMQ + Docker Compose |

## 双后端分工

| 职责 | 后端 | 状态 |
|------|------|------|
| 认证 + 用户管理 | Java（sjzm-user） | ✅ |
| 竞品分析 + 评分引擎 + ASIN 导入 + 筛选预设 + 领星对接 | Java（sjzm-product） | ✅ |
| 店铺画像 / 店铺基线 / 商品族证据 / 方法卡命中缓存（analysis-baseline 层） | Java（sjzm-product） | ✅ 骨架已落，自动聚类/M06 待补 |
| 产品 / 选品 / 定稿 / 素材库 / 运营商库 / 文件链接 / 标签 / 回收站 / 报告 / 统计 / 公告 | Python | 保留 |
| 图片管理 / 导入导出 / 领星 Excel/COS 导入 | Python | 保留 |

> 已核实（2026-07）：Python 后端 23 个路由文件仍在跑上述 CRUD，Java 后端无任何 carrier/material/selection/final-draft/recycle/file-links/tags/report Controller。两条线不重复。

## 铁律

1. **代码仓库是唯一事实来源** — 不信任脱离代码的口头描述
2. **分层单向** — Controller → Service → Mapper，禁止反向
3. **配置走环境变量** — 禁止硬编码，读取 `.env`
4. **Java 用 jakarta.*** — Spring Boot 4.x，禁止 javax.*
5. **API 路径** — Java: `/api/v1/{resource}/`，Python: `/api/v1/{resource}/`
6. **修改前先读对应 AGENTS.md** — 了解模块上下文后再动手
7. **响应统一用 `Result.success()` / `Result.error()`**
8. **新功能优先用模块化** — 前端放 `src/modules/`，即插即用，不改 router/sidebar

## 会话启动检查清单

```bash
git status --short              # 当前分支和未提交变更
docker compose ps               # Docker 服务状态
```
如 Docker 未运行，先启动对应环境再继续。

## 模块入口

| 模块 | CLAUDE.md | 说明 |
|------|-----------|------|
| Java 后端 | [java-backend/CLAUDE.md](java-backend/CLAUDE.md) | 微服务（gateway/user/product） |
| Python 后端 | [backend/CLAUDE.md](backend/CLAUDE.md) | AI 功能（向量/图像识别/评分） |
| 前端 | [frontend/CLAUDE.md](frontend/CLAUDE.md) | Vue 3 管理后台（35 个功能模块 / 25 个 view 目录） |
