# T1: SelectionQueryForm/types.ts — 添加新字段

修改文件: frontend/src/components/SelectionQueryForm/types.ts

在 SelectionQueryParams 接口新增:
- month: string (月份，格式 "2026-05")
- priceMin: number | null
- priceMax: number | null
- unitsMin: number | null
- unitsMax: number | null
- listingDaysMin: number | null
- listingDaysMax: number | null
- bsrMax: number | null
- weightMax: number | null
- variantCountMax: number | null
- fulfillment: string[] (配送方式多选)

在 defaultQueryParams 补默认值: 所有 number 为 null, fulfillment 为 []。
