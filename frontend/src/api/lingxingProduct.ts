import request from '@/utils/request'

/** 领星本地产品（后端 lingxing_local_product 的映射） */
export interface LingxingLocalProduct {
  id: number
  lingxingId: number
  sku: string | null
  skuIdentifier: string | null
  productName: string | null
  cid: number | null
  categoryName: string | null
  bid: number | null
  brandName: string | null
  picUrl: string | null
  psId: number | null
  spu: string | null
  cgPrice: string | null
  cgDelivery: number | null
  cgTransportCosts: string | null
  purchaseRemark: string | null
  status: number | null
  statusText: string | null
  openStatus: number | null
  isCombo: number | null
  productDeveloperUid: string | null
  productDeveloper: string | null
  cgOptUid: string | null
  cgOptUsername: string | null
  lxCreateTime: string | null
  lxUpdateTime: string | null
  syncedAt: string | null
}

/** MyBatis-Plus 分页响应 */
export interface MpPage<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

/** 领星亚马逊店铺（后端 lingxing_seller 的映射） */
export interface LingxingSeller {
  id: number
  sid: number
  mid: number | null
  name: string | null
  sellerId: string | null
  accountName: string | null
  sellerAccountId: number | null
  region: string | null
  country: string | null
  hasAdsSetting: number | null
  marketplaceId: string | null
  status: number | null
  syncedAt: string | null
}

/** 本地产品同步结果统计 */
export interface SyncResult {
  pages: number
  fetched: number
  upserted: number
}

/** 添加/编辑本地产品结果 */
export interface SetProductResult {
  product_id: number
  sku: string
  sku_identifier: string
  resynced: number
}

/** 店铺同步结果统计 */
export interface SellerSyncResult {
  fetched: number
  upserted: number
}

/** 报表类同步结果统计（产品表现/利润） */
export interface ReportSyncResult {
  pages: number
  fetched: number
  upserted: number
}

/** 领星产品表现（结构化关键列，完整字段见后端 raw_json） */
export interface LingxingProductPerformance {
  id: number
  bizKey: string
  summaryField: string | null
  summaryValue: string | null
  sidScope: string | null
  asin: string | null
  parentAsin: string | null
  msku: string | null
  sku: string | null
  itemName: string | null
  currencyCode: string | null
  startDate: string | null
  endDate: string | null
  volume: number | null
  orderItems: number | null
  amount: string | null
  grossProfit: string | null
  grossMargin: string | null
  sessionsTotal: number | null
  spend: string | null
  tacos: string | null
  syncedAt: string | null
}

/** 领星利润统计-ASIN（结构化关键列，完整字段见后端 raw_json） */
export interface LingxingProfitAsin {
  id: number
  bizKey: string
  asin: string | null
  parentAsin: string | null
  sid: string | null
  storeName: string | null
  dataDate: string | null
  countryCode: string | null
  localSku: string | null
  localName: string | null
  itemName: string | null
  currencyCode: string | null
  totalSalesQuantity: number | null
  totalSalesAmount: string | null
  totalAdsCost: string | null
  cgPrice: string | null
  cgTransportCosts: string | null
  totalCost: string | null
  grossProfit: string | null
  grossRate: string | null
  syncedAt: string | null
}

/** 产品表现同步入参 */
export interface PerformanceSyncPayload {
  sids: number[]
  startDate: string
  endDate: string
  summaryField?: string
  currencyCode?: string
}

/** 利润同步入参 */
export interface ProfitSyncPayload {
  sids?: number[]
  startDate: string
  endDate: string
  currencyCode?: string
}

/** Result<T> 包装解包：拦截器返回整个 {code,message,data}，业务层只需 data */
function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => res?.data as T)
}

export const lingxingProductApi = {
  /** 手动触发：全量同步领星本地产品到库（分页拉取 + 幂等 upsert，可能耗时数分钟） */
  syncLocalProducts(): Promise<SyncResult> {
    return unwrap<SyncResult>(
      request({
        url: '/api/v1/modules/lingxing/local-products/sync',
        method: 'post',
        // 分页拉取 + 翻页限流，放大超时到 10 分钟
        timeout: 600000
      })
    )
  },

  /** 分页查询已落库的领星本地产品 */
  listLocalProducts(
    current = 1,
    size = 20,
    sku?: string
  ): Promise<MpPage<LingxingLocalProduct>> {
    return unwrap<MpPage<LingxingLocalProduct>>(
      request({
        url: '/api/v1/modules/lingxing/local-products',
        method: 'get',
        params: { current, size, ...(sku ? { sku } : {}) }
      })
    )
  },

  /**
   * 添加/编辑本地产品（写回领星）。body 按领星 productSet 文档组织，至少含 sku；
   * 新增时还需 product_name。返回 {product_id, sku, sku_identifier, resynced}。
   */
  setLocalProduct(body: Record<string, any>): Promise<SetProductResult> {
    return unwrap<SetProductResult>(
      request({
        url: '/api/v1/modules/lingxing/local-products/set',
        method: 'post',
        data: body,
        timeout: 60000
      })
    )
  },

  /** 上传本地产品图片（写回领星）。picture_list: [{pic_url, is_primary}] */
  uploadLocalProductPictures(
    sku: string,
    pictureList: Array<{ pic_url: string; is_primary: number }>
  ): Promise<any> {
    return unwrap<any>(
      request({
        url: '/api/v1/modules/lingxing/local-products/upload-pictures',
        method: 'post',
        data: { sku, picture_list: pictureList },
        timeout: 60000
      })
    )
  },

  /** 手动触发：同步领星亚马逊店铺列表（sid 来源，一次性返回全部授权店铺） */
  syncSellers(): Promise<SellerSyncResult> {
    return unwrap<SellerSyncResult>(
      request({
        url: '/api/v1/modules/lingxing/sellers/sync',
        method: 'post'
      })
    )
  },

  /** 查询已落库的领星店铺（可按 status 过滤，1=正常） */
  listSellers(status?: number): Promise<LingxingSeller[]> {
    return unwrap<LingxingSeller[]>(
      request({
        url: '/api/v1/modules/lingxing/sellers',
        method: 'get',
        params: status != null ? { status } : {}
      })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 手动触发：按店铺+时间窗(≤92天)同步产品表现 */
  syncProductPerformance(payload: PerformanceSyncPayload): Promise<ReportSyncResult> {
    return unwrap<ReportSyncResult>(
      request({
        url: '/api/v1/modules/lingxing/product-performance/sync',
        method: 'post',
        data: payload,
        timeout: 600000
      })
    )
  },

  /** 分页查询已落库的产品表现 */
  listProductPerformance(
    current = 1,
    size = 20,
    asin?: string
  ): Promise<MpPage<LingxingProductPerformance>> {
    return unwrap<MpPage<LingxingProductPerformance>>(
      request({
        url: '/api/v1/modules/lingxing/product-performance',
        method: 'get',
        params: { current, size, ...(asin ? { asin } : {}) }
      })
    )
  },

  /** 手动触发：按店铺+时间窗(≤7天)同步利润统计-ASIN */
  syncProfitAsin(payload: ProfitSyncPayload): Promise<ReportSyncResult> {
    return unwrap<ReportSyncResult>(
      request({
        url: '/api/v1/modules/lingxing/profit-asin/sync',
        method: 'post',
        data: payload,
        timeout: 600000
      })
    )
  },

  /** 分页查询已落库的利润统计-ASIN */
  listProfitAsin(
    current = 1,
    size = 20,
    asin?: string
  ): Promise<MpPage<LingxingProfitAsin>> {
    return unwrap<MpPage<LingxingProfitAsin>>(
      request({
        url: '/api/v1/modules/lingxing/profit-asin',
        method: 'get',
        params: { current, size, ...(asin ? { asin } : {}) }
      })
    )
  }
}

export default lingxingProductApi
