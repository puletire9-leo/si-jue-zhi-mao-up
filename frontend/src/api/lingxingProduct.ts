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

/** ASIN 基准表（lingxing_asin_baseline）。模型一/模型二 6945 团队 ASIN 主表 */
export interface LingxingAsinBaseline {
  asin: string;
  baseSku: string | null;
  baseStore: string | null;
  developer: string | null;
  listingTags: string | null;
  createTime: string | null;
  fbaInventoryFirstMonth: string | null;
  inventoryFirstStore: string | null;
  inventoryFirstCountry: string | null;
  inventoryFirstSku: string | null;
  inventoryFirstQty: string | null;
  fbaAvailableFirstMonth: string | null;
  availableFirstStore: string | null;
  availableFirstCountry: string | null;
  availableFirstSku: string | null;
  availableFirstQty: string | null;
  fbaObservationStatus: string | null;
  dataCoverageEnd: string | null;
  productCreateTime: string | null;
  productCreateSource: string | null;
  fbaAvailableFirstMonthFinal: string | null;
  fbaAvailableFirstBasis: string | null;
  modelStartMonth: string | null;
  modelStartBasis: string | null;
  timePrecision: string | null;
  dataCutoffMonth: string | null;
  analysisStatus: string | null;
  baselineVersion: string | null;
}

/** 基准表筛选参数 */
export interface BaselineListParams {
  current?: number;
  size?: number;
  asin?: string;
  developer?: string;
  currency?: "GBP" | "EUR" | "";
  modelStartMonth?: string;
  analysisStatus?: string;
  keyword?: string;
}

/** ASIN 基准表人工可编辑字段白名单。 */
export interface LingxingBaselineUpdatePayload {
  developer?: string | null;
  listingTags?: string | null;
  modelStartMonth?: string | null;
  modelStartBasis?: string | null;
  analysisStatus?: string | null;
}

/** 工作台总览响应 */
export interface LingxingOverview {
  tableCounts: {
    baseline: number;
    monthlyPerformance: number;
    skuWeekly: number;
    profitAsin: number;
    localProduct: number;
    seller: number;
    purchasePlan: number;
    purchaseOrder: number;
    purchaseOrderItem: number;
    dataSyncRun: number;
  };
  coverage: {
    monthlyEarliest: string | null;
    monthlyLatest: string | null;
    weeklyLatest: string | null;
    profitLatest: string | null;
  };
  byDeveloper: Array<{ developer: string; cnt: number }>;
  byCurrency: Array<{ currency: string; cnt: number }>;
  byStartMonth: Array<{ month: string; cnt: number }>;
  byStatus: Array<{ status: string; cnt: number }>;
  recentSyncs: SyncRun[];
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

  /** 领星工作台总览：10 张表行数 + 团队分布 + 覆盖窗口 + 最近同步 */
  getOverview(): Promise<LingxingOverview> {
    return unwrap<LingxingOverview>(
      request({
        url: "/api/v1/modules/lingxing/overview",
        method: "get",
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

  /** ASIN 基准表分页查询 */
  listBaseline(
    params: BaselineListParams = {},
  ): Promise<MpPage<LingxingAsinBaseline>> {
    const { current = 1, size = 20, ...rest } = params;
    const clean: Record<string, any> = { current, size };
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") clean[k] = v;
    });
    return unwrap<MpPage<LingxingAsinBaseline>>(
      request({
        url: "/api/v1/modules/lingxing/baseline",
        method: "get",
        params: clean,
      }),
    );
  },

  /** 查询单个 ASIN 基准档案 */
  getBaseline(asin: string): Promise<LingxingAsinBaseline> {
    return unwrap<LingxingAsinBaseline>(
      request({
        url: `/api/v1/modules/lingxing/baseline/${encodeURIComponent(asin)}`,
        method: "get",
      }),
    );
  },

  /** 更新单个 ASIN 基准档案（可编辑：标签/开发人/起算月等） */
  updateBaseline(
    asin: string,
    patch: LingxingBaselineUpdatePayload,
  ): Promise<LingxingAsinBaseline> {
    return unwrap<LingxingAsinBaseline>(
      request({
        url: `/api/v1/modules/lingxing/baseline/${encodeURIComponent(asin)}`,
        method: "post",
        data: patch,
      }),
    );
  },
};

export default lingxingProductApi;
