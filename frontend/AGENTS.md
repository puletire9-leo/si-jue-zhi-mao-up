# 前端 - Agent 开发索引

> Vue 3 + TypeScript + Element Plus + Vite + Pinia
> 跨境电商产品数据管理后台

## 目录结构

```
frontend/src/
├── api/              # API 接口定义（20个文件）
├── components/       # 通用组件（8个）
├── composables/      # 组合式函数
├── layouts/          # 布局组件
├── router/           # Vue Router 路由
├── stores/           # Pinia 状态管理（5个）
├── styles/           # 全局样式（SCSS）
├── types/            # TypeScript 类型定义（11个）
├── utils/            # 工具函数（11个）
└── views/            # 页面视图（27个）
```

## 页面视图

> 页面实际请求去向不要只看页面名判断，先看对应 `src/api/*.ts`，再看 `vite.config.js` 代理规则。

| 页面 | 路径 | API 文件 |
|------|------|---------|
| 登录 | /login | user.ts |
| 首页 | / | - |
| 仪表盘 | /dashboard | - |
| 产品管理 | /products | product.ts |
| 选品管理 | /selection | selection.ts |
| 全部选品 | /all-selection | selection.ts |
| 新品 | /new-products | product.ts |
| 参考产品 | /reference-products | product.ts |
| 定稿 | /final-drafts | finalDrafts.ts |
| 素材库 | /material-library | materialLibrary.ts |
| 运营商库 | /carrier-library | carrierLibrary.ts |
| 拓品·竞品店铺 | /expansion-competitor-shops | shopCollection.ts |
| 图片管理 | /image-management | image.ts |
| 导入导出 | /import-export | import_export.ts |
| 产品数据看板 | /product-data-dashboard | productData.ts |
| 统计 | /statistics | statistics.ts |
| 报表 | /report-viewer | report.ts |
| 领星导入 | /lingxing | lingxing.ts |
| 文件链接 | /file-links | fileLink.ts |
| 下载管理 | /download-manager | downloadTask.ts |
| 用户管理 | /user-management | user.ts |
| 设置 | /settings | systemConfig.ts |
| AI 选品 | /ai-selection | ai-selection.ts |
| 产品回收站 | /product-recycle | product.ts |
| 选品回收站 | /selection-recycle | selection.ts |
| 定稿回收站 | /final-draft-recycle | finalDrafts.ts |
| 运营商回收站 | /carrier-recycle | carrierLibrary.ts |

## API 文件 → 后端映射

| API 文件 | 主要调用路径 | 后端 |
|----------|------------|------|
| product.ts | `/api/v1/products/`、`/api/v1/product-recycle/` | Python（开发态走 `^/api` 兜底） |
| selection.ts | `/api/v1/selection/`、`/api/v1/scoring/` | 混合：Python 为主，`scoring` 走 Java |
| finalDrafts.ts | `/api/v1/final-drafts/` | Python（迁移中） |
| materialLibrary.ts | `/api/v1/material-library/` | Python |
| carrierLibrary.ts | `/api/v1/carrier-library/` | Python |
| image.ts | `/api/v1/images/` | Python |
| statistics.ts | `/api/v1/statistics/` | Python |
| fileLink.ts | `/api/v1/file-links/` | Python |
| user.ts | `/api/v1/auth/`、`/api/v1/users/` | Java |
| category.ts | `/api/v1/categories/` | Python |
| tag.ts | `/api/v1/tags/` | Python |
| systemConfig.ts | `/api/v1/system-config/`、`/api/v1/sellersprite-config` | 混合：Python 为主，`sellersprite-config` 走 Java |
| ai-selection.ts | `/api/v1/ai-selection/` | Python；JWT 鉴权，按用户隔离的 Redis 投递会话 |
| product-line.ts | `/api/v1/product-line/` | 混合：Java 与 Selection Agent 共存，必须结合代理规则判断 |

拓品·竞品店铺使用独立页面和 `/api/v1/modules/shop-collection/expansion-products`，读取 `shop_products` 当前批次商品全集；不复用 `views/AllSelection` 的页面框架。销量字段使用 `shop_products.units`（页面展示为月销量）。

统一选品框架的“下载全部 CSV”会按当前筛选遍历所有分页，再通过 `competitor.ts` 调用 `/api/v1/competitor/export-current-page`；后端按查询计划回查 `competitor_products_clean` / `competitor_products` / `deng_zong_shop` / `shop_products`，不要从前端展示字段自行拼 CSV。
统一选品页面由 `KeepAlive` 缓存；批次筛选组件在页面重新激活时必须刷新批次选项，确保卖家精灵任务完成并写入 clean 后无需整页刷新即可看到新批次。
店铺选品首屏、切站点、重置和切换方法卡时必须先把 `shop_products` 最新周批次写入 `activeFilters.range.createdWeeks`，再请求分类和商品；禁止只更新筛选抽屉 draft 后用空批次查询全部历史数据。

布局内容区使用 `KeepAlive` 按路由缓存页面实例；新品榜、店铺选品等列表页切换后不得在 `onActivated` 中自动重查，用户显式搜索、筛选、刷新时才更新。

`filter_mode`（MODE1/MODE2/FAIL）、`filter_reasons`、`grade` 与 `sales_tier` 属于旧分级体系：统一选品页不再作为筛选条件，也不在卡片或详情中展示；M01/M02/M03 方法卡不受影响。

人工选品库页面位于 `src/modules/developer-selection-library/`，API 位于 `src/api/developerSelectionLibrary.ts`。总选品管理、新品榜和店铺选品可通过选择模式把当前页已选商品加入好品库或差品库，商品详情也必须提供相同入口；普通开发只看自己的数据，管理员可按开发筛选，卡片必须显示开发姓名标签。周期、多周及价格/销量/上架/BSR/重量/配送等筛选必须复用 `FilterDrawer + RangeFilterPanel`；“下载全部 CSV”按当前全部筛选遍历分页导出完整记录字段。好品/差品批次彼此独立且归属开发人员；一个商品只能属于一个批次或未分类，转换好/差品时必须清空原批次。页面必须复用统一选品的选择模式（默认关闭、点击卡片多选、全选当前页）和卡片大小控制，批次标签支持“全部/未加入分类/具体批次”筛选，CSV 必须包含 `batchId` 与 `batchName`。
精品页面位于 `src/modules/premium-products/`，复用 `views/AllSelection` 统一选品框架，但查询计划必须固定为 `premium_products` 原始表。首次进入、重置和切换站点默认选择该站点最新入库周；不得默认应用 M01。M01/M03 只能作为用户手动叠加规则，M02 不支持；类目、卖家、变体、人工好差品库及完整字段 CSV 都必须读取精品独立数据源，禁止回退到新品榜 clean/raw 表。
精品接口只返回已补全商品，并附带 `enriched` 标识；八爪鱼原始空壳不得进入页面。灰色“待卖家精灵补全”占位只作为异常防御，不得使用红色问号图片把数据未返回误导成图片加载故障。
统一筛选框的“上架时间”排序值固定为 `listingDate`，后端必须按 `available_date` 排序；不要在前端对单页结果二次按日期排序掩盖服务端分页错误。
新品榜默认 M01 的“大类榜单”必须调用 `/api/v1/method-cards/M01/categories/query`，并使用与当前 M01 商品列表相同的站点、周批次和规则口径；分类选择必须作为字符串数组传给 M01 POST 查询，禁止使用逗号拼接，避免 `Arts, Crafts & Sewing` 一类名称被拆坏。分类请求需有请求序号，站点或筛选快速切换时旧响应不得覆盖新响应。
新品榜未显式应用方法卡时不得附加隐藏的合格规则；价格、销量、上架天数等条件只来自可见的统一筛选框。新品榜周批次数量必须跟随当前 clean/raw 数据源，不能用原始表数量标注 clean 列表。
店铺选品“大类榜单”必须调用 `/api/v1/modules/shop-collection/selection-categories/query`，参数直接来自去掉当前 category 后的 `shop_products` 查询计划；站点、M01/M03、批次和区间筛选必须与商品分页一致。店铺分类值是完整 `node_label_path`，商品筛选必须精确匹配完整路径，禁止用全量分类统计或模糊 LIKE 造成数量漂移。
店铺选品底层 `batch_date` 日批次在统一选品框架中必须聚合为 ISO 周并按周筛选，展示周起止日期；不得把日批次列表伪装成新品榜周批次。
统一选品的 `ProductDetailDialog` 是人工选品决策面板：居中宽弹窗固定展示价格、月销、月销售额、上架时间、BSR、评分/评论、变体/卖家和重量/配送8项核心信息；市场、规格、卖家、变体和数据来源用页签局部滚动。价格必须按站点显示币种，`-1` 价格哨兵值显示为 `—`，`0` 不得当成空值，文本 `null/undefined` 不得直接展示；子变体打开 Amazon 必须使用当前 ASIN。商品卡与详情共用同一币种格式化规则。
统一选品卡生成 Amazon 以图识图链接时必须先移除 Amazon CDN 的 `US200/SX` 等缩略图修饰符并对原图 URL 编码；禁止直接复用历史 `similarUrl` 让 StyleSnap 收到低分辨率图片。
管理员进入人工选品库时默认选择“刘淼”，从新品榜/店铺选品加入好品或差品时也默认真实归属刘淼账号；不得只改显示标签而仍写入系统管理员账号。

卖家精灵请求中心位于 `src/modules/sellersprite-request-center/`。任务列表支持按 `yyyy-MM` 创建月份筛选，页面默认当前月；月度请求次数必须读取后端整月汇总，禁止用当前分页的 `apiCalls` 前端相加。
卖家精灵请求中心只有 `STOPPED/SUCCESS/PARTIAL_SUCCESS/FAILED` 终态任务可删除；活跃任务必须先停止并等待 worker 退出。删除会同时移除任务、子项和该任务的月度请求次数记录，以解除来源幂等占用并允许重新创建。

八爪鱼自动采集配置页允许同功能同站点保存多条平级命名任务，不显示主/附加概念。每条任务必须可维护分类和“初筛”开关。配置表必须明显展示自动读取的最新云采集批次号、开始/结束时间、本批次数量和状态；只有 Finished 批次允许“导入DB”。导入请求必须携带页面当前显示的批次元数据，确认框明确写出批次号、时间和数量，禁止后端静默切换批次。后端同步返回可见 `QUEUED` 任务及 taskId 后，页面必须进行有上限轮询并展示 `QUEUED → RUNNING → READY/ERROR`；导入任务列表显示任务名称、分类、是否初筛、请求次数和批次；“导入DB”不得自动请求卖家精灵，只有用户点击“请求卖家精灵”并确认后才调用，确认文案需明确目标数据表。
生产 Nginx 必须对 `/index.html` 和 SPA history fallback 返回 `Cache-Control: no-store, no-cache`；带 hash 的 JS/CSS 静态资源继续使用 immutable 长缓存。发布后普通刷新必须能加载新入口，避免旧页面继续调用过期 API 参数。
Vite 自动导入的 `auto-import.d.ts` 和 `components.d.ts` 只在 development 模式生成；production 构建禁止重写声明文件，避免 Windows 文件占用导致发布构建随机失败。

非标店铺上新（`/zheng-products`，数据源 `deng_zong_shop`）必须真实支持页面暴露的 ASIN、销量、上架天数、价格、BSR、重量、变体、配送、卖家、类目、批次与排序；不得只显示筛选控件却在查询计划中标记 unsupported。

## 通用组件

| 组件 | 用途 |
|------|------|
| ImageUpload | 图片上传（支持拖拽/裁剪） |
| LazyImage | 懒加载图片（含占位符） |
| ThumbnailViewer | 缩略图查看器 |
| ProductDetailDialog | 产品详情弹窗 |
| SelectionQueryForm | 选品查询表单 |
| UniversalCard / UniversalList | 通用卡片/列表 |
| VirtualList | 虚拟滚动列表（大数据量） |

## 状态管理

| Store | 说明 |
|-------|------|
| user | 用户信息 + Token |
| app | 全局应用状态 |
| finalDraft | 定稿操作状态 |
| productData | 产品数据筛选状态 |
| systemLog | 系统日志 |

下载中心禁止使用 XHR/fetch 将完整 ZIP 转成 Blob；必须先申请短时下载会话，再用原生 `<a>` 下载，让浏览器负责流式落盘。下载按钮需有短时 loading/禁用状态，避免用户重复点击生成并发大文件请求。

## Agent 修改规则

侧边栏模块通过 `manifest.ts` 的 `menuGroup` 组织二级目录；长业务分组使用 `menuSection` 和 `menuSectionOrder` 组织三级目录。三级目录只改变菜单信息架构，不得改变模块 URL、路由名称或权限标识。
侧边栏允许多个一级目录和三级分组同时展开，禁止启用 Element Plus 菜单的 `unique-opened` 单展开限制。
店铺请求中心必须把“正常店铺请求”和“非标店铺上新”作为独立模式：正常模式读取 `shop_candidate_pool` 并写 `shop_products`；非标模式读取 `deng_zong_shop_seller`，只通过 `/api/v1/deng-zong-shop/sync/batch` 创建 `DENG_ZONG_SHOP_SYNC`，结果只写 `deng_zong_shop`。非标商品页只读展示，不得再维护第二套卖家管理弹窗。

统一选品框架中，ASIN 搜索（单条或多条）都是精准直查：只保留当前站点和业务数据源，必须移除方法卡、周批次、类目及区间筛选后再生成查询计划。禁止仅对多条 ASIN 启用精准模式，否则新品榜默认 M01 会吞掉单条 ASIN，而店铺选品表现正常，造成模块语义不一致。

1. 新增页面放 `views/` 下，在 `router/index.ts` 注册路由
2. 新增 API 放 `api/` 下，使用 `utils/request.ts` 的 axios 实例
3. 新增组件放 `components/` 下，PascalCase 命名
4. 新增类型放 `types/` 下，禁止使用 `any`
5. 样式用 SCSS，变量在 `styles/variables.scss`
6. 注意：开发态真实请求去向优先看 `vite.config.js`；混合模块（如 `selection.ts`、`systemConfig.ts`、`product-line.ts`）必须结合代理规则判断
