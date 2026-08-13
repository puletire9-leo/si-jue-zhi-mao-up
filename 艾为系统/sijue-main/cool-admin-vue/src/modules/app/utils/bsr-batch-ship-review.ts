export type BatchShipReviewStatus =
	| "draft"
	| "pending_review"
	| "rejected"
	| "approved"
	| "executing"
	| "execute_success"
	| "execute_partial_failed"
	| "execute_failed";

export type BatchShipReviewAction = "restore" | "withdraw" | "approve" | "reject" | "execute";

export type BatchShipReviewStatusMeta = {
	text: string;
	type: "primary" | "success" | "warning" | "danger" | "info";
	tone: "neutral" | "active" | "success" | "warning" | "danger";
	description: string;
};

export const REVIEW_STATUS_OPTIONS: Array<{
	label: string;
	value: BatchShipReviewStatus;
}> = [
	{ label: "草稿", value: "draft" },
	{ label: "待审核", value: "pending_review" },
	{ label: "已驳回", value: "rejected" },
	{ label: "已通过", value: "approved" },
	{ label: "发送中", value: "executing" },
	{ label: "发送成功", value: "execute_success" },
	{ label: "部分失败", value: "execute_partial_failed" },
	{ label: "发送失败", value: "execute_failed" }
];

export const REVIEW_FAILED_STATUS_FILTER = "execute_abnormal";

export const REVIEW_FAILED_STATUS_VALUES: BatchShipReviewStatus[] = [
	"execute_failed",
	"execute_partial_failed"
];

const REVIEW_STATUS_META: Record<BatchShipReviewStatus, BatchShipReviewStatusMeta> = {
	draft: {
		text: "草稿",
		type: "info",
		tone: "neutral",
		description: "可继续修改和提交审核"
	},
	pending_review: {
		text: "待审核",
		type: "warning",
		tone: "active",
		description: "等待审核人确认，不会直接发送"
	},
	rejected: {
		text: "已驳回",
		type: "danger",
		tone: "danger",
		description: "可还原修改后重新提交"
	},
	approved: {
		text: "已通过",
		type: "success",
		tone: "success",
		description: "审核已通过，可手动发送"
	},
	executing: {
		text: "发送中",
		type: "primary",
		tone: "active",
		description: "正在调用旧批量发货链路"
	},
	execute_success: {
		text: "发送成功",
		type: "success",
		tone: "success",
		description: "已生成旧批量发货执行批次"
	},
	execute_partial_failed: {
		text: "部分失败",
		type: "warning",
		tone: "warning",
		description: "部分发货计划创建失败，可重新发送"
	},
	execute_failed: {
		text: "发送失败",
		type: "danger",
		tone: "danger",
		description: "未完成发送，可重新发送"
	}
};

export const REVIEW_ACTION_TEXT: Record<BatchShipReviewAction, string> = {
	restore: "修改",
	withdraw: "撤回",
	approve: "审核通过",
	reject: "驳回",
	execute: "发送"
};

export const METHOD_META: Record<string, { label: string; icon: string; color: string }> = {
	express: { label: "快递", icon: "🚚", color: "#f56c6c" },
	air: { label: "空快", icon: "✈️", color: "#409eff" },
	air_slow: { label: "空慢", icon: "✈️", color: "#67b8ff" },
	truck: { label: "卡车", icon: "🚛", color: "#67c23a" },
	rail: { label: "铁路", icon: "🚂", color: "#e6a23c" },
	sea: { label: "海运", icon: "🚢", color: "#13a8a8" }
};

export function getReviewStatusMeta(status: any): BatchShipReviewStatusMeta {
	return (
		REVIEW_STATUS_META[String(status || "draft") as BatchShipReviewStatus] || {
			text: status ? String(status) : "未知",
			type: "info",
			tone: "neutral",
			description: "未知状态"
		}
	);
}

export function canReviewAction(status: any, action: BatchShipReviewAction) {
	const value = String(status || "");
	const rules: Record<BatchShipReviewAction, string[]> = {
		restore: ["draft", "rejected"],
		withdraw: ["pending_review"],
		approve: ["pending_review"],
		reject: ["pending_review"],
		execute: ["approved", "execute_failed", "execute_partial_failed"]
	};
	return rules[action].includes(value);
}

export function getMethodMeta(methodKey: any, fallbackLabel = "") {
	const key = String(methodKey || "");
	return METHOD_META[key] || { label: fallbackLabel || key || "-", icon: "📦", color: "#909399" };
}

export function formatReviewNumber(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "0";
	return num.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function formatReviewTime(value: any) {
	if (!value) return "-";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	const pad = (num: number) => String(num).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours()
	)}:${pad(date.getMinutes())}`;
}

export function pickReviewPageList(response: any) {
	if (Array.isArray(response)) return response;
	if (Array.isArray(response?.list)) return response.list;
	if (Array.isArray(response?.data?.list)) return response.data.list;
	return [];
}

export function pickReviewPagination(response: any, fallback = { page: 1, size: 20, total: 0 }) {
	return response?.pagination || response?.data?.pagination || fallback;
}

export function pickReviewStatusCounts(response: any) {
	const source =
		response?.status_counts ||
		response?.statusCounts ||
		response?.data?.status_counts ||
		response?.data?.statusCounts ||
		{};
	const counts: Record<string, number> = { all: Number(source.all) || 0 };

	REVIEW_STATUS_OPTIONS.forEach((item) => {
		counts[item.value] = Number(source[item.value]) || 0;
	});

	if (!counts.all) {
		counts.all = REVIEW_STATUS_OPTIONS.reduce(
			(total, item) => total + (counts[item.value] || 0),
			0
		);
	}

	return counts;
}

export function getReviewStatusCount(counts: Record<string, number>, status: string) {
	if (!status) return Number(counts?.all) || 0;
	if (status === REVIEW_FAILED_STATUS_FILTER) {
		return REVIEW_FAILED_STATUS_VALUES.reduce(
			(total, item) => total + (Number(counts?.[item]) || 0),
			0
		);
	}
	return Number(counts?.[status]) || 0;
}

export function buildReviewQuickStatusCards(counts: Record<string, number>) {
	return [
		{
			key: "all",
			label: "全部",
			status: "",
			count: getReviewStatusCount(counts, ""),
			tone: "neutral"
		},
		{
			key: "draft",
			label: "草稿",
			status: "draft",
			count: getReviewStatusCount(counts, "draft"),
			tone: "neutral"
		},
		{
			key: "pending",
			label: "待审核",
			status: "pending_review",
			count: getReviewStatusCount(counts, "pending_review"),
			tone: "active"
		},
		{
			key: "rejected",
			label: "已驳回",
			status: "rejected",
			count: getReviewStatusCount(counts, "rejected"),
			tone: "danger"
		},
		{
			key: "approved",
			label: "可发送",
			status: "approved",
			count: getReviewStatusCount(counts, "approved"),
			tone: "success"
		},
		{
			key: "failed",
			label: "发送异常",
			status: REVIEW_FAILED_STATUS_FILTER,
			count: getReviewStatusCount(counts, REVIEW_FAILED_STATUS_FILTER),
			tone: "danger"
		}
	];
}

export function buildReviewStatusOptionsWithCount(counts: Record<string, number>) {
	return [
		{
			label: "发送异常",
			value: REVIEW_FAILED_STATUS_FILTER,
			count: getReviewStatusCount(counts, REVIEW_FAILED_STATUS_FILTER),
			aggregate: true
		},
		...REVIEW_STATUS_OPTIONS.map((item) => ({
			...item,
			count: getReviewStatusCount(counts, item.value),
			aggregate: false
		}))
	];
}

export function getReviewStatusFilterValues(status: string) {
	return status === REVIEW_FAILED_STATUS_FILTER ? [...REVIEW_FAILED_STATUS_VALUES] : [];
}

export function getReviewStatusFilterParam(status: string) {
	return status === REVIEW_FAILED_STATUS_FILTER ? "" : status;
}

export function normalizeReviewSummary(row: any) {
	const summary = row?.summary_json || row?.summary || {};
	return {
		totalShipQty:
			Number(row?.total_ship_qty ?? summary.total_ship_qty ?? summary.totalShipQty ?? 0) || 0,
		productCount:
			Number(row?.product_count ?? summary.product_count ?? summary.productCount ?? 0) || 0,
		segmentCount:
			Number(row?.segment_count ?? summary.segment_count ?? summary.segmentCount ?? 0) || 0,
		orderCount: Number(row?.order_count ?? summary.order_count ?? summary.orderCount ?? 0) || 0,
		methodCount:
			Number(row?.method_count ?? summary.method_count ?? summary.methodCount ?? 0) || 0,
		warehouseCount:
			Number(
				row?.warehouse_count ?? summary.warehouse_count ?? summary.warehouseCount ?? 0
			) || 0
	};
}

export function buildReviewActionPayload(row: any, remark = "") {
	return {
		review_no: row?.review_no || row?.reviewNo || "",
		remark
	};
}
