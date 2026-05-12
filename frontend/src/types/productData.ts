/**
 * 产品数据类型定义
 * 基于 product_data_202501 表结构
 */

// 产品基础数据接口
export interface ProductData {
  // 基础信息
  id?: number
  date: string
  asin: string
  parent_asin: string
  msku: string
  sku: string
  store: string
  country: string

  // 类目信息
  category_level1: string
  category_level2: string
  category_level3: string
  main_category_rank: string

  // 产品信息
  product_name: string
  brand: string

  // 人员信息
  developer: string
  responsible_person: string

  // 销售数据
  sales_volume: number
  sales_amount: number
  order_quantity: number

  // 流量数据
  sessions_total: number
  pv_total: number
  cvr: number

  // 广告数据
  ad_spend: number
  ad_sales_amount: number
  acoas: number
  roas: number
  impressions: number
  clicks: number
  ctr: number
}

// 分类统计接口
export interface CategoryStats {
  category: string
  productCount: number
  totalSalesVolume: number
  totalSalesAmount: number
  totalOrderQuantity: number
  avgAcoas: number
  avgRoas: number
  avgCvr: number
  totalAdSpend: number
  totalAdSales: number
  orderRate?: number
  growthRate?: number
}

// 视图模式
export type ViewMode = 'manager' | 'developer'

// 时间维度
export type TimeDimension = 'day' | 'week' | 'month'

// 筛选条件
export interface FilterParams {
  category?: string
  store?: string
  country?: string
  developer?: string
  startDate?: string
  endDate?: string
  searchKeyword?: string
  month?: string
  timeDimension?: TimeDimension
}

// 产品列表请求参数
export interface ProductListParams {
  page?: number
  pageSize?: number
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  filters?: FilterParams
}

// 产品列表响应
export interface ProductListResponse {
  list: ProductData[]
  total: number
  page: number
  pageSize: number
}

// 销售趋势数据
export interface TrendData {
  date: string
  category: string
  salesVolume: number
  salesAmount: number
  orderQuantity: number
  adSpend?: number
  adSales?: number
  acoas?: number
  impressions?: number
  clicks?: number
}

// TOP产品数据
export interface TopProduct {
  rank: number
  product: ProductData
  salesVolume: number
  salesAmount: number
}

// 广告表现数据
export interface AdPerformance {
  category: string
  adSpend: number
  adSales: number
  acoas: number
  roas: number
  impressions: number
  clicks: number
  ctr: number
}

// API响应格式
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// 导出参数
export interface ExportParams {
  filters?: FilterParams
  fields?: string[]
}

// 分类配置
export const CATEGORY_CONFIG = {
  'Garden': {
    name: 'Garden',
    label: 'Garden',
    color: '#52C41A',
    icon: 'Box'
  },
  'Home & Kitchen': {
    name: 'Home & Kitchen',
    label: 'Home & Kitchen',
    color: '#13C2C2',
    icon: 'House'
  },
  'DIY & Tools': {
    name: 'DIY & Tools',
    label: 'DIY & Tools',
    color: '#1890FF',
    icon: 'Tool'
  },
  'Toys & Games': {
    name: 'Toys & Games',
    label: 'Toys & Games',
    color: '#722ED1',
    icon: 'Box'
  },
  'Sports & Outdoors': {
    name: 'Sports & Outdoors',
    label: 'Sports & Outdoors',
    color: '#FAAD14',
    icon: 'Box'
  },
  'Automotive': {
    name: 'Automotive',
    label: 'Automotive',
    color: '#FA541C',
    icon: 'Box'
  },
  'Fashion': {
    name: 'Fashion',
    label: 'Fashion',
    color: '#F759AB',
    icon: 'Box'
  },
  'Beauty': {
    name: 'Beauty',
    label: 'Beauty',
    color: '#EB2F96',
    icon: 'Box'
  },
  'Pet Supplies': {
    name: 'Pet Supplies',
    label: 'Pet Supplies',
    color: '#A0D911',
    icon: 'Box'
  },
  'Stationery & Office Supplies': {
    name: 'Stationery & Office Supplies',
    label: 'Stationery & Office Supplies',
    color: '#52C41A',
    icon: 'Box'
  },
  'Health & Personal Care': {
    name: 'Health & Personal Care',
    label: 'Health & Personal Care',
    color: '#13C2C2',
    icon: 'Box'
  },
  'Business, Industry & Science': {
    name: 'Business, Industry & Science',
    label: 'Business, Industry & Science',
    color: '#1890FF',
    icon: 'Box'
  },
  'Baby Products': {
    name: 'Baby Products',
    label: 'Baby Products',
    color: '#722ED1',
    icon: 'Box'
  },
  'Grocery': {
    name: 'Grocery',
    label: 'Grocery',
    color: '#FAAD14',
    icon: 'Box'
  },
  'Lighting': {
    name: 'Lighting',
    label: 'Lighting',
    color: '#FA541C',
    icon: 'Box'
  },
  'Electronics & Photo': {
    name: 'Electronics & Photo',
    label: 'Electronics & Photo',
    color: '#F759AB',
    icon: 'Box'
  },
  'Computers & Accessories': {
    name: 'Computers & Accessories',
    label: 'Computers & Accessories',
    color: '#EB2F96',
    icon: 'Box'
  },
  'Musical Instruments & DJ': {
    name: 'Musical Instruments & DJ',
    label: 'Musical Instruments & DJ',
    color: '#A0D911',
    icon: 'Box'
  },
  'PC & Video Games': {
    name: 'PC & Video Games',
    label: 'PC & Video Games',
    color: '#52C41A',
    icon: 'Box'
  },
  'Books': {
    name: 'Books',
    label: 'Books',
    color: '#13C2C2',
    icon: 'Box'
  },
  '淘汰sku': {
    name: '淘汰sku',
    label: '淘汰sku',
    color: '#999999',
    icon: 'Box'
  }
} as const

export type CategoryKey = keyof typeof CATEGORY_CONFIG
