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

| 页面 | 路径 | API 文件 | 后端 |
|------|------|---------|------|
| 登录 | /login | user.ts | Java |
| 首页 | / | - | - |
| 仪表盘 | /dashboard | - | - |
| 产品管理 | /products | product.ts | Java |
| 选品管理 | /selection | selection.ts | Java |
| 全部选品 | /all-selection | selection.ts | Java |
| 新品 | /new-products | product.ts | Java |
| 参考产品 | /reference-products | product.ts | Java |
| 定稿 | /final-drafts | finalDrafts.ts | Java |
| 素材库 | /material-library | materialLibrary.ts | Java |
| 运营商库 | /carrier-library | carrierLibrary.ts | Java |
| 图片管理 | /image-management | image.ts | Python |
| 导入导出 | /import-export | import_export.ts | Python |
| 产品数据看板 | /product-data-dashboard | productData.ts | Python |
| 统计 | /statistics | statistics.ts | Python |
| 报表 | /report-viewer | report.ts | Python |
| 领星导入 | /lingxing | lingxing.ts | Python |
| 文件链接 | /file-links | fileLink.ts | Python |
| 下载管理 | /download-manager | downloadTask.ts | Python |
| 用户管理 | /user-management | user.ts | Java |
| 设置 | /settings | systemConfig.ts | Python |
| 产品回收站 | /product-recycle | product.ts | Python |
| 选品回收站 | /selection-recycle | selection.ts | Python |
| 定稿回收站 | /final-draft-recycle | finalDrafts.ts | Java |
| 运营商回收站 | /carrier-recycle | carrierLibrary.ts | Python |

## API 文件 → 后端映射

| API 文件 | 主要调用路径 | 后端 |
|----------|------------|------|
| product.ts | `/api/v1/products/` | Python（迁移中→Java） |
| selection.ts | `/api/v1/selection/` | Python（迁移中→Java） |
| finalDrafts.ts | `/api/v1/final-drafts/` | Python（迁移中→Java） |
| materialLibrary.ts | `/api/v1/material-library/` | Python |
| carrierLibrary.ts | `/api/v1/carrier-library/` | Python |
| image.ts | `/api/v1/images/` | Python |
| user.ts | `/api/v1/users/` | Python |
| category.ts | `/api/v1/categories/` | Python |
| tag.ts | `/api/v1/tags/` | Python |
| systemConfig.ts | `/api/v1/system-config/` | Python |

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
6. 注意：API 路径正在从 `/api/v1/` 迁移到 `/api/`（Java 后端），新增调用优先用新路径
