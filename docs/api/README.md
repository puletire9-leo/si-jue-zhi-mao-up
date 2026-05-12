# API 路由分流表

> 前端 Nginx 根据路径前缀将请求分发到 Java 后端或 Python 后端。

## 路由规则

### Java 后端（Spring Boot :8080）— 核心业务

| 路径前缀 | Controller | 功能 |
|----------|-----------|------|
| `/api/auth/**` | AuthController | 登录/登出/刷新Token/当前用户 |
| `/api/products/**` | ProductController | 产品 CRUD/批量操作/统计/导入导出 |
| `/api/selections/**` | SelectionController | 选品 CRUD/批量操作/统计 |
| `/api/final-drafts/**` | FinalDraftController | 定稿 CRUD/批量操作/下载ZIP |
| `/api/materials/**` | MaterialLibraryController | 素材库 CRUD/批量操作 |
| `/api/carriers/**` | CarrierLibraryController | 运营商库 CRUD/批量操作 |
| `/api/categories/**` | CategoryController | 分类 CRUD |
| `/api/tags/**` | TagController | 标签 CRUD/批量操作 |
| `/api/users/**` | UserController | 用户 CRUD/密码/角色 |
| `/api/image-proxy/**` | ImageProxyController | COS 图片代理/缩略图 |
| `/health` | HealthController | 健康检查 |
| `/actuator/**` | Spring Actuator | Prometheus 指标/健康/信息 |
| `/swagger-ui/**` | SpringDoc | Java API 文档 |

### Python 后端（FastAPI :8000）— AI 功能

| 路径前缀 | 路由模块 | 功能 |
|----------|---------|------|
| `/api/v1/images/**` | images.py | 图片管理/以图搜图/相似图片搜索 |
| `/api/v1/scoring/**` | scoring.py | 评分配置/重算/等级统计 |
| `/api/v1/import/**` | import_.py | 产品导入/图片导入/模板下载 |
| `/api/v1/export/**` | export.py | 产品导出/图片导出/统计导出 |
| `/api/v1/reports/**` | reports.py | 报告生成/查看 |
| `/api/v1/statistics/**` | statistics.py | 仪表板/趋势/存储统计 |
| `/api/v1/system-config/**` | system_config.py | 系统配置/备份管理 |
| `/api/v1/logs/**` | logs.py | 系统文档/更新记录/需求管理 |
| `/api/v1/download-tasks/**` | download_tasks.py | 下载任务管理 |
| `/api/v1/lingxing/**` | lingxing.py | 领星导入 |
| `/api/v1/product-data/**` | product_data.py | 产品数据看板 |
| `/api/v1/file-links/**` | file_links.py | 文件链接管理 |
| `/api/v1/material-library/**` | material_library.py | 素材库（含 AI 分析） |
| `/api/v1/carrier-library/**` | carrier_library.py | 运营商库 |
| `/api/v1/selection/**` | selection.py | 选品管理 |
| `/api/v1/product-recycle/**` | product_recycle.py | 产品回收站 |
| `/api/v1/recycle-bin/**` | recycle_bin.py | 通用回收站 |
| `/api/v1/health` | health.py | Python 健康检查 |
| `/api/products/**` | product_sales.py | 产品销量（独立路由） |
| `/docs` | FastAPI | Python API 文档 |

## 注意事项

1. **路径冲突**：`/api/products/` 同时被 Java 和 Python 使用。Nginx 按配置顺序匹配，当前 Python 的 `/api/products/`（产品销量）在 Java 之后，需确保不冲突。
2. **迁移中的模块**：素材库、运营商库、选品管理目前 Python 和 Java 都有路由，正在从 Python 逐步迁移到 Java。迁移完成后移除 Python 侧路由。
3. **认证**：Java 后端使用 Spring Security + JWT，Python 后端使用自定义中间件。两端 JWT Secret 需保持一致。
