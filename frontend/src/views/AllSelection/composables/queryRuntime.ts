import { competitorApi, type CompetitorListResponse } from "@/api/competitor";
import { methodCardsApi, type MethodCardListParams } from "@/api/methodCards";
import shopCollectionApi, { type ShopProductRow } from "@/api/shopCollection";
import { getList as getAiSelectionList } from "@/api/ai-selection-pool";
import { brsRankingApi } from "@/api/brs-ranking";
import {
  shopProducts as getLingxingShopProducts,
  type LingxingShopProduct,
} from "@/api/lingxingShopData";
import type {
  SelectionQueryPlan,
  CompetitorQueryPlan,
  PremiumProductsQueryPlan,
  DengZongQueryPlan,
  ShopProductsQueryPlan,
  AiSelectionQueryPlan,
  LingxingShopQueryPlan,
  BrsRankingQueryPlan,
  MethodCardQueryPlan,
} from "./queryPlan";
import type { ApiResponse } from "@/types/api";

export interface ResolvedQueryResult {
  list: Record<string, any>[];
  total: number;
}

export interface ResolvedQueryResponse {
  plan: SelectionQueryPlan;
  result: ResolvedQueryResult;
}

async function resolveCompetitorPlan(
  plan: CompetitorQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res: ApiResponse<CompetitorListResponse> = await competitorApi.getList(
    plan.params,
  );
  return {
    plan,
    result: {
      list: res.data?.list ?? [],
      total: res.data?.total ?? 0,
    },
  };
}

async function resolveDengZongPlan(
  plan: DengZongQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res: ApiResponse<CompetitorListResponse> =
    await competitorApi.getDengZongShopList(plan.params);
  return {
    plan,
    result: {
      list: res.data?.list ?? [],
      total: res.data?.total ?? 0,
    },
  };
}

async function resolvePremiumProductsPlan(
  plan: PremiumProductsQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res: ApiResponse<CompetitorListResponse> =
    await competitorApi.getPremiumList(plan.params);
  return {
    plan,
    result: {
      list: res.data?.list ?? [],
      total: res.data?.total ?? 0,
    },
  };
}

function normalizeShopProduct(raw: ShopProductRow): Record<string, any> {
  return {
    ...raw,
    productType: "shop",
    source: "店铺商品",
    productTitle: raw.title || "",
    storeName: raw.sellerName || "",
    productLink: raw.productUrl || "",
    similarProducts: raw.similarUrl || "",
    salesVolume: raw.units ?? 0,
    listingDate: raw.availableDate ?? undefined,
    variantCount: raw.variations ?? 0,
    dataFilterMode: raw.filterMode || "",
  };
}

async function resolveShopProductsPlan(
  plan: ShopProductsQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res = await shopCollectionApi.selectionProducts(plan.params);
  return {
    plan,
    result: {
      list: (res.list ?? []).map(normalizeShopProduct),
      total: res.total ?? 0,
    },
  };
}

async function resolveAiSelectionPlan(
  plan: AiSelectionQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res = await getAiSelectionList(plan.params);
  return {
    plan,
    result: {
      list: res?.list ?? [],
      total: res?.total ?? 0,
    },
  };
}

async function resolveBrsRankingPlan(
  plan: BrsRankingQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res: ApiResponse<CompetitorListResponse> = await brsRankingApi.getList(
    plan.params,
  );
  return {
    plan,
    result: {
      list: res.data?.list ?? [],
      total: res.data?.total ?? 0,
    },
  };
}

/**
 * 领星 small_image_url 存的是 ._SL75_. 缩略图（75px），卡片显示很糊。
 * 把 Amazon CDN 尺寸修饰符统一换成 ._SL500_.（500px），卡片清晰又不过大。
 */
function upgradeAmazonImage(url: string): string {
  if (!url) return "";
  const isAmazon = /(?:m\.media-amazon|images-[a-z]+\.ssl-images-amazon)\.com\//i.test(
    url,
  );
  if (!isAmazon) return url;
  // ._SL75_. / ._AC_SX300_. / .__ac...__. 等 → ._SL500_.
  return url.replace(
    /\.(?:_[^./?#]*_|\*[^./?#]*\*)\.(jpe?g|png|webp)(?=([?#]|$))/i,
    "._SL500_.$1",
  );
}

function normalizeLingxingShopProduct(
  raw: LingxingShopProduct,
): Record<string, any> {
  const img = upgradeAmazonImage(raw.imageUrl || "");
  return {
    ...raw,
    productType: "lingxing_shop",
    source: "领星店铺数据",
    productTitle: raw.title || "",
    imageUrl: img,
    // 统一表用 country(UK/DE)，卡片/点击日志/详情页多处读 marketplace，补一份别名
    marketplace: raw.country || "",
    storeName: raw.baseStore || "",
    // 卡片"销量"用最近月销量
    salesVolume: raw.latestVolume ?? 0,
    // 上架日期（统一字段，首次写入锁定）
    listingDate: raw.listingDate ?? undefined,
    category: raw.latestCateRank || "",
    // 实时字段（JOIN listing）：价格/BSR/评分/评论/品牌/配送，对齐卡片&详情页读的字段名
    price: raw.price ?? undefined,
    symbol: raw.currencyCode || undefined,
    bsr: raw.sellerRank ?? undefined,
    rating: raw.lastStar ?? raw.latestAvgStar ?? undefined,
    ratings: raw.reviewNum ?? raw.latestReviewsCount ?? undefined,
    reviewCount: raw.reviewNum ?? raw.latestReviewsCount ?? undefined,
    brand: raw.sellerBrand || undefined,
    fulfillment: raw.fulfillmentChannelType || undefined,
    deliveryMethod: raw.fulfillmentChannelType || undefined,
  };
}

async function resolveLingxingShopPlan(
  plan: LingxingShopQueryPlan,
): Promise<ResolvedQueryResponse> {
  const res = await getLingxingShopProducts(plan.params);
  return {
    plan,
    result: {
      list: (res.list ?? []).map(normalizeLingxingShopProduct),
      total: res.total ?? 0,
    },
  };
}

async function resolveMethodCardPlan(
  plan: MethodCardQueryPlan,
): Promise<ResolvedQueryResponse> {
  if (plan.methodId === "M01") {
    const res: ApiResponse<CompetitorListResponse> =
      await methodCardsApi.getM01Products(plan.params as MethodCardListParams);
    return {
      plan,
      result: {
        list: res.data?.list ?? [],
        total: res.data?.total ?? 0,
      },
    };
  }
  if (plan.methodId === "M02") {
    const res: ApiResponse<CompetitorListResponse> =
      await methodCardsApi.getM02Products(plan.params as MethodCardListParams);
    return {
      plan,
      result: {
        list: res.data?.list ?? [],
        total: res.data?.total ?? 0,
      },
    };
  }
  if (plan.methodId === "M03") {
    const res: ApiResponse<CompetitorListResponse> =
      await methodCardsApi.getM03Products(plan.params as MethodCardListParams);
    return {
      plan,
      result: {
        list: res.data?.list ?? [],
        total: res.data?.total ?? 0,
      },
    };
  }
  throw new Error(`Unknown method card: ${plan.methodId}`);
}

export async function resolveSelectionQueryPlan(
  plan: SelectionQueryPlan,
): Promise<ResolvedQueryResponse> {
  switch (plan.executor) {
    case "competitor":
      return resolveCompetitorPlan(plan);
    case "premium_products":
      return resolvePremiumProductsPlan(plan);
    case "deng_zong":
      return resolveDengZongPlan(plan);
    case "shop_products":
      return resolveShopProductsPlan(plan);
    case "ai_selection":
      return resolveAiSelectionPlan(plan);
    case "brs_ranking":
      return resolveBrsRankingPlan(plan);
    case "lingxing_shop":
      return resolveLingxingShopPlan(plan);
    case "method_card":
      return resolveMethodCardPlan(plan);
    default:
      throw new Error(
        `Unknown executor: ${(plan as SelectionQueryPlan).executor}`,
      );
  }
}
