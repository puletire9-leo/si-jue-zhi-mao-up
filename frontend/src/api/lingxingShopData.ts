/**
 * 领星店铺数据选品 API（Java sjzm-product，lingxing_product_unified 统一表）。
 * 复用 AllSelection 选品页框架，数据源是我们自己的领星数据。
 */
import request from "@/utils/request";

const BASE = "/api/v1/modules/lingxing";

export interface LingxingShopQueryParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortOrder?: "desc" | "asc";
  country?: string;
  /** 按领星店铺分类（base_store，空=全部） */
  baseStore?: string;
  developer?: string;
  asin?: string;
  title?: string;
  latestVolumeMin?: number;
  latestVolumeMax?: number;
}

export interface LingxingShopProduct {
  asin: string;
  parentAsin?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  baseStore?: string | null;
  country?: string | null;
  developer?: string | null;
  principal?: string | null;
  latestVolume?: number | null;
  totalVolume?: number | null;
  latestAmount?: number | null;
  totalAmount?: number | null;
  listingDate?: string | null;
  latestFbaAvailable?: number | null;
  latestCateRank?: string | null;
  latestReviewsCount?: number | null;
  latestAvgStar?: number | null;
  latestMonth?: string | null;
  listingTags?: string | null;
  // 实时字段（JOIN listing）
  price?: number | null;
  currencyCode?: string | null;
  sellerRank?: number | null;
  reviewNum?: number | null;
  lastStar?: number | null;
  fulfillmentChannelType?: string | null;
  thirtyVolume?: number | null;
  sellerBrand?: string | null;
}

export interface LingxingShopListResponse {
  list: LingxingShopProduct[];
  total: number;
  page: number;
  size: number;
}

export interface LingxingShopStore {
  store: string;
  count: number;
}

/** 分页查询领星店铺数据选品列表 */
export function shopProducts(
  params: LingxingShopQueryParams,
): Promise<LingxingShopListResponse> {
  return request({
    url: `${BASE}/shop-products`,
    method: "post",
    data: params,
  }).then((res: any) => {
    if (res?.data) return res.data as LingxingShopListResponse;
    return res as unknown as LingxingShopListResponse;
  });
}

/** 按领星店铺分类下拉（country 可空=全部） */
export function shopStores(country?: string): Promise<LingxingShopStore[]> {
  return request({
    url: `${BASE}/shop-stores`,
    method: "get",
    params: country ? { country } : {},
  }).then((res: any) => (res?.data as LingxingShopStore[]) ?? []);
}
