import request from '@/utils/request'
import type {
  Marketplace,
  ShopProfileSummary,
  ShopProfileDetail,
  ShopProfileProduct,
  ShopProfileCategory,
  ShopProfilePositioningResult,
  ShopProfileComputeResult,
  ShopProfilePositioningComputeResult,
  ShopProfileBaseline,
  ShopProfileBaselineMember,
  ShopProfileSummaryParams,
  ShopProfileProductsParams,
  ShopProfilePositioningParams,
  SalesTier
} from '@/types/shopProfile'

const BASE = '/api/v1/shop-profile'

/** 后端 PageResult<T> 结构 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  totalPages: number
}

/**
 * 解包 Result<T>。request.ts 拦截器把整个 {code,message,data} 透传下来，
 * 业务错误（如未建表/未物化）也会带 code!==200 + message。这里主动抛出，
 * 让页面 catch 能拿到后端 message 做精确提示。
 */
function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => {
    if (res && typeof res === 'object' && 'code' in res && res.code !== 200) {
      throw new Error(res.message || '请求失败')
    }
    return (res?.data ?? res) as T
  })
}

/** 前端兜底校验：marketplace 只允许 UK/DE/US，禁止 ALL */
function assertMarketplace(m: string): asserts m is Marketplace {
  if (m !== 'UK' && m !== 'DE' && m !== 'US') {
    throw new Error(`非法 marketplace：${m}，只支持 UK / DE / US`)
  }
}

/** sellerName 走 path 参数，必须 encode（可能含空格、GmbH.、斜杠等） */
function encodeSeller(sellerName: string): string {
  return encodeURIComponent(sellerName)
}

export const shopProfileApi = {
  /** 实时聚合的店铺画像列表 */
  summary(params: ShopProfileSummaryParams): Promise<ShopProfileSummary[]> {
    assertMarketplace(params.marketplace)
    return unwrap<ShopProfileSummary[]>(
      request({ url: `${BASE}/summary`, method: 'get', params })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 物化快照读取（compute 之后） */
  snapshots(params: ShopProfileSummaryParams): Promise<ShopProfileSummary[]> {
    assertMarketplace(params.marketplace)
    return unwrap<ShopProfileSummary[]>(
      request({ url: `${BASE}/snapshots`, method: 'get', params })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 物化店铺画像（写操作，需二次确认） */
  compute(params: { marketplace: Marketplace; batchDate?: string }): Promise<ShopProfileComputeResult> {
    assertMarketplace(params.marketplace)
    return unwrap<ShopProfileComputeResult>(
      request({ url: `${BASE}/compute`, method: 'post', params, timeout: 300000 })
    )
  },

  /** 单店画像详情（摘要 + 类目结构） */
  detail(
    marketplace: Marketplace,
    sellerName: string,
    params?: { batchDate?: string }
  ): Promise<ShopProfileDetail> {
    assertMarketplace(marketplace)
    return unwrap<ShopProfileDetail>(
      request({ url: `${BASE}/${marketplace}/${encodeSeller(sellerName)}`, method: 'get', params })
    )
  },

  /** 单店商品明细（分页） */
  products(
    marketplace: Marketplace,
    sellerName: string,
    params: ShopProfileProductsParams
  ): Promise<PageResult<ShopProfileProduct>> {
    assertMarketplace(marketplace)
    return unwrap<PageResult<ShopProfileProduct>>(
      request({ url: `${BASE}/${marketplace}/${encodeSeller(sellerName)}/products`, method: 'get', params })
    )
  },

  /** 单店类目结构 */
  categories(
    marketplace: Marketplace,
    sellerName: string,
    params?: { batchDate?: string; salesTier?: SalesTier }
  ): Promise<ShopProfileCategory[]> {
    assertMarketplace(marketplace)
    return unwrap<ShopProfileCategory[]>(
      request({ url: `${BASE}/${marketplace}/${encodeSeller(sellerName)}/categories`, method: 'get', params })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 基线定位列表 */
  positioning(params: ShopProfilePositioningParams): Promise<ShopProfilePositioningResult[]> {
    assertMarketplace(params.marketplace)
    return unwrap<ShopProfilePositioningResult[]>(
      request({ url: `${BASE}/positioning`, method: 'get', params })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 物化基线定位（写操作，需二次确认） */
  computePositioning(params: {
    baselineCode: string
    marketplace: Marketplace
    batchDate?: string
  }): Promise<ShopProfilePositioningComputeResult> {
    assertMarketplace(params.marketplace)
    return unwrap<ShopProfilePositioningComputeResult>(
      request({ url: `${BASE}/positioning/compute`, method: 'post', params, timeout: 300000 })
    )
  },

  /** 单店对指定基线的定位详情 */
  positioningDetail(
    marketplace: Marketplace,
    sellerName: string,
    params: { baselineCode: string; batchDate?: string }
  ): Promise<ShopProfilePositioningResult> {
    assertMarketplace(marketplace)
    return unwrap<ShopProfilePositioningResult>(
      request({ url: `${BASE}/${marketplace}/${encodeSeller(sellerName)}/positioning`, method: 'get', params })
    )
  }
}

export const shopProfileBaselineApi = {
  /** 基线列表 */
  list(params?: { baselineType?: string; status?: string }): Promise<ShopProfileBaseline[]> {
    return unwrap<ShopProfileBaseline[]>(
      request({ url: `${BASE}/baselines`, method: 'get', params })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 创建基线 */
  create(data: ShopProfileBaseline): Promise<ShopProfileBaseline> {
    return unwrap<ShopProfileBaseline>(
      request({ url: `${BASE}/baselines`, method: 'post', data })
    )
  },

  /** 更新基线 */
  update(id: number, data: ShopProfileBaseline): Promise<ShopProfileBaseline> {
    return unwrap<ShopProfileBaseline>(
      request({ url: `${BASE}/baselines/${id}`, method: 'put', data })
    )
  },

  /** 基线成员列表 */
  members(
    baselineCode: string,
    params?: { marketplace?: Marketplace }
  ): Promise<ShopProfileBaselineMember[]> {
    return unwrap<ShopProfileBaselineMember[]>(
      request({ url: `${BASE}/baselines/${encodeURIComponent(baselineCode)}/members`, method: 'get', params })
    ).then((d) => (Array.isArray(d) ? d : []))
  },

  /** 新增基线成员 */
  addMember(
    baselineCode: string,
    data: ShopProfileBaselineMember
  ): Promise<ShopProfileBaselineMember> {
    return unwrap<ShopProfileBaselineMember>(
      request({ url: `${BASE}/baselines/${encodeURIComponent(baselineCode)}/members`, method: 'post', data })
    )
  },

  /** 删除基线成员（需二次确认） */
  deleteMember(id: number): Promise<void> {
    return unwrap<void>(
      request({ url: `${BASE}/baselines/members/${id}`, method: 'delete' })
    )
  }
}

export default shopProfileApi
