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
246

<system-reminder>
Contents of /mnt/f/项目/si-jue-zhi-mao-up/frontend/CLAUDE.md:

# 前端 - Claude 自动加载上下文

> Vue 3 + TypeScript + Element Plus + Vite + Pinia。详情见 [AGENTS.md](AGENTS.md)。

## 目录结构

```
frontend/src/
├── api/          # API 接口定义（20 文件）
├── components/   # 通用组件（8 个）
├── composables/  # 组合式函数
├── layouts/      # 布局组件
├── router/       # Vue Router 路由
├── stores/       # Pinia 状态管理（5 个）
├── styles/       # 全局样式 SCSS
├── types/        # TypeScript 类型（11 个）
├── utils/        # 工具函数（11 个）
└── views/        # 页面视图（27 个）
```

## 修改规则

1. 新页面放 `views/`，在 `router/index.ts` 注册
2. 新 API 放 `api/`，用 `utils/request.ts` 的 axios 实例
3. 新组件放 `components/`，PascalCase 命名
4. 新类型放 `types/`，**禁止 `any`**
5. 样式用 SCSS，变量在 `styles/variables.scss`

## 后端映射

| API 文件 | 实际后端 | 说明 |
|----------|---------|------|
| product.ts | Python | CRUD 待迁移到 Java |
| selection.ts | Python | CRUD 待迁移到 Java |
| finalDrafts.ts | Python | CRUD 待迁移到 Java |
| materialLibrary.ts | Python | 含 AI 分析，保留 Python |
| carrierLibrary.ts | Python | 待迁移到 Java |
| image.ts | Python | 核心 AI，保留 Python |
| user.ts | Java | sjzm-user，已迁移 |
| productData.ts | Python | Polars 数据处理，保留 |
| import_export.ts | Python | Excel 处理，保留 |
| report.ts | Python | 脚本生成，保留 |
| lingxing.ts | Python | COS 上传，保留 |

**Java 后端已实现的前端页面：** 登录/用户管理/竞品分析/评分/ASIN 导入/筛选预设。
**仍在 Python 的页面：** 产品管理/选品/定稿/素材库/运营商库/图片管理/导入导出/数据看板/统计/报表/领星导入。

## 构建

**生产构建禁止在 Docker 内执行。** Docker Desktop 内存不够，Vite 构建会 OOM 导致守护进程崩溃。在宿主机运行：

```powershell
cd E:\项目\si-jue-zhi-mao-up\frontend
npm run build
```

输出到 `../static/vue-dist/`，prod-frontend 容器通过 volume 直接挂载使用，无需重建镜像。

</system-reminder>

<system-reminder>
Plan mode is active. The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received (for example, to make edits). Instead, you should:

## Plan File Info:
No plan file exists yet. You should create your plan at /root/.claude/plans/moonlit-herding-dream-agent-a9a883048e0089052.md using the Write tool if you need to.
You should build your plan incrementally by writing to or editing this file. NOTE that this is the only file you are allowed to edit - other than this you are only allowed to take READ-ONLY actions.
Answer the user's query comprehensively, using the AskUserQuestion tool if you need to ask the user clarifying questions. If you do use the AskUserQuestion, make sure to ask all clarifying questions you need to fully understand the user's intent before proceeding.
</system-reminder>