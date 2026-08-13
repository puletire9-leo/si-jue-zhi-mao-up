import request from "@/utils/request";

/** 领星本地产品（后端 lingxing_local_product 的映射） */
export interface LingxingLocalProduct {
  id: number;
  lingxingId: number;
  sku: string | null;
  skuIdentifier: string | null;
  productName: string | null;
  cid: number | null;
  categoryName: string | null;
  bid: number | null;
  brandName: string | null;
  picUrl: string | null;
  psId: number | null;
  spu: string | null;
  cgPrice: string | null;
  cgDelivery: number | null;
  cgTransportCosts: string | null;
  purchaseRemark: string | null;
  status: number | null;
  statusText: string | null;
  openStatus: number | null;
  isCombo: number | null;
  productDeveloperUid: string | null;
  productDeveloper: string | null;
  cgOptUid: string | null;
  cgOptUsername: string | null;
  lxCreateTime: string | null;
  lxUpdateTime: string | null;
  syncedAt: string | null;
}

/** MyBatis-Plus 分页响应 */
export interface MpPage<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

/** 领星亚马逊店铺（后端 lingxing_seller 的映射） */
export interface LingxingSeller {
  id: number;
  sid: number;
  mid: number | null;
  name: string | null;
  sellerId: string | null;
  accountName: string | null;
  sellerAccountId: number | null;
  region: string | null;
  country: string | null;
  hasAdsSetting: number | null;
  marketplaceId: string | null;
  status: number | null;
  syncedAt: string | null;
}

/** 本地产品同步结果统计 */
export interface SyncResult {
  pages: number;
  fetched: number;
  upserted: number;
}

/** 添加/编辑本地产品结果 */
export interface SetProductResult {
  product_id: number;
  sku: string;
  sku_identifier: string;
  resynced: number;
}

/** 店铺同步结果统计 */
export interface SellerSyncResult {
  fetched: number;
  upserted: number;
}

/** 报表类同步结果统计（产品表现/利润） */
export interface ReportSyncResult {
  pages: number;
  fetched: number;
  upserted: number;
}

/** 产品统一表聚合块（工作台展示今天建成的 6994 目标标签 ASIN 宽表） */
export interface LingxingUnifiedOverview {
  total: number;
  withSales: number;
  byCountry: Array<{ country: string; cnt: number }>;
  byDeveloper: Array<{ developer: string; cnt: number }>;
  byLatestMonth: Array<{ month: string; cnt: number }>;
  /** 6 目标标签各计数（后端一行返回，值可能是字符串数字） */
  byTag: {
    tag_jingpu: number | string | null;
    tag_feibiao: number | string | null;
    tag_taotai: number | string | null;
    tag_daitaotai: number | string | null;
    tag_jijie: number | string | null;
    tag_lvbiao: number | string | null;
  } | null;
}

/** 工作台总览响应 */
export interface LingxingOverview {
  tableCounts: {
    monthlyPerformance: number;
    skuWeekly: number;
    profitAsin: number;
    localProduct: number;
    seller: number;
    purchasePlan: number;
    purchaseOrder: number;
    purchaseOrderItem: number;
    dataSyncRun: number;
    productUnified: number;
  };
  coverage: {
    monthlyEarliest: string | null;
    monthlyLatest: string | null;
    weeklyEarliest: string | null;
    weeklyLatest: string | null;
    profitLatest: string | null;
  };
  unified: LingxingUnifiedOverview | null;
  recentSyncs: SyncRun[];
}

/** 产品统一表明细（lingxing_product_unified，ASIN 维度宽表关键展示列） */
export interface LingxingProductUnified {
  id: number;
  asin: string;
  parentAsin: string | null;
  baseSku: string | null;
  baseMsku: string | null;
  baseStore: string | null;
  country: string | null;
  developer: string | null;
  title: string | null;
  listingTags: string | null;
  listingDate: string | null;
  fbaInventoryFirstMonth: string | null;
  fbaObservationStatus: string | null;
  totalVolume: number | null;
  totalAmount: string | null;
  totalOrderItems: number | null;
  totalGrossProfit: string | null;
  avgGrossMargin: string | null;
  activeMonths: number | null;
  firstSaleMonth: string | null;
  lastSaleMonth: string | null;
  latestMonth: string | null;
  latestVolume: number | null;
  latestAmount: string | null;
  latestFbaAvailable: number | null;
  latestAvgStar: string | null;
  latestReviewsCount: number | null;
  syncedAt: string | null;
}

/** 统一表分页查询参数 */
export interface ProductUnifiedListParams {
  current?: number;
  size?: number;
  asin?: string;
  developer?: string;
}

/** 同步运行记录 */
export interface SyncRun {
  run_id: string;
  run_type: string;
  marketplace: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  upserted_count: number | null;
  fetched_count: number | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

/** 领星利润统计-ASIN（结构化关键列，完整字段见后端 raw_json） */
export interface LingxingProfitAsin {
  id: number;
  bizKey: string;
  asin: string | null;
  parentAsin: string | null;
  sid: string | null;
  storeName: string | null;
  dataDate: string | null;
  countryCode: string | null;
  localSku: string | null;
  localName: string | null;
  itemName: string | null;
  currencyCode: string | null;
  totalSalesQuantity: number | null;
  totalSalesAmount: string | null;
  totalAdsCost: string | null;
  cgPrice: string | null;
  cgTransportCosts: string | null;
  totalCost: string | null;
  grossProfit: string | null;
  grossRate: string | null;
  syncedAt: string | null;
}

/** 利润同步入参 */
export interface ProfitSyncPayload {
  sids?: number[];
  startDate: string;
  endDate: string;
  currencyCode?: string;
}

export interface PurchasePlanSyncPayload {
  startDate: string;
  endDate: string;
  searchFieldTime?: "creator_time" | "expect_arrive_time" | "update_time";
  planSns?: string[];
  statuses?: number[];
  sids?: number[];
}

export interface PurchaseOrderSyncPayload {
  startDate: string;
  endDate: string;
  searchFieldTime?: "create_time" | "expect_arrive_time" | "update_time";
  orderSns?: string[];
  customOrderSns?: string[];
  purchaseType?: number;
}

export interface LingxingCredentialsPayload {
  appId: string;
  appSecret: string;
}

export interface LingxingPingResult {
  token: string;
  code: string;
  message: string;
  dataSize: number;
}

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

/** Result<T> 包装解包：业务 code 非 200 时必须拒绝，避免页面把失败当空数据。 */
function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return promise.then((response) => {
    if (!response || typeof response !== "object") {
      throw new Error("领星接口响应格式错误");
    }

    const result = response as Partial<ApiEnvelope<T>>;
    if (result.code !== 200) {
      throw new Error(
        result.message ||
          `领星接口请求失败 (${String(result.code ?? "unknown")})`,
      );
    }

    return result.data as T;
  });
}

export const lingxingProductApi = {
  /** 全量同步领星本地产品到库（分页拉取 + 幂等 upsert，可能耗时数分钟） */
  syncLocalProducts(): Promise<SyncResult> {
    return unwrap<SyncResult>(
      request({
        url: "/api/v1/modules/lingxing/local-products/sync",
        method: "post",
        // 分页拉取 + 翻页限流，放大超时到 10 分钟
        timeout: 600000,
      }),
    );
  },

  /** 分页查询已落库的领星本地产品 */
  listLocalProducts(
    current = 1,
    size = 20,
    sku?: string,
  ): Promise<MpPage<LingxingLocalProduct>> {
    return unwrap<MpPage<LingxingLocalProduct>>(
      request({
        url: "/api/v1/modules/lingxing/local-products",
        method: "get",
        params: { current, size, ...(sku ? { sku } : {}) },
      }),
    );
  },

  /**
   * 添加/编辑本地产品（写回领星）。body 按领星 productSet 文档组织，至少含 sku；
   * 新增时还需 product_name。返回 {product_id, sku, sku_identifier, resynced}。
   */
  setLocalProduct(body: Record<string, any>): Promise<SetProductResult> {
    return unwrap<SetProductResult>(
      request({
        url: "/api/v1/modules/lingxing/local-products/set",
        method: "post",
        data: body,
        timeout: 60000,
      }),
    );
  },

  /** 上传本地产品图片（写回领星）。picture_list: [{pic_url, is_primary}] */
  uploadLocalProductPictures(
    sku: string,
    pictureList: Array<{ pic_url: string; is_primary: number }>,
  ): Promise<any> {
    return unwrap<any>(
      request({
        url: "/api/v1/modules/lingxing/local-products/upload-pictures",
        method: "post",
        data: { sku, picture_list: pictureList },
        timeout: 60000,
      }),
    );
  },

  /** 同步领星亚马逊店铺列表（sid 来源，一次性返回全部授权店铺） */
  syncSellers(): Promise<SellerSyncResult> {
    return unwrap<SellerSyncResult>(
      request({
        url: "/api/v1/modules/lingxing/sellers/sync",
        method: "post",
      }),
    );
  },

  /** 查询已落库的领星店铺（可按 status 过滤，1=正常） */
  listSellers(status?: number): Promise<LingxingSeller[]> {
    return unwrap<LingxingSeller[]>(
      request({
        url: "/api/v1/modules/lingxing/sellers",
        method: "get",
        params: status != null ? { status } : {},
      }),
    ).then((d) => (Array.isArray(d) ? d : []));
  },

  /** 同步领星采购计划列表（计划量 quantity_plan） */
  syncPurchasePlans(payload: PurchasePlanSyncPayload): Promise<any> {
    return unwrap<any>(
      request({
        url: "/api/v1/modules/lingxing/purchase/plans/sync",
        method: "post",
        data: payload,
        timeout: 1800000,
      }),
    );
  },

  /** 同步领星采购单列表（实际采购量 quantity_real / 入库量 quantity_entry） */
  syncPurchaseOrders(payload: PurchaseOrderSyncPayload): Promise<any> {
    return unwrap<any>(
      request({
        url: "/api/v1/modules/lingxing/purchase/orders/sync",
        method: "post",
        data: payload,
        timeout: 1800000,
      }),
    );
  },

  /** 查看领星采购事实层统计 */
  getPurchaseStats(): Promise<any> {
    return unwrap<any>(
      request({
        url: "/api/v1/modules/lingxing/purchase/stats",
        method: "get",
      }),
    );
  },

  /** 按店铺+时间窗(≤7天)同步利润统计-ASIN */
  syncProfitAsin(payload: ProfitSyncPayload): Promise<ReportSyncResult> {
    return unwrap<ReportSyncResult>(
      request({
        url: "/api/v1/modules/lingxing/profit-asin/sync",
        method: "post",
        data: payload,
        timeout: 600000,
      }),
    );
  },

  /** 分页查询已落库的利润统计-ASIN */
  listProfitAsin(
    current = 1,
    size = 20,
    asin?: string,
  ): Promise<MpPage<LingxingProfitAsin>> {
    return unwrap<MpPage<LingxingProfitAsin>>(
      request({
        url: "/api/v1/modules/lingxing/profit-asin",
        method: "get",
        params: { current, size, ...(asin ? { asin } : {}) },
      }),
    );
  },

  /** 领星工作台总览：10 张表行数 + 团队分布 + 覆盖窗口 + 统一表聚合 + 最近同步 */
  getOverview(): Promise<LingxingOverview> {
    return unwrap<LingxingOverview>(
      request({
        url: "/api/v1/modules/lingxing/overview",
        method: "get",
      }),
    );
  },

  /** 分页查询产品统一表（6994 目标标签 ASIN 宽表，按累计销量倒序） */
  listProductUnified(
    params: ProductUnifiedListParams = {},
  ): Promise<MpPage<LingxingProductUnified>> {
    const { current = 1, size = 60, ...rest } = params;
    const clean: Record<string, any> = { current, size };
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") clean[k] = v;
    });
    return unwrap<MpPage<LingxingProductUnified>>(
      request({
        url: "/api/v1/modules/lingxing/product-unified",
        method: "get",
        params: clean,
      }),
    );
  },

  /** 更新领星凭证：敏感字段只通过 JSON body 传输。 */
  updateCredentials(payload: LingxingCredentialsPayload): Promise<void> {
    return unwrap<void>(
      request({
        url: "/api/v1/modules/lingxing/credentials",
        method: "post",
        data: payload,
      }),
    );
  },

  /** 换取 token 并调用轻量业务接口，验证领星链路。 */
  ping(): Promise<LingxingPingResult> {
    return unwrap<LingxingPingResult>(
      request({
        url: "/api/v1/modules/lingxing/ping",
        method: "post",
      }),
    );
  },

  /** 最近同步运行记录 */
  listSyncRuns(limit = 50): Promise<SyncRun[]> {
    return unwrap<SyncRun[]>(
      request({
        url: "/api/v1/modules/lingxing/sync-runs",
        method: "get",
        params: { limit },
      }),
    );
  },

};

export default lingxingProductApi;
