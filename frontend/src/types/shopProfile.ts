/**
 * 店铺画像 / 店铺基线 / 基线定位 类型
 * 对应后端 sjzm-product analysisbaseline.shopprofile 的 DTO / Entity。
 * 后端接口前缀：/api/v1/shop-profile（基线在 /shop-profile/baselines 子路径）。
 */

/** 市场：只允许具体国家站点，禁止 ALL */
export type Marketplace = 'UK' | 'DE' | 'US'

/** 销量等级；类目结构里还会出现聚合口径 'ABC' */
export type SalesTier = 'A' | 'B' | 'C' | 'D' | 'UNKNOWN'
export type CategoryTier = SalesTier | 'ABC'

/** 店铺画像摘要（后端 ShopProfileSummary，计数为 Long → number） */
export interface ShopProfileSummary {
  marketplace: Marketplace
  sellerName: string
  sellerId?: string | null
  productCount: number
  aCount: number
  bCount: number
  cCount: number
  dCount: number
  unknownCount: number
  abCount: number
  abcCount: number
  aRatio: number
  abRatio: number
  abcRatio: number
  dRatio: number
  topACategory?: string | null
  topABCCategory?: string | null
  topDCategory?: string | null
  profileType?: string | null
  latestBatchDate?: string | null
  variationMode?: string | null
}

/** 单店商品明细（后端 ShopProfileProduct） */
export interface ShopProfileProduct {
  id: number
  marketplace: Marketplace
  sellerName: string
  sellerId?: string | null
  asin: string
  parentAsin?: string | null
  salesTier: SalesTier
  title: string
  brand?: string | null
  imageUrl?: string | null
  productUrl?: string | null
  similarUrl?: string | null
  nodeId?: number | null
  nodeLabelPath?: string | null
  categoryLeaf?: string | null
  bsrId?: string | null
  units?: number | null
  bsr?: number | null
  price?: number | null
  rating?: number | null
  ratings?: number | null
  fulfillment?: string | null
  /** 后端返回的是 epoch 毫秒（Long），前端按需转日期 */
  availableDate?: number | null
  batchDate?: string | null
  createdAt?: string | null
}

/** 单店类目结构（后端 ShopProfileCategory） */
export interface ShopProfileCategory {
  marketplace: Marketplace
  sellerName: string
  salesTier: CategoryTier
  categoryKey: string
  productCount: number
  unitsSum: number
  unitsAvg?: number | null
}

/** 单店详情（后端 ShopProfileDetail） */
export interface ShopProfileDetail {
  summary: ShopProfileSummary
  categories: ShopProfileCategory[]
}

/** 基线定位结果（后端 ShopProfilePositioningResult，扁平结构，非继承 summary） */
export interface ShopProfilePositioningResult {
  baselineCode: string
  baselineName?: string | null
  marketplace: Marketplace
  sellerName: string
  sellerId?: string | null
  batchDate?: string | null
  variationMode?: string | null

  productCount: number
  aCount: number
  bCount: number
  cCount: number
  dCount: number
  unknownCount: number
  abCount: number
  abcCount: number
  aRatio: number
  abRatio: number
  abcRatio: number
  dRatio: number
  topACategory?: string | null
  topABCCategory?: string | null
  topDCategory?: string | null
  profileType?: string | null

  baselineShopCount?: number | null
  baselineAvgProductCount?: number | null
  baselineAvgARatio?: number | null
  baselineAvgAbRatio?: number | null
  baselineAvgAbcRatio?: number | null
  baselineAvgDRatio?: number | null
  categoryMatchScore?: number | null
  similarityScore?: number | null
  positioningLabel?: string | null
  profileAdvice?: string | null
}

/** compute 写操作结果（后端 ShopProfileComputeResult） */
export interface ShopProfileComputeResult {
  marketplace: Marketplace
  batchDate?: string | null
  variationMode?: string | null
  deletedSnapshots?: number
  insertedSnapshots?: number
  deletedCategories?: number
  insertedCategories?: number
  requiresSqlMigration?: boolean
  sourceTable?: string | null
}

/** computePositioning 写操作结果（后端 ShopProfilePositioningComputeResult） */
export interface ShopProfilePositioningComputeResult {
  baselineCode: string
  marketplace: Marketplace
  batchDate?: string | null
  variationMode?: string | null
  deletedResults?: number
  insertedResults?: number
  requiresSqlMigration?: boolean
  resultTable?: string | null
}

/** 店铺基线（后端 ShopProfileBaseline 实体） */
export interface ShopProfileBaseline {
  id?: number
  baselineCode: string
  baselineName: string
  baselineType?: string | null
  marketplaceScope?: string | null
  categoryScope?: string | null
  shopCount?: number | null
  metricSummaryJson?: string | null
  status?: string | null
  createdBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** 店铺基线成员（后端 ShopProfileBaselineMember 实体） */
export interface ShopProfileBaselineMember {
  id?: number
  baselineCode?: string | null
  marketplace: Marketplace
  sellerName: string
  sellerId?: string | null
  sourceReason?: string | null
  weight?: number | null
  status?: string | null
  addedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** 画像列表 / 快照查询入参 */
export interface ShopProfileSummaryParams {
  marketplace: Marketplace
  batchDate?: string
  sellerName?: string
  minProductCount?: number
  limit?: number
}

/** 单店商品分页入参 */
export interface ShopProfileProductsParams {
  batchDate?: string
  salesTier?: SalesTier
  category?: string
  page?: number
  size?: number
}

/** 基线定位查询入参 */
export interface ShopProfilePositioningParams {
  baselineCode: string
  marketplace: Marketplace
  batchDate?: string
  sellerName?: string
  limit?: number
}
