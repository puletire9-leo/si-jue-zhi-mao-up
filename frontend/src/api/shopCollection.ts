import request from "@/utils/request";

/** 店铺观察池记录（后端 shop_watchlist 映射） */
export interface ShopWatchlist {
  id: number;
  marketplace: string;
  sellerName: string;
  sellerId: string | null;
  sourceType: string;
  sourceCode: string;
  reason: string | null;
  hitCount: number | null;
  topCategory: string | null;
  status: string;
  lastFetchRunId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** 店铺画像摘要（复用后端 ShopProfileSummary） */
export interface ShopProfileSummary {
  marketplace: string;
  sellerName: string;
  sellerId: string | null;
  productCount: number;
  aCount: number;
  bCount: number;
  cCount: number;
  dCount: number;
  unknownCount: number;
  abCount: number;
  abcCount: number;
  aRatio: number | null;
  abRatio: number | null;
  abcRatio: number | null;
  dRatio: number | null;
  topACategory: string | null;
  topABCCategory: string | null;
  topDCategory: string | null;
  profileType: string | null;
  latestBatchDate: string | null;
  variationMode: string | null;
  m01HitCount: number | null;
  m01HitRatio: number | null;
  avgListingDays: number | null;
  avgUnits: number | null;
  earliestAvailableDate: number | null;
  earliestAvailableDateText: string | null;
  maxListingDays: number | null;
  new30Count: number | null;
  new90Count: number | null;
  new180Count: number | null;
  old180Count: number | null;
  unknownListingDaysCount: number | null;
  newProductCount: number | null;
  newABCCount: number | null;
  newABCRatio: number | null;
  oldDCount: number | null;
  oldDRatio: number | null;
  goodTendencyCount: number | null;
  attentionStrongCount: number | null;
  attentionReviewCount: number | null;
  shopProfile3dType: string | null;
  shopProfile3dExplanation: string | null;
}

/** 单店销量等级维度洞察（后端 ShopTierInsight） */
export interface ShopTierInsight {
  salesTier: string;
  productCount: number | null;
  m01HitCount: number | null;
  m01HitRatio: number | null;
  avgListingDays: number | null;
  avgUnits: number | null;
  earliestAvailableDate: number | null;
  earliestAvailableDateText: string | null;
  maxListingDays: number | null;
  new30Count: number | null;
  new90Count: number | null;
  new180Count: number | null;
  old180Count: number | null;
  unknownListingDaysCount: number | null;
}

/** 单店类目维度洞察（后端 ShopCategoryInsight） */
export interface ShopCategoryInsight {
  salesTier: string;
  categoryKey: string;
  nodeLabelPath: string | null;
  productCount: number | null;
  unitsSum: number | null;
  unitsAvg: number | null;
  avgListingDays: number | null;
  m01HitCount: number | null;
  m01HitRatio: number | null;
  attentionLevel: string | null;
  attentionReason: string | null;
  labelMeaning: string | null;
  attentionTags: string[];
  tendencyTags: string[];
  /** 兼容别名，新页面请勿使用 */
  riskLevel?: string | null;
  riskReason?: string | null;
}

/** 类目标签聚合洞察（后端 ShopCategoryRiskInsight） */
export interface ShopCategoryLabelInsight {
  attentionLevel: string | null;
  attentionReason: string | null;
  labelMeaning: string | null;
  attentionTags: string[];
  tendencyTags: string[];
  productCount: number | null;
  unitsSum: number | null;
  unitsAvg: number | null;
  avgListingDays: number | null;
  m01HitCount: number | null;
  categoryCount: number | null;
  topCategories: string[];
  /** 兼容别名，新页面请勿使用 */
  riskLevel?: string | null;
  riskReason?: string | null;
}

/** 互斥时间桶统计（模型分层，非累计窗口） */
export interface ShopAgeBucketStat {
  ageBucket: string;
  productCount: number | null;
  unitsSum: number | null;
  avgUnits: number | null;
  m01HitCount: number | null;
  abcCount: number | null;
}

/** 二维矩阵单元格 */
export interface ShopMatrixCell {
  rowKey: string;
  colKey: string;
  productCount: number | null;
  unitsSum: number | null;
  m01HitCount: number | null;
}

/** 二维矩阵 */
export interface ShopMatrix {
  name: string;
  rowDim: string;
  colDim: string;
  rowKeys: string[];
  colKeys: string[];
  cells: ShopMatrixCell[];
}

/** 单店全集画像分析（后端 ShopCollectionInsight） */
export interface ShopCollectionInsight {
  snapshot: ShopSnapshot | null;
  profile: ShopProfileSummary | null;
  methodId: string | null;
  m01HitCount: number | null;
  m01HitRatio: number | null;
  earliestAvailableDate: number | null;
  earliestAvailableDateText: string | null;
  maxListingDays: number | null;
  avgListingDays: number | null;
  avgUnits: number | null;
  new30Count: number | null;
  new90Count: number | null;
  new180Count: number | null;
  old180Count: number | null;
  unknownListingDaysCount: number | null;
  tierStats: ShopTierInsight[];
  categoryStats: ShopCategoryInsight[];
  ageBucketStats: ShopAgeBucketStat[];
  salesAgeMatrix: ShopMatrix | null;
  salesAttentionMatrix: ShopMatrix | null;
  ageAttentionMatrix: ShopMatrix | null;
  topGoodTendencyCategories: string[];
  topAttentionCategories: string[];
  shopProfile3dType: string | null;
  shopProfile3dExplanation: string | null;
  categoryLabelStats: ShopCategoryLabelInsight[];
  /** 兼容别名，新页面请勿使用 */
  riskStats?: ShopCategoryLabelInsight[];
}

/** 店铺画像类目结构 */
export interface ShopProfileCategory {
  marketplace: string;
  sellerName: string;
  salesTier: string;
  categoryKey: string;
  productCount: number;
  unitsSum: number;
  unitsAvg: number | null;
}

/** 店铺全集商品明细 */
export interface ShopProfileProduct {
  id: number;
  marketplace: string;
  sellerName: string;
  sellerId: string | null;
  asin: string;
  parentAsin: string | null;
  salesTier: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  similarUrl: string | null;
  nodeId: number | null;
  nodeLabelPath: string | null;
  categoryLeaf: string | null;
  bsrId: string | null;
  units: number | null;
  bsr: number | null;
  price: string | null;
  rating: string | null;
  ratings: number | null;
  fulfillment: string | null;
  availableDate: number | null;
  listingDays: number | null;
  batchDate: string | null;
  createdAt: string | null;
  ageBucket: string | null;
  m01Hit: number | null;
  attentionLevel: string | null;
  attentionReason: string | null;
  labelMeaning: string | null;
}

/** 单店全景详情 */
export interface ShopCollectionDetail {
  watchlistEntries: ShopWatchlist[];
  profile: ShopProfileSummary | null;
  categories: ShopProfileCategory[];
}

export interface ShopSnapshot {
  sourceRunId: string;
  batchCode: string | null;
  batchDate: string | null;
  marketplace: string;
  sellerName: string;
  total: number | null;
  fetchedCount: number | null;
  writtenCount: number | null;
  apiCalls: number | null;
}

export interface ShopProductWallItem {
  asin: string;
  parentAsin: string | null;
  imageUrl: string | null;
  title: string | null;
  units: number | null;
  salesTier: string | null;
  price: string | number | null;
  rating: string | number | null;
  ratings: number | null;
  nodeLabelPath: string | null;
  productUrl: string | null;
}

export interface ShopProductWallSection {
  count: number;
  page: number;
  size: number;
  products: ShopProductWallItem[];
}

export interface ShopProductWallResult {
  snapshot: ShopSnapshot;
  sections: Record<string, ShopProductWallSection>;
}

export interface ShopCompareResult {
  baseline: Pick<ShopSnapshot, "sourceRunId" | "batchCode" | "batchDate">;
  compare: Pick<ShopSnapshot, "sourceRunId" | "batchCode" | "batchDate">;
  summary: {
    newCount: number;
    goneCount: number;
    keptCount: number;
    upgradedCount: number;
    downgradedCount: number;
  };
  newProducts: ShopProductWallItem[];
  goneProducts: ShopProductWallItem[];
  keptProducts: ShopProductWallItem[];
  upgradedProducts: ShopProductWallItem[];
  downgradedProducts: ShopProductWallItem[];
}

/** 通用分页响应 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/** MyBatis-Plus 分页响应 */
export interface MpPage<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

/** 店铺商品原始行：跨店商品卡片流直接读取 shop_products。 */
export interface ShopProductRow {
  id: number;
  marketplace: string;
  sellerName: string | null;
  sellerId: string | null;
  asin: string;
  parentAsin: string | null;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  similarUrl: string | null;
  nodeLabelPath: string | null;
  units: number | null;
  salesTier: string | null;
  bsr: number | null;
  price: string | number | null;
  rating: string | number | null;
  ratings: number | null;
  fulfillment: string | null;
  variations: number | null;
  weightG: number | null;
  grade: string | null;
  filterMode: string | null;
  filterReasons: string | null;
  source: string | null;
  availableDate: number | null;
  listingDays: number | null;
  batchDate: string | null;
  sourceRunId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** 统一选品页传给 shop_products 的筛选条件。 */
export interface ShopProductSelectionParams {
  page?: number;
  size?: number;
  marketplace: string;
  asins?: string[];
  title?: string;
  sellerName?: string;
  brand?: string;
  categories?: string[];
  /** 品线树精确筛选：L2 小类 node_id。 */
  nodeId?: number;
  /** 品线树精确筛选：L1 大类 bsr_id。 */
  bsrId?: string;
  batchDates?: string[];
  priceMin?: number;
  priceMax?: number;
  unitsMin?: number;
  unitsMax?: number;
  listingDaysMin?: number;
  listingDaysMax?: number;
  bsrMax?: number;
  weightMax?: number;
  maxVariantCount?: number;
  fulfillment?: string[];
  grade?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** 规则叠加在 shop_products 数据源上；店铺选品只支持 M01 / M03。 */
  methodId?: 'M01' | 'M03';
}

export interface ShopSelectionBatch {
  week: string;
  count: number;
  startDate: string;
  endDate: string;
}

export interface ShopSelectionCategory {
  category: string;
  count: number;
}

export interface ShopScreeningBatch {
  batchCode: string;
  shopCount: number;
  productCount: number;
}

export interface ShopScreeningRow {
  marketplace: string;
  sellerName: string;
  sellerId: string | null;
  productCount: number;
  passedProductCount: number;
  m01HitCount: number;
  m01HitRatio: number | null;
  avgListingDays: number | null;
  avgUnits: number | null;
  new30Count: number;
  new90Count: number;
  aCount: number;
  bCount: number;
  cCount: number;
  dCount: number;
  abcCount: number;
  abcRatio: number | null;
  topCategory: string | null;
  latestBatchCode: string | null;
  watchlistId: number | null;
  watchlistStatus: string | null;
  sourceType: string | null;
  sourceCode: string | null;
  reason: string | null;
  sourceHitCount: number | null;
  totalRows: number;
  totalProductCount: number;
  totalPassedProductCount: number;
  totalM01HitCount: number;
}

export interface ShopScreeningQuery {
  marketplace: string;
  scope?: 'ALL' | 'WATCHLIST';
  batchCodes?: string[];
  sellerNames?: string[];
  sellerKeyword?: string;
  watchlistStatus?: string;
  sourceType?: string;
  priceMin?: number;
  priceMax?: number;
  unitsMin?: number;
  unitsMax?: number;
  listingDaysMin?: number;
  listingDaysMax?: number;
  bsrMax?: number;
  weightMax?: number;
  maxVariantCount?: number;
  fulfillment?: string[];
  categories?: string[];
  m01Only?: boolean;
  minProductCount?: number;
  minPassedProductCount?: number;
  minM01HitCount?: number;
  avgListingDaysMax?: number;
  sortBy?: 'productCount' | 'passedProductCount' | 'm01HitCount' | 'avgListingDays' | 'new90Count';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

/** Result<T> 解包 */
function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => res?.data as T);
}

const BASE = "/api/v1/modules/shop-collection";

export const shopCollectionApi = {
  screenShops(params: ShopScreeningQuery): Promise<PageResult<ShopScreeningRow>> {
    return unwrap<PageResult<ShopScreeningRow>>(
      request({ url: `${BASE}/shop-screening`, method: 'post', data: params }),
    );
  },

  screeningBatches(marketplace: string): Promise<ShopScreeningBatch[]> {
    return unwrap<ShopScreeningBatch[]>(
      request({ url: `${BASE}/screening-batches`, method: 'get', params: { marketplace } }),
    ).then((items) => (Array.isArray(items) ? items : []));
  },

  /** 查询观察池 */
  listWatchlist(
    marketplace?: string,
    status?: string,
    sourceType?: string,
  ): Promise<ShopWatchlist[]> {
    return unwrap<ShopWatchlist[]>(
      request({
        url: `${BASE}/watchlist`,
        method: "get",
        params: {
          ...(marketplace ? { marketplace } : {}),
          ...(status ? { status } : {}),
          ...(sourceType ? { sourceType } : {}),
        },
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 人工加入观察池 */
  addManualWatchlist(
    marketplace: string,
    sellerName: string,
    reason?: string,
  ): Promise<ShopWatchlist> {
    return unwrap<ShopWatchlist>(
      request({
        url: `${BASE}/watchlist/manual`,
        method: "post",
        data: { marketplace, sellerName, reason },
      }),
    );
  },

  /** 更新观察池状态 */
  updateWatchlistStatus(id: number, status: string): Promise<void> {
    return unwrap<void>(
      request({
        url: `${BASE}/watchlist/${id}/status`,
        method: "put",
        params: { status },
      }),
    );
  },

  /** 移除观察池记录 */
  removeWatchlist(id: number): Promise<void> {
    return unwrap<void>(
      request({ url: `${BASE}/watchlist/${id}`, method: "delete" }),
    );
  },

  /** 店铺全集原始分页 */
  listShopProducts(
    current = 1,
    size = 20,
    marketplace?: string,
    sellerName?: string,
    asin?: string,
  ): Promise<MpPage<ShopProductRow>> {
    return unwrap<MpPage<ShopProductRow>>(
      request({
        url: `${BASE}/products`,
        method: "get",
        params: {
          current,
          size,
          ...(marketplace ? { marketplace } : {}),
          ...(sellerName ? { sellerName } : {}),
          ...(asin ? { asin } : {}),
        },
      }),
    );
  },

  /** 统一选品页：跨店分页读取 shop_products。 */
  selectionProducts(
    params: ShopProductSelectionParams,
  ): Promise<PageResult<ShopProductRow>> {
    return unwrap<PageResult<ShopProductRow>>(
      request({
        url: `${BASE}/selection-products`,
        method: 'post',
        data: params,
      }),
    );
  },

  /** 拓品页面：当前批次内跨店分页，搜索不会扩展到历史快照。 */
  expansionProducts(
    params: ShopProductSelectionParams,
  ): Promise<PageResult<ShopProductRow>> {
    return unwrap<PageResult<ShopProductRow>>(
      request({
        url: `${BASE}/expansion-products`,
        method: 'post',
        data: params,
      }),
    );
  },

  /** 统一选品页：店铺商品类目下拉。 */
  selectionCategories(
    params: ShopProductSelectionParams,
  ): Promise<ShopSelectionCategory[]> {
    return unwrap<ShopSelectionCategory[]>(
      request({
        url: `${BASE}/selection-categories/query`,
        method: 'post',
        data: { ...params, categories: undefined, page: undefined, size: undefined },
      }),
    ).then((items) => (Array.isArray(items) ? items : []));
  },

  /** 统一选品页：店铺商品抓取批次下拉。 */
  selectionBatches(marketplace: string): Promise<ShopSelectionBatch[]> {
    return unwrap<ShopSelectionBatch[]>(
      request({
        url: `${BASE}/selection-batches`,
        method: 'get',
        params: { marketplace },
      }),
    ).then((items) => (Array.isArray(items) ? items : []));
  },

  /** 店铺全集画像列表 */
  summary(
    marketplace: string,
    sellerName?: string,
    minProductCount?: number,
    limit = 100,
    sourceRunId?: string,
    batchDate?: string,
  ): Promise<ShopProfileSummary[]> {
    return unwrap<ShopProfileSummary[]>(
      request({
        url: `${BASE}/summary`,
        method: "get",
        params: {
          marketplace,
          ...(sellerName ? { sellerName } : {}),
          ...(minProductCount != null ? { minProductCount } : {}),
          ...(sourceRunId ? { sourceRunId } : {}),
          ...(batchDate ? { batchDate } : {}),
          limit,
        },
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 选品中心竞品店铺列表（带 M01 命中与新品维度） */
  selectionShops(params: {
    marketplace: string;
    sellerName?: string;
    batchDate?: string;
    minProductCount?: number;
    minM01HitCount?: number;
    minNew90Count?: number;
    minGoodTendencyCount?: number;
    maxAttentionStrongCount?: number;
    limit?: number;
    sourceRunId?: string;
  }): Promise<ShopProfileSummary[]> {
    const { marketplace, limit = 100, ...rest } = params;
    return unwrap<ShopProfileSummary[]>(
      request({
        url: `${BASE}/selection-shops`,
        method: "get",
        params: {
          marketplace,
          limit,
          ...Object.fromEntries(
            Object.entries(rest).filter(([, v]) => v != null && v !== ""),
          ),
        },
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 单店全集画像分析（M01 命中/上架时间/等级/类目标签） */
  insight(
    marketplace: string,
    sellerName: string,
    sourceRunId?: string,
    batchCode?: string,
  ): Promise<ShopCollectionInsight> {
    return unwrap<ShopCollectionInsight>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}/insight`,
        method: "get",
        params: {
          ...(sourceRunId ? { sourceRunId } : {}),
          ...(batchCode ? { batchCode } : {}),
        },
      }),
    );
  },

  /** 单店全景详情 */
  detail(
    marketplace: string,
    sellerName: string,
    batchDate?: string,
    sourceRunId?: string,
  ): Promise<ShopCollectionDetail> {
    return unwrap<ShopCollectionDetail>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}`,
        method: "get",
        params: {
          ...(batchDate ? { batchDate } : {}),
          ...(sourceRunId ? { sourceRunId } : {}),
        },
      }),
    );
  },

  snapshots(marketplace: string, sellerName: string): Promise<ShopSnapshot[]> {
    return unwrap<ShopSnapshot[]>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}/snapshots`,
        method: "get",
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  productWall(
    marketplace: string,
    sellerName: string,
    sourceRunId?: string,
    salesTier?: string,
    page = 1,
    size = 24,
  ): Promise<ShopProductWallResult> {
    return unwrap<ShopProductWallResult>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}/product-wall`,
        method: "get",
        params: {
          ...(sourceRunId ? { sourceRunId } : {}),
          ...(salesTier ? { salesTier } : {}),
          page,
          size,
        },
      }),
    );
  },

  compare(
    marketplace: string,
    sellerName: string,
    baselineRunId: string,
    compareRunId: string,
    page = 1,
    size = 12,
  ): Promise<ShopCompareResult> {
    return unwrap<ShopCompareResult>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}/compare`,
        method: "get",
        params: { baselineRunId, compareRunId, page, size },
      }),
    );
  },

  /** 单店全集商品明细分页（三维筛选） */
  shopProducts(params: {
    marketplace: string;
    sellerName: string;
    salesTier?: string;
    ageBucket?: string;
    attentionLevel?: string;
    m01Only?: boolean;
    keyword?: string;
    category?: string;
    sourceRunId?: string;
    page?: number;
    size?: number;
  }): Promise<PageResult<ShopProfileProduct>> {
    const { marketplace, sellerName, page = 1, size = 60, ...rest } = params;
    return unwrap<PageResult<ShopProfileProduct>>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}/products`,
        method: "get",
        params: {
          page,
          size,
          ...Object.fromEntries(
            Object.entries(rest).filter(
              ([, v]) => v != null && v !== "" && v !== false,
            ),
          ),
        },
      }),
    );
  },
};

export default shopCollectionApi;
