## Why

正式观察池、店铺详情和店铺画像目前分别读取不同数据源、使用不同批次口径，并在前端一次性加载或二次筛选，导致观察池卡顿、店铺数量被截断、画像只显示少量旧店铺。系统需要把三页统一到 `shop_products` 的周批次店铺全集，并提供与新品榜一致的上层筛选能力，让用户按“通过筛选商品数”发现最值得分析的店铺。

## What Changes

- 新增统一店铺筛选工作台查询，以 `shop_products.batch_code` ISO 周批次为唯一批次口径，按商品筛选后聚合店铺。
- 支持周批次多选、店铺名称批量精准/模糊搜索、价格、销量、上架天数、BSR、重量、变体、配送和类目等商品条件。
- 支持按店铺商品数、通过筛选商品数、M01 命中数、平均上架天数、新品数进行服务端筛选、排序和分页。
- 正式观察池改为服务端分页，不再一次返回和渲染全部记录，并复用统一店铺筛选指标。
- 店铺详情列表移除固定 `limit=100` 和 JVM 后置筛选，展示所有已成功/部分成功抓取的店铺。
- 店铺画像列表切换到 `shop_products` 周批次数据源；旧 `deng_zong_shop` 日期批次列表不再作为店铺画像主列表。
- 三个页面复用同一筛选状态、周批次选项和字段含义，并显示“通过筛选商品数”。

## Capabilities

### New Capabilities

- `shop-screening-workbench`: 定义跨观察池、店铺详情和店铺画像的统一周批次店铺筛选、聚合、排序、分页和性能要求。

### Modified Capabilities

无。

## Impact

- 前端：`shop-collection-watchlist`、`shop-collection-shops`、`shop-profile`、`shopCollection.ts` 及统一筛选组件。
- Java：`ShopCollectionController`、`ShopCollectionService`、店铺画像 Mapper/DTO、观察池查询服务。
- 数据库：为 `shop_products` 和 `shop_watchlist` 补充周批次/筛选/分页所需组合索引；不迁移或删除历史数据。
- API：新增统一店铺筛选分页接口和周批次接口；旧接口短期保留兼容。
