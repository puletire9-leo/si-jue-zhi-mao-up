# 暗黑模式 CSS Variables 兼容性验证文档

> 创建日期: 2026-06-13
> 验证范围: Element Plus 2.13.1 官方 `css-vars.css` 与项目手动 `html.dark` 补丁 (`index.scss` 第 440-662 行)

---

## 1. 引入方式

**当前状态**: 未引入。`main.ts` 中仅导入了 `element-plus/dist/index.css`（第 5 行），没有导入 `element-plus/theme-chalk/dark/css-vars.css`。

**建议引入方式**: 在 `frontend/src/main.ts` 中，在现有 `import 'element-plus/dist/index.css'` 之后添加：

```typescript
import 'element-plus/theme-chalk/dark/css-vars.css'
```

**可选位置**: 也可在 `App.vue` 的 `<style>` 块中 `@import`，但 `main.ts` 更符合该项目的现有习惯（所有全局 CSS 都在 main.ts 或 `@styles/index.scss` 中引入）。

---

## 2. 版本兼容性结论

| 项 | 值 | 要求 | 结论 |
|---|---|---|---|
| element-plus 版本 | `^2.13.1` | >= 2.9 | 兼容 |
| dark mode 切换方式 | `html.classList.add('dark')` | 与 css-vars 选择器 `html.dark` 一致 | 兼容 |
| 主色覆盖 | `document.documentElement.style.setProperty('--el-color-primary', '#b45309')` | css-vars 会读取该变量 | 兼容 |

**结论**: 版本和切换机制均满足要求，可以直接引入 `css-vars.css`。

---

## 3. 组件覆盖情况分类

### 3.1 可删除（css-vars 已完全覆盖）

导入 `css-vars.css` 后，以下组件的暗黑样式由 Element Plus 官方自动处理，项目的手动补丁可以删除：

| # | 组件 | index.scss 行号 | css-vars 覆盖机制 |
|---|------|-----------------|-------------------|
| 1 | **el-table** | 479-505 | `--el-fill-color-light` 控制行 hover，`--el-text-color-primary` 控制文字，`--el-border-color-lighter` 控制边框，`--el-bg-color` 控制背景 |
| 2 | **el-dialog** | 507-516 | `--el-bg-color-overlay` 控制弹窗背景，`--el-text-color-primary` 控制标题文字 |
| 3 | **el-dropdown-menu** | 552-563 | `--el-bg-color-overlay` 控制下拉菜单背景，`--el-border-color-light` 控制边框 |
| 4 | **el-tag** | 565-574 | 通过 `--el-bg-color`、`--el-border-color`、`--el-text-color-primary` 级联 |
| 5 | **el-switch** | 576-583 | `--el-color-primary` 控制激活态颜色，`--el-border-color` 控制底色 |
| 6 | **el-breadcrumb** | 586-593 | `--el-text-color-primary` 控制最后一项文字，`--el-text-color-regular` 控制中间项 |
| 7 | **el-avatar** | 594-597 | `--el-fill-color-light` 控制占位背景 |
| 8 | **el-input__wrapper** | 470-477 | `--el-fill-color-blank` 控制输入框背景，`--el-border-color` 控制边框，`--el-text-color-primary` 控制文字 |
| 9 | **el-card** | 465-468 | `--el-card-bg-color` 和 `--el-fill-color-blank` 被 css-vars 显式覆盖 |
| 10 | **el-select-dropdown** | 641-648 | `--el-bg-color-overlay` 控制下拉背景 |
| 11 | **el-picker-panel** | 643-648 | `--el-bg-color-overlay` 控制面板背景，`--el-text-color-primary` 控制文字 |
| 12 | **el-message-box** | 644-648 | `--el-bg-color-overlay` 控制消息框背景 |
| 13 | **el-popover** | 645-648 | `--el-bg-color-overlay` 控制弹出层背景 |
| 14 | **el-form-item__label** | 656-661 | `--el-text-color-regular` 控制标签文字 |
| 15 | **el-descriptions** | 657-661 | `--el-text-color-regular` 控制描述文字 |

### 3.2 需保留（品牌色、自定义组件）

以下补丁涉及项目品牌色（琥珀色 #b45309）或自定义 UI，css-vars 无法替代，需要保留：

| # | 选择器 | 行号 | 保留原因 |
|---|--------|------|----------|
| 1 | **el-button--primary** | 519-523 | 项目主色为 `#b45309`（琥珀色），css-vars 默认主色为 `#409eff`（蓝色）。虽然 `--el-color-primary` 在启动时被设为 `#b45309`，但 css-vars.css 同时设置 `--el-color-primary-light-3` 等渐变变体（硬编码蓝底衍生色），不能自动适配琥珀色。需要保留以维持主色一致性 |
| 2 | **el-menu** / **el-sub-menu** | 531-550 | 侧边栏菜单有品牌色渐变背景 (`linear-gradient`) 和自定义激活态样式。css-vars 不覆盖 el-menu 的激活渐变和品牌色 |
| 3 | **el-button--default** | 525-529 | 自定义 dark 模式下的默认按钮背景 `$dark-bg-hover`，样式不同于 css-vars 默认的 fill 色 |
| 4 | **[class*="panel"] / [class*="detail"] / [class*="info"]** | 607-614 | 通用通配补丁，针对第三方或自定义面板。css-vars 无法控制非 Element Plus 组件的样式 |
| 5 | **内联样式强制覆盖** | 617-626 | `[style*="background: #fff"]` 等强制覆盖内联白块的补丁。css-vars 无法影响内联样式 |
| 6 | **边框线强制覆盖** | 629-637 | `[style*="border-bottom: 1px solid #F0"]` 等强制覆盖内联亮边框的补丁 |
| 7 | **el-select-dropdown__item / el-picker-panel__content** | 650-652 | 虽 css-vars 可覆盖，但这里与上面的弹窗补丁绑定。实际可删（归类到 3.1），但建议 Phase 2 确认 |
| 8 | **html.dark body** (基础样式) | 442-445 | 全局 body 背景/文字色，不在 Element Plus 组件域内 |
| 9 | **滚动条** | 448-462 | Element Plus 不覆盖滚动条样式 |
| 10 | **el-scrollbar__wrap** | 598-600 | 透明背景设置，css-vars 未覆盖 |
| 11 | **el-tag--info** | 570-573 | 自定义语义标签的颜色（品牌色半透明背景） |

### 3.3 当前无覆盖（index.scss 未补丁，css-vars.css 也未显式覆盖）

以下组件在暗黑模式下可能存在样式问题，需后续观察：

| # | 组件 | 说明 |
|---|------|------|
| 1 | **el-empty** | css-vars 仅覆盖了 SVG 填充色（`--el-empty-fill-color-*`），但组件布局背景未覆盖。若使用 `el-empty`，背景可能偏白 |
| 2 | **el-tabs** | 无任何暗黑覆盖。tab 头和内容区域可能显示为白色背景 |
| 3 | **el-rate** | 无任何暗黑覆盖。星星颜色可能在深色背景下不清晰 |
| 4 | **el-progress** | 无任何暗黑覆盖。进度条轨迹可能在深色背景下不可见 |
| 5 | **el-collapse** / **el-collapse-item** | 无任何暗黑覆盖 |
| 6 | **el-checkbox** / **el-radio** | 无显式覆盖。但可能通过 CSS 变量 `--el-text-color-primary` / `--el-border-color` 级联解决 |
| 7 | **el-slider** | 无暗黑覆盖 |
| 8 | **el-steps** | 无暗黑覆盖 |
| 9 | **el-badge** | 无暗黑覆盖 |
| 10 | **el-cascader** | 无专门覆盖。下拉面板归入 `el-select-dropdown`（有补丁），但输入框部分无覆盖 |
| 11 | **el-transfer** | 无暗黑覆盖 |
| 12 | **el-calendar** | 无暗黑覆盖 |
| 13 | **el-result** | 无暗黑覆盖 |
| 14 | **el-tree** | 无专门覆盖，但可能通过通用变量级联 |

---

## 4. css-vars.css 提供的额外覆盖（当前手动补丁未覆盖的）

导入 css-vars.css 后会带来额外收益：

| 特性 | css-vars 提供 | 当前手动补丁 |
|------|-------------|-------------|
| el-empty SVG 填充色 | 10 级灰度变量 | 无 |
| el-button disabled 文字色 | `--el-button-disabled-text-color` | 无 |
| 阴影变量 | 4 级 box-shadow | 无 |
| 语义色渐变变体 (success/warning/danger/info light-x) | 每色 5 级变体 + dark-2 | 无 |
| 遮罩层颜色 | `--el-mask-color` | 无 |

---

## 5. 其他文件中的 html.dark 样式（不在 index.scss 内）

除 `index.scss` 外，以下文件也有 `html.dark` 块，均涉及布局和自定义组件，**不受 css-vars.css 影响**，无需处理：

| 文件 | 覆盖内容 |
|------|---------|
| `App.vue` (118-133) | 全局报错页面暗黑背景 |
| `Layout/index.vue` (95-113) | 侧边栏、内容区、头部、标签栏暗黑背景 |
| `Layout/lay-sidebar/index.vue` (327-376) | 侧边栏 logo 区、菜单项、激活态 |
| `Layout/lay-navbar/index.vue` (210-244) | 导航栏按钮、用户信息文字 |
| `Layout/lay-tags/index.vue` (187+) | 标签栏背景 |
| `Layout/lay-panel/index.vue` (128+) | 右侧面板背景 |
| `Layout/lay-setting/index.vue` (683+) | 设置面板内容和组件 |

---

## 6. 后续 Phase 2 建议

### 立即引入
```typescript
// main.ts 中，在 element-plus/dist/index.css 之后添加
import 'element-plus/theme-chalk/dark/css-vars.css'
```

### 可以安全删除的补丁（引入 css-vars.css 后）
建议按以下优先级删除，每次删除后验证：

1. **第一梯队（完全由 css-vars 接管）**：
   - `el-table` (479-505) — 全部移除
   - `el-dialog` (507-516) — 全部移除
   - `el-card` (465-468) — 全部移除
   - `el-switch` (576-583) — 全部移除
   - `el-breadcrumb` (586-593) — 全部移除
   - `el-avatar` (594-597) — 全部移除

2. **第二梯队（css-vars 级联覆盖）**：
   - `el-input__wrapper` (470-477) — 全部移除
   - `el-tag` (565-574) — 全部移除
   - `el-dropdown-menu` (552-563) — 全部移除

3. **第三梯队（弹窗/选择器组的强制覆盖）**：
   - 单独覆盖的 `.el-select-dropdown`, `.el-picker-panel`, `.el-message-box`, `.el-popover` (640-648)
   - `.el-select-dropdown__item`, `.el-picker-panel__content` (650-652)
   - `.el-form-item__label`, `.el-descriptions` (656-661)

### 必须保留的补丁
- `el-button--primary` (519-523) — 品牌色保留
- `el-button--default` (525-529) — 自定义暗黑默认按钮样式
- `el-menu` 相关 (531-550) — 品牌色 + 渐变激活态
- `el-tag--info` (570-573) — 品牌色语义标签
- `[class*="panel"]` 等通配补丁 (607-614) — 第三方组件防御
- 内联样式强制覆盖 (617-637) — 防御性补丁
- 基础 body 样式 (442-445)
- 滚动条样式 (448-462)
- 所有 `Layout/*.vue` 中的 `html.dark` 块 — 自定义布局组件

### 引入后需测试的组件
引入 css-vars.css 后，建议手动复核以下组件在暗黑模式下的表现：
- `el-empty` — 检查 SVG 颜色
- `el-tabs` — 检查背景是否出现白块
- `el-rate` — 检查星星颜色
- `el-tree` — 检查节点背景
- `el-calendar` — 检查日期单元格
