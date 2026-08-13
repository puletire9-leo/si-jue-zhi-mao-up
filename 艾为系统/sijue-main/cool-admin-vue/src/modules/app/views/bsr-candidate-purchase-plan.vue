<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<el-select
				v-model="sampleStatusFilter"
				class="sample-status-filter"
				placeholder="采购状态"
				clearable
				style="width: 140px"
				@change="handleSampleStatusFilterChange"
				@clear="handleSampleStatusFilterChange"
			>
				<el-option label="已下单" value="ordered" />
				<el-option label="已采购" value="purchased" />
				<el-option label="已完成" value="completed" />
			</el-select>
			<cl-flex1 />
			<cl-search-key placeholder="搜索" />
		</cl-row>

		<cl-row>
			<el-table
				ref="tableRef"
				v-loading="loading"
				:data="tableData"
				class="purchase-plan-table"
				border
				stripe
				style="width: 100%"
				:height="tableHeight"
				@sort-change="handleSortChange"
			>
				<el-table-column type="selection" width="40" />
				<el-table-column label="图片" width="82" align="center">
					<template #default="{ row }">
						<el-image
							v-if="getCandidateImageUrl(row)"
							class="purchase-plan-image"
							:src="getCandidateImageUrl(row)"
							fit="contain"
							:preview-src-list="[getCandidateImageUrl(row)]"
							:preview-teleported="true"
						/>
						<span v-else>-</span>
					</template>
				</el-table-column>
				<el-table-column type="index" label="序号" width="60" align="center" />

				<el-table-column prop="candidate_id" label="选品ID" min-width="90" sortable />
				<el-table-column prop="asin" label="ASIN" min-width="120" />
				<el-table-column prop="marketplace" label="国家" min-width="80" />
				<el-table-column prop="sku" label="SKU" min-width="120" sortable />
				<el-table-column prop="lingxing_sku" label="领星SKU" min-width="120" />
				<el-table-column prop="account_name" label="店铺" min-width="120" />
				<el-table-column prop="ppg_sn" label="批次号" min-width="140" />
				<el-table-column prop="plan_sn" label="计划编号" min-width="140" sortable />
				<el-table-column prop="type" label="类型" min-width="100">
					<template #default="{ row }">
						<el-tag :type="row.type === 1 ? 'primary' : 'warning'" size="small">
							{{ row.type === 1 ? "常规采购" : "样品采购" }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="采购状态" min-width="130">
					<template #default="{ row }">
						<el-tag :type="getSamplePurchaseStatus(row).type" size="small">
							{{ getSamplePurchaseStatus(row).label }}
						</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="物流动态" min-width="320">
					<template #default="{ row }">
						<template v-if="orderStatusMap[row.plan_sn]?.length">
							<div
								v-for="s in orderStatusMap[row.plan_sn]"
								:key="s.order_sn"
								style="margin: 2px 0"
							>
								<el-popover
									placement="left-start"
									trigger="hover"
									:width="540"
									:teleported="true"
									:show-after="150"
									:hide-after="80"
									popper-class="candidate-logistics-popover"
									@show="handleLogisticsPopoverShow(s)"
								>
									<template #reference>
										<div
											class="logistics-trace-trigger"
											:class="{ 'is-empty': !getOrderLatestTrace(s).text }"
										>
											<span class="logistics-trace-trigger__text">
												{{ getOrderLogisticsDisplayText(s) }}
											</span>
										</div>
									</template>

									<div
										v-loading="isLogisticsLoading(s)"
										class="logistics-popover"
									>
										<div class="logistics-popover__header">
											<div>
												<div class="logistics-popover__title">
													{{ s.order_sn || "-" }}
												</div>
												<div class="logistics-popover__hint">
													{{ getOrderLogisticsReason(s) }}
												</div>
												<div
													v-if="getOrderLatestTrace(s).text"
													class="logistics-popover__latest"
												>
													<b>最新轨迹：</b
													>{{ getOrderLatestTraceText(s) }}
												</div>
											</div>
											<el-button
												link
												type="primary"
												size="small"
												:loading="isLogisticsLoading(s)"
												@click.stop="refreshOrderLogisticsOverview(s)"
											>
												刷新轨迹
											</el-button>
										</div>

										<div
											v-if="getLogisticsError(s)"
											class="logistics-popover__error"
										>
											{{ getLogisticsError(s) }}
										</div>

										<div
											v-if="
												getLogisticsPackageSummary(s) ||
												getQuerySummaryText(s)
											"
											class="logistics-popover__stats"
										>
											<span v-if="getLogisticsPackageSummary(s)">
												{{ getLogisticsPackageSummary(s) }}
											</span>
											<span v-if="getQuerySummaryText(s)">
												{{ getQuerySummaryText(s) }}
											</span>
										</div>

										<template v-if="getLogisticsPackages(s).length">
											<div
												v-for="pkg in getLogisticsPackages(s)"
												:key="
													pkg.id ||
													pkg.tracking_no ||
													pkg.logistics_order_no
												"
												class="logistics-package"
											>
												<div class="logistics-package__head">
													<div>
														<div class="logistics-package__tracking">
															{{
																pkg.tracking_no ||
																pkg.logistics_order_no ||
																"无运单号"
															}}
														</div>
														<div class="logistics-package__company">
															{{ getPackageCompanyText(pkg) }}
														</div>
													</div>
													<div class="logistics-package__time">
														{{ formatDateTime(pkg.latest_trace_time) }}
													</div>
												</div>

												<div
													v-if="pkg.latest_trace_text"
													class="logistics-package__latest"
												>
													<b>最新轨迹：</b>
													{{ formatDateTime(pkg.latest_trace_time) }}
													{{ pkg.latest_trace_text }}
												</div>

												<div class="logistics-meta-grid">
													<div>
														<b>包裹状态：</b
														>{{ getPackageLogisticsStatusText(pkg) }}
													</div>
													<div>
														<b>原始公司：</b
														>{{ pkg.raw_company_name || "-" }}
													</div>
													<div>
														<b>快递编码：</b
														>{{ pkg.company_code || "-" }}
													</div>
													<div>
														<b>查询方式：</b>{{ pkg.query_mode || "-" }}
													</div>
													<div>
														<b>识别状态：</b
														>{{ pkg.identify_status || "-" }}
													</div>
													<div>
														<b>手机号：</b
														>{{ getPackagePhoneText(pkg) }}
													</div>
													<div>
														<b>仓库：</b>{{ pkg.warehouse_name || "-" }}
													</div>
													<div>
														<b>签收时间：</b
														>{{ formatDateTime(pkg.sign_time) }}
													</div>
													<div>
														<b>上次查询：</b
														>{{
															formatDateTime(
																pkg.last_query_time ||
																	pkg.last_sync_time
															)
														}}
													</div>
													<div>
														<b>下次可查：</b
														>{{ formatDateTime(pkg.next_query_after) }}
													</div>
													<div>
														<b>查询受限：</b
														>{{ pkg.query_block_reason || "-" }}
													</div>
													<div>
														<b>服务状态：</b
														>{{ pkg.provider_status || "-" }}
													</div>
													<div>
														<b>服务消息：</b
														>{{ pkg.provider_message || "-" }}
													</div>
												</div>

												<el-timeline
													v-if="getTraceList(pkg).length"
													class="logistics-timeline"
												>
													<el-timeline-item
														v-for="(trace, traceIndex) in getTraceList(
															pkg
														)"
														:key="traceIndex"
														:timestamp="getTraceTime(trace)"
														:type="
															traceIndex === 0 ? 'primary' : 'info'
														"
														:hollow="traceIndex !== 0"
													>
														<div class="trace-remark">
															{{ getTraceText(trace) }}
														</div>
													</el-timeline-item>
												</el-timeline>
												<el-empty
													v-else
													description="暂无轨迹信息"
													:image-size="44"
												/>
											</div>
										</template>
										<el-empty
											v-else
											description="暂无包裹物流轨迹"
											:image-size="52"
										/>
									</div>
								</el-popover>
							</div>
						</template>
						<span v-else>-</span>
					</template>
				</el-table-column>
				<el-table-column prop="quantity_plan" label="采购数量" min-width="100" sortable />
				<el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
				<el-table-column prop="operator_name" label="操作人" min-width="100" />
				<el-table-column prop="createTime" label="创建时间" min-width="160" sortable />
				<el-table-column label="操作" width="110" fixed="right" align="center">
					<template #default="{ row }">
						<el-button
							v-if="canMarkSampleCompleted(row)"
							link
							type="primary"
							size="small"
							:loading="isMarkingSampleCompleted(row)"
							@click="markSampleCompleted(row)"
						>
							已完成
						</el-button>
						<span v-else>-</span>
					</template>
				</el-table-column>
			</el-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>
	</cl-crud>
</template>

<script lang="ts" name="app-bsr-candidate-purchase-plan" setup>
import { useCrud } from "@cool-vue/crud";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCool } from "/@/cool";
import { onMounted, reactive, ref } from "vue";
import { product_main_image_display_url } from "/$/app/utils";
import { getPagePagination, getPlanSns } from "/$/app/utils/purchase-plan-pagination";

const { service } = useCool();
const loading = ref(false);
const tableData = ref<any[]>([]);
const tableRef = ref();
const tableHeight = "calc(100vh - 190px)";
const orderStatusMap = ref<Record<string, any[]>>({});
const candidateImageMap = ref<Record<string, string>>({});
const logisticsOverviewMap = ref<Record<string, any>>({});
const logisticsLoadingMap = ref<Record<string, boolean>>({});
const logisticsErrorMap = ref<Record<string, string>>({});
const completeLoadingMap = ref<Record<string, boolean>>({});
const sampleStatusFilter = ref("");

const currentSort = reactive({ prop: "", order: "" });
const localSampleSortFields = new Set([
	"candidate_id",
	"sku",
	"plan_sn",
	"quantity_plan",
	"createTime"
]);

const handleSortChange = ({ prop, order }: any) => {
	currentSort.prop = prop || "";
	currentSort.order = order || "";
	Crud.value?.refresh();
};

const handleSampleStatusFilterChange = () => {
	Crud.value?.refresh({ page: 1 });
};

function applySortParams(query: any) {
	if (!currentSort.prop) return;
	if (!localSampleSortFields.has(currentSort.prop)) return;

	query.order = currentSort.prop;
	query.sort = currentSort.order === "ascending" ? "asc" : "desc";
}

async function loadSamplePage(query: any) {
	const samplePage = await (service.app.bsr_candidate_purchase_plan as any).request({
		url: "/samplePage",
		method: "POST",
		data: {
			...query,
			type: 2,
			sampleStatus: sampleStatusFilter.value
		}
	});

	return {
		list: samplePage?.list || [],
		pagination: getPagePagination(samplePage, query)
	};
}

const Crud = useCrud({
	service: service.app.bsr_candidate_purchase_plan,
	async onRefresh(params, { render }) {
		loading.value = true;
		const query: any = { ...params, size: params.size || 20 };

		applySortParams(query);

		try {
			const res = await loadSamplePage(query);

			const list = res?.list || [];
			tableData.value = list;
			const planSns = getPlanSns(list);
			const candidateIds = getCandidateIds(list);
			orderStatusMap.value = {};
			candidateImageMap.value = {};
			logisticsOverviewMap.value = {};
			logisticsLoadingMap.value = {};
			logisticsErrorMap.value = {};
			if (planSns.length) fetchOrderStatus(planSns);
			if (candidateIds.length) fetchCandidateImages(candidateIds);
			render(list, getPagePagination(res, query));
		} catch (err: any) {
			console.error(err);
			tableData.value = [];
			orderStatusMap.value = {};
			candidateImageMap.value = {};
			logisticsOverviewMap.value = {};
			logisticsLoadingMap.value = {};
			logisticsErrorMap.value = {};
			render([], { page: query.page || 1, size: query.size || 20, total: 0 });
		} finally {
			loading.value = false;
		}
	}
});

onMounted(() => {
	Crud.value?.refresh({ page: 1 });
});

function getCandidateIds(list: any[]) {
	return Array.from(
		new Set(
			(list || [])
				.map((item) => Number(item?.candidate_id))
				.filter((id) => Number.isFinite(id) && id > 0)
		)
	);
}

const fetchCandidateImages = async (candidateIds: number[]) => {
	if (!candidateIds.length) return;

	try {
		const data = await (service.app.bsr_candidate_purchase_plan as any).request({
			url: "/candidateImages",
			method: "POST",
			data: { candidateIds }
		});
		candidateImageMap.value = {
			...candidateImageMap.value,
			...(data || {})
		};
	} catch (err) {
		console.error("获取样品图片失败", err);
	}
};

const fetchOrderStatus = async (planSns: string[]) => {
	if (!planSns.length) return;

	try {
		const data = await (service.app.bsr_candidate as any).request({
			url: "/getOrderStatusByPlanSns",
			method: "POST",
			data: { planSns }
		});
		if (data) {
			orderStatusMap.value = data;
			fetchSavedLogisticsOverviews(data);
		}
	} catch (err) {
		console.error("获取采购/物流状态失败", err);
	}
};

function getUniqueOrdersFromStatusMap(statusMap: Record<string, any[]>) {
	const seen = new Set<string>();
	const orders: any[] = [];

	Object.values(statusMap || {}).forEach((items) => {
		(items || []).forEach((order: any) => {
			const orderSn = getOrderSn(order);
			if (!orderSn || seen.has(orderSn)) return;
			seen.add(orderSn);
			orders.push(order);
		});
	});

	return orders;
}

function fetchSavedLogisticsOverviews(statusMap: Record<string, any[]>) {
	const orders = getUniqueOrdersFromStatusMap(statusMap);
	orders.forEach((order) => {
		fetchOrderLogisticsOverview(order, false);
	});
}

function getCandidateImageUrl(row: any) {
	const directImage = String(row?.aliyun_img || row?.image_url || "").trim();
	const mappedImage = candidateImageMap.value[String(row?.candidate_id || "")] || "";
	return product_main_image_display_url(directImage || mappedImage);
}

function getPlanOrders(row: any) {
	const planSn = String(row?.plan_sn || "").trim();
	if (!planSn) return [];
	return orderStatusMap.value[planSn] || [];
}

function isSamplePurchaseCompleted(row: any) {
	return Number(row?.sample_status) === 3;
}

function getSamplePurchaseStatus(row: any): { label: string; type: "info" | "warning" | "success" } {
	if (isSamplePurchaseCompleted(row)) return { label: "已完成", type: "success" };
	if (getPlanOrders(row).length) return { label: "已采购", type: "warning" };
	return { label: "已下单", type: "info" };
}

function canMarkSampleCompleted(row: any) {
	return Boolean(row?.id && !isSamplePurchaseCompleted(row) && getPlanOrders(row).length);
}

function isMarkingSampleCompleted(row: any) {
	return Boolean(row?.id && completeLoadingMap.value[String(row.id)]);
}

async function markSampleCompleted(row: any) {
	if (!row?.id || isMarkingSampleCompleted(row)) return;

	try {
		await ElMessageBox.confirm(
			`确认将采购计划 ${row.plan_sn || row.id} 标记为已完成？`,
			"标记已完成",
			{ type: "warning" }
		);
	} catch {
		return;
	}

	const key = String(row.id);
	completeLoadingMap.value = {
		...completeLoadingMap.value,
		[key]: true
	};

	try {
		const data = await (service.app.bsr_candidate_purchase_plan as any).request({
			url: "/markSampleCompleted",
			method: "POST",
			data: { id: row.id }
		});
		row.sample_status = 3;
		row.sample_completed_time = data?.sample_completed_time || row.sample_completed_time;
		ElMessage.success("已标记为已完成");
		Crud.value?.refresh();
	} catch (err: any) {
		console.error("标记样品采购已完成失败", err);
		ElMessage.error(err?.message || "标记失败，请稍后重试");
	} finally {
		completeLoadingMap.value = {
			...completeLoadingMap.value,
			[key]: false
		};
	}
}

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

function getOrderLogisticsStatus(order: any) {
	const overview = getLogisticsOverview(order);
	return String(overview?.logistics_status || order?.logistics_status || "").trim();
}

function getOrderLogisticsStatusText(order: any) {
	const overview = getLogisticsOverview(order);
	const text = String(
		overview?.logistics_status_text || order?.logistics_status_text || ""
	).trim();
	if (text) return text;

	const status = getOrderLogisticsStatus(order);
	return status || "查看物流轨迹";
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

function getOrderLogisticsTagType(order: any) {
	const status = getOrderLogisticsStatus(order);

	if (["confirmed", "signed"].includes(status)) return "success";
	if (
		[
			"logistics_exception",
			"phone_required",
			"manual_required",
			"overtime_unsigned",
			"partial_overtime_unsigned",
			"logistics_abnormal"
		].includes(status)
	) {
		return "danger";
	}
	if (["pending_mapping", "partial_signed", "in_transit", "delivering"].includes(status)) {
		return "warning";
	}
	if (["no_logistics", "no_result"].includes(status)) return "info";
	return "primary";
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

function getPackageLogisticsStatusText(pkg: any) {
	return String(pkg?.status_text || pkg?.status || "未返回").trim();
}

function getPackageLogisticsTagType(pkg: any) {
	const status = String(pkg?.status || "").trim();

	if (status === "signed") return "success";
	if (
		["logistics_exception", "phone_required", "manual_required", "identify_failed"].includes(
			status
		)
	) {
		return "danger";
	}
	if (["pending_mapping", "in_transit", "delivering", "no_result"].includes(status))
		return "warning";
	if (["ignored", "disabled"].includes(status)) return "info";
	return "primary";
}

function getPackageCompanyText(pkg: any) {
	return (
		[pkg?.logistics_company || pkg?.raw_company_name, pkg?.company_name]
			.filter(Boolean)
			.join(" / ") || "-"
	);
}

function getPackagePhoneText(pkg: any) {
	const phone = pkg?.contact_phone_masked || pkg?.contact_phone;
	const status = pkg?.phone_status;
	if (phone && status) return `${phone}（${status}）`;
	return phone || status || "-";
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

function getTraceTime(trace: any) {
	return formatDateTime(getTraceTimeValue(trace));
}

function getTraceTimeValue(trace: any) {
	return trace?.accept_time || trace?.time || trace?.ftime || trace?.context_time || trace?.date;
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

function handleLogisticsPopoverShow(order: any) {
	ensureOrderLogisticsOverview(order);
}

function ensureOrderLogisticsOverview(order: any) {
	if (hasLogisticsOverview(order)) return;
	fetchOrderLogisticsOverview(order, false);
}

function refreshOrderLogisticsOverview(order: any) {
	fetchOrderLogisticsOverview(order, true);
}
</script>

<style scoped lang="scss">
.purchase-plan-table {
	width: 100%;
}

.purchase-plan-image {
	width: 48px;
	height: 48px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
	background: var(--el-fill-color-light);
}

.logistics-trace-trigger {
	box-sizing: border-box;
	max-width: 100%;
	margin: 2px 0;
	padding: 4px 7px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-primary);
	cursor: pointer;
	line-height: 1.45;

	&.is-empty {
		color: var(--el-text-color-secondary);
	}
}

.logistics-trace-trigger__text {
	display: -webkit-box;
	overflow: hidden;
	text-overflow: ellipsis;
	word-break: break-all;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

:global(.candidate-logistics-popover) {
	padding: 0 !important;
	max-width: min(540px, calc(100vw - 48px));
	border: 1px solid var(--el-border-color-light);
	box-shadow: 0 10px 28px rgba(31, 45, 61, 0.16);
}

:global(.candidate-logistics-popover .logistics-popover) {
	box-sizing: border-box;
	max-height: min(620px, calc(100vh - 140px));
	overflow-y: auto;
	background: var(--el-bg-color);
	font-size: 13px;
	line-height: 1.55;
}

:global(.candidate-logistics-popover .logistics-popover__header) {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 14px 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: var(--el-bg-color);
}

:global(.candidate-logistics-popover .logistics-popover__title),
:global(.candidate-logistics-popover .logistics-package__tracking) {
	font-weight: 600;
	color: var(--el-text-color-primary);
}

:global(.candidate-logistics-popover .logistics-popover__hint),
:global(.candidate-logistics-popover .logistics-package__company) {
	margin-top: 3px;
	color: var(--el-text-color-secondary);
	word-break: break-word;
}

:global(.candidate-logistics-popover .logistics-popover__latest) {
	margin-top: 8px;
	padding: 8px 9px;
	border-radius: 4px;
	background: var(--el-color-primary-light-9);
	color: var(--el-text-color-primary);
	word-break: break-word;
}

:global(.candidate-logistics-popover .logistics-popover__error) {
	margin: 10px 14px 0;
	padding: 7px 9px;
	border-radius: 4px;
	background: var(--el-color-danger-light-9);
	color: var(--el-color-danger);
}

:global(.candidate-logistics-popover .logistics-popover__stats) {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	padding: 10px 14px 0;
}

:global(.candidate-logistics-popover .logistics-popover__stats span) {
	padding: 3px 7px;
	border-radius: 4px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-regular);
}

:global(.candidate-logistics-popover .logistics-package) {
	margin: 10px 12px 12px;
	padding: 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: var(--el-fill-color-blank);
}

:global(.candidate-logistics-popover .logistics-package__head) {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
}

:global(.candidate-logistics-popover .logistics-package__time) {
	flex: 0 0 auto;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	white-space: nowrap;
}

:global(.candidate-logistics-popover .logistics-meta-grid) {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 4px 12px;
	margin-top: 9px;
	color: var(--el-text-color-regular);
}

:global(.candidate-logistics-popover .logistics-meta-grid > div),
:global(.candidate-logistics-popover .logistics-package__latest),
:global(.candidate-logistics-popover .trace-remark) {
	word-break: break-word;
}

:global(.candidate-logistics-popover .logistics-package__latest) {
	margin-top: 9px;
	padding: 7px 8px;
	border-radius: 4px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-regular);
}

:global(.candidate-logistics-popover .logistics-timeline) {
	margin-top: 12px;
	padding-left: 14px;
}

:global(.candidate-logistics-popover .el-timeline-item) {
	padding-bottom: 12px;
}

:global(.candidate-logistics-popover .el-timeline-item__timestamp) {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

:global(.candidate-logistics-popover .trace-remark) {
	padding: 7px 9px;
	border-radius: 4px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-primary);
	white-space: pre-wrap;
}

:global(.candidate-logistics-popover .el-empty) {
	padding: 14px 0;
}
</style>
