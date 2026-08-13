export type LcsStatus = "draft" | "asset" | "copy" | "ready";
export type LcsMskuCardTone = "blocked" | "pending_upload" | "uploaded";

export interface LcsMskuCardPoint {
	msku: string;
	amazonAccount: string;
	variantLabel: string;
	cardPoint: string;
	tone: LcsMskuCardTone;
}

export interface LcsActivityTimelineItem {
	time: string;
	content: string;
	operator?: string;
}

export interface LcsSkuRow {
	sku: string;
	title: string;
	category: string;
	accounts: string[];
	variants: string[];
	mskuCardPoints: LcsMskuCardPoint[];
	mskuCount: number;
	productImagesDone: number;
	productImagesTotal: number;
	aPlusImagesDone: number;
	aPlusImagesTotal: number;
	copyPercent: number;
	status: LcsStatus;
	updatedAt: string;
	thumbStyle: Record<string, string>;
	activityTimeline: LcsActivityTimelineItem[];
}

export const LCS_MARKETPLACES = ["UK", "DE", "FR", "IT", "ES"] as const;
export type LcsMarketplace = (typeof LCS_MARKETPLACES)[number];

export const LCS_SITE_LOCALE: Record<LcsMarketplace, string> = {
	UK: "EN",
	DE: "DE",
	FR: "FR",
	IT: "IT",
	ES: "ES"
};

export interface LcsWorkbenchMsku {
	id: string;
	msku: string;
	selectedVariantId?: string;
	amazonAccount: string;
	variantLabel: string;
	sites: string[];
	owner: string;
	asin: string;
	workItemId?: number;
	currentAiTaskId?: number | null;
}
export type ListingAiRunPhase =
  | "queued"
  | "ai_params_running"
  | "ai_params_done"
  | "ai_params_failed"
  | "ai_copy_running"
  | "ai_copy_done"
  | "ai_copy_failed"
  | "params_running"
  | "copy_running"
  | "awaiting_review"
  | "accepted"
  | "rejected"
  | "superseded"
  | "done"
  | "closed"
  | "failed"
  | "cancelled";

export function mapStatusToPhase(status: number, stage?: string): ListingAiRunPhase {
  if (status === 390) {
    const s = String(stage || "").toLowerCase();
    if (s === "review_approved" || s === "accepted") return "done";
    if (s === "review_closed") return "closed";
    return "awaiting_review";
  }
  if (status === 900) return "failed";
  if (status === 990) return "cancelled";
  if (status >= 300) return "ai_copy_done";
  if (status >= 200) return "ai_copy_running";
  if (status >= 190) return "ai_params_done";
  if (status >= 110) return "ai_params_running";
  return "queued";
}

export function phaseLabel(phase: ListingAiRunPhase): string {
  const labels: Record<ListingAiRunPhase, string> = {
    queued: "排队中",
    ai_params_running: "AI 选参中",
    ai_params_done: "选参完成",
    ai_params_failed: "选参失败",
    ai_copy_running: "文案生成中",
    ai_copy_done: "文案完成",
    ai_copy_failed: "文案失败",
    params_running: "选词调研中",
    copy_running: "文案生成中",
    awaiting_review: "待审核",
    accepted: "已确认",
    rejected: "已废弃",
    superseded: "已替代",
    done: "已完成",
    closed: "已关闭",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[phase] || phase;
}

export function phaseTagType(
  phase: ListingAiRunPhase
): "success" | "warning" | "danger" | "info" {
  if (phase === "done") return "success";
  if (phase === "closed") return "info";
  if (phase === "accepted" || phase === "ai_params_done" || phase === "ai_copy_done")
    return "success";
  if (phase === "awaiting_review") return "warning";
  if (phase === "ai_params_running" || phase === "ai_copy_running") return "warning";
  if (phase === "failed") return "danger";
  if (phase === "ai_params_failed" || phase === "ai_copy_failed" || phase === "rejected")
    return "danger";
  if (phase === "cancelled") return "info";
  if (phase === "superseded") return "info";
  return "warning";
}

export function snapshotKeywordRoleLabel(role: string): string {
  if (role === "core_head") return "核心大词";
  if (role === "long_tail") return "长尾词";
  return "核心词";
}
