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
};
