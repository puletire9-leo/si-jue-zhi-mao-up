import { ref } from "vue";
import { service } from "/@/cool";

export function usePurchaseOrderLogistics() {
	const logisticsOverviewMap = ref<Record<string, any>>({});
	const logisticsLoadingMap = ref<Record<string, boolean>>({});
	const logisticsErrorMap = ref<Record<string, string>>({});

	const getOrderSn = (order: any) => String(order?.order_sn || "").trim();

	function getLogisticsOverview(order: any) {
		const orderSn = getOrderSn(order);
		return (orderSn && logisticsOverviewMap.value[orderSn]) || order?.logistics_overview || null;
	}

	function hasLogisticsOverview(order: any) {
		return Boolean(getLogisticsOverview(order));
	}

	function getLogisticsPackages(order: any) {
		const packages = getLogisticsOverview(order)?.packages;
		return Array.isArray(packages) ? packages : [];
	}

	function getOrderLogisticsReason(order: any) {
		const overview = getLogisticsOverview(order);
		return String(
			overview?.logistics_status_reason ||
				overview?.query_hint ||
				order?.logistics_status_reason ||
				"已读取保存的物流轨迹，需要最新结果可点击刷新"
		);
	}

	function getOrderLatestTrace(order: any) {
		const rows: Array<{
			time: any;
			text: string;
			packageIndex: number;
			traceIndex: number;
		}> = [];

		getLogisticsPackages(order).forEach((pkg: any, packageIndex: number) => {
			const latestText = String(pkg?.latest_trace_text || "").trim();
			if (latestText) {
				rows.push({
					time: pkg?.latest_trace_time,
					text: latestText,
					packageIndex,
					traceIndex: -1
				});
			}

			getTraceList(pkg).forEach((trace: any, traceIndex: number) => {
				const text = getTraceText(trace);
				if (!text || text === "-") return;
				rows.push({
					time: getTraceTimeValue(trace),
					text,
					packageIndex,
					traceIndex
				});
			});
		});

		rows.sort((a, b) => {
			const byTime = getSortableTime(b.time) - getSortableTime(a.time);
			if (byTime) return byTime;
			const byPackage = a.packageIndex - b.packageIndex;
			if (byPackage) return byPackage;
			return a.traceIndex - b.traceIndex;
		});

		return rows[0] || { time: "", text: "", packageIndex: -1, traceIndex: -1 };
	}

	function getOrderLatestTraceText(order: any) {
		const trace = getOrderLatestTrace(order);
		if (!trace.text) return "";
		const time = formatDateTime(trace.time);
		return [time !== "-" ? time : "", trace.text].filter(Boolean).join(" ");
	}

	function getOrderLogisticsDisplayText(order: any) {
		const latestTrace = getOrderLatestTraceText(order);
		if (latestTrace) return latestTrace;
		if (isLogisticsLoading(order)) return "正在读取保存轨迹";
		if (getLogisticsOverview(order)) return "暂无最新轨迹";
		return "暂无保存轨迹";
	}

	function getLogisticsPackageSummary(order: any) {
		const overview = getLogisticsOverview(order);
		if (!overview) return "";

		const packageCount = overview.package_count ?? overview.logistics_pkg_count ?? 0;
		const signedCount = overview.signed_count ?? overview.logistics_signed_count ?? 0;
		const unsignedCount = overview.unsigned_count ?? overview.logistics_unsigned_count ?? 0;

		return `包裹 ${packageCount} / 已签 ${signedCount} / 未签 ${unsignedCount}`;
	}

	function getPackageCompanyText(pkg: any) {
		return (
			[pkg?.logistics_company || pkg?.raw_company_name, pkg?.company_name]
				.filter(Boolean)
				.join(" / ") || "-"
		);
	}

	function getPackageLogisticsStatusText(pkg: any) {
		return String(pkg?.status_text || pkg?.status || "未返回").trim();
	}

	function getPackagePhoneText(pkg: any) {
		const phone = pkg?.contact_phone_masked || pkg?.contact_phone;
		const status = pkg?.phone_status;
		if (phone && status) return `${phone}（${status}）`;
		return phone || status || "-";
	}

	function getQuerySummaryText(order: any) {
		const summary = getLogisticsOverview(order)?.query_summary;
		if (!summary) return "";

		const parts = [
			`真实查询 ${summary.real_query_count || 0}`,
			`跳过 ${summary.skipped_count || 0}`,
			`异常 ${summary.error_count || 0}`
		];
		const reasons = Object.entries(summary.reasons || {})
			.map(([key, value]) => `${key} ${value}`)
			.join("，");

		return reasons ? `${parts.join("，")}；${reasons}` : parts.join("，");
	}

	function isLogisticsLoading(order: any) {
		const orderSn = getOrderSn(order);
		return Boolean(orderSn && logisticsLoadingMap.value[orderSn]);
	}

	function getLogisticsError(order: any) {
		const orderSn = getOrderSn(order);
		return orderSn ? logisticsErrorMap.value[orderSn] : "";
	}

	async function fetchOrderLogisticsOverview(order: any, query = true) {
		const orderSn = getOrderSn(order);
		if (!orderSn || logisticsLoadingMap.value[orderSn]) return;

		logisticsLoadingMap.value = {
			...logisticsLoadingMap.value,
			[orderSn]: true
		};
		logisticsErrorMap.value = {
			...logisticsErrorMap.value,
			[orderSn]: ""
		};

		try {
			const data = await service.request({
				url: "/admin/app/bsr_purchase_order_logistics/orderOverview",
				method: "POST",
				data: {
					order_sn: orderSn,
					query,
					include_packages: true
				}
			});

			logisticsOverviewMap.value = {
				...logisticsOverviewMap.value,
				[orderSn]: data || {}
			};
		} catch (err) {
			console.error("刷新物流轨迹失败", err);
			logisticsErrorMap.value = {
				...logisticsErrorMap.value,
				[orderSn]: "物流轨迹刷新失败，请稍后再试"
			};
		} finally {
			logisticsLoadingMap.value = {
				...logisticsLoadingMap.value,
				[orderSn]: false
			};
		}
	}

	function ensureOrderLogisticsOverview(order: any) {
		if (hasLogisticsOverview(order)) return;
		void fetchOrderLogisticsOverview(order, false);
	}

	function refreshOrderLogisticsOverview(order: any) {
		void fetchOrderLogisticsOverview(order, true);
	}

	function preloadOrdersLogistics(orders: any[]) {
		for (const order of orders || []) {
			ensureOrderLogisticsOverview(order);
		}
	}

	return {
		getOrderSn,
		getLogisticsOverview,
		getLogisticsPackages,
		getOrderLogisticsReason,
		getOrderLatestTrace,
		getOrderLatestTraceText,
		getOrderLogisticsDisplayText,
		getLogisticsPackageSummary,
		getPackageCompanyText,
		getPackageLogisticsStatusText,
		getPackagePhoneText,
		getQuerySummaryText,
		isLogisticsLoading,
		getLogisticsError,
		ensureOrderLogisticsOverview,
		refreshOrderLogisticsOverview,
		preloadOrdersLogistics,
		formatDateTime,
		getTraceList,
		getTraceTime,
		getTraceText
	};
}

function parseJsonValue(value: any) {
	if (!value || typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function normalizeTraceList(value: any) {
	const parsed = parseJsonValue(value);
	return Array.isArray(parsed) ? parsed : [];
}

function getTraceList(pkg: any) {
	const rawResponse = parseJsonValue(pkg?.raw_response_json);
	const candidates = [
		pkg?.trace_info_json,
		pkg?.trace_json,
		rawResponse?.data,
		rawResponse?.traces,
		rawResponse?.trace,
		rawResponse?.list
	];

	for (const item of candidates) {
		const traces = normalizeTraceList(item);
		if (traces.length) return traces;
	}

	return [];
}

function getTraceTimeValue(trace: any) {
	return trace?.accept_time || trace?.time || trace?.ftime || trace?.context_time || trace?.date;
}

function getTraceTime(trace: any) {
	return formatDateTime(getTraceTimeValue(trace));
}

function getTraceText(trace: any) {
	return String(trace?.remark || trace?.context || trace?.text || trace?.status || "-");
}

function getSortableTime(value: any) {
	if (!value) return 0;
	const time = Date.parse(String(value).replace(/-/g, "/"));
	return Number.isFinite(time) ? time : 0;
}

function formatDateTime(value: any) {
	if (!value) return "-";
	return String(value).replace("T", " ").slice(0, 19);
}
