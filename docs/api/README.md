# API 路由分流说明

> 本文描述当前仓库的代码事实，不描述理想目标架构。
>
> 开发环境下，真实请求去向优先由 `frontend/vite.config.js` 决定；生产环境或显式开启 `VITE_USE_GATEWAY=true` 时，再由 Gateway 和部署配置接管转发。

## 事实源优先级

1. `frontend/vite.config.js`
2. `frontend/src/api/*.ts`
3. Java Controller / Python Router / Selection Agent 实现
4. 本文档与其他说明文档

如果文档和代码不一致，以代码实现为准，并同步回写文档。

## 当前开发态真实分流

当前默认前提：

- 开发环境
- `VITE_USE_GATEWAY=false`
- 前端请求通过 Vite 代理转发

| 路径前缀 | 开发态目标 | 当前拥有者 | 说明 |
|----------|------------|------------|------|
| `/api/v1/auth/**` | Java User `:8001` | Java 用户服务 | 登录、刷新、当前用户 |
| `/api/v1/users/**` | Java User `:8001` | Java 用户服务 | 用户管理、密码、角色 |
| `/api/v1/asin-import/**` | Java Product `:8002` | Java 产品服务 | ASIN 导入 |
| `/api/v1/competitor/**` | Java Product `:8002` | Java 产品服务 | 竞品查询 |
| `/api/v1/product-performance/**` | Java Product `:8002` | Java 产品服务 | 真实战绩 |
| `/api/v1/category-baseline/**` | Java Product `:8002` | Java 产品服务 | 销量基线 |
| `/api/v1/element-discovery/**` | Java Product `:8002` | Java 产品服务 | ④线元素发现预览 |
| `/api/v1/seller/**` | Java Product `:8002` | Java 产品服务 | 卖家画像、跟品信号、热度矩阵 |
| `/api/v1/scoring/**` | Java Product `:8002` | Java 产品服务 | 评分配置与重算 |
| `/api/v1/filter-config/**` | Java Product `:8002` | Java 产品服务 | 精筛、初筛配置 |
| `/api/v1/filter-presets/**` | Java Product `:8002` | Java 产品服务 | 筛选预设 |
| `/api/v1/sellersprite-config/**` | Java Product `:8002` | Java 产品服务 | 卖家精灵配置 |
| `/api/v1/click-logs/**` | Java Product `:8002` | Java 产品服务 | 点击日志 |
| `/api/v1/deng-zong-shop/**` | Java Product `:8002` | Java 产品服务 | 郑总店铺 |
| `/api/v1/modules/**` | Java Product `:8002` | Java 产品服务 | 当前主要为 `shop-rating` |
| `/api/v1/product-line/aggregated-data` | Java Product `:8002` | Java 产品服务 | 品线聚合数据 |
| `/api/v1/product-line/guidance` | Java Product `:8002` | Java 产品服务 | 品线指导结果 |
| `/api/v1/product-line/tree` | Java Product `:8002` | Java 产品服务 | 品线树 |
| `/api/v1/product-line/**` 其他路径 | Selection Agent `:8011` | Selection Agent | `model`、`elements`、`batches` 等 |
| `/selection-api/**` | Selection Agent `:8011` | Selection Agent | SSE/Agent 服务 |
| `^/api` 兜底 | Python Backend `:8090` | Python FastAPI | 所有未命中特例代理的 `/api` 请求 |

## 维护时的判断方式

### 看一个前端接口到底属于谁

1. 先看 `frontend/src/api/*.ts` 的请求路径。
2. 再看 `frontend/vite.config.js` 是否有精确代理规则。
3. 如果没有命中特例，再落到 Python `^/api` 兜底。
4. 最后回到对应后端实现确认路由是否真实存在。

### 当前最容易误判的混合模块

| 前端文件 | 当前情况 | 备注 |
|----------|----------|------|
| `selection.ts` | 以 Python `/selection/*` 为主 | 同文件里的 `/scoring/*` 走 Java |
| `systemConfig.ts` | 以 Python `/system-config/*` 为主 | `sellersprite-config` 走 Java |
| `product-line.ts` | Java 与 Selection Agent 混合 | `aggregated-data/guidance/tree` 走 Java，其余由 Vite 精确匹配到 Agent |

## 已知风险

以下问题已经在代码里出现，维护时不要把它们当作“已规范完成”的状态：

- 文档中的旧路由表不能单独作为事实源，必须与 `frontend/vite.config.js` 一起看。
- 部分前端接口当前存在“前端已封装，但后端未实现”或“命名不一致”的情况。
- `product-line` 相关接口同时穿过 Java 和 Selection Agent，是当前最需要谨慎确认的区域。

完整问题清单、按前端 API 文件的拥有者划分、以及已确认的不对齐接口，见 [当前前后端映射与规范治理草案.md](./当前前后端映射与规范治理草案.md)。

## 文档更新规则

出现以下任一变更时，必须同步更新本文：

1. `frontend/vite.config.js` 新增、删除或修改代理规则。
2. 某个 `frontend/src/api/*.ts` 从 Python 切到 Java，或从 Java 切到 Selection Agent。
3. 后端新增了需要靠精确代理命中的特例路径。
4. 迁移期接口结束兼容，旧路径被删除。
