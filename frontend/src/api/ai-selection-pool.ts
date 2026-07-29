/**
 * AI 选品池 API（Java 后端，ai_selection 持久表）。
 * 与原有的 ai-selection.ts（Python 会话模型）不同，本模块对接 Java Controller 的 CRUD 操作。
 */
import request from "@/utils/request";
import type { CompetitorListParams, CompetitorListResponse } from "./competitor";

const BASE = "/api/v1/ai-selection-pool";

// ── 类型定义 ───────────────────────────────────────────────

export interface AiSelectionPoolListParams extends CompetitorListParams {
  batchIds?: string[];
  batchLabel?: string;
  carriers?: string[];
  methodId?: string;
}

export interface AiSelectionPushRequest {
  asins: string[];
  marketplace: string;
  batchLabel?: string;
}

export interface AiSelectionProductBrief {
  asin: string;
  title: string;
  imageUrl: string;
  marketplace: string;
  sourceRef: string;
  batchId: string;
}

export interface AiSelectionPushResponse {
  batchId: string;
  batchLabel: string;
  total: number;
  requested: number;
  invalidAsins: string[];
  products: AiSelectionProductBrief[];
}

export interface AiSelectionBatchInfo {
  batchId: string;
  batchLabel: string;
  pushedBy: string;
  pushedAt: string;
  productCount: number;
}

// ── API 方法 ───────────────────────────────────────────────

/** 分页查询 AI 选品列表（对接选品框架 queryPlan） */
export function getList(
  params: AiSelectionPoolListParams,
): Promise<CompetitorListResponse> {
  return request({
    url: `${BASE}/products`,
    method: "post",
    data: params,
  }).then((res: any) => {
    // 标准响应解包：{ code, data: { list, total, page, size } }
    if (res?.data) {
      return res.data as CompetitorListResponse;
    }
    return res as unknown as CompetitorListResponse;
  });
}

/** AI Agent 投递 ASIN */
export function pushAsins(
  params: AiSelectionPushRequest,
): Promise<AiSelectionPushResponse> {
  return request({
    url: `${BASE}/push`,
    method: "post",
    data: params,
  }).then((res: any) => {
    return res?.data as AiSelectionPushResponse;
  });
}

/** 手动导入 ASIN */
export function importAsins(
  params: AiSelectionPushRequest,
): Promise<AiSelectionPushResponse> {
  return request({
    url: `${BASE}/import`,
    method: "post",
    data: params,
  }).then((res: any) => {
    return res?.data as AiSelectionPushResponse;
  });
}

/** 按载体多站点增量捞取：一次请求多国合并为「一个批次」，
 *  相对 载体+站点+ASIN 历史去重，只灌新增（从 shop_products / competitor_products_clean 双通道 INSERT SELECT）。 */
export function harvest(
  carrierKey: string,
  marketplaces: string[],
): Promise<AiSelectionPushResponse> {
  return request({
    url: `${BASE}/harvest`,
    method: "post",
    data: { carrierKey, marketplaces },
  }).then((res: any) => res?.data as AiSelectionPushResponse);
}

/** 批次列表（RangeFilterPanel 用） */
export function getBatches(
  marketplace: string,
): Promise<AiSelectionBatchInfo[]> {
  return request({
    url: `${BASE}/batches`,
    method: "get",
    params: { marketplace },
  }).then((res: any) => {
    return res?.data as AiSelectionBatchInfo[];
  });
}

/** 大类目统计 */
export function getCategories(
  marketplace: string,
  batchIds?: string[],
): Promise<Array<{ category: string; count: number }>> {
  return request({
    url: `${BASE}/categories`,
    method: "get",
    params: { marketplace, batchIds },
  }).then((res: any) => {
    return res?.data as Array<{ category: string; count: number }>;
  });
}

/** 删除批次及其商品 */
export function deleteBatch(batchId: string): Promise<void> {
  return request({
    url: `${BASE}/batches/${batchId}`,
    method: "delete",
  });
}
