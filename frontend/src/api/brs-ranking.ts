import request from "@/utils/request";
import {
  normalizeProduct,
  type BatchWeek,
  type CompetitorListParams,
  type CompetitorListResponse,
} from "./competitor";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1/brs-ranking";

export const brsRankingApi = {
  /** BRS 榜单分页筛选（请求体结构与 competitor/products 一致，返回结构同 CompetitorProductResponse） */
  getList(
    params: CompetitorListParams,
  ): Promise<ApiResponse<CompetitorListResponse>> {
    return request({
      url: `${BASE}/products`,
      method: "post",
      data: params,
    }).then((res: any) => {
      if (res.data?.list) {
        res.data.list = res.data.list.map(normalizeProduct);
      }
      return res;
    });
  },
};

export function getCreatedWeeks(
  marketplace: string,
): Promise<ApiResponse<BatchWeek[]>> {
  return request.get(`${BASE}/created-weeks`, { params: { marketplace } });
}
