import request from "@/utils/request";
import type { ApiResponse } from "@/types/api";
import {
  normalizeProduct,
  type CompetitorListResponse,
} from "@/api/competitor";

export interface MethodCardListParams {
  marketplace?: "UK" | "DE" | "US";
  month?: string;
  createdWeek?: string;
  createdWeeks?: string[];
  batchDate?: string;
  bsrId?: string;
  nodeId?: number | string;
  page?: number;
  size?: number;
}

export const methodCardsApi = {
  getM01Products(
    params: MethodCardListParams,
  ): Promise<ApiResponse<CompetitorListResponse>> {
    return request({
      url: "/api/v1/method-cards/M01/products",
      method: "get",
      params,
      paramsSerializer: { indexes: null },
    }).then((res: any) => {
      if (res.data?.list) {
        res.data.list = res.data.list.map(normalizeProduct);
      }
      return res;
    });
  },

  getM02Products(
    params: MethodCardListParams,
  ): Promise<ApiResponse<CompetitorListResponse>> {
    return request({
      url: "/api/v1/method-cards/M02/products",
      method: "get",
      params,
    }).then((res: any) => {
      if (res.data?.list) {
        res.data.list = res.data.list.map(normalizeProduct);
      }
      return res;
    });
  },

  // M03 FBM 自发货简单道 - 与 M01/M02 独立平行, 后端 /api/v1/method-cards/M03/products
  getM03Products(
    params: MethodCardListParams,
  ): Promise<ApiResponse<CompetitorListResponse>> {
    return request({
      url: "/api/v1/method-cards/M03/products",
      method: "get",
      params,
    }).then((res: any) => {
      if (res.data?.list) {
        res.data.list = res.data.list.map(normalizeProduct);
      }
      return res;
    });
  },

  // M01 达标阈值：查看
  getM01Rule(
    marketplace: "UK" | "DE" | "US",
  ): Promise<ApiResponse<M01Rule>> {
    return request({
      url: "/api/v1/method-cards/M01/rule",
      method: "get",
      params: { marketplace },
    });
  },

  // M01 达标阈值：更新（持久化，立即影响列表查询口径）
  updateM01Rule(
    marketplace: "UK" | "DE" | "US",
    body: Partial<M01RuleEditable>,
  ): Promise<ApiResponse<M01Rule>> {
    return request({
      url: "/api/v1/method-cards/M01/rule",
      method: "put",
      params: { marketplace },
      data: body,
    });
  },
};

/** M01 达标阈值（后端 M01Rule 映射）。bsrMax=null 表示不使用 BSR 判定。 */
export interface M01Rule {
  marketplace: string;
  priceMin: number;
  priceMax: number;
  weightMax: number;
  listingDaysMax: number;
  sales30: number;
  sales60: number;
  sales90: number;
  bsrMax: number | null;
}

/** 可编辑字段（marketplace 不可改，由参数指定）。 */
export type M01RuleEditable = Omit<M01Rule, "marketplace">;
