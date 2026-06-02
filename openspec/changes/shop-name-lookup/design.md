## Context

当前系统通过 `CompetitorController.lookup` 端点调用卖家精灵 API，该端点要求 `asins` 非空（`@NotEmpty`）。用户有一个独立脚本 `test_shop_lookup.py` 可以按店铺名查询 API 并存入 `deng_zong_shop` 表，但这不是系统功能。

现有架构：
- `SellerspriteApiService` 封装了卖家精灵 API 调用（带熔断、限流、日志）
- `CompetitorLookupRequest` 已有 `sellerName` 字段
- `DengZongShop` Entity + `DengZongShopMapper` 已存在
- `DengZongShopSeller` 表存储卖家元数据

## Goals / Non-Goals

**Goals:**
- 新增 `POST /api/v1/deng-zong-shop/sync` 端点，按店铺名查询卖家精灵 API 并存入 `deng_zong_shop`
- 自动分页遍历所有数据
- 前端卖家管理弹窗增加"同步数据"按钮

**Non-Goals:**
- 不修改现有 `CompetitorController.lookup` 端点的行为
- 不做定时自动同步（手动触发即可）
- 不处理 US 站点（当前只有 UK/DE）

## Decisions

### 1. 新建独立端点 vs 修改现有 lookup

**选择：新建独立端点 `POST /api/v1/deng-zong-shop/sync`**

理由：
- 现有 lookup 存入 `competitor_product` 表，逻辑不同
- 避免影响已有竞品查询功能
- 职责清晰：邓总店铺数据独立管理

### 2. 分页遍历策略

**选择：后端同步遍历所有页面，前端等待完成**

理由：
- 卖家精灵 API 单页最多 100 条，一个店铺通常几百到几千条
- 同步遍历简单可靠，预计耗时几秒到十几秒
- 设置较长超时（120s）即可

### 3. 复用 SellerspriteApiService vs 新建调用

**选择：复用 `SellerspriteApiService` 的 HTTP 调用逻辑，但在 `DengZongShopService` 中组装请求**

理由：
- `SellerspriteApiService.competitorLookup` 要求 `asins` 非空，不适合直接调用
- 新建 `DengZongShopService` 直接构建 HTTP 请求，复用 `SellerspriteConfig` 和 `SellerspriteConfigService.getSecretKey()`
- 保持 `SellerspriteApiService` 不变

## Risks / Trade-offs

- [API 速率限制] → 复用现有 `ApiRateLimitService` 的限流检查
- [大数据量超时] → 设置 120s 超时，分页间隔 300ms 避免触发限流
- [重复数据] → 使用 `INSERT IGNORE` 或 `ON DUPLICATE KEY UPDATE` 处理唯一约束
