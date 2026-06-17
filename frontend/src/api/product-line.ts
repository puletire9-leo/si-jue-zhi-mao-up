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

export function getBatches(marketplace: string) {
  return request.get(`${MODEL_BASE}/batches`, { params: { marketplace } });
}

export function getAggregatedData(marketplace: string, month: string) {
  return request.get(`${MODEL_BASE}/aggregated-data`, {
    params: { marketplace, month },
  });
}

export function getAllCategories(marketplace: string, month: string) {
  return request({
    url: "/api/v1/product-line/all-categories",
    method: "get",
    params: { marketplace, month },
  });
}

export function getTree(marketplace: string, month: string) {
  return request.get(`${MODEL_BASE}/tree`, { params: { marketplace, month } });
}

export function getModelMd(nodeId: number, marketplace: string) {
  return request.get(`${MODEL_BASE}/model/${nodeId}/md`, {
    params: { marketplace },
  });
}
