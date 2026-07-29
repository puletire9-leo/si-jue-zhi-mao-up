import request from "@/utils/request";

const MODEL_BASE = "/api/v1/product-line";

export function getProductLineModel(
  nodeId: number,
  marketplace: string,
  batchId?: string,
) {
  const params: Record<string, any> = { marketplace };
  if (batchId) params.batchId = batchId;
  return request.get(`${MODEL_BASE}/model/${nodeId}`, { params });
}

export function getProductLineElements(
  nodeId: number,
  marketplace: string,
  month?: string,
) {
  return request.get(`${MODEL_BASE}/elements`, {
    params: { node_id: nodeId, marketplace, month },
  });
}

export function getAggregatedData(marketplace: string, month: string) {
  return request.get(`${MODEL_BASE}/aggregated-data`, {
    params: { marketplace, month },
  });
}

/**
 * 品线树。跟随批次改造后优先按 batchDates(单天 yyyy-MM-dd)取数;
 * 未传 batchDates 时后端回退取最新批次。month 参数保留兼容旧调用。
 */
export function getTree(
  marketplace: string,
  options?: {
    batchDates?: string[];
    methodId?: string;
    month?: string;
    dataSource?: "all" | "new" | "shop";
  },
) {
  return request.get(`${MODEL_BASE}/tree`, {
    params: {
      marketplace,
      ...(options?.batchDates?.length
        ? { batchDates: options.batchDates }
        : {}),
      ...(options?.month ? { month: options.month } : {}),
      ...(options?.methodId ? { methodId: options.methodId } : {}),
      ...(options?.dataSource ? { dataSource: options.dataSource } : {}),
    },
  });
}

export function getModelMd(nodeId: number, marketplace: string) {
  return request.get(`${MODEL_BASE}/model/${nodeId}/md`, {
    params: { marketplace },
  });
}
