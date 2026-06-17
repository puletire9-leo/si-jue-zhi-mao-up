import request from "@/utils/request";
import type { ApiResponse } from "@/types/api";

export interface CompetitorProductRaw {
  // 基础字段
  marketplace?: string;
  asin: string;
  month?: string;
  title?: string;
  brand?: string;
  brandUrl?: string;
  imageUrl?: string;
  parentAsin?: string;
  sku?: string;
  nodeId?: number;
  nodeIdPath?: string;
  nodeLabelPath?: string;
  symbol?: string;

  // 销量/收入
  units?: number;
  unitsGr?: number;
  amzUnit?: number;
  amzSales?: number;
  revenue?: number;

  // BSR
  bsrId?: string;
  bsr?: number;
  bsrCr?: number;
  bsrCv?: number;

  // 评分
  ratings?: number;
  rating?: number;
  ratingsRate?: number;
  ratingsCv?: number;
  ratingDelta?: number;

  // 价格
  price?: number;
  primePrice?: number;
  profit?: number;
  fba?: number;

  // 卖家
  sellerName?: string;
  sellerId?: string;
  sellerNation?: string;
  sellers?: number;

  // 配送
  fulfillment?: string;
  variations?: number;
  weight?: string;
  dimension?: string;

  // 状态
  bestSeller?: string;
  amazonChoice?: string;
  newRelease?: string;
  ebc?: string;
  video?: string;

  // 评分
  score?: number;
  grade?: string;
  weekTag?: string;
  isCurrent?: number;

  // 衍生字段
  filterMode?: string;
  filterReasons?: string;
  listingDays?: number;
  weightG?: number;
  productUrl?: string;
  similarUrl?: string;
  source?: string;
  shopLink?: string;
  availableDate?: string;

  // 子类目
  subcategories?: Array<{
    code: string;
    rank: number;
    label: string;
  }>;

  // 批次日期
  batchDate?: string;
}

export interface CompetitorListParams {
  marketplace?: string;
  month?: string;
  asin?: string[];
  source?: string;
  filterMode?: string;
  brand?: string;
  sellerName?: string;
  title?: string;
  category?: string;
  grade?: string;
  weekTag?: string;
  isCurrent?: number;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  size?: number;
  groupByParent?: boolean;
  maxVariantCount?: number;
  priceMin?: number;
  priceMax?: number;
  bsrMax?: number;
  ratingMin?: number;
  weightMax?: number;
  keywords?: string;
  nodeId?: number | string;
  /** 入库周次（ISO 周，如 2026-W19），后端按 created_at 实时过滤 */
  createdWeek?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  /**
   * 灵活合格规则（最多 5 条，规则间 OR：满足任一即合格）。
   * 每条三字段各自可选：上架天数上限 / 月销量下限(严格大于) / BSR 排名上限。
   */
  qualifyRules?: QualifyRule[];
}

/** 单条合格规则：三字段各自独立可选（可组合可单独） */
export interface QualifyRule {
  /** 上架天数上限：listing_days ≤ X（"X天内"的新品） */
  listingDaysMax?: number;
  /** 月销量下限：units > Y（严格大于） */
  unitsMin?: number;
  /** BSR 排名上限：bsr ∈ (0, Z] */
  bsrMax?: number;
}

/** 入库批次（按 created_at 实时计算的 ISO 周 + 条数 + 起止日期） */
export interface BatchWeek {
  week: string;
  count: number;
  startDate: string;
  endDate: string;
}

export interface CompetitorListResponse {
  list: Record<string, any>[];
  total: number;
  page: number;
  size: number;
}

/**
 * 将 Java 竞品数据转换为前端统一格式（同时提供新旧两种字段名）
 */
export function normalizeProduct(
  raw: CompetitorProductRaw,
): Record<string, any> {
  const result: Record<string, any> = {
    ...raw,
    // 基础字段（始终设置）
    id: raw.id ?? raw.asin,
    productType: getProductType(raw.source || ""),
  };
  // 仅在有值时设置别名字段，避免空字符串覆盖原始字段导致 fallback 链断裂
  if (raw.title) result.productTitle = raw.title;
  if (raw.sellerName) result.storeName = raw.sellerName;
  if (raw.shopLink) result.storeUrl = raw.shopLink;
  if (raw.units != null) result.salesVolume = raw.units;
  if (raw.productUrl) result.productLink = raw.productUrl;
  if (raw.similarUrl) result.similarProducts = raw.similarUrl;
  if (raw.filterMode) result.dataFilterMode = raw.filterMode;
  if (raw.availableDate) result.listingDate = raw.availableDate;
  if (raw.variantCount != null) result.variantCount = raw.variantCount;
  return result;
}

/**
 * 根据 source 字段推断产品类型
 * @param source 来源字段（如 '新品榜', '竞品', '郑总店铺'）
 * @returns 'new' | 'reference' | 'zheng' | ''
 */
export function getProductType(
  source: string,
): "new" | "reference" | "zheng" | "" {
  if (!source) return "";
  if (source.includes("新品")) return "new";
  if (source.includes("竞品")) return "reference";
  if (source.includes("郑总") || source.includes("店铺上新")) return "zheng";
  return "";
}

export const competitorApi = {
  getVariants(
    marketplace: string,
    parentAsin: string,
  ): Promise<ApiResponse<any[]>> {
    return request({
      url: "/api/v1/competitor/variants",
      method: "get",
      params: { marketplace, parentAsin },
    });
  },

  getList(
    params: CompetitorListParams,
  ): Promise<ApiResponse<CompetitorListResponse>> {
    // 用 POST：qualifyRules 是数组，GET querystring 不友好；
    // 后端 GET/POST 两版都走 queryFromDb，行为一致。
    return request({
      url: "/api/v1/competitor/products",
      method: "post",
      data: params,
    }).then((res: any) => {
      if (res.data?.list) {
        res.data.list = res.data.list.map(normalizeProduct);
      }
      return res;
    });
  },

  getDetail(
    asin: string,
    marketplace: string = "UK",
  ): Promise<ApiResponse<CompetitorProductRaw[]>> {
    return request({
      url: `/api/v1/competitor/${asin}/history`,
      method: "get",
      params: { marketplace },
    });
  },

  lookup(data: any): Promise<ApiResponse<CompetitorProductRaw[]>> {
    return request({
      url: "/api/v1/competitor/lookup",
      method: "post",
      data,
    });
  },

  getQuota(): Promise<any> {
    return request({ url: "/api/v1/competitor/quota", method: "get" });
  },

  updateQuota(data: Record<string, number>): Promise<any> {
    return request({ url: "/api/v1/competitor/quota", method: "put", data });
  },

  // 精筛配置
  getFilterConfig(marketplace = "UK"): Promise<any> {
    return request({
      url: "/api/v1/filter-config",
      method: "get",
      params: { marketplace },
    });
  },

  updateFilterConfig(
    data: Record<string, number>,
    marketplace = "UK",
    dataMonth?: string,
    reapply = false,
  ): Promise<any> {
    // 如果未传 dataMonth，使用当前年月
    if (!dataMonth) {
      const now = new Date();
      dataMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return request({
      url: "/api/v1/filter-config",
      method: "put",
      params: { marketplace, dataMonth, reapply },
      data,
    });
  },

  // 初筛配置
  getInitialFilterConfig(marketplace = "UK"): Promise<any> {
    return request({
      url: "/api/v1/filter-config/initial",
      method: "get",
      params: { marketplace },
    });
  },

  updateInitialFilterConfig(
    data: Record<string, number>,
    marketplace = "UK",
  ): Promise<any> {
    return request({
      url: "/api/v1/filter-config/initial",
      method: "put",
      params: { marketplace },
      data,
    });
  },

  // 邓总店铺
  getDengZongShopList(params: Record<string, any>): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/products",
      method: "get",
      params,
    });
  },

  // 邓总店铺卖家
  getDengZongShopSellers(params?: { marketplace?: string }): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/sellers",
      method: "get",
      params,
    });
  },
  getDengZongShopSellerSummary(params?: {
    marketplace?: string;
    batchDate?: string;
  }): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/seller-summary",
      method: "get",
      params,
    });
  },
  getDengZongShopCompleteness(marketplace: string): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/completeness",
      method: "get",
      params: { marketplace },
    });
  },
  createDengZongShopSeller(data: Record<string, any>): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/sellers",
      method: "post",
      data,
    });
  },
  updateDengZongShopSeller(
    id: number,
    data: Record<string, any>,
  ): Promise<any> {
    return request({
      url: `/api/v1/deng-zong-shop/sellers/${id}`,
      method: "put",
      data,
    });
  },
  deleteDengZongShopSeller(id: number): Promise<any> {
    return request({
      url: `/api/v1/deng-zong-shop/sellers/${id}`,
      method: "delete",
    });
  },
  syncDengZongShop(data: {
    sellerName: string;
    marketplace: string;
  }): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/sync",
      method: "post",
      data,
      timeout: 120000,
    });
  },
  getDengZongVariants(marketplace: string, parentAsin: string): Promise<any> {
    return request({
      url: "/api/v1/deng-zong-shop/variants",
      method: "get",
      params: { marketplace, parentAsin },
    });
  },

  // 手动重新筛选（不改配置，仅重新跑筛选逻辑）
  reapplyFilter(
    marketplace: string,
    dataMonth?: string,
  ): Promise<ApiResponse<any>> {
    return request({
      url: "/api/v1/filter-config/reapply",
      method: "post",
      params: { marketplace, dataMonth },
    });
  },
};

export function getDengZongMaxBatchDate(marketplace: string) {
  return request.get("/api/v1/deng-zong-shop/max-batch-date", {
    params: { marketplace },
  });
}

/**
 * 获取入库批次列表（按 created_at 实时计算的 ISO 周 + 每周条数，按周倒序，第一条为最新批次）。
 * @param source 来源（竞品/新品/郑总），按 LIKE 匹配；省略则不限来源
 * @param filterMode 筛选模式，默认 MODE1
 */
export function getCreatedWeeks(
  marketplace: string,
  source?: string,
  filterMode = "MODE1",
): Promise<ApiResponse<BatchWeek[]>> {
  return request.get("/api/v1/competitor/created-weeks", {
    params: { marketplace, source, filterMode },
  });
}
