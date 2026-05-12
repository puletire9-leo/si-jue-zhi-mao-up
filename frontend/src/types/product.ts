export interface Product {
  sku: string
  name: string
  type: ProductType
  image?: string
  localPath?: string
  thumbPath?: string
  description?: string
  price?: number
  stock?: number
  category?: string
  tags?: string[]
  developer?: string
  includedItems?: string
  createdAt?: string
  updatedAt?: string
  delete_time?: string
}

export type ProductType = '普通产品' | '组合产品' | '定制产品'

export interface ProductListParams {
  page: number
  size: number
  sku?: string
  name?: string
  type?: ProductType
  category?: string
}

export interface ProductListResponse {
  list: Product[]
  total: number
  page: number
  size: number
}

export interface ProductFormData {
  sku: string
  name: string
  type: ProductType
  description?: string
  image?: string
  price?: number
  stock?: number
  category?: string
  tags?: string[]
}
