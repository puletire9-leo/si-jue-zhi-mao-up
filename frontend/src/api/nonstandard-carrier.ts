/**
 * 非标载体配置 API（Java 后端，nonstandard_carrier 表）。
 * 载体承载「一类非标品用哪套市场检索词」，供 AI 选品页全量捞取使用。
 */
import request from "@/utils/request";

const BASE = "/api/v1/nonstandard-carrier";

export interface NonstandardCarrier {
  id?: number;
  carrierKey: string;
  name: string;
  /** 标题主词，逗号分隔；% 可匹配有序插词 */
  titleKeywords?: string;
  categoryPaths?: string;
  /** 硬排除词，逗号分隔；两个召回通道都过滤，不能被成品保护词覆盖 */
  excludeKeywords?: string;
  /** 条件排除词，逗号分隔；命中成品保护词时允许救回 */
  conditionalExcludeKeywords?: string;
  /** 成品保护词，逗号分隔；只覆盖条件排除词 */
  includeKeywords?: string;
  note?: string;
  enabled?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 载体列表 */
export function getCarriers(): Promise<NonstandardCarrier[]> {
  return request({ url: `${BASE}/list`, method: "get" }).then(
    (res: any) => (res?.data ?? []) as NonstandardCarrier[],
  );
}

/** 新增/更新载体（带 id 则更新） */
export function saveCarrier(
  carrier: NonstandardCarrier,
): Promise<NonstandardCarrier> {
  return request({ url: BASE, method: "post", data: carrier }).then(
    (res: any) => res?.data as NonstandardCarrier,
  );
}

/** 删除载体 */
export function deleteCarrier(id: number): Promise<void> {
  return request({ url: `${BASE}/${id}`, method: "delete" });
}
