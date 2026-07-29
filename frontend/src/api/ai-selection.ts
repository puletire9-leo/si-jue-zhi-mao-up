import request from "@/utils/request";

const BASE = "/api/v1/ai-selection";

/** AI 选品产品（后端 camelCase，直接兼容 UniversalCard） */
export interface AiSelectionProduct {
  asin: string;
  productTitle: string;
  imageUrl: string;
  price: number | null;
  marketplace: string;
  bsr: number | null;
  units: number | null;
  unitsGr: number | null;
  sellerName: string;
  mainCategoryName: string;
  availableDate: number | null;
  createdAt: string | null;
  symbol: string;
  rating: number | null;
  ratings: number | null;
  fulfillment: string;
  sourceTable: string;
  productUrl: string;
  listingDays: number | null;
}

export interface PushBatch {
  id: string;
  message: string;
  pushedAt: string;
  total: number;
  requested: number;
  invalidAsins: string[];
  products: AiSelectionProduct[];
}

export interface SessionResponse {
  batches: PushBatch[];
}

export interface PushResponse {
  batchId: string;
  total: number;
  requested: number;
  invalidAsins: string[];
  products: AiSelectionProduct[];
  message: string;
}

export interface AsinLookupResponse {
  total: number;
  requested: number;
  invalidAsins: string[];
  products: AiSelectionProduct[];
}

// 响应拦截器已解包为业务对象，这里直接把结果断言为对应结构。
function unwrap<T>(p: Promise<unknown>): Promise<T> {
  return p.then((res) => res as T);
}

/** AI Agent 投递 ASIN — 调 API 后前端自动轮询展示 */
export function pushAsins(
  asins: string[],
  options?: { marketplace?: string; message?: string },
): Promise<PushResponse> {
  return unwrap<PushResponse>(
    request.post(`${BASE}/push`, {
      asins,
      marketplace: options?.marketplace,
      message: options?.message,
    }),
  );
}

/** 前端轮询 — 首次取最近批次，后续只取指定批次之后的增量 */
export function getSession(
  afterBatchId?: string,
  limit = 10,
): Promise<SessionResponse> {
  return unwrap<SessionResponse>(
    request.get(`${BASE}/session`, {
      params: { afterBatchId, limit },
    }),
  );
}

/** 清空当前用户会话 */
export function clearSession(): Promise<{ message: string }> {
  return unwrap<{ message: string }>(request.delete(`${BASE}/session`));
}

/** 一次性 ASIN 查询（不入会话） */
export function lookupAsins(
  asins: string[],
  marketplace?: string,
): Promise<AsinLookupResponse> {
  return unwrap<AsinLookupResponse>(
    request.post(`${BASE}/lookup`, { asins, marketplace }),
  );
}
