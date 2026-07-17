export const BASELINE_DEVELOPERS = [
  "蒋舒",
  "陈杨",
  "宋凤莉",
  "刘淼",
  "龙梦临",
  "周沁仪",
  "张子轩",
  "黄雨珊",
] as const;

export const UNLABELLED_STATUS = "未标注";

export const BASELINE_STATUSES = [
  "周同步自动新增",
  "正常",
  UNLABELLED_STATUS,
  "待淘汰",
  "淘汰",
  "季节性断货",
] as const;

export type BaselineDeveloper = (typeof BASELINE_DEVELOPERS)[number];
export type BaselineStatus = (typeof BASELINE_STATUSES)[number];
export type TagType = "primary" | "success" | "warning" | "info" | "danger";

export interface BaselineEditablePatch {
  developer?: string | null;
  listingTags?: string | null;
  modelStartMonth?: string | null;
  modelStartBasis?: string | null;
  analysisStatus?: string | null;
}

export interface LatestRequestGuard {
  begin: () => number;
  isLatest: (requestId: number) => boolean;
  finish: (requestId: number) => boolean;
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let latestRequestId = 0;
  return {
    begin() {
      latestRequestId += 1;
      return latestRequestId;
    },
    isLatest(requestId) {
      return requestId === latestRequestId;
    },
    finish(requestId) {
      return requestId === latestRequestId;
    },
  };
}

export function buildMonthOptions(current = new Date(), count = 24): string[] {
  const cursor = new Date(current.getFullYear(), current.getMonth(), 1);
  const months: string[] = [];

  for (let index = 0; index < Math.max(0, count); index += 1) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return months;
}

export function normalizeDeveloper(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function normalizeAnalysisStatus(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function normalizeListingTags(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const tags = value
    .split(/[,，、;；\n\r]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? [...new Set(tags)].join(",") : null;
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function normalizeBaselinePatch(
  patch: BaselineEditablePatch,
): BaselineEditablePatch {
  const normalized: BaselineEditablePatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, "developer")) {
    normalized.developer = normalizeDeveloper(patch.developer);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "listingTags")) {
    normalized.listingTags = normalizeListingTags(patch.listingTags);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "modelStartMonth")) {
    normalized.modelStartMonth = normalizeText(patch.modelStartMonth);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "modelStartBasis")) {
    normalized.modelStartBasis = normalizeText(patch.modelStartBasis);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "analysisStatus")) {
    normalized.analysisStatus = normalizeAnalysisStatus(patch.analysisStatus);
  }
  return normalized;
}

export function validateBaselinePatch(patch: BaselineEditablePatch): string[] {
  const errors: string[] = [];
  const normalized = normalizeBaselinePatch(patch);
  const developer = normalized.developer;
  const month = normalized.modelStartMonth ?? "";
  const status = normalized.analysisStatus;

  if (
    developer &&
    !BASELINE_DEVELOPERS.includes(developer as BaselineDeveloper)
  ) {
    errors.push("开发人不在团队名单中");
  }
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    errors.push("起算月格式不正确");
  }
  if (status && !BASELINE_STATUSES.includes(status as BaselineStatus)) {
    errors.push("分析状态不合法");
  }
  if ((normalized.listingTags?.length ?? 0) > 1000) {
    errors.push("领星标签长度不能超过 1000 个字符");
  }
  if ((normalized.modelStartBasis?.length ?? 0) > 255) {
    errors.push("起算依据长度不能超过 255 个字符");
  }

  return errors;
}

export function tagVariant(tag: string): TagType {
  if (tag.includes("待淘汰")) return "warning";
  if (tag.includes("淘汰")) return "danger";
  if (tag.includes("断货")) return "warning";
  if (tag.includes("绿标")) return "success";
  if (tag.includes("非标品")) return "info";
  return "primary";
}

export function statusTagType(status: string | null | undefined): TagType {
  if (!status || status.includes(UNLABELLED_STATUS)) return "info";
  if (status.includes("待淘汰") || status.includes("断货")) {
    return "warning";
  }
  if (status.includes("淘汰")) return "danger";
  if (status.includes("新增")) return "success";
  return "primary";
}
