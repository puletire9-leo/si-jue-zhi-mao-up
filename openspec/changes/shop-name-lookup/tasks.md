## 1. 后端 - 新增同步服务

- [x] 1.1 创建 `DengZongShopService` 类，注入 `SellerspriteConfig`、`SellerspriteConfigService`、`DengZongShopMapper`、`ApiRateLimitService`
- [x] 1.2 实现 `syncBySellerName(sellerName, marketplace)` 方法：构建请求体（sellerName + marketplace + asins=[]），调用卖家精灵 API，分页遍历所有页面
- [x] 1.3 实现数据映射逻辑：将 API 返回的 JSON 映射为 `DengZongShop` Entity（复用 test_shop_lookup.py 的字段映射）
- [x] 1.4 实现批量插入：使用 `INSERT IGNORE` 或逐条插入处理唯一约束冲突
- [x] 1.5 返回同步结果（total 条数、inserted 条数、error 信息）

## 2. 后端 - 新增同步端点

- [x] 2.1 在 `DengZongShopController` 中新增 `POST /api/v1/deng-zong-shop/sync` 端点
- [x] 2.2 参数校验：sellerName 和 marketplace 不能为空
- [x] 2.3 调用 `DengZongShopService.syncBySellerName()` 并返回结果

## 3. 前端 - API 接口

- [x] 3.1 在 `competitor.ts` 中新增 `syncDengZongShop(data: { sellerName: string; marketplace: string })` 方法

## 4. 前端 - 卖家管理弹窗增加同步按钮

- [x] 4.1 在卖家表格操作列增加"同步数据"按钮
- [x] 4.2 实现同步逻辑：调用 API，显示加载状态，完成后显示成功条数
- [x] 4.3 同步完成后自动刷新产品列表

## 5. 验证

- [x] 5.1 重启 java-product 容器，测试 `POST /api/v1/deng-zong-shop/sync` 端点
- [x] 5.2 前端点击同步按钮，验证数据写入 deng_zong_shop 表
