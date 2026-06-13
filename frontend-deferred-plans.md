# 思觉智贸前端 — 待执行优化方案

> 基于前期 17 项审计分析，对 5 个暂未执行项的详细实施方案。
> 每项包含：现状分析 → 目标状态 → 实施步骤 → 风险/注意事项 → 工作量预估 → 验收标准。
> 方案说明与代码库实际状态已于 2026-06-13 核实。

---

## 方案一：菜单双轨合并（#1）

### 现状

`frontend/src/layouts/Layout/components/lay-sidebar/index.vue` 中同时存在两套菜单生成逻辑：

1. **模块化菜单**（第 46-81 行）：从 `modules/*/manifest.ts` 自动收集，支持 `menuGroup` / `menuOrder`
2. **Legacy 硬编码菜单**（第 83-145 行）：手写 5 个分组 + 4 个独立项，覆盖 22 个页面路径

当前已有 2 个模块完成迁移（`product-line-selection`、`zheng-shop-analysis`），剩余约 **22 个页面** 仍在 legacy 菜单中。两个列表通过 `[...topLevel, ...groupMenus, ...legacyGroups]` 合并，排序靠 `order` 整型协商，维护者需要同时在两处配置新路由。

> **关联文件：** `lay-sidebar/index.vue`、`modules/types.ts`、`router/index.ts`

### 目标状态

Legacy 菜单完全删除，所有页面路由通过 `modules/*/manifest.ts` 自动收集。sidebar 中只有一个数据来源。

### 实施步骤

**Phase 1 — 扩展 ModuleManifest 类型（0.3人天）**

当前 `types.ts` 的 `ModuleManifest.route` 已支持 `children` 和 `meta`，无需再扩。
仅需新增两个字段：

```typescript
export interface ModuleManifest {
  // ... 已有字段不变
  external?: boolean       // 外部链接（如 HTML 看板），点击后新窗口打开
  hiddenInMenu?: boolean   // true 时不显示在 sidebar（用于动态路由页面如 /product/:sku）
}
```

**Phase 2 — 逐个迁移（2-3人天，可并行）**

为每个 legacy 页面创建 `modules/<id>/manifest.ts`（每个文件约 10 行）：

```
页面的 id 命名规则：kebab-case，与当前路由 path 一致
  - all-selection → modules/all-selection/manifest.ts
  - asin-import → modules/asin-import/manifest.ts
  - carrier-library → modules/carrier-library/manifest.ts
  …共约 22 个页面

每个 manifest.ts 模板：
  export default {
    id: 'all-selection',
    name: '总选品管理',
    icon: 'List',
    menuGroup: '选品中心',
    menuOrder: 10,
    route: {
      path: 'all-selection',
      name: 'AllSelection',
      component: () => import('@/views/AllSelection/index.vue'),
      meta: { title: '总选品管理' }
    }
  } satisfies ModuleManifest

处理特殊页面：
  - 数据看板中的 HTML 看板（product_sales_dashboard_v2.html 等）→ external: true
  - /product/:sku 等动态路由页面 → hiddenInMenu: true
```

**Phase 3 — 清理（0.3人天）**

```
迁移全部完成后：
  - 删除 lay-sidebar/index.vue 第 83-145 行的 legacyGroups
  - 删除 lay-sidebar/index.vue 中已不再需要的图标 import（第 4-14 行，只剩 Odometer 等少量图标）
  - 确认 sidebar 中 0 个硬编码路由
```

### 风险与注意事项

| 风险 | 缓解 |
|------|------|
| 22 个 manifest 文件导致 modules 目录膨胀 | 按功能域分子文件夹（modules/selection/、modules/data/、modules/settings/） |
| 动态路由页面（如 `/product/:sku`、`/selection/:id`）不应在菜单显示 | 新增 `hiddenInMenu` 字段，sidebar 生成逻辑跳过 |
| external 链接（HTML 看板）需要特殊处理 | 新增 `external` 字段，sidebar 中 window.open |
| `menuOrder` 排序冲突 | 规定分组 order 区间：10-19 选品中心，20-29 资料集，30-39 微定制，40-49 数据看板，50+ 领星，200+ 设置类 |
| 部分页面组件路径与模块路径不一致 | manifest 中的 `route.component` 引用 `@/views/xxx` 不变，不必移动 vue 文件 |

### 工作量：2.5-4 人天（可并行到 2 人）

### 验收标准

- [ ] `legacyGroups` 数组完全删除，sidebar 只从 `getAllModules()` 收集
- [ ] 所有 22 个旧页面在 sidebar 中正确显示、可点击导航
- [ ] HTML 看板链接在新窗口打开
- [ ] 动态路由页面不在菜单中显示
- [ ] 快捷键 `import` 从 lay-sidebar 中清理干净

---

## 方案二：全局 Cmd+K 搜索（#8）

### 现状

目前每个页面自建搜索框，不存在跨页面的统一搜索入口：
- `ProductLineTree.vue` 中有品线/小类搜索（本地过滤）
- 品线选品 topbar 中有商品标题搜索（后端 API）
- `AllSelection` 中有 SelectionQueryForm（含标题/ASIN/多条件搜索）
- 其他页面各自为政

用户在不同页面切换时需要重新输入搜索条件。没有全局搜索栏。

### 目标状态

顶部 navbar 右上角增加 Cmd+K 快捷键搜索入口，弹出模态搜索面板支持：
- 跨页面搜索商品 ASIN / 标题
- 搜索历史（localStorage 持久化）
- 键盘导航（↑↓ 选择，Enter 打开）
- 选中后跳转到落地页（`/selection-detail?asin=xxx`）

### 实施步骤

**Phase 1 — 确认后端搜索覆盖范围（0.3人天）**

```
先确认现有 API 能否覆盖搜索场景：
  - GET /api/v1/competitor/search  → 搜索竞品？仅限已录入的竞品？
  - GET /api/v1/selection/query    → 搜索选品？
  - 是否有统一商品搜索端点？

如果现有 API 只能搜单一数据源，V1 版本限定在搜索选品（selection 表）。
明确 API 边界后再开始前端组件开发，避免返工。
```

**Phase 2 — 搜索组件（1.5人天）**

```
创建 frontend/src/components/GlobalSearch/index.vue

组件结构：
  <template>
    <!-- 搜索触发：navbar 中的按钮 -->
    <el-tooltip content="搜索 (Cmd+K)">
      <el-button :icon="Search" circle @click="openPanel" />
    </el-tooltip>

    <!-- 模态搜索面板（自定义 overlay，非 el-dialog 以避免样式冲突） -->
    <teleport to="body">
      <div v-if="visible" class="search-overlay" @click.self="close">
        <div class="search-panel">
          <el-input
            ref="inputRef"
            v-model="query" placeholder="搜索商品 ASIN 或标题…"
            clearable autofocus
            @keydown="handleKeydown"
          />
          <!-- 搜索建议列表 -->
          <div v-if="results.length" class="search-results">
            <div
              v-for="(item, idx) in results"
              :key="item.asin"
              class="search-item"
              :class="{ active: idx === activeIdx }"
              @click="navigate(item)"
              @mouseenter="activeIdx = idx"
            >
              <span class="item-title">{{ item.title }}</span>
              <span class="item-asin mono">{{ item.asin }}</span>
            </div>
          </div>
          <div v-else-if="query && !searching" class="search-empty">
            未找到匹配商品
          </div>
        </div>
      </div>
    </teleport>
  </template>

功能要点：
  - 键盘：Ctrl+K / Cmd+K 打开，Escape 关闭
  - 防抖 300ms + AbortController 取消旧请求（防止输入快于响应时的竞态）
  - 搜索历史：localStorage('searchHistory') 最近 10 条
  - 选中后跳转 /selection-detail?asin=xxx，landing 页需要读取 asin 参数
  - el-input 聚焦自动选中文字
```

**Phase 3 — 集成到 navbar（0.3人天）**

```
在 lay-navbar/index.vue 中添加：
  import GlobalSearch from '@/components/GlobalSearch/index.vue'
  ...
  <GlobalSearch />

放在 navbar-right 的现有 icon 按钮之前（或替换刷新的位置）
```

### 风险与注意事项

| 风险 | 缓解 |
|------|------|
| 搜索结果跨数据源（选品/定稿/素材），一开始就做全太复杂 | V1 版本只搜选品（selection）表，后续扩展。明确写在 plan 里 |
| debounce + API 在高频输入时的竞态 | 300ms debounce + `AbortController` 取消旧请求 |
| Cmd+K 与浏览器快捷键冲突 | 只在弹出关闭时捕获，不阻止浏览器默认行为；打开后捕获和阻止冒泡 |
| 搜索结果跳转后落地页不认 `?asin=xxx` | SelectionDetail 等落地页需在 mounted 中检查 route.query.asin 并自动触发定位逻辑 |
| navbar 中的 GlobalSearch 按钮在 SSG/SSR 下报错 | 搜索组件只在 client 端挂载（`onMounted` 内绑定快捷键），SSR 安全 |

### 工作量：1.5-2 天（纯前端）+ 0.5-1 天（后端确认/适配）

### 验收标准

- [ ] Cmd+K / Ctrl+K 打开搜索面板，Escape 关闭
- [ ] 输入关键词 300ms 后显示搜索结果
- [ ] ↑↓ 导航、Enter 选中有高亮指示
- [ ] 选中商品跳转到对应页面并定位
- [ ] 搜索历史存 localStorage，最多 10 条
- [ ] 打开多个搜索请求时，旧请求被 Abort

---

## 方案三：移动端选择器替代（#10）

### 现状

品线选品页面的 `topbar` 中，站点/月份/版本使用 `<el-select>` 配合 `style="width:80px"`。
在第 425 行 `@media (max-width: 900px)` 中，三个 `.tb-select` 直接被 `display: none` 隐藏。
这导致移动端/小屏完全无法切换市场、月份、和版本，页面功能严重受限。

> **关联文件：** `modules/product-line-selection/index.vue`

### 目标状态

小屏状态下站点/月份/版本选择器不是消失，而是以底部弹出式选择器（ActionSheet）形式呈现。同时增加紧凑的当前选择显示。

### 实施步骤

**Phase 0 — 快速修复（10 分钟）— 在 ActionSheet 组件做好前先用**

```
修改 index.vue 的 @media 规则，让窄屏下选择器变小但不消失：

  @media (max-width: 900px) {
    .tb-select {
      display: inline-flex;          // 改 hidden 为 flex
      .el-select { min-width: 60px; width: auto !important; }  // 压缩宽度
      .el-select__wrapper { min-width: 54px; }
    }
    .tb-select:nth-child(3) {        // 版本选择器宽一点
      .el-select { min-width: 100px; }
    }
  }

这样在 ActionSheet 组件完成前，移动端至少能正常使用功能。
```

**Phase 1 — 创建 MobileActionSheet 组件（1人天）**

```
创建 frontend/src/components/MobileActionSheet/index.vue

组件设计：
  <template>
    <!-- 触发按钮（紧凑显示当前选择） -->
    <button class="trigger" @click="visible = true">
      <span class="trigger-value">{{ displayValue }}</span>
      <el-icon><ArrowDown /></el-icon>
    </button>

    <!-- 底部弹出面板 -->
    <teleport to="body">
      <Transition name="slide-up">
        <div v-if="visible" class="sheet-overlay" @click.self="visible = false">
          <div class="sheet-panel">
            <div class="sheet-header">
              <span class="sheet-title">{{ title }}</span>
              <button class="sheet-close" @click="visible = false">完成</button>
            </div>
            <div class="sheet-body">
              <div
                v-for="opt in options"
                class="sheet-option"
                :class="{ selected: opt.value === modelValue }"
                @click="select(opt.value)"
              >
                <span>{{ opt.label }}</span>
                <el-icon v-if="opt.value === modelValue"><Select /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </teleport>
  </template>

Props: title, options, modelValue
Emits: update:modelValue

关键设计：
  - slide-up 动画使用 transform: translateY，合成器友好不改触发布局
  - 暗黑模式适配：sheet-panel 使用 var(--el-bg-color-overlay) 而非固定白色
```

**Phase 2 — 修改品线选品页（0.3人天）**

```
在 index.vue 的 topbar 区域：

  <!-- 桌面端：保持现有 el-select（desktop-only 只在移动端隐藏） -->
  <label v-if="isDesktop" class="tb-select">
    站点 <el-select v-model="store.marketplace" size="small" style="width:80px">…</el-select>
  </label>
  <MobileActionSheet v-else
    title="选择站点"
    :options="marketplaceOptions"
    v-model="store.marketplace"
  />

判断桌面/移动用 CSS media query + 响应式断点计算，而非 window resize 事件。
或者用 :class 切换 display，不使用 v-if/v-else（避免生命周期差异）。
```

### 风险与注意事项

| 风险 | 缓解 |
|------|------|
| 该页面不是高频移动端场景 | 但 `display:none` 完全禁用比降级更差，即使使用率低也应修复。优先级定为 P2 |
| Table 在移动端横向滚动 | Table 有 `el-scrollbar` 支持横向滚动，保持 `min-width: 800px` |
| MobileActionSheet 在暗黑模式下白背景 | 组件内使用 `var(--el-bg-color-overlay)` 和 `var(--el-text-color-primary)` 等 CSS 变量 |
| `v-if="isDesktop"` 切换导致组件卸载重建 | 改用 CSS 方案：`<div class="desktop-only"><el-select/></div>` + `<div class="mobile-only"><MobileActionSheet/></div>` 两者同时存在，CSS 控制显示隐藏 |

### 工作量：1.5 人天（含 10 分钟快速修复）

### 验收标准

- [ ] 移动端（<900px）站点/月份/版本可正常切换
- [ ] ActionSheet 从底部滑入，有平滑动画
- [ ] 桌面端 el-select 行为无变化
- [ ] 暗黑模式下 ActionSheet 显示正常

---

## 方案四：暗黑模式重构（#12）

### 现状

当前暗黑模式状态（2026-06-13 核实）：

| 层 | 覆盖情况 | 文件 |
|----|---------|------|
| 全局基础 `html.dark { ... }` | `index.scss:440-662` 约 220 行覆盖 | `styles/index.scss` |
| 内联样式补丁 `[style*="background: #fff"]` | 行 617-637 约 20 行 `!important` 属性选择器 | `styles/index.scss` |
| Layout（sidebar/navbar/tags/panel） | 完整，每个组件 scoped `:deep(html.dark)` | 5 个 layout 文件 |
| 24 个视图页面 | **零覆盖** | `views/*/index.vue` |
| 11 个通用组件 | **零覆盖** | `components/*/index.vue` |
| 2 个模块页 | **零覆盖** | `modules/*/index.vue` |
| Element Plus 版本 | **2.13.1**（支持 CSS Variables 方案） | `package.json` |

当前触发方式：`settings.ts` 中同时使用 `html.classList.add('dark')` + `html.setAttribute('data-theme', 'dark')`。

核心问题：
1. `[style*="background: #fff"]` 属性选择器匹配内联样式，但每增加 Element Plus 组件或升级版本都可能出现未覆盖的白色块
2. 20 处 `!important` 导致后续样式难以覆盖
3. 视图页面零覆盖，用户在暗黑模式下浏览数据区域时体验断裂

### 目标状态

- 删除 `[style*="..."]` 属性选择器和 `!important` 修补
- 视图页面暗黑模式覆盖率达到 80%+
- 引入 Element Plus 官方 `dark/css-vars.css` 作为基线，自定义覆盖降级为普通选择器

### 实施步骤

**Phase 1 — 安装官方暗黑 CSS Variables（0.3人天）**

```
1. 引入官方暗黑变量：
   // App.vue 或 main.ts 中
   import 'element-plus/theme-chalk/dark/css-vars.css'

2. 验证兼容性：当前已经是 html.dark + data-theme="dark" 双触发，
   引入 css-vars.css 后 Element Plus 组件自身样式自动响应 dark 变量，
   不需立即删除现有覆盖。先确认无冲突。

3. 验证组件列表（确认 css-vars 覆盖了这些）：
   el-table, el-dialog, el-select-dropdown, el-picker-panel,
   el-message-box, el-popover, el-card, el-tag, el-dropdown-menu,
   el-breadcrumb, el-avatar, el-switch, el-scrollbar
   → 以上当前都有手动覆盖，如果 css-vars 已覆盖则可删
```

**Phase 2 — 逐个清理 `!important` 补丁（1人天）**

```
⚠️ 核心原则：每次只删一条，删完立刻测试，不批量删除。

删除顺序：
  1. [style*="background: #fff"] 组（第 617-626 行）
     → 删后验证 el-dialog、el-select-dropdown、el-picker-panel 背景

  2. [style*="border-bottom"] 组（第 629-636 行）
     → 删后验证各组件边框颜色

  3. [class*="panel"] 等通配选择器（第 607-614 行）
     → 逐个删除，验证

  4. 弹窗/下拉等组件的手动覆盖（第 640-662 行）
     → 如果 css-vars 已覆盖则删，否则保留

注意：
  - 每次删除后刷新页面看有无白块
  - 如果 css-vars 未能覆盖，保留手动覆盖但去掉 !important
  - 已确认 el-button--primary 的背景色 (#b45309) 需要保留手动覆盖（主色是品牌色，不是 Element Plus 默认蓝）
```

**Phase 3 — 视图页面暗黑覆盖（6-8人天，可逐个页面并行）**

创建 `frontend/src/styles/dark-overrides.scss` 集中管理页面级覆盖：

```scss
// dark-overrides.scss — 仅在 Phase 3 开始时创建
// 所有覆盖必须在 @media (prefers-color-scheme: dark) 或 html.dark 下生效
// 使用 CSS 变量而非硬编码颜色，以便未来切换主题

html.dark {
  // 选品卡片
  .universal-card {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    .card-title { color: var(--el-text-color-primary); }
  }

  // 数据表格通用
  .el-table {
    th.el-table__cell { background: var(--el-fill-color-light); }
    td.el-table__cell { border-color: var(--el-border-color); }
  }

  // 空白状态引导
  .empty-guide { background: transparent; }

  // 统计/报表卡片
  .page-header, .stat-card { background: var(--el-bg-color); }
}
```

**优先级策略（按日活/功能重要性排序）：**

```
第一批（P0，2人天）：
  - AllSelection（最核心的选品管理）
  - SelectionDetail（选品详情）
  - ProductDetail（产品详情）
  - FinalDraft（定稿管理）

第二批（P1，2人天）：
  - AsinImport（数据分析）
  - CarrierLibrary（载体库）
  - MaterialLibrary（素材库）
  - ProductDataDashboard（数据看板）

第三批（P2，2-3人天）：
  - 其余 16 个页面 + 通用组件
```

**Phase 4 — 开启完整 CSS Variables 方案（0.5人天）**

```
在所有视图覆盖完成后：
  1. 检查现有 html.dark 下的样式有多少可以删掉（被 css-vars 替代的）
  2. 删除 redundant 手动样式
  3. 最终状态：基线用官方 css-vars.css，品牌特定色（#b45309 等）保留手动覆盖
```

### Element Plus 组件暗黑属性自查清单

| 组件 | 需要检查的属性 | css-vars 覆盖？ | 当前补丁覆盖？ |
|------|---------------|----------------|---------------|
| el-table | header bg, row hover, stripe, border | ✅ v2.13.1 | ✅ |
| el-dialog | bg, header border, title color, body | ✅ | ✅ |
| el-drawer | bg | ✅ | ✅ |
| el-select-dropdown | item bg, hover, selected | ✅ | ⚠️ 不完整 |
| el-picker-panel | bg, cell hover | ✅ | ❌ |
| el-message-box | bg, content | ✅ | ✅ |
| el-popover | bg, arrow | ✅ | ✅ |
| el-card | bg | ✅ | ✅ |
| el-form-item__label | label color | ✅ | ✅ |
| el-empty | description text | ❌（需手动） | ❌ |
| el-image viewer | mask, toolbar | ❌（需手动） | ❌ |
| el-progress | text color | ❌（需手动） | ❌ |
| el-collapse | header bg | ❌（需手动） | ❌ |
| el-tabs | header bg | ❌（需手动） | ❌ |
| el-input-number | control bg | ❌（需手动） | ❌ |
| el-rate | star color | ❌（需手动） | ❌ |
| el-slider | rail bg | ❌（需手动） | ❌ |
| el-steps | step title | ❌（需手动） | ❌ |

> 验证方法：在 v2.13.1 上实测后更新此表。如果 css-vars 已覆盖，对应的手动补丁可删。

### 风险与注意事项

| 风险 | 缓解 |
|------|------|
| Element Plus css-vars.css 与当前自定义 dark 覆盖冲突 | 先导入 css-vars.css（优先级低），然后逐个验证哪些手动覆盖可删。不改 currentColor 等 CSS 变量 |
| 删 `[style*="background"]` 后出现白块 | 逐个删除，删一条测一条。先确认 css-vars 覆盖了对应组件再删 |
| 页面 scoped CSS 中的硬编码颜色不响应 dark 模式 | 替换 `color: #xxx` / `background: #xxx` 为 `var(--el-text-color-primary)` / `var(--el-bg-color)` |
| `html.dark` + `data-theme="dark"` 双触发冗余 | 统一只保留 `html.classList.toggle('dark')`。但需确认 `data-theme` 的消费者——当前是否其他地方依赖它。全局搜 `data-theme` 引用 |

### 工作量：8-12 人天（可并行到 3-4 人）

### 验收标准

- [ ] `[style*="background"]` 属性选择器和 `!important` 全部删除
- [ ] Element Plus css-vars.css 正常加载
- [ ] 5 个核心页面（AllSelection, SelectionDetail, FinalDraft, AsinImport, Settings）暗黑模式无白块
- [ ] 视图页面暗黑覆盖 >= 80%（首批 P0 4 个 + P1 4 个 + P2 部分）
- [ ] el-dialog, el-select-dropdown, el-picker-panel, el-message-box, el-popover 在暗黑模式下显示正常
- [ ] 主色（#b45309）在暗黑模式下可见性正常

---

## 方案五：骨架屏加载态替代（#16）

### 现状

目前 **26 处** `v-loading` 使用场景：

```
AllSelection/index.vue:      products-grid v-loading="loading"
CarrierLibrary/index.vue:    drafts-grid v-loading="loading"
Dashboard/index.vue:         v-loading="loading"
DownloadManager/index.vue:   task-list-card v-loading="loading"
FinalDraft/index.vue:        drafts-grid v-loading="loading"
ImageManagement/index.vue:   v-loading="loading"
MaterialLibrary/index.vue:   v-loading="loading"
ResourceCollection/index.vue: v-loading="loading"
...（共 26 处分布在 25 个文件中）
```

骨架屏仅 2 处使用：
  - `LazyImage/index.vue`: `<el-skeleton :rows="1" animated />`
  - `ThumbnailViewer/index.vue`: `<el-skeleton :rows="1" animated />`

`v-loading` 显示全屏旋转图标 + 遮罩 + 阻止交互，用户等待时无法预览内容结构，感知等待时间较长。

### 目标状态

- 列表/表格/卡片网格的**首屏加载**从旋转图标改为骨架屏（`<el-skeleton>`）
- 后续操作（点击筛选、翻页）仍保留 `v-loading`（短时间内重复加载，骨架屏闪烁反而更差）
- 骨架屏视觉风格统一 + 暗黑模式适配

### 实施步骤

**Phase 1 — 创建统一骨架屏组件（1人天）**

```
创建 frontend/src/components/SkeletonWrapper/index.vue

设计要点：
  1. 加载态添加 pointer-events: none 防止用户误操作触发重复请求
  2. 骨架颜色使用 CSS 变量（var(--el-fill-color-light)），自动适配暗黑模式
  3. 容器尺寸（grid/padding）与真实内容保持一致，防止布局偏移（CLS）

  <template>
    <div v-if="loading" class="skeleton-wrapper" style="pointer-events: none">
      <template v-if="variant === 'card-grid'">
        <div class="skeleton-grid">
          <el-skeleton :count="count" animated>
            <template #template>
              <el-skeleton-item variant="image" style="height:180px" />
              <el-skeleton-item variant="text" style="width:60%" />
              <el-skeleton-item variant="text" style="width:80%" />
            </template>
          </el-skeleton>
        </div>
      </template>

      <template v-if="variant === 'table'">
        <el-skeleton :rows="rows" animated />
      </template>

      <template v-if="variant === 'stats'">
        <div class="skeleton-stats">
          <el-skeleton-item variant="h1" style="width:30%" />
          <el-skeleton-item variant="text" />
          <el-skeleton-item variant="text" style="width:60%" />
        </div>
      </template>

      <template v-if="variant === 'list'">
        <div class="skeleton-list">
          <el-skeleton :count="count" animated>
            <template #template>
              <div class="skeleton-list-row">
                <el-skeleton-item variant="circle" style="width:40px;height:40px" />
                <el-skeleton-item variant="text" style="width:70%" />
              </div>
            </template>
          </el-skeleton>
        </div>
      </template>
    </div>
    <slot v-else />
  </template>

  Props:
    loading: boolean
    variant: 'card-grid' | 'table' | 'stats' | 'list'
    count?: number (骨架卡片数量，默认 6)
    rows?: number (表格行数，默认 5)

  CSS（使用 CSS 变量，暗黑模式自动适配）：
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      padding: 16px;
    }
    :deep(.el-skeleton) { --el-skeleton-color: var(--el-fill-color-light); }
```

**Phase 2 — 替换卡片网格页面（优先，1.5人天）**

```
替换顺序（按用户感知排序）：
  1. AllSelection → products-grid 替换为 SkeletonWrapper variant="card-grid"
  2. FinalDraft → drafts-grid 替换为 SkeletonWrapper variant="card-grid"
  3. CarrierLibrary → drafts-grid 替换为 SkeletonWrapper variant="card-grid"
  4. MaterialLibrary → 同上
  5. ResourceCollection → 同上

每个页面的替换模式（以 AllSelection 为例）：
  <!-- 替换前 -->
  <div v-loading="loading" class="products-grid">
    <UniversalCard v-for="p in products" ... />
  </div>

  <!-- 替换后：首屏用骨架屏，后续操作保持 v-loading -->
  <template v-if="loading && !hasLoaded">
    <SkeletonWrapper variant="card-grid" :count="12" />
  </template>
  <div v-else v-loading="refreshing" class="products-grid">
    <UniversalCard v-for="p in products" ... />
  </div>

注意：
  - 需要每个页面新增 hasLoaded（是否已完成首屏加载）和 refreshing（后续操作加载）两个状态
  - loading = hasLoaded ? refreshing : true
```

**Phase 3 — 表格/列表页（1人天）**

```
替换顺序：
  1. DownloadManager → task-list-card 替换为 SkeletonWrapper variant="table"
  2. ImageManagement → 替换为 variant="card-grid"
  3. 其他 v-loading 页面 → 逐个判断最合适的 variant
```

**Phase 4 — 首页统计卡片（0.3人天）**

```
Dashboard 首页的统计卡片组替换为 variant="stats"
```

### 骨架屏设计原则

```
1. 形状接近真实内容轮廓（圆角卡片配圆角图、文本行用短块）
2. 颜色使用 CSS 变量 var(--el-fill-color-light) + var(--el-skeleton-color)，
   暗黑模式自动适配
3. 动画使用 el-skeleton 自带的 animated（渐变闪光效果）
4. 首次加载必用骨架屏，筛选/翻页等后续操作保留 v-loading（避免骨架屏闪烁）
5. 骨架屏容器使用和真实内容相同的 grid/padding，减少 CLS
```

### 风险与注意事项

| 风险 | 缓解 |
|------|------|
| 替换后布局偏移（CLS） | SkeletonWrapper 容器尺寸和真实内容一致（相同 grid/padding） |
| 骨架屏加载完后切换到真实内容的闪烁 | 骨架屏颜色接近真实背景色（用 CSS 变量），内容到达后 onMounted 立即替换 |
| 首屏/后续采用不同 loading 方式增加状态复杂度 | 每个页面新增 `hasLoaded: boolean` 状态，简化逻辑 |
| 暗黑模式下骨架屏颜色太亮 | 使用 CSS 变量，暗黑模式自动响应 `--el-skeleton-color` |
| `pointer-events: none` 时用户无法操作 | 仅在首屏加载时开启，后续刷新用 `v-loading`（已有遮罩） |

### 工作量：4-5 人天

### 验收标准

- [ ] 卡片网格、表格、统计三种场景的 SkeletonWrapper 渲染正确
- [ ] 首屏加载显示骨架屏（非旋转图标）
- [ ] 后续筛选/翻页使用 `v-loading`（非骨架屏）
- [ ] 暗黑模式下骨架屏颜色正确（没有亮白色块）
- [ ] Lighthouse CLS <= 0.1
- [ ] 骨架屏加载态下点击无响应（`pointer-events: none`）

---

## 总工作量汇总（优化后）

| 方案 | 原估算 | 优化后 | 并行度 | 优先级 | 建议执行顺序 |
|------|--------|--------|--------|--------|------------|
| 一、菜单双轨合并 | 6-10 人天 | **2.5-4 人天** | 2 人并行 | **P3 — 配合模块迁移** | ⑤ |
| 二、全局 Cmd+K 搜索 | 2-3 人天 | **2-3 人天** | 1 人 | **P1** | ② |
| 三、移动端选择器 | 2 人天 | **1.5 人天** | 1 人 | **P2** | ③ |
| 四、暗黑模式重构 | 6-10 人天 | **8-12 人天** | 3-4 人并行 | **P0 — 补丁不可持续** | ① |
| 五、骨架屏加载态 | 4-5 人天 | **4-5 人天** | 2 人并行 | **P2 — 体验优化** | ④ |

**建议执行顺序（优化后）：**
暗黑模式 → 全局搜索 → 移动端选择器 → 骨架屏 → 菜单双轨

**理由（优化后）：**
- **暗黑模式**：当前 20 处 `!important` + 属性选择器补丁，每加组件都可能出白块，优先根治
- **全局搜索**：独立可做、用户感知强、后端 API 确认后纯前端 1.5 天完成
- **移动端选择器**：先 10 分钟快速修复缓解症状，组件开发可后移
- **骨架屏**：体验优化，不阻塞功能，可穿插其他任务并行
- **菜单双轨**：依赖模块迁移进度，不阻塞功能使用，排到最后

**总工作量（优化后）：18-25 人天**（可并行 3-4 人 → 约 2-3 周完成全部 5 项）
