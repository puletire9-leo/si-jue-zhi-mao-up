# 前端 - Claude 自动加载上下文

> Vue 3 + TypeScript + Element Plus + Vite + Pinia。详情见 [AGENTS.md](AGENTS.md)。

## 目录结构

```
frontend/src/
├── api/          # API 接口定义（20 文件）
├── components/   # 通用组件（8 个）
├── composables/  # 组合式函数
├── layouts/      # 布局组件
├── router/       # Vue Router 路由
├── stores/       # Pinia 状态管理（5 个）
├── styles/       # 全局样式 SCSS
├── types/        # TypeScript 类型（11 个）
├── utils/        # 工具函数（11 个）
└── views/        # 页面视图（27 个）
```

## 修改规则

1. 新页面放 `views/`，在 `router/index.ts` 注册
2. 新 API 放 `api/`，用 `utils/request.ts` 的 axios 实例
3. 新组件放 `components/`，PascalCase 命名
4. 新类型放 `types/`，**禁止 `any`**
5. 样式用 SCSS，变量在 `styles/variables.scss`

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
