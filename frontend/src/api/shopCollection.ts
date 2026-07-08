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
  batchDate: string | null;
  createdAt: string | null;
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

/** 观察池同步结果 */
export interface WatchlistSyncResult {
  methodId: string;
  marketplace: string | null;
  minCount: number;
  rankedShops: number;
  upserted: number;
}

/** 店铺全集抓取结果 */
export interface ShopSyncResult {
  sellerName: string;
  marketplace: string;
  total: number;
  inserted: number;
  apiCalls: number;
  runId: string;
  batchDate: string;
}

/** Result<T> 解包 */
function unwrap<T>(p: Promise<any>): Promise<T> {
  return p.then((res) => res?.data as T);
}

const BASE = "/api/v1/modules/shop-collection";

export const shopCollectionApi = {
  /** 方法卡排名同步观察池 */
  syncWatchlistFromMethodRank(
    methodId = "M01",
    marketplace?: string,
    minCount = 1,
  ): Promise<WatchlistSyncResult> {
    return unwrap<WatchlistSyncResult>(
      request({
        url: `${BASE}/watchlist/sync-from-method-rank`,
        method: "post",
        params: { methodId, minCount, ...(marketplace ? { marketplace } : {}) },
        timeout: 120000,
      }),
    );
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

  /** 抓取店铺全集（消耗卖家精灵请求次数，每月限 2 万次；放大超时到 10 分钟） */
  syncShopProducts(
    marketplace: string,
    sellerName: string,
    fetchReason?: string,
    watchlistId?: number,
  ): Promise<ShopSyncResult> {
    return unwrap<ShopSyncResult>(
      request({
        url: `${BASE}/products/sync`,
        method: "post",
        data: { marketplace, sellerName, fetchReason, watchlistId },
        timeout: 600000,
      }),
    );
  },

  /** 店铺全集原始分页 */
  listShopProducts(
    current = 1,
    size = 20,
    marketplace?: string,
    sellerName?: string,
    asin?: string,
  ): Promise<MpPage<any>> {
    return unwrap<MpPage<any>>(
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

  /** 单店全集商品明细分页 */
  shopProducts(
    marketplace: string,
    sellerName: string,
    salesTier?: string,
    category?: string,
    page = 1,
    size = 60,
    sourceRunId?: string,
  ): Promise<PageResult<ShopProfileProduct>> {
    return unwrap<PageResult<ShopProfileProduct>>(
      request({
        url: `${BASE}/${marketplace}/${encodeURIComponent(sellerName)}/products`,
        method: "get",
        params: {
          ...(salesTier ? { salesTier } : {}),
          ...(category ? { category } : {}),
          ...(sourceRunId ? { sourceRunId } : {}),
          page,
          size,
        },
      }),
    );
  },
};

export default shopCollectionApi;
