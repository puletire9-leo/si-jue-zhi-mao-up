# 前端 - Claude 自动加载上下文

> Vue 3 + TypeScript + Element Plus + Vite + Pinia。详情见 [AGENTS.md](AGENTS.md)。

## 目录结构

```
frontend/src/
├── api/          # API 接口定义
├── components/   # 通用组件
├── composables/  # 组合式函数
├── layouts/      # 布局组件
├── modules/      # 功能模块（即插即用）
├── router/       # Vue Router 路由
├── stores/       # Pinia 状态管理
├── styles/       # 全局样式 SCSS
├── types/        # TypeScript 类型
├── utils/        # 工具函数
└── views/        # 页面视图（旧，逐步迁移到 modules）
```

## 模块化规则（新功能必须遵守）

新功能页面**必须**放 `src/modules/`，不改 `router/index.ts` 和 `lay-sidebar/index.vue`。

```
src/modules/
├── index.ts              # 模块扫描器（自动收集 + 缓存）
├── types.ts              # ModuleManifest 类型
└── your-module/          # 功能模块目录
    ├── manifest.ts       # 模块清单（路由 + 菜单 + 权限）
    ├── index.vue         # 页面入口
    └── components/       # 模块私有组件
```

**manifest.ts 模板：**
```typescript
import type { ModuleManifest } from '../types'

export default {
  id: 'your-module',           // 唯一标识
  name: '显示名称',             // 菜单文本
  icon: 'Shop',                // Element Plus 图标名
  menuGroup: '分组名',          // 可选，有则归入子菜单
  menuOrder: 50,               // 排序权重，越小越靠前
  permissions: [],             // 可选，权限标识
  route: {
    path: 'your-module',       // 路由路径（子路径，非绝对）
    name: 'YourModule',        // 路由名称
    component: () => import('./index.vue'),
    meta: { title: '页面标题' }
  }
} satisfies ModuleManifest
```

**关键约束：**
- `manifest.ts` 只放一级目录（`modules/xxx/manifest.ts`），不支持嵌套
- 路由 name 自动加 `module-{id}-` 前缀，无需手动加
- 图标用字符串名（如 `'Shop'`），运行时按需加载，禁止 import 图标组件
- 模块 API 前缀：`/api/v1/modules/{module-id}/`

## 修改规则

1. **新功能页面**放 `modules/`，只创建 manifest + 页面，**不改 router/sidebar**
2. **旧页面修改**仍在 `views/`，后续逐步迁移到 modules
3. 新 API 放 `api/`，用 `utils/request.ts` 的 axios 实例
4. 新组件放 `components/`，PascalCase 命名
5. 新类型放 `types/`，**禁止 `any`**
6. 样式用 SCSS，变量在 `styles/variables.scss`

## 后端映射

| API 文件 | 实际后端 | 说明 |
|----------|---------|------|
| product.ts | Python | CRUD 待迁移到 Java |
| selection.ts | Python | CRUD 待迁移到 Java |
| finalDrafts.ts | Python | CRUD 待迁移到 Java |
| materialLibrary.ts | Python | 含 AI 分析，保留 Python |
| carrierLibrary.ts | Python | 待迁移到 Java |
| image.ts | Python | 核心 AI，保留 Python |
| user.ts | Java | sjzm-user，已迁移 |
| productData.ts | Python | Polars 数据处理，保留 |
| import_export.ts | Python | Excel 处理，保留 |
| report.ts | Python | 脚本生成，保留 |
| lingxing.ts | Python | COS 上传，保留 |

**Java 后端已实现的前端页面：** 登录/用户管理/竞品分析/评分/ASIN 导入/筛选预设。
**仍在 Python 的页面：** 产品管理/选品/定稿/素材库/运营商库/图片管理/导入导出/数据看板/统计/报表/领星导入。

## 构建

**生产构建禁止在 Docker 内执行。** Docker Desktop 内存不够，Vite 构建会 OOM 导致守护进程崩溃。在宿主机运行：

```powershell
cd E:\项目\si-jue-zhi-mao-up\frontend
npm run build
```

输出到 `../static/vue-dist/`，prod-frontend 容器通过 volume 直接挂载使用，无需重建镜像。
