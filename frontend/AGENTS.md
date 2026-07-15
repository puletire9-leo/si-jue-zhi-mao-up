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
| product-line.ts | `/api/v1/product-line/` | 混合：Java 与 Selection Agent 共存，必须结合代理规则判断 |

统一选品框架的“下载全部 CSV”会按当前筛选遍历所有分页，再通过 `competitor.ts` 调用 `/api/v1/competitor/export-current-page`；后端按查询计划回查 `competitor_products_clean` / `competitor_products` / `deng_zong_shop` / `shop_products`，不要从前端展示字段自行拼 CSV。

布局内容区使用 `KeepAlive` 按路由缓存页面实例；新品榜、店铺选品等列表页切换后不得在 `onActivated` 中自动重查，用户显式搜索、筛选、刷新时才更新。

`filter_mode`（MODE1/MODE2/FAIL）、`filter_reasons`、`grade` 与 `sales_tier` 属于旧分级体系：统一选品页不再作为筛选条件，也不在卡片或详情中展示；M01/M02/M03 方法卡不受影响。

人工选品库页面位于 `src/modules/developer-selection-library/`，API 位于 `src/api/developerSelectionLibrary.ts`。新品榜和店铺选品可把当前页已选商品加入好品库或差品库；普通开发只看自己的数据，管理员可按开发筛选，卡片必须显示开发姓名标签。周期、多周及价格/销量/上架/BSR/重量/配送等筛选必须复用 `FilterDrawer + RangeFilterPanel`；“下载全部 CSV”按当前全部筛选遍历分页导出完整记录字段。好品/差品批次彼此独立且归属开发人员；一个商品只能属于一个批次或未分类，转换好/差品时必须清空原批次。页面必须复用统一选品的选择模式（默认关闭、点击卡片多选、全选当前页）和卡片大小控制，批次标签支持“全部/未加入分类/具体批次”筛选，CSV 必须包含 `batchId` 与 `batchName`。
管理员进入人工选品库时默认选择“刘淼”，从新品榜/店铺选品加入好品或差品时也默认真实归属刘淼账号；不得只改显示标签而仍写入系统管理员账号。

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

## Agent 修改规则

1. 新增页面放 `views/` 下，在 `router/index.ts` 注册路由
2. 新增 API 放 `api/` 下，使用 `utils/request.ts` 的 axios 实例
3. 新增组件放 `components/` 下，PascalCase 命名
4. 新增类型放 `types/` 下，禁止使用 `any`
5. 样式用 SCSS，变量在 `styles/variables.scss`
6. 注意：开发态真实请求去向优先看 `vite.config.js`；混合模块（如 `selection.ts`、`systemConfig.ts`、`product-line.ts`）必须结合代理规则判断
