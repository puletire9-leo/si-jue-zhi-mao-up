# 思觉智贸前端 — 剩余待执行计划

> 生成日期: 2026-06-13
> 基于已完成工作（全局搜索 + 移动端快速修复 + 暗黑验证 + 骨架屏 + Code Review）后的剩余项

---

## 当前状态总览

### ✅ 已完成（今日）

| # | 方案 | 完成内容 | 工作量 |
|---|------|---------|--------|
| 1 | 全局 Cmd+K 搜索 | `GlobalSearch/index.vue` 创建 + lay-navbar 集成 | ~2 人天 |
| 2 | 移动端选择器 | Phase 0 — CSS 快速修复（`display:none → inline-flex`） | 10 分钟 |
| 3 | 暗黑模式验证 | `dark-mode-validation.md` 兼容性报告 | ~0.5 人天 |
| 4 | 骨架屏 | `SkeletonWrapper` 组件 + AllSelection 首屏替换 | ~2 人天 |
| 5 | 代码审查 | commit 5f7448f + 今日未提交代码审查完成 | ~1 小时 |

### 📥 未提交（4 个文件需 commit）

```
 M frontend/src/components.d.ts
 M frontend/src/layouts/Layout/components/lay-navbar/index.vue
 M frontend/src/modules/product-line-selection/index.vue
 M frontend/src/views/AllSelection/index.vue
```

---

## 待执行项目

按优先级从高到低排列。

---

### P0 — 代码修复（基于 Code Review 发现）

> **工作量：0.5 人天 | 可先 commit 通提**

| # | 严重度 | 文件 | 问题 | 修复方式 |
|---|--------|------|------|---------|
| H1 | 🟡 HIGH | `GlobalSearch/index.vue:130` | `(res as any)?.data?.list` 类型擦除 | 定义 `SearchResponse` 接口替换 `any` |
| M1 | 🔵 MEDIUM | `store.ts:83,103,173...` | 6 处空 `catch {}` 静默吞异常 | 加 `console.warn('[Store]', err)` |
| M2 | 🔵 MEDIUM | `ModelSummaryBar.vue:310` | `goodProducts` 为 `any[]` | 定义 `GoodProductItem` 接口 |
| M3 | 🔵 MEDIUM | `store.ts:74` | `map((sc: any) => ...)` 类型逃逸 | 定义 `SubCategory` 类型 |

**建议：** 先修复、再统一提交（包含今日所有未提交改动）。

---

### P1 — 暗黑模式 Phase 2-4（实施）

> **工作量：7-10 人天 | 可并行 3-4 人**

详见验证报告 `frontend/src/styles/dark-mode-validation.md`

**Phase 2 — 引入并验证 css-vars（0.5 人天）**
- 在 `main.ts` 中添加 `import 'element-plus/theme-chalk/dark/css-vars.css'`
- 验证 14 个可删除的组件补丁是否正常

**Phase 3 — 视图页面暗黑覆盖（6-8 人天）**

| 批次 | 页面 | 工作量 |
|------|------|--------|
| P0（必做） | AllSelection, SelectionDetail, ProductDetail, FinalDraft | 2 人天 |
| P1（建议） | AsinImport, CarrierLibrary, MaterialLibrary, Dashboard | 2 人天 |
| P2（可选） | 其余 16 个 views + 通用组件 | 2-3 人天 |

**Phase 4 — 补丁清理（1 人天）**
- 删除 `[style*="background: #fff"]` 等属性选择器（第 617-637 行）
- 删除 `el-table`, `el-dialog`, `el-card` 等 14 个被 css-vars 替代的补丁（第 465-597 行）
- 保留品牌色（`#b45309`）、侧边栏渐变、滚动条等 11 项

---

### P2 — 骨架屏 Phase 3-4（扩展替换）

> **工作量：2-3 人天 | 可并行 2 人**

目前还剩 **25 处** `v-loading` 需要评估替换：

**阶段 3 — 卡片网格页面（1 人天）**

| 页面 | 组件 | 替换模式 | 备注 |
|------|------|---------|------|
| CarrierLibrary | `drafts-grid` | `variant="card-grid"` | 与 AllSelection 同模式 |
| FinalDraft | `drafts-grid` | `variant="card-grid"` | 同上 |
| MaterialLibrary | `drafts-grid` | `variant="card-grid"` | 同上 |
| ImageManagement | grid | `variant="card-grid"` | 同上 |

**阶段 4 — 表格/统计页面（1-2 人天）**

| 页面 | 当前用法 | 推荐 variant |
|------|---------|-------------|
| DownloadManager | `task-list-card v-loading` | `variant="table"` |
| UserManagement | 表格 v-loading | `variant="table"` |
| ProductManagement | 表格 v-loading | `variant="table"` |
| Dashboard | 统计卡片组 | `variant="stats"` |
| SelectionDetail | 详情页 | `variant="list"` |
| 其余 8 个 views | 逐个判断 | 按需选择 |

**注意：** 模板已存在，每个页面替换只需加 `hasLoaded`/`refreshing` + 模板包裹，平均 10 分钟/页。

---

### P2 — 暗黑模式 + 骨架屏联动

骨架屏颜色已用 CSS 变量自动适配暗黑模式，无需额外工作。
但需要在 `dark-overrides.scss`（Phase 2 创建）中添加 `.skeleton-wrapper` 的暗色变量：
```scss
html.dark .skeleton-wrapper {
  --el-skeleton-color: var(--el-fill-color);
  --el-skeleton-to-color: var(--el-fill-color-light);
}
```

---

### P3 — 菜单双轨合并

> **工作量：2.5-4 人天 | 可并行 2 人**

**现状：`lay-sidebar/index.vue` 仍有 22 个页面在 `legacyGroups`**
**已迁移：** 仅 `product-line-selection`、`zheng-shop-analysis` 2 个

**步骤：**
1. 新增 `external?: boolean` + `hiddenInMenu?: boolean` 字段到 `ModuleManifest`（0.3 人天）
2. 为 22 个页面各创建 `modules/<id>/manifest.ts`（2-3 人天）
3. 删除 `legacyGroups` 数组和多余的图标 import（0.3 人天）

**高优先迁移的 4 个页面（与暗黑模式配合）：**
```
all-selection → modules/all-selection/manifest.ts  ← P0 页面，优先
selection-detail → modules/selection-detail/manifest.ts  ← P0
final-draft → modules/final-draft/manifest.ts  ← P0
asin-import → modules/asin-import/manifest.ts  ← P1
```

---

### P3 — 移动端选择器 Phase 1-2（全量 ActionSheet）

> **工作量：1.5 人天 | 可单独做**

快速修复（Phase 0）已完成，CSS 改 `display:none → inline-flex` 缓解了移动端功能缺失。
但完整的 ActionSheet 组件尚未创建：

1. 创建 `MobileActionSheet/index.vue` 组件（1 人天）
2. 替换品线选品页的 `el-select`（0.3 人天）
3. 响应式布局调整（0.2 人天）

**优先级说明：** Phase 0 已解燃眉之急，全量 ActionSheet 不阻塞使用，可排在最后。

---

## 建议执行顺序

```
Round 1（立即）：
  ├── 修复 Code Review 4 个发现项 (0.5d)
  └── commit 今日所有改动

Round 2（并行）：
  ├── 暗黑 Phase 2 引入 css-vars (0.5d)
  ├── 暗黑 Phase 3 P0 页面覆盖 (2d)
  └── 骨架屏 Phase 3 卡片页面 (1d)

Round 3（并行）：
  ├── 暗黑 Phase 3 P1 页面覆盖 (2d)
  ├── 暗黑 Phase 4 补丁清理 (1d)
  └── 骨架屏 Phase 4 表格/统计 (1.5d)

Round 4（根据节奏）：
  ├── 菜单双轨 4 个 P0/P1 页面 (0.5d)
  ├── 菜单双轨其余 18 个页面 (2d)
  └── 移动端 ActionSheet (1.5d)
```

## 工作量汇总

| 轮次 | 内容 | 工作量 | 并行度 | 实际耗时 |
|------|------|--------|--------|---------|
| Round 1 | 修复+提交 | 0.5 人天 | 1 人 | 0.5 天 |
| Round 2 | 暗黑 P2 + P0 页面 + 骨架屏 | 3.5 人天 | 3 人并行 | 1-1.5 天 |
| Round 3 | 暗黑 P1-P4 + 骨架屏 | 4.5 人天 | 2 人并行 | 2-2.5 天 |
| Round 4 | 菜单双轨 + 移动端 | 4 人天 | 2 人并行 | 2 天 |
| **合计** | | **12.5 人天** | | **~6 天** |
