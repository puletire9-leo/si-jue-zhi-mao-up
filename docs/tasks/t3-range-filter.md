# T3: RangeFilterPanel 组件

创建: frontend/src/components/RangeFilterPanel/index.vue

三栏布局区间筛选面板，卖家精灵风格。
@use "@/styles/variables.scss" as *; 主题色 $primary-color: #b45309

## Props
modelValue: {
  priceMin, priceMax: number | null
  unitsMin, unitsMax: number | null
  listingDaysMin, listingDaysMax: number | null
  bsrMax: number | null
  weightMax: number | null
  variantCountMax: number | null
  fulfillment: string[]
}
country?: string (货币符号映射 UK=£ US=$ DE=€)

## Emits
update:modelValue

## 布局
三栏 flex, <992px 塌单栏。
每栏橙点标题: <span class="rfp__dot"></span> ::before 圆形8px背景 $primary-color

栏1: 价格下限 ~ 价格上限 (el-input-number, controls-position="right", 货币后缀)
栏2: 销量下限 ~ 销量上限 + 上架天数下限 ~ 上架天数上限
栏3: 变体数上限 + BSR上限 + 重量上限(g) + 配送方式(AMZ/FBA/FBM el-checkbox-group)

所有字段带 el-tooltip 问号说明。
el-input-number 的 :value-on-clear="null", :min="0"
