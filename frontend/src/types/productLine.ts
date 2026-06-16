// 品线选品模块类型定义

// --- API 响应模型 ---

/** 品线树节点（API aggregated-data 中的子类） */
export interface SubCategoryNode {
  nodeId: number
  nodeName: string
  nodeFullPath: string
  productCount: number
  isZheng?: boolean
}

/** 品线分组（API aggregated-data 中的 L1 品线） */
export interface ProductLineGroup {
  bsrId: string
  bsrName: string
  subCategoryCount: number
  totalProducts: number
  subCategories: SubCategoryNode[]
  isZheng?: boolean
}

/** 品线树聚合数据 API 响应 */
export interface AggregatedDataResponse {
  marketplace: string
  month: string
  productLines: ProductLineGroup[]
}

/** 批次信息 */
export interface BatchInfo {
  batchId: string
  status: string
  dataVersion: number
  analyzedAt: string
  batchType?: string
}

/** 批次列表 API 响应 */
export interface BatchListResponse {
  batches: BatchInfo[]
  currentDataVersion: number
}

// --- 品线模型数据类型 ---

/** 质量基准 — 后端 snake_case */
export interface QualityBenchmark {
  bsr_p50: number
  bsr_p90: number
  rating_min: number
  ratings_min: number
  weight_g_median: number
  weight_g_max: number
  fba_median: number
  fba_max: number
  listing_days_median: number
}

/** 价格区间 — 后端 snake_case */
export interface PriceBand {
  min: number
  max: number
  avg: number
  sweet_spot_min: number
  sweet_spot_max: number
  sweet_spot_ratio: number
}

/** 已验证元素 — 后端 camelCase (手动映射) */
export interface ProvenElement {
  name: string
  frequency: number
  carriers: string[]
  signalTags: string[]
  insight: string
}

/** 载体详情 — 后端 snake_case */
export interface CarrierItem {
  name: string
  count: number
  avg_price: number
  avg_weight_g: number
  avg_fba: number
  avg_variants: number
  variant_strategy: string
  lightweight: boolean
  lightweight_reason: string
}

/** 推荐组合 — 后端 camelCase (手动映射) */
export interface ComboItem {
  elements: string[]
  carriers: string[]
  scenes: string[]
  keywordsEn: string[]
  keywordsCn: string[]
  heat: string
  reason: string
}

/** 搜索关键词 */
export interface SearchKeywords {
  en: string[]
  cn: string[]
}

/** 好品 — 后端 camelCase */
export interface GoodProduct {
  asin: string
  elements: string[]
  carriers: string[]
  scenes: string[]
  keywordsEn: string[]
  keywordsCn: string[]
  lightweight: string
}

/** 品线模型 API 响应 — 匹配 Python 后端 JSON */
export interface ProductLineModelData {
  nodeId: number
  nodeName: string
  nodeFullPath: string
  bsrId: string
  stats?: { raw: number; total: number; sampled: number }
  overallHealth: string
  healthReason: string
  qualityBenchmark: QualityBenchmark
  priceBand: PriceBand
  provenElements: ProvenElement[]
  carrierDetail: CarrierItem[]
  elementSaturation?: Array<{ element: string; frequency: number; saturation: string; insight: string }>
  emergingElements?: Array<{ element: string; asin: string; signal: string; opportunity: string }>
  recommendedCombos: ComboItem[]
  searchKeywords: SearchKeywords
  priceGaps?: Array<{ range: string; opportunity: string }>
  lightweightSummary: string
  goodProducts: GoodProduct[]
}

// --- UI 模型 ---

/** 树节点状态 */
export type NodeStatus = 'analyzed' | 'pending'

/** 品线树 UI 节点 */
export interface TreeNode {
  id: string
  name: string
  nodeId: number | null
  status: NodeStatus
  productCount: number
  isZheng?: boolean
}

/** 品线树 UI 分组 */
export interface TreeGroup {
  id: string
  name: string
  icon: string
  expanded: boolean
  isZheng?: boolean
  children: TreeNode[]
}

/** 筛选条件类型 */
export type FilterType = 'element' | 'carrier' | 'price' | 'keyword' | 'combo'

export interface GoodProductItem {
  asin: string
  elements?: string[]
  carriers?: string[]
  scenes?: string[]
  keywordsEn?: string[]
  keywordsCn?: string[]
}

