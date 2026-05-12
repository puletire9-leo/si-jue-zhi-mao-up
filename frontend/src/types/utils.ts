import type { ProductType } from './product'

export type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

export const getProductTypeTag = (type: ProductType | string): TagType => {
  const typeMap: Record<string, TagType> = {
    '普通产品': 'info',
    '组合产品': 'success',
    '定制产品': 'warning'
  }
  return typeMap[type] || 'info'
}
