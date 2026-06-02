## Why

当前系统只能通过 ASIN 列表调用卖家精灵 API 查询竞品数据，无法按店铺名批量拉取产品。用户需要输入店铺名即可自动调用卖家精灵 API 查询该店铺所有产品并存入 `deng_zong_shop` 表，替代目前手动运行 `test_shop_lookup.py` 脚本的方式。

## What Changes

- 新增按店铺名查询卖家精灵 API 的后端端点，允许 `asins` 为空，只传 `sellerName` + `marketplace`
- 查询结果自动存入 `deng_zong_shop` 表（而非 `competitor_product` 表）
- 支持分页遍历（自动拉取所有页面）
- 前端在卖家管理弹窗中增加"同步数据"按钮，点击后触发查询

## Capabilities

### New Capabilities
- `shop-name-lookup`: 按店铺名调用卖家精灵 API 查询产品并存入 deng_zong_shop 表

### Modified Capabilities

## Impact

- **后端**: `DengZongShopController` 新增同步端点，`DengZongShopService` 新增调用卖家精灵 API 的逻辑
- **前端**: AllSelection 页面卖家管理弹窗增加同步按钮
- **API**: 新增 `POST /api/v1/deng-zong-shop/sync` 端点
- **依赖**: 复用现有 `SellerspriteApiService` 的 HTTP 调用能力和 `SellerspriteConfig` 配置
