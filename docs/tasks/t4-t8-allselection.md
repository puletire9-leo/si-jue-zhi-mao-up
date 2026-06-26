# T2+T4+T5+T6+T7+T8: AllSelection/index.vue 全面改造

## T2: 顶部标签组
SelectionQueryForm 上方插入 .sjl-tag-bar，包含:
- 站点 radio-group (UK/US/DE)
- 月份 radio-group (最近12个月 + 头项"最近30天" value="")
- 类目多选下拉 el-select multiple

script 加 monthOptions computed。

## T4: 独立参数接线
buildApiParams filterFields 加 "month"
FILTER_TO_API_KEY 加 month -> month

loadProducts 中 competitorParams 合并 rangeFilterData:
- priceMin/priceMax/bsrMax/weightMax
- variantCountMax
- fulfillment (数组非空才传)

删除旧 variant-filter-bar 中的变体数输入框(保留置顶开关)
删除 maxVariantCount ref 和 handleMaxVariantCountChange

## T5: qualifyRules 翻译合并
buildRangeRule(qp) 把 unitsMin/Max, listingDaysMin/Max 译成 RuleCondition
新品榜: 区间条件 AND 进每条 OR 规则
其他 tab: 区间单独成一条 OR 规则

## T6: 月份接线
createdWeek 默认注入改为 if (!competitorParams.month && ...) 才注入
选具体月份跳过 createdWeek

## T7: 预设兼容
handlePresetApply 对缺失区间字段补 null/default

## T8: 样式
.sjl-tag-bar 样式 + 暗黑模式适配
filterDialog 精简
