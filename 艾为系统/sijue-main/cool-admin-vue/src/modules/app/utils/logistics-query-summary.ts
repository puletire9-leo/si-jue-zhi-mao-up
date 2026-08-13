export type LogisticsPackageRow = Record<string, any>;

export type LogisticsPackageSnapshot = Map<string, number | null>;

export interface LogisticsQuerySummary {
	total: number;
	realQueryCount: number;
	skippedCount: number;
	reasons: Record<string, number>;
}

export function buildPackageSnapshot(rows: LogisticsPackageRow[] = []): LogisticsPackageSnapshot {
	const snapshot = new Map<string, number | null>();
	rows.forEach((row, index) => {
		snapshot.set(getPackageKey(row, index), parseQueryTime(row?.last_query_time || row?.last_sync_time));
	});
	return snapshot;
}

export function buildLogisticsQuerySummary(
	rows: LogisticsPackageRow[] = [],
	before: LogisticsPackageSnapshot | LogisticsPackageRow[] = []
): LogisticsQuerySummary {
	const snapshot = before instanceof Map ? before : buildPackageSnapshot(before);
	const summary: LogisticsQuerySummary = {
		total: rows.length,
		realQueryCount: 0,
		skippedCount: 0,
		reasons: {}
	};

	rows.forEach((row, index) => {
		const attemptCount = Number(row?.query_attempt_count) || 0;
		if (attemptCount > 0) {
			summary.realQueryCount += attemptCount;
			return;
		}

		const previousTime = snapshot.get(getPackageKey(row, index));
		const currentTime = parseQueryTime(row?.last_query_time || row?.last_sync_time);

		if (currentTime && currentTime !== previousTime) {
			summary.realQueryCount += 1;
			return;
		}

		summary.skippedCount += 1;
		const reasonText = getQueryBlockReasonText(row);
		summary.reasons[reasonText] = (summary.reasons[reasonText] || 0) + 1;
	});

	return summary;
}

export function formatLogisticsQuerySummaryMessage(summary: LogisticsQuerySummary): string {
	if (!summary.total) return "没有包裹可查询";

	const reasonText = formatReasonSummary(summary.reasons);
	if (summary.realQueryCount > 0 && summary.skippedCount > 0) {
		return `真实查询快递100 ${summary.realQueryCount} 次，跳过 ${summary.skippedCount} 个：${reasonText}`;
	}
	if (summary.realQueryCount > 0) {
		return `真实查询快递100 ${summary.realQueryCount} 次`;
	}
	return `未调用快递100：${reasonText}`;
}

export function getQueryBlockReasonText(row: LogisticsPackageRow = {}): string {
	const reason = String(row.query_block_reason || row.query_mode || row.status || "").trim();
	const nextQueryAfter = row.next_query_after || "";
	const lastError = row.last_error_message || row.provider_message || row.identify_error_message || "";

	if (String(row.identify_status || "").trim() === "failed" && !String(row.company_code || "").trim()) {
		return lastError ? `识别失败：${lastError}` : "识别失败";
	}
	if (row.can_query === true || reason === "ok") {
		return "可查询快递100";
	}
	if (reason === "cooldown") {
		return `冷却中${nextQueryAfter ? `，下次可查 ${nextQueryAfter}` : ""}`;
	}

	const map: Record<string, string> = {
		phone_required: "缺少手机号",
		phone_invalid: "手机号无效",
		pending_mapping: "待自动识别快递公司",
		identify_failed: lastError ? `识别失败：${lastError}` : "识别失败",
		missing_warehouse: "采购单没有仓库，无法自动匹配手机号",
		warehouse_contact_required: "该仓库未配置联系人手机号",
		warehouse_contact_exhausted: "仓库联系人手机号均未匹配，请人工填写手机号",
		manual_required: "需人工判断物流，不查快递100",
		ignored: "已忽略，不参与整单物流",
		disabled: "已停用，不查快递100",
		signed: "已签收，不再查询，避免重复消耗快递100额度",
		missing_tracking_no: "缺少运单号",
		no_result: lastError ? `查询失败：${lastError}` : "查询失败"
	};

	return map[reason] || lastError || "未满足查询条件";
}

function formatReasonSummary(reasons: Record<string, number>) {
	const entries = Object.entries(reasons);
	if (!entries.length) return "无可查询包裹";
	if (entries.length === 1) return entries[0][0];
	return entries.map(([reason, count]) => `${reason} ${count} 个`).join("；");
}

function getPackageKey(row: LogisticsPackageRow = {}, index = 0): string {
	return String(row.id || row.tracking_no || row.logistics_order_no || index);
}

function parseQueryTime(value: any): number | null {
	if (!value) return null;
	if (value instanceof Date) {
		const time = value.getTime();
		return Number.isFinite(time) ? time : null;
	}
	const text = String(value).trim();
	if (!text) return null;
	const time = Date.parse(text.replace(/-/g, "/"));
	return Number.isFinite(time) ? time : null;
}
