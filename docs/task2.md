Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 前端选品视图切换到 competitor_products 新数据源

 Context

 前端选品页面（AllSelection / 新品榜 / 竞品店铺 / 郑总店铺）当前调用 Python 后端 API（/api/v1/selection/*），读取旧      
 selection_products 表。但新数据已通过卖家精灵 API 写入 Java 后端的 competitor_products 表（56 个 API 字段 + 7
 个衍生字段）。

 需要让前端直接调用 Java 后端读取
 competitor_products，同时前端组件对字段名差异具备容错能力——只取需要的字段展示，不因字段不存在而报错。

 变更清单

 1. Java: CompetitorQueryRequest 增加查询参数

 文件: java-backend/sjzm-product/src/main/java/com/sjzm/product/dto/CompetitorQueryRequest.java

 新增字段：
 - source — 数据来源筛选（新品榜/竞品店铺/郑总店铺）
 - filterMode — 筛选模式筛选（MODE1/MODE2/FAIL）
 - title — 标题模糊搜索
 - sortBy — 排序字段（price/units/bsr/listingDays/createdAt）
 - sortOrder — 排序方向（asc/desc）

 2. Java: CompetitorProductResponse 补全衍生字段

 文件: java-backend/sjzm-product/src/main/java/com/sjzm/product/dto/CompetitorProductResponse.java

 新增 7 个衍生字段（来自 CompetitorProduct 的筛选衍生列）：
 - filterMode, filterReasons, listingDays, weightG
 - productUrl, similarUrl, source

 3. Java: CompetitorService 增强查询能力

 文件: java-backend/sjzm-product/src/main/java/com/sjzm/product/service/CompetitorService.java

 - queryFromDb() 支持 source / filterMode / title 筛选
 - queryFromDb() 支持动态排序（sortBy + sortOrder）
 - toResponse() 映射所有衍生字段到响应 DTO

 4. Java: CompetitorController 加 GET 端点

 文件: java-backend/sjzm-product/src/main/java/com/sjzm/product/controller/CompetitorController.java

 新增 GET /api/v1/competitor/products 端点，参数通过 query string 传递，方便前端调用（保留原有 POST 端点不变）。

 5. 前端: 新建 competitor API 模块

 文件: frontend/src/api/competitor.ts（新建）

 - getList(params) → GET /api/v1/competitor/products
 - 在 API 层做字段名归一化映射，让组件收到的数据同时包含新旧字段名

 字段映射（归一化：同时提供新旧两套字段名）：

 ┌────────────────┬──────────────────────────────┐
 │ 新字段（Java） │     归一化后（组件可用）     │
 ├────────────────┼──────────────────────────────┤
 │ title          │ productTitle + title         │
 ├────────────────┼──────────────────────────────┤
 │ sellerName     │ storeName + sellerName       │
 ├────────────────┼──────────────────────────────┤
 │ units          │ salesVolume + units          │
 ├────────────────┼──────────────────────────────┤
 │ productUrl     │ productLink + productUrl     │
 ├────────────────┼──────────────────────────────┤
 │ similarUrl     │ similarProducts + similarUrl │
 ├────────────────┼──────────────────────────────┤
 │ filterMode     │ filterMode + dataFilterMode  │
 ├────────────────┼──────────────────────────────┤
 │ source         │ source（产品来源）           │
 └────────────────┴──────────────────────────────┘

 6. 前端: AllSelection 切换到 Java API

 文件: frontend/src/views/AllSelection/index.vue

 - loadProducts() 改为调用 competitorApi.getList() 替代原来的
 selectionApi.getNewProductsList/getReferenceProductsList/getAllSelectionList
 - 根据 activeTab 设置 source 筛选参数：
   - new → source=新品榜
   - reference → source=竞品店铺
   - zheng → source=郑总店铺
   - all → 不传 source
 - pagination.total 从 Java 返回的分页信息提取
 - 删除/添加/导入等写操作暂时保留调用 Python 后端（这些功能后续迁移）

 7. 前端: UniversalCard 容错增强

 文件: frontend/src/components/UniversalCard/index.vue

 - titleText → product.productTitle || product.title || ''
 - storeName → product.storeName || product.sellerName || ''
 - salesVolume → product.salesVolume || product.units || 0
 - productLink → product.productLink || product.productUrl || ''
 - similarProductsLink → product.similarProducts || product.similarUrl || ''
 - 所有字段取值使用可选链或 || 兜底，不会因字段缺失报错

 8. 前端: ProductDetailDialog 容错增强

 文件: frontend/src/components/ProductDetailDialog/index.vue

 - 同样按新旧字段名兼容取值
 - 新增展示 Java 独有的关键字段：BSR、品牌、配送方式、重量、筛选模式等

 前端展示字段总览（从 competitor_products 取）

 ┌──────────┬─────────────┬─────────────────────┐
 │ 卡片位置 │  使用字段   │      数据来源       │
 ├──────────┼─────────────┼─────────────────────┤
 │ 标题     │ title       │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ ASIN     │ asin        │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 价格     │ price       │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 销量     │ units       │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ BSR      │ bsr         │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 店铺名   │ sellerName  │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 图片     │ imageUrl    │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 上架天数 │ listingDays │ 衍生字段            │
 ├──────────┼─────────────┼─────────────────────┤
 │ 配送方式 │ fulfillment │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 品牌     │ brand       │ competitor_products │
 ├──────────┼─────────────┼─────────────────────┤
 │ 筛选模式 │ filterMode  │ 衍生字段            │
 ├──────────┼─────────────┼─────────────────────┤
 │ 产品链接 │ productUrl  │ 衍生字段            │
 ├──────────┼─────────────┼─────────────────────┤
 │ 相似链接 │ similarUrl  │ 衍生字段            │
 ├──────────┼─────────────┼─────────────────────┤
 │ 来源     │ source      │ 衍生字段            │
 └──────────┴─────────────┴─────────────────────┘

 文件变更汇总

 ┌───────────────────────────────────────────────────────┬─────────────────────────────┐
 │                         文件                          │          变更类型           │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ java-backend/.../dto/CompetitorQueryRequest.java      │ 修改：加筛选/排序字段       │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ java-backend/.../dto/CompetitorProductResponse.java   │ 修改：加衍生字段            │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ java-backend/.../service/CompetitorService.java       │ 修改：增强查询 + toResponse │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ java-backend/.../controller/CompetitorController.java │ 修改：加 GET 端点           │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ frontend/src/api/competitor.ts                        │ 新建                        │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ frontend/src/views/AllSelection/index.vue             │ 修改：切换数据源            │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ frontend/src/components/UniversalCard/index.vue       │ 修改：字段兼容              │
 ├───────────────────────────────────────────────────────┼─────────────────────────────┤
 │ frontend/src/components/ProductDetailDialog/index.vue │ 修改：字段兼容 + 新字段展示 │
 └───────────────────────────────────────────────────────┴─────────────────────────────┘

 验证

 1. 启动 Docker 开发环境 → 访问 http://localhost:8179/all-selection
 2. 新品榜/竞品店铺/郑总店铺/全部选品四个 tab 切换正常，不报错
 3. 如果 competitor_products 表为空，页面显示"暂无选品数据"而不报错
 4. 通过 ASIN 导入触发一次 API 调用后 → 数据出现在选品页面
 5. 产品卡片正常显示：图片、标题、价格、销量、BSR、店铺、筛选模式
 6. 点击卡片 → 详情弹窗正常展示所有字段