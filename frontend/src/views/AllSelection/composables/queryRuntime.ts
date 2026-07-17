import { competitorApi, type CompetitorListResponse } from "@/api/competitor";
import { methodCardsApi, type MethodCardListParams } from "@/api/methodCards";
import shopCollectionApi, { type ShopProductRow } from "@/api/shopCollection";
import type {
  SelectionQueryPlan,
  CompetitorQueryPlan,
  PremiumProductsQueryPlan,
  DengZongQueryPlan,
  ShopProductsQueryPlan,
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
    case "method_card":
      return resolveMethodCardPlan(plan);
    default:
      throw new Error(
        `Unknown executor: ${(plan as SelectionQueryPlan).executor}`,
      );
  }
}
