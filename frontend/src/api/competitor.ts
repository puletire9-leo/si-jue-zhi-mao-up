import request from '@/utils/request'
import type { ApiResponse } from '@/types/api'

export interface CompetitorProductRaw {
  // 基础字段
  marketplace?: string
  asin: string
  month?: string
  title?: string
  brand?: string
  brandUrl?: string
  imageUrl?: string
  parentAsin?: string
  sku?: string
  nodeId?: number
  nodeIdPath?: string
  nodeLabelPath?: string
  symbol?: string

  // 销量/收入
  units?: number
  unitsGr?: number
  amzUnit?: number
  amzSales?: number
  revenue?: number

  // BSR
  bsrId?: string
  bsr?: number
  bsrCr?: number
  bsrCv?: number

  // 评分
  ratings?: number
  rating?: number
  ratingsRate?: number
  ratingsCv?: number
  ratingDelta?: number

  // 价格
  price?: number
  primePrice?: number
  profit?: number
  fba?: number

  // 卖家
  sellerName?: string
  sellerId?: string
  sellerNation?: string
  sellers?: number

  // 配送
  fulfillment?: string
  variations?: number
  weight?: string
  dimension?: string

  // 状态
  bestSeller?: string
  amazonChoice?: string
  newRelease?: string
  ebc?: string
  video?: string

  // 评分
  score?: number
  grade?: string
  weekTag?: string
  isCurrent?: number

  // 衍生字段
  filterMode?: string
  filterReasons?: string
  listingDays?: number
  weightG?: number
  productUrl?: string
  similarUrl?: string
  source?: string
  shopLink?: string
  availableDate?: string

  // 子类目
  subcategories?: Array<{
    code: string
    rank: number
    label: string
  }>
}

export interface CompetitorListParams {
  marketplace?: string
  month?: string
  asin?: string[]
  source?: string
  filterMode?: string
  brand?: string
  sellerName?: string
  title?: string
  category?: string
  grade?: string
  weekTag?: string
  isCurrent?: number
  sortBy?: string
  sortOrder?: string
  page?: number
  size?: number
  groupByParent?: boolean
  maxVariantCount?: number
}

export interface CompetitorListResponse {
  list: Record<string, any>[]
  total: number
  page: number
  size: number
}

/**
 * 将 Java 竞品数据转换为前端统一格式（同时提供新旧两种字段名）
 */
export function normalizeProduct(raw: CompetitorProductRaw): Record<string, any> {
  const result: Record<string, any> = {
    ...raw,
    // 基础字段（始终设置）
    id: raw.id ?? raw.asin,
    productType: getProductType(raw.source || ''),
  }
  // 仅在有值时设置别名字段，避免空字符串覆盖原始字段导致 fallback 链断裂
  if (raw.title) result.productTitle = raw.title
  if (raw.sellerName) result.storeName = raw.sellerName
  if (raw.shopLink) result.storeUrl = raw.shopLink
  if (raw.units != null) result.salesVolume = raw.units
  if (raw.productUrl) result.productLink = raw.productUrl
  if (raw.similarUrl) result.similarProducts = raw.similarUrl
  if (raw.filterMode) result.dataFilterMode = raw.filterMode
  if (raw.availableDate) result.listingDate = raw.availableDate
  if (raw.variantCount != null) result.variantCount = raw.variantCount
  return result
}

function getProductType(source: string): 'new' | 'reference' | 'zheng' | '' {
  if (!source) return ''
  if (source.includes('新品')) return 'new'
  if (source.includes('竞品')) return 'reference'
  if (source.includes('郑总') || source.includes('店铺上新')) return 'zheng'
  return ''
}

export const competitorApi = {
  getVariants(marketplace: string, parentAsin: string): Promise<ApiResponse<any[]>> {
    return request({
      url: '/api/v1/competitor/variants',
      method: 'get',
      params: { marketplace, parentAsin }
    })
  },

  getList(params: CompetitorListParams): Promise<ApiResponse<CompetitorListResponse>> {
    return request({
      url: '/api/v1/competitor/products',
      method: 'get',
      params
    }).then((res: any) => {
      if (res.data?.list) {
        res.data.list = res.data.list.map(normalizeProduct)
      }
      return res
    })
  },

  getDetail(asin: string, marketplace: string = 'UK'): Promise<ApiResponse<CompetitorProductRaw[]>> {
    return request({
      url: `/api/v1/competitor/${asin}/history`,
      method: 'get',
      params: { marketplace }
    })
  },

  lookup(data: any): Promise<ApiResponse<CompetitorProductRaw[]>> {
    return request({
      url: '/api/v1/competitor/lookup',
      method: 'post',
      data
    })
  },

  getQuota(): Promise<any> {
    return request({ url: '/api/v1/competitor/quota', method: 'get' })
  },

  updateQuota(data: Record<string, number>): Promise<any> {
    return request({ url: '/api/v1/competitor/quota', method: 'put', data })
  },

  // 精筛配置
  getFilterConfig(): Promise<any> {
    return request({ url: '/api/v1/filter-config', method: 'get' })
  },

  updateFilterConfig(data: Record<string, number>, marketplace = 'UK', dataMonth?: string): Promise<any> {
    // 如果未传 dataMonth，使用当前年月
    if (!dataMonth) {
      const now = new Date()
      dataMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    }
    return request({ url: '/api/v1/filter-config', method: 'put', params: { marketplace, dataMonth }, data })
  },

  // 初筛配置
  getInitialFilterConfig(): Promise<any> {
    return request({ url: '/api/v1/filter-config/initial', method: 'get' })
  },

  updateInitialFilterConfig(data: Record<string, number>): Promise<any> {
    return request({ url: '/api/v1/filter-config/initial', method: 'put', data })
  },

  // 邓总店铺
  getDengZongShopList(params: Record<string, any>): Promise<any> {
    return request({ url: '/api/v1/deng-zong-shop/products', method: 'get', params })
  },

  // 邓总店铺卖家
  getDengZongShopSellers(params?: { marketplace?: string }): Promise<any> {
    return request({ url: '/api/v1/deng-zong-shop/sellers', method: 'get', params })
  },
  getDengZongShopSellerSummary(params?: { marketplace?: string }): Promise<any> {
    return request({ url: '/api/v1/deng-zong-shop/seller-summary', method: 'get', params })
  },
  createDengZongShopSeller(data: Record<string, any>): Promise<any> {
    return request({ url: '/api/v1/deng-zong-shop/sellers', method: 'post', data })
  },
  updateDengZongShopSeller(id: number, data: Record<string, any>): Promise<any> {
    return request({ url: `/api/v1/deng-zong-shop/sellers/${id}`, method: 'put', data })
  },
  deleteDengZongShopSeller(id: number): Promise<any> {
    return request({ url: `/api/v1/deng-zong-shop/sellers/${id}`, method: 'delete' })
  },
  syncDengZongShop(data: { sellerName: string; marketplace: string }): Promise<any> {
    return request({ url: '/api/v1/deng-zong-shop/sync', method: 'post', data, timeout: 120000 })
  },
  getDengZongVariants(marketplace: string, parentAsin: string): Promise<any> {
    return request({ url: '/api/v1/deng-zong-shop/variants', method: 'get', params: { marketplace, parentAsin } })
  },
}

