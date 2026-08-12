import request from "@/utils/request";

/** Result<T> 响应包装 */
interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

/** 库存批次到货明细（后端 lingxing_inventory_batch_detail 映射） */
export interface InventoryBatchDetail {
  id: number;
  batchNo: string;
  sku: string;
  developer: string;
  operator: string | null;
  skuPrefix: string;
  dataDate: string;
  goodNum: number;
  goodTransitNum: number;
  totalNum: number;
  balanceNum: number;
  transitBalanceNum: number;
  whName: string;
  typeName: string;
  purchaseInTime: string;
  purchaseOrderSns: string;
  planSn: string;
  syncedAt: string;
  createdAt: string;
}

/** 分页查询响应 */
export interface InventoryBatchPage {
  records: InventoryBatchDetail[];
  total: number;
  size: number;
  current: number;
  availableDates: string[];
}

/** 同步结果 */
export interface InventoryBatchSyncResult {
  runId: string;
  fetched: number;
  upserted: number;
  pages?: number;
  skippedNoPrefix?: number;
}

export interface InventoryBatchQueryParams {
  current?: number;
  size?: number;
  developer?: string;
  dataDate?: string;
  sku?: string;
}

export interface InventoryBatchSyncParams {
  startDate?: string;
  endDate?: string;
  developer?: string;
}

/** Result<T> 解包：业务 code 非 200 时拒绝 */
function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  return promise.then((response) => {
    if (!response || typeof response !== "object") {
      throw new Error("到货看板接口响应格式错误");
    }
    const result = response as Partial<ApiEnvelope<T>>;
    if (result.code !== 200) {
      throw new Error(
        result.message || `请求失败 (${String(result.code ?? "unknown")})`,
      );
    }
    return result.data as T;
  });
}

/** 分页查询批次明细（到货看板数据） */
export function listInventoryBatch(
  params: InventoryBatchQueryParams,
): Promise<InventoryBatchPage> {
  return unwrap<InventoryBatchPage>(
    request({
      url: "/api/v1/modules/lingxing/inventory-batch",
      method: "get",
      params,
    }),
  );
}

/** 手动触发同步（分页拉取，放大超时到 10 分钟） */
export function syncInventoryBatch(
  data: InventoryBatchSyncParams,
): Promise<InventoryBatchSyncResult> {
  return unwrap<InventoryBatchSyncResult>(
    request({
      url: "/api/v1/modules/lingxing/inventory-batch/sync",
      method: "post",
      data,
      timeout: 600000,
    }),
  );
}
