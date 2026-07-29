# AI 选品

一个直接复用选品框架（`UniversalList` + `UniversalCard`）的壳页面：

- AI Agent 通过接口投递 ASIN，前端每 3 秒自动拉取并展示成商品卡片。
- 也可在页面点“导入 ASIN”手动粘贴查询。
- 暂不自动遍历市场表筛选，`auto-screen` 仅为占位接口。

页面路由：`/ai-selection` ｜ API 前缀：`/api/v1/ai-selection`

## 代码位置

| 内容 | 路径 |
|------|------|
| 前端页面 | `frontend/src/modules/ai-selection/index.vue` |
| 前端 API | `frontend/src/api/ai-selection.ts` |
| 复用框架 | `frontend/src/components/UniversalList/`、`UniversalCard/` |
| FastAPI 路由 | `backend/app/api/v1/ai_selection.py` |
| 服务实现 | `backend/app/services/ai_selection_service.py` |
| 请求/响应模型 | `backend/app/schemas/ai_selection.py` |
| ASIN 索引迁移 | `java-backend/sql/add_ai_selection_asin_index.sql` |

## 鉴权

所有接口需携带 Java 后端签发的 Bearer access token：`Authorization: Bearer <access-token>`

- `GET /session`、`POST /lookup`：任意登录用户。
- `POST /push`、`DELETE /session`、`POST /auto-screen`：管理员或开发角色。
- 会话按用户 ID 隔离，互不可见。生产 Nginx 移除外部 `X-User-*` 头，直连 Python 必须验签 JWT。

## API

### 投递 ASIN（AI Agent 用）

```http
POST /api/v1/ai-selection/push
Authorization: Bearer <access-token>
Content-Type: application/json

{ "asins": ["B00CH1RBSY", "B0GT4SCSDL"], "marketplace": "UK", "message": "UK 挂牌候选" }
```

约束：单次 ≤200 个；自动 trim/大写/去重；ASIN 须为 10 位大写字母或数字；`marketplace` 可选（US/UK/DE）；非法值进 `invalidAsins`，全非法返回 422。

### 拉取会话（前端轮询）

```http
GET /api/v1/ai-selection/session?afterBatchId=<id>&limit=10
```

最多保留最近 50 批，Redis TTL 24 小时。

### 清空会话

```http
DELETE /api/v1/ai-selection/session
```

### 一次性查询（不入会话）

```http
POST /api/v1/ai-selection/lookup
{ "asins": ["B00CH1RBSY"], "marketplace": "UK" }
```

### 自动筛选占位

```http
POST /api/v1/ai-selection/auto-screen
{ "enabled": false, "method_cards": ["M01", "M03"] }
```

当前只返回“尚未实现”的结构化响应。

## 数据口径

- 两源表均用 `(asin, marketplace)` 索引。
- `shop_products` 按 `created_at DESC, id DESC` 取最新；`competitor_products_clean` 优先 `is_current=1` 再按时间取最新。
- 两源重叠时按 `created_at` 取最新，同时间优先 clean 表。
- 返回 camelCase 字段，直接兼容 `UniversalCard`（`imageUrl`、`sellerName`、`mainCategoryName`、`availableDate`、`productUrl` 等）。
