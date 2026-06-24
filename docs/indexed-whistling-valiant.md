# 选品查询表单 → 卖家精灵风格筛选面板

## Context

总选品页的查询表单 `SelectionQueryForm` 当前是「紧凑搜索栏 + 两个 dialog」结构,筛选能力分散、不直观。用户提供了卖家精灵风格的面板截图(`docs/PixPin_2026-06-17_23-54-30.png`)作为视觉参考,要求照抄其结构和样式:顶部横向标签按钮组(站点/月份/类目)+ 下方三栏 min~max 区间筛选区(每栏橙色圆点标题)。

截图约 25 个字段,但后端 `competitor_products` 当前真正能查的有限。已与用户对齐:**照抄视觉样式,字段只放后端能查的**,不画死控件。两个接口点已拍板:
- **月份**:选具体月份按 `month` 数据月列查,选「最近30天」走现有 createdWeek 批次周逻辑(两态互斥)。
- **配送方式 AMZ/FBA/FBM**:后端新增 `fulfillment` 查询参数,前端勾选真正生效。

目标:总选品页筛选面板视觉升级为卖家精灵风格,新增价格/销量/上架天数/变体数/BSR/重量区间 + 配送方式 + 月份筛选,且保留现有全部功能(紧凑搜索、多项精确搜索、以图搜图、排序、预设保存、grade/weekTag)。

## 主题色 / 复用

- 主题色 `$primary-color: #b45309`(琥珀色)已在 `frontend/src/styles/variables.scss` — 正好是截图的橙色圆点色。新样式 `@use "@/styles/variables.scss" as *;`。
- 标签按钮组复用 `el-radio-group + el-radio-button`(项目已用,如 isCurrent)。
- 区间面板**新建展示组件**,借用 `QualifyRuleFilter` 的 SCSS 调性(橙点/问号/虚线),不直接复用其规则器逻辑(语义不符)。

## 字段 → API 参数映射

| 前端 formData | 走法 | API 参数 | 后端现状 |
|---|---|---|---|
| country | 独立 | marketplace | ✅ |
| month | 独立(新接) | month | ✅ 列已存在,需调 createdWeek 注入条件 |
| category | 独立 | category | ✅ |
| priceMin/priceMax | 独立 | priceMin/priceMax | ✅ 完整 |
| variantCountMax | 独立 | maxVariantCount | ✅ 仅上限 |
| bsrMax | 独立 | bsrMax | ✅ 仅上限 |
| weightMax | 独立 | weightMax | ✅ 仅上限 |
| unitsMin/unitsMax | 翻译 qualifyRules | units ge/le | ✅ qualifyRules |
| listingDaysMin/Max | 翻译 qualifyRules | listingDays ge/le | ✅ qualifyRules |
| fulfillment[] | 独立(新接) | fulfillment | ❌ **后端需新增参数+Mapper过滤** |

独立参数空值判断:`buildApiParams` 已跳过 null,`0` 通过(价格下限 0 有效)。

## 实施清单(每步 type-check + build 验证)

验证命令(宿主机,禁 Docker 内构建):`cd frontend && npm run type-check && npm run build`

### 前端

- **T1 类型打底**:`SelectionQueryForm/types.ts` — `SelectionQueryParams` 加 month/priceMin/priceMax/unitsMin/unitsMax/listingDaysMin/listingDaysMax/bsrMax/weightMax/variantCountMax/fulfillment;数值用 `number | null`,fulfillment 用 `string[]`;`defaultQueryParams` 补默认。

- **T2 顶部标签组**:`SelectionQueryForm/index.vue` 加 `monthOptions` computed(客户端生成最近12月 + 「最近30天」头项 value='')+ `sjl-tag-bar` template(站点/月份用 radio-button,类目保留多选下拉)+ 高亮态样式(is-active 映射 $primary-color)。

- **T3 RangeFilterPanel 组件**:新建 `frontend/src/components/RangeFilterPanel/index.vue` — 纯展示 + v-model,三栏布局,每栏橙点标题,字段含成对 min~max 输入(价格/销量/上架天数)+ 单上限框(变体/BSR/重量)+ 配送方式 AMZ/FBA/FBM 多选 + 问号 tooltip + 货币后缀(按 country 映射 $/£/€)。响应式 <992px 塌单栏。

- **T4 独立参数接线**:`AllSelection/index.vue` — `filterFields` 加 month/priceMin/priceMax/bsrMax/weightMax/variantCountMax;`FILTER_TO_API_KEY` 加 `variantCountMax→maxVariantCount`;收编现有工具条里的 maxVariantCount ref(删行 143-166 输入框,保留 groupByParent)。

- **T5 qualifyRules 翻译合并**:`AllSelection` 加 `buildRangeRule(qp)` 把 unitsMin/Max、listingDaysMin/Max 译成 RuleCondition;改 `loadProducts` 合并逻辑——新品榜 tab 把区间 AND 进每条 OR 规则,其它 tab 区间单独成一条规则。

- **T6 月份接线**:formData.month 映射到 month 参数;调整 createdWeek 默认注入为 `if (!competitorParams.month) { ...createdWeek... }`,使「选月份」与「最近30天」互斥。

- **T7 预设兼容**:`setQueryParams`/`handlePresetApply` 对缺失区间字段显式补 null,防止切换老预设串值。

- **T8 布局收尾**:filterDialog 精简(次级项 grade/isCurrent/排序 保留 dialog),紧凑搜索/多项精确搜索/以图搜图原样保留;暗黑模式变量适配;四 tab(all/new/reference/zheng)回归。

### 后端(配送方式查询参数)

- **T9 fulfillment 查询参数**:
  - `CompetitorQueryRequest.java` / `CompetitorListParams`(前端 competitor.ts)加 `fulfillment` 字段(List<String> 或逗号字符串)。
  - `CompetitorProductMapper.java` 主查询 + 分组查询加 `<if> AND cp.fulfillment IN (...)` 过滤。
  - `CompetitorService.queryFromDb` 透传参数。
  - 验证:勾选 FBM/FBA 后 POST body 带 fulfillment,结果只含对应配送方式。

## 风险点

1. **月份 vs createdWeek 叠加**:选具体月份必须跳过 createdWeek 默认注入,否则查空。T6 重点测三态(选月/最近30天/默认)。
2. **maxVariantCount 仅上限**:UI 做单框,不画 min~max 对;收编旧工具条避免两处都能改、互相覆盖。
3. **qualifyRules AND 合并**:新品榜 OR 规则 + 区间 AND,合并不当导致条数暴增/暴减。按「区间 AND 进每条规则」实测验证。
4. **预设串值**:老预设无新字段,Object.assign 不重置 → 切预设残留上次值。T7 显式补 null。
5. **fulfillment 后端改动**:T9 涉及 DTO + Mapper,与前端 PR 可分离;前端勾选先做,后端参数到位后联调。

## 验证(端到端)

1. 前端:`cd frontend && npm run type-check && npm run build` 全绿。
2. 启 dev server,总选品页:
   - 站点/月份/类目标签切换高亮正常,点击即筛。
   - 价格/销量/上架天数 min~max、变体/BSR/重量上限填入 → 看 console 打印 competitorParams,独立参数 + qualifyRules 正确。
   - 配送方式勾选 FBM/FBA → 结果只含对应配送。
   - 月份选 2026-05 / 最近30天 / 默认,数据三态正确。
   - 预设:存带区间预设 → 切走 → 切回,值正确;切老预设不串值。
   - 四 tab 无回归,紧凑搜索/多项精确搜索/以图搜图/排序仍可用。
