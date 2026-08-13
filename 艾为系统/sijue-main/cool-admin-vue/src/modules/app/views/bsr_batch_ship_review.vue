<template>
	<div class="batch-ship-review-page">
		<div class="page-head">
			<div class="page-title-group">
				<div class="page-title">批量发货审核</div>
				<div class="page-subtitle">
					保存批量发货弹窗快照，先审核，审核通过后再手动发送。
				</div>
			</div>
			<div class="page-actions">
				<el-button :icon="Refresh" :loading="loading" @click="loadList">刷新</el-button>
			</div>
		</div>

		<div class="status-strip">
			<button
				v-for="item in statusCards"
				:key="item.key"
				type="button"
				class="status-card"
				:class="[`is-${item.tone}`, { active: filters.status === item.status }]"
				@click="setStatusFilter(item.status)"
			>
				<span>{{ item.label }}</span>
				<strong>{{ item.count }}</strong>
			</button>
		</div>

		<div class="filter-panel">
			<el-input
				v-model="filters.keyword"
				clearable
				class="keyword-input"
				placeholder="搜索审核单号 / MSKU / ASIN / FNSKU / 产品 / 采购单 / 采购计划"
				@keyup.enter="searchList"
			>
				<template #prefix>
					<el-icon><search /></el-icon>
				</template>
			</el-input>

			<el-select
				v-model="filters.status"
				clearable
				placeholder="状态"
				class="filter-select"
				@change="handleFilterAutoSearch"
			>
				<el-option
					v-for="item in statusFilterOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				>
					<div class="status-option" :class="{ 'is-aggregate': item.aggregate }">
						<span>{{ item.label }}</span>
						<em class="status-option-count">{{ formatReviewNumber(item.count) }}</em>
					</div>
				</el-option>
			</el-select>

			<el-date-picker
				v-model="filters.date_range"
				type="daterange"
				value-format="YYYY-MM-DD"
				start-placeholder="开始日期"
				end-placeholder="结束日期"
				class="date-range"
				@change="handleFilterAutoSearch"
			/>

			<el-switch
				v-model="filters.only_mine"
				active-text="只看我提交"
				class="mine-switch"
				@change="handleFilterAutoSearch"
			/>

			<div class="filter-actions">
				<el-button type="primary" :icon="Search" :loading="loading" @click="searchList">
					查询
				</el-button>
				<el-button @click="resetFilters">重置</el-button>
			</div>
		</div>

		<div v-loading="loading" class="review-card-band">
			<div v-if="reviews.length" class="review-card-list">
				<article
					v-for="row in reviews"
					:key="row.review_no"
					class="review-history-card"
					:class="getReviewCardClassName(row)"
				>
					<div class="review-history-identity">
						<div class="review-history-head">
							<div class="review-history-no-line">
								<strong class="review-history-no">{{
									row.review_no || "-"
								}}</strong>
								<el-tag
									:type="getReviewStatusMeta(row.status).type"
									effect="light"
									round
								>
									{{ getReviewStatusMeta(row.status).text }}
								</el-tag>
								<span class="review-product-count-badge">
									{{ formatReviewNumber(getReviewProductCount(row)) }} 个产品
								</span>
							</div>
							<div class="review-desc">
								{{ getReviewStatusMeta(row.status).description }}
							</div>
							<div class="review-history-meta">
								<span>
									创建 <strong>{{ getCreatedByName(row) }}</strong>
									<em>{{
										formatReviewTime(row.create_time || row.createTime)
									}}</em>
								</span>
								<span v-if="row.submitted_time">
									提交 <strong>{{ getSubmittedByName(row) }}</strong>
									<em>{{ formatReviewTime(row.submitted_time) }}</em>
								</span>
								<span v-if="row.reviewed_time">
									审核 <strong>{{ getReviewedByName(row) }}</strong>
									<em>{{ formatReviewTime(row.reviewed_time) }}</em>
								</span>
							</div>
						</div>

						<div class="review-product-preview">
							<template v-if="getReviewProductRows(row).length">
								<div
									class="review-product-carousel"
									:class="{
										'is-scrollable': getReviewProductRows(row).length > 1
									}"
								>
									<button
										v-if="getReviewProductRows(row).length > 1"
										type="button"
										class="review-product-nav"
										aria-label="向左查看产品"
										@click.stop="scrollReviewProductTrack($event, -1)"
									>
										<el-icon><arrow-left /></el-icon>
									</button>

									<div class="review-product-window">
										<div class="review-product-track">
											<el-popover
												v-for="product in getReviewProductRows(row)"
												:key="`${row.review_no}-${product.product_line_no}-${product.msku}-${product.asin}`"
												:width="390"
												placement="bottom-start"
												trigger="hover"
												:show-after="160"
												:hide-after="60"
												popper-class="review-product-detail-popover"
											>
												<template #reference>
													<div class="review-product-mini-card">
														<el-image
															v-if="product.product_img"
															:src="product.product_img"
															fit="contain"
															class="review-product-mini-img"
														>
															<template #error>
																<div
																	class="review-product-img-fallback"
																>
																	<el-icon
																		><icon-picture
																	/></el-icon>
																</div>
															</template>
														</el-image>
														<div
															v-else
															class="review-product-img-fallback"
														>
															<el-icon><icon-picture /></el-icon>
														</div>

														<div class="review-product-mini-info">
															<div
																class="review-product-mini-name"
																:title="product.product_name || '-'"
															>
																{{ product.product_name || "-" }}
															</div>
															<div class="review-product-mini-meta">
																MSKU {{ product.msku || "-" }} /
																{{ product.marketplace || "-" }}
															</div>
															<div class="review-product-mini-stats">
																<span
																	>发货
																	{{
																		formatReviewNumber(
																			product.ship_qty
																		)
																	}}</span
																>
																<span
																	>运输
																	{{
																		formatReviewNumber(
																			product.method_count ||
																				product.segment_count
																		)
																	}}</span
																>
															</div>
														</div>
													</div>
												</template>

												<div class="review-product-popover">
													<div class="review-product-popover-head">
														<strong>{{
															product.product_name || "-"
														}}</strong>
														<span>{{
															product.seller_name || "店铺未记录"
														}}</span>
													</div>
													<div class="review-product-popover-grid">
														<span>MSKU</span>
														<strong>{{ product.msku || "-" }}</strong>
														<span>FNSKU</span>
														<strong>{{ product.fnsku || "-" }}</strong>
														<span>ASIN</span>
														<strong>{{ product.asin || "-" }}</strong>
														<span>产品编码</span>
														<strong>{{
															product.product_code || "-"
														}}</strong>
													</div>
													<div class="review-product-popover-stats">
														<div>
															<span>发货</span>
															<strong>{{
																formatReviewNumber(product.ship_qty)
															}}</strong>
														</div>
														<div>
															<span>运输段</span>
															<strong>{{
																formatReviewNumber(
																	product.segment_count
																)
															}}</strong>
														</div>
														<div>
															<span>运输方式</span>
															<strong>{{
																formatReviewNumber(
																	product.method_count
																)
															}}</strong>
														</div>
													</div>
												</div>
											</el-popover>
										</div>
									</div>

									<button
										v-if="getReviewProductRows(row).length > 1"
										type="button"
										class="review-product-nav"
										aria-label="向右查看产品"
										@click.stop="scrollReviewProductTrack($event, 1)"
									>
										<el-icon><arrow-right /></el-icon>
									</button>
								</div>
								<div class="review-product-carousel-summary">
									<span>
										预览
										{{ formatReviewNumber(getReviewProductRows(row).length) }} /
										{{ formatReviewNumber(getReviewProductCount(row)) }}
									</span>
									<em v-if="getReviewHiddenProductCount(row) > 0">
										另
										{{ formatReviewNumber(getReviewHiddenProductCount(row)) }}
										个在详情
									</em>
									<em v-else>本批产品</em>
								</div>
							</template>
							<div v-else class="review-product-empty">
								暂无产品预览，可进入详情查看快照
							</div>
						</div>
					</div>

					<div class="review-history-operation">
						<div class="review-history-metrics">
							<div>
								<span>发货</span>
								<strong>{{
									formatReviewNumber(getSummary(row).totalShipQty)
								}}</strong>
							</div>
							<div>
								<span>产品</span>
								<strong>{{
									formatReviewNumber(getSummary(row).productCount)
								}}</strong>
							</div>
							<div>
								<span>运输段</span>
								<strong>{{
									formatReviewNumber(getSummary(row).segmentCount)
								}}</strong>
							</div>
							<div>
								<span>采购单</span>
								<strong>{{
									formatReviewNumber(getSummary(row).orderCount)
								}}</strong>
							</div>
							<div>
								<span>方式</span>
								<strong>{{
									formatReviewNumber(getSummary(row).methodCount)
								}}</strong>
							</div>
							<div>
								<span>仓库</span>
								<strong>{{
									formatReviewNumber(getSummary(row).warehouseCount)
								}}</strong>
							</div>
							<div class="review-execute-metric">
								<span>执行</span>
								<strong>{{ getReviewExecuteStatusText(row) }}</strong>
							</div>
						</div>

						<div class="review-method-summary-line">
							<span
								v-for="item in getReviewMethodSummary(row)"
								:key="item.method_key || item.methodKey"
								class="review-method-pill"
								:style="{
									'--method-color': getMethodMeta(
										item.method_key || item.methodKey,
										item.method_label || item.methodLabel
									).color
								}"
							>
								{{
									item.method_label ||
									item.methodLabel ||
									getMethodMeta(item.method_key || item.methodKey).label
								}}
								<strong>{{
									formatReviewNumber(
										item.planned_qty || item.plannedQty || item.qty
									)
								}}</strong>
							</span>
							<span
								v-if="!getReviewMethodSummary(row).length"
								class="review-method-empty"
							>
								暂无运输方式
							</span>
							<em v-if="row.executed_batch_no" class="review-exec">
								旧批次 {{ row.executed_batch_no }}
							</em>
						</div>
					</div>

					<div class="review-history-actions">
						<el-button type="primary" plain :icon="View" @click="goDetail(row)">
							详情
						</el-button>
						<el-button
							v-if="canReviewAction(row.status, 'withdraw')"
							type="primary"
							plain
							:icon="EditPen"
							:loading="withdrawingReviewNo === row.review_no"
							@click="withdrawAndEditReview(row)"
						>
							撤回修改
						</el-button>
						<el-button
							v-if="canReviewAction(row.status, 'restore')"
							type="primary"
							plain
							:icon="EditPen"
							@click="editReview(row)"
						>
							修改
						</el-button>
						<el-button
							v-if="canReviewAction(row.status, 'approve')"
							type="success"
							plain
							:icon="Check"
							@click="approveReview(row)"
						>
							通过
						</el-button>
						<el-button
							v-if="canReviewAction(row.status, 'reject')"
							type="danger"
							plain
							:icon="Close"
							@click="rejectReview(row)"
						>
							驳回
						</el-button>
						<el-button
							v-if="canReviewAction(row.status, 'execute')"
							type="warning"
							plain
							:icon="RefreshRight"
							:loading="executingReviewNo === row.review_no"
							@click="executeReview(row)"
						>
							{{ getExecuteButtonText(row) }}
						</el-button>
					</div>
				</article>
			</div>
			<el-empty v-else description="暂无批量发货审核单" />
		</div>

		<div class="pagination-band">
			<span>共 {{ formatReviewNumber(pagination.total) }} 条审核单</span>
			<el-pagination
				v-model:current-page="pagination.page"
				v-model:page-size="pagination.size"
				background
				layout="sizes, prev, pager, next, jumper"
				:page-sizes="[10, 20, 50, 100]"
				:total="pagination.total"
				@size-change="loadList"
				@current-change="loadList"
			/>
		</div>

		<el-drawer
			class="review-detail-drawer"
			:model-value="reviewDetailVisible"
			:show-close="false"
			:with-header="false"
			:size="'96%'"
			direction="rtl"
			:destroy-on-close="true"
			@close="closeReviewDetail"
		>
			<bsr-batch-ship-review-detail-panel v-if="reviewDetailVisible" :key="reviewDetailKey" />
		</el-drawer>
	</div>
</template>

<script lang="ts" name="app-bsr_batch_ship_review" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	Close,
	EditPen,
	Picture as IconPicture,
	Refresh,
	RefreshRight,
	Search,
	View
} from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import {
	buildReviewQuickStatusCards,
	buildReviewStatusOptionsWithCount,
	canReviewAction,
	formatReviewNumber,
	formatReviewTime,
	getReviewStatusFilterParam,
	getReviewStatusFilterValues,
	getMethodMeta,
	getReviewStatusMeta,
	normalizeReviewSummary,
	pickReviewPageList,
	pickReviewPagination,
	pickReviewStatusCounts
} from "/@/modules/app/utils/bsr-batch-ship-review";
import BsrBatchShipReviewDetailPanel from "/@/modules/app/components/BsrBatchShipReviewDetailPanel.vue";

const { service } = useCool();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const executingReviewNo = ref("");
const withdrawingReviewNo = ref("");
const reviews = ref<any[]>([]);
const reviewStatusCounts = ref<Record<string, number>>({ all: 0 });
const filters = reactive({
	keyword: "",
	status: "",
	date_range: [] as string[],
	only_mine: false
});
const pagination = reactive({
	page: 1,
	size: 20,
	total: 0
});

const reviewRequest = (action: string, data: any = {}) => {
	return service.request({
		url: `/admin/app/bsr_batch_ship_review/${action}`,
		method: "POST",
		data
	});
};

const statusCards = computed(() => {
	return buildReviewQuickStatusCards(reviewStatusCounts.value);
});

const statusFilterOptions = computed(() => {
	return buildReviewStatusOptionsWithCount(reviewStatusCounts.value);
});

const reviewDetailReviewNo = computed(() => String(route.query.review_no || ""));
const reviewDetailMode = computed(() => String(route.query.mode || "view"));
const reviewDetailVisible = computed(() => Boolean(reviewDetailReviewNo.value));
const reviewDetailKey = computed(
	() => `${reviewDetailReviewNo.value || "none"}:${reviewDetailMode.value || "view"}`
);

onMounted(() => {
	loadList();
});

async function loadList() {
	loading.value = true;
	try {
		const res = await reviewRequest("page", {
			page: pagination.page,
			size: pagination.size,
			keyword: filters.keyword,
			status: getReviewStatusFilterParam(filters.status),
			statuses: getReviewStatusFilterValues(filters.status),
			date_range: filters.date_range,
			only_mine: filters.only_mine
		});
		reviews.value = pickReviewPageList(res);
		const page = pickReviewPagination(res, pagination);
		reviewStatusCounts.value = pickReviewStatusCounts(res);
		pagination.page = Number(page.page) || pagination.page;
		pagination.size = Number(page.size) || pagination.size;
		pagination.total = Number(page.total) || 0;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载批量发货审核单失败");
	} finally {
		loading.value = false;
	}
}

function searchList() {
	pagination.page = 1;
	loadList();
}

function handleFilterAutoSearch() {
	searchList();
}

function resetFilters() {
	filters.keyword = "";
	filters.status = "";
	filters.date_range = [];
	filters.only_mine = false;
	searchList();
}

function setStatusFilter(status: string) {
	filters.status = filters.status === status ? "" : status;
	handleFilterAutoSearch();
}

function getSummary(row: any) {
	return normalizeReviewSummary(row);
}

function getReviewProductRows(row: any) {
	return Array.isArray(row?.product_preview?.list) ? row.product_preview.list : [];
}

function getReviewProductCount(row: any) {
	return (
		Number(row?.product_preview?.total ?? row?.product_count ?? getSummary(row).productCount) ||
		0
	);
}

function getReviewHiddenProductCount(row: any) {
	return Number(row?.product_preview?.hidden_count) || 0;
}

function getProductMethodSummary(product: any) {
	return Array.isArray(product?.method_summary || product?.methodSummary)
		? product.method_summary || product.methodSummary
		: [];
}

function getReviewMethodSummary(row: any) {
	const summary = row?.summary_json || row?.summary || {};
	const summaryMethods = summary.method_summary || summary.methodSummary;
	if (Array.isArray(summaryMethods) && summaryMethods.length) {
		return summaryMethods;
	}

	const methodMap = new Map<string, any>();
	getReviewProductRows(row).forEach((product: any) => {
		getProductMethodSummary(product).forEach((method: any) => {
			const key = String(method.method_key || method.methodKey || method.method_label || "");
			if (!key) return;
			if (!methodMap.has(key)) {
				methodMap.set(key, {
					method_key: method.method_key || method.methodKey || key,
					method_label: method.method_label || method.methodLabel || key,
					planned_qty: 0
				});
			}
			const item = methodMap.get(key);
			item.planned_qty +=
				Number(method.planned_qty || method.plannedQty || method.qty || 0) || 0;
		});
	});
	return Array.from(methodMap.values());
}

function getReviewExecuteStatusText(row: any) {
	const status = String(row?.status || "");
	if (status === "executing") return "发送中";
	if (status === "execute_success") return "成功";
	if (status === "execute_partial_failed") return "部分失败";
	if (status === "execute_failed") return "失败";
	if (row?.executed_batch_no) return "已发送";
	return "未发送";
}

function scrollReviewProductTrack(event: MouseEvent, direction: -1 | 1) {
	const track = (event.currentTarget as HTMLElement)
		?.closest(".review-product-carousel")
		?.querySelector<HTMLElement>(".review-product-track");
	if (!track) return;
	const scrollDistance = Math.max(220, Math.floor(track.clientWidth * 0.82));
	track.scrollBy({
		left: scrollDistance * direction,
		behavior: "smooth"
	});
}

function getReviewCardClassName(row: any) {
	const tone = getReviewStatusMeta(row.status).tone;
	return `is-${tone}`;
}

function pickOperatorName(row: any, prefix: string) {
	return row?.[`${prefix}_nickname`] || row?.[`${prefix}_username`] || "-";
}

function getCreatedByName(row: any) {
	return pickOperatorName(row, "created_by");
}

function getSubmittedByName(row: any) {
	return pickOperatorName(row, "submitted_by");
}

function getReviewedByName(row: any) {
	return pickOperatorName(row, "reviewed_by");
}

function getExecuteButtonText(row: any) {
	return ["execute_failed", "execute_partial_failed"].includes(String(row?.status || ""))
		? "重试失败项"
		: "发送";
}

function openReviewDetail(row: any, mode: string = "view") {
	router.push({
		path: "/app/bsr_batch_ship_review",
		query: { review_no: row.review_no, mode }
	});
}

function goDetail(row: any) {
	openReviewDetail(row, "view");
}

function editReview(row: any) {
	openReviewDetail(row, "edit");
}

async function withdrawAndEditReview(row: any) {
	try {
		await ElMessageBox.confirm(
			`确认撤回 ${row.review_no} 并进入修改？撤回后审核单会回到草稿状态。`,
			"撤回修改",
			{
				type: "warning",
				confirmButtonText: "撤回并修改",
				cancelButtonText: "取消"
			}
		);
	} catch (error) {
		return;
	}
	withdrawingReviewNo.value = row.review_no;
	try {
		await reviewRequest("withdraw", {
			review_no: row.review_no,
			remark: "列表撤回后修改审核单快照"
		});
		ElMessage.success("审核单已撤回，可继续修改");
		openReviewDetail(row, "edit");
	} catch (error: any) {
		ElMessage.error(error?.message || "撤回审核单失败");
		await loadList();
	} finally {
		withdrawingReviewNo.value = "";
	}
}

function closeReviewDetail() {
	router.push({
		path: "/app/bsr_batch_ship_review"
	});
}

async function approveReview(row: any) {
	await ElMessageBox.confirm(`确认审核通过 ${row.review_no}？通过后仍需手动发送。`, "审核通过", {
		type: "success",
		confirmButtonText: "通过",
		cancelButtonText: "取消"
	});
	await reviewRequest("approve", { review_no: row.review_no });
	ElMessage.success("审核已通过");
	await loadList();
}

async function rejectReview(row: any) {
	const { value } = await ElMessageBox.prompt(
		"请填写驳回原因，提交人会按原因还原修改。",
		"驳回审核单",
		{
			type: "warning",
			inputType: "textarea",
			inputPlaceholder: "例如：仓库选择不正确，铁路段数量需要调整",
			confirmButtonText: "驳回",
			cancelButtonText: "取消",
			inputValidator: (value) => Boolean(String(value || "").trim()) || "请填写驳回原因"
		}
	);
	await reviewRequest("reject", { review_no: row.review_no, remark: value });
	ElMessage.success("审核单已驳回");
	await loadList();
}

async function executeReview(row: any) {
	const isRetry = ["execute_failed", "execute_partial_failed"].includes(String(row.status || ""));
	await ElMessageBox.confirm(
		isRetry
			? `确认重试 ${row.review_no} 的失败项？系统会复用旧批次号重试失败明细。`
			: `确认发送 ${row.review_no}？系统会读取已保存的发货 payload，并调用旧批量发货提交链路。`,
		isRetry ? "重试失败项" : "发送发货计划",
		{
			type: "warning",
			confirmButtonText: isRetry ? "重试" : "发送",
			cancelButtonText: "取消"
		}
	);
	executingReviewNo.value = row.review_no;
	try {
		await reviewRequest("execute", { review_no: row.review_no });
		ElMessage.success("发送任务已完成，请查看执行结果");
		await loadList();
	} catch (error: any) {
		ElMessage.error(error?.message || "发送失败");
		await loadList();
	} finally {
		executingReviewNo.value = "";
	}
}
</script>

<style lang="scss" scoped>
.batch-ship-review-page {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	padding: 12px;
	box-sizing: border-box;
	background: var(--el-bg-color-page);
	color: var(--el-text-color-primary);
}

.page-head,
.filter-panel,
.pagination-band {
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-light);
}

.page-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 16px;
	border-radius: 8px 8px 0 0;
}

.page-title {
	font-size: 18px;
	font-weight: 700;
	line-height: 1.2;
}

.page-subtitle {
	margin-top: 4px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.status-strip {
	display: grid;
	grid-template-columns: repeat(6, minmax(120px, 1fr));
	gap: 10px;
	padding: 10px 0;
}

.status-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 58px;
	padding: 12px 14px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: var(--el-bg-color);
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;

	span {
		font-size: 13px;
		color: var(--el-text-color-regular);
	}

	strong {
		font-size: 24px;
		font-weight: 760;
	}

	&:hover,
	&.active {
		transform: translateY(-1px);
		border-color: var(--el-color-primary-light-5);
		box-shadow: 0 6px 16px rgba(30, 43, 74, 0.08);
	}

	&.is-active strong {
		color: var(--el-color-warning);
	}

	&.is-success strong {
		color: var(--el-color-success);
	}

	&.is-danger strong {
		color: var(--el-color-danger);
	}
}

.filter-panel {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 12px;
	border-radius: 8px;
}

.keyword-input {
	flex: 1 1 360px;
	min-width: 260px;
}

.filter-select {
	width: 168px;
}

.status-option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	min-width: 0;

	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&.is-aggregate span {
		font-weight: 600;
	}
}

.status-option-count {
	flex: 0 0 auto;
	min-width: 24px;
	padding: 1px 7px;
	border-radius: 999px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-style: normal;
	line-height: 18px;
	text-align: center;
}

.date-range {
	width: 240px;
}

.mine-switch {
	flex: 0 0 auto;
}

.filter-actions {
	display: flex;
	gap: 8px;
	margin-left: auto;
}

.review-card-band {
	flex: 1;
	min-height: 0;
	margin-top: 10px;
	overflow: auto;
}

.review-card-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 1180px;
}

.review-history-card {
	position: relative;
	display: grid;
	grid-template-columns: minmax(390px, 0.62fr) minmax(620px, 1.25fr) 150px;
	align-items: stretch;
	gap: 12px;
	padding: 12px 14px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: var(--el-bg-color);
	box-shadow: 0 1px 4px rgba(31, 45, 61, 0.035);
	overflow: hidden;
	transition:
		border-color 0.18s,
		box-shadow 0.18s,
		transform 0.18s;
}

.review-history-card::before {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	width: 3px;
	background: #d9e6f7;
	content: "";
}

.review-history-card:hover {
	border-color: #c6d8f2;
	box-shadow: 0 4px 14px rgba(31, 45, 61, 0.08);
	transform: translateY(-1px);
}

.review-history-card.is-success::before {
	background: var(--el-color-success);
}

.review-history-card.is-warning::before {
	background: var(--el-color-warning);
}

.review-history-card.is-danger {
	border-color: #f8c7c7;
	background: linear-gradient(90deg, #fff7f7 0, #fff 78px);
}

.review-history-card.is-danger::before {
	background: var(--el-color-danger);
}

.review-history-identity,
.review-history-operation {
	min-width: 0;
}

.review-history-identity {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 8px;
	padding-right: 12px;
	border-right: 1px solid #edf1f7;
}

.review-history-head {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
}

.review-history-no-line {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.review-history-no {
	min-width: 0;
	overflow: hidden;
	color: #1f2d3d;
	font-family: Consolas, "Courier New", monospace;
	font-size: 14px;
	font-weight: 800;
	letter-spacing: 0;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.review-product-count-badge {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
	min-height: 22px;
	padding: 0 8px;
	border: 1px solid #d9ecff;
	border-radius: 999px;
	background: #f4f9ff;
	color: #1677ff;
	font-size: 12px;
	font-weight: 700;
	white-space: nowrap;
}

.review-desc,
.review-history-meta,
.review-history-meta em,
.review-product-carousel-summary,
.review-method-empty {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.review-history-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 5px 10px;
	line-height: 1.25;

	span {
		white-space: nowrap;
	}

	strong {
		color: #606266;
		font-weight: 700;
	}

	em {
		margin-left: 4px;
		font-style: italic;
	}
}

.review-product-preview {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
}

.review-product-carousel {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.review-product-carousel.is-scrollable {
	grid-template-columns: 24px minmax(0, 1fr) 24px;
}

.review-product-nav {
	display: inline-flex;
	flex: 0 0 auto;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 52px;
	padding: 0;
	border: 1px solid #dfe7f2;
	border-radius: 6px;
	background: #fff;
	color: #7a8798;
	cursor: pointer;
	transition:
		border-color 0.16s,
		background 0.16s,
		color 0.16s,
		box-shadow 0.16s;
}

.review-product-nav:hover {
	border-color: #b9d8ff;
	background: #f4f9ff;
	color: #1677ff;
	box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
}

.review-product-window {
	position: relative;
	min-width: 0;
	overflow: hidden;
}

.review-product-window::before,
.review-product-window::after {
	position: absolute;
	top: 0;
	z-index: 2;
	width: 16px;
	height: 100%;
	pointer-events: none;
	content: "";
}

.review-product-window::before {
	left: 0;
	background: linear-gradient(90deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
}

.review-product-window::after {
	right: 0;
	background: linear-gradient(270deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
}

.review-product-track {
	display: flex;
	gap: 7px;
	min-width: 0;
	padding: 1px 2px 2px;
	overflow: hidden;
	overflow-x: auto;
	scroll-behavior: smooth;
	scroll-snap-type: x proximity;
	scrollbar-width: none;
}

.review-product-track::-webkit-scrollbar {
	display: none;
}

.review-product-mini-card {
	display: grid;
	flex: 0 0 180px;
	grid-template-columns: 42px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	min-height: 58px;
	padding: 7px;
	border: 1px solid #e6edf7;
	border-radius: 7px;
	background: linear-gradient(180deg, #fff 0%, #f9fbff 100%);
	cursor: help;
	scroll-snap-align: start;
	transition:
		border-color 0.16s,
		background 0.16s,
		box-shadow 0.16s,
		transform 0.16s;
}

.review-product-mini-card:hover {
	border-color: #b9d8ff;
	background: #fff;
	box-shadow: 0 4px 12px rgba(31, 45, 61, 0.1);
	transform: translateY(-1px);
}

.review-product-mini-img,
.review-product-img-fallback {
	flex: 0 0 auto;
	width: 42px;
	height: 42px;
	border: 1px solid #ebeef5;
	border-radius: 6px;
	background: #fff;
}

.review-product-img-fallback {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f6f8fb;
	color: #b5bfcc;
	font-size: 18px;
}

.review-product-mini-info {
	min-width: 0;
}

.review-product-mini-name {
	overflow: hidden;
	color: #303133;
	font-size: 12px;
	font-weight: 700;
	line-height: 1.25;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.review-product-mini-meta {
	margin-top: 3px;
	overflow: hidden;
	color: #909399;
	font-size: 11px;
	line-height: 1.2;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.review-product-mini-stats {
	display: flex;
	align-items: center;
	gap: 5px;
	min-width: 0;
	margin-top: 5px;
	overflow: hidden;
	font-size: 11px;
	line-height: 1;
	white-space: nowrap;
}

.review-product-mini-stats span {
	color: #529b2e;
	font-weight: 700;
}

.review-product-carousel-summary {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-height: 16px;
	padding: 0 30px;
	font-size: 11px;
	line-height: 1.2;
	white-space: nowrap;
}

.review-product-carousel-summary em {
	color: #1677ff;
	font-style: normal;
	font-weight: 600;
}

.review-product-empty {
	display: flex;
	align-items: center;
	min-height: 52px;
	padding: 0 10px;
	border: 1px dashed #dfe7f2;
	border-radius: 7px;
	background: #fbfcff;
	color: #a8abb2;
	font-size: 12px;
}

.review-history-operation {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 8px;
	min-width: 0;
}

.review-history-metrics {
	display: grid;
	grid-template-columns: repeat(7, minmax(70px, 1fr));
	gap: 4px;
}

.review-history-metrics > div {
	min-width: 0;
	padding: 6px;
	border: 1px solid #eef2f7;
	border-radius: 5px;
	background: #f7f9fc;
	text-align: center;
}

.review-history-metrics span {
	display: block;
	color: #909399;
	font-size: 11px;
}

.review-history-metrics strong {
	display: block;
	margin-top: 1px;
	overflow: hidden;
	color: #303133;
	font-size: 14px;
	line-height: 1.1;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.review-execute-metric strong {
	color: #606266;
	font-size: 12px;
}

.review-method-summary-line {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	min-height: 28px;
}

.review-method-pill {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	min-height: 24px;
	padding: 0 7px;
	border: 1px solid color-mix(in srgb, var(--method-color) 34%, transparent);
	border-radius: 5px;
	background: color-mix(in srgb, var(--method-color) 9%, transparent);
	color: var(--method-color);
	font-size: 12px;
}

.review-method-pill strong {
	color: var(--method-color);
}

.review-exec {
	color: var(--el-color-success);
	font-family: Consolas, "Courier New", monospace;
	font-size: 12px;
	font-style: normal;
}

.review-history-actions {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 8px;
	min-width: 0;
	padding-left: 12px;
	border-left: 1px solid #edf1f7;
}

.review-history-actions :deep(.el-button) {
	width: 100%;
	margin-left: 0;
}

:global(.review-product-detail-popover) {
	padding: 0 !important;
	border: 1px solid #dfe8f5 !important;
	border-radius: 8px !important;
	box-shadow: 0 12px 28px rgba(31, 45, 61, 0.14) !important;
}

:global(.review-product-detail-popover .review-product-popover) {
	padding: 12px;
}

:global(.review-product-detail-popover .review-product-popover-head) {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.review-product-detail-popover .review-product-popover-head strong) {
	display: -webkit-box;
	overflow: hidden;
	color: #1f2937;
	font-size: 13px;
	line-height: 1.35;
	text-overflow: ellipsis;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

:global(.review-product-detail-popover .review-product-popover-head span) {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

:global(.review-product-detail-popover .review-product-popover-grid) {
	display: grid;
	grid-template-columns: 64px minmax(0, 1fr);
	gap: 7px 10px;
	padding: 10px 0;
}

:global(.review-product-detail-popover .review-product-popover-grid span) {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

:global(.review-product-detail-popover .review-product-popover-grid strong) {
	overflow: hidden;
	color: var(--el-text-color-primary);
	font-size: 12px;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
}

:global(.review-product-detail-popover .review-product-popover-stats) {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

:global(.review-product-detail-popover .review-product-popover-stats div) {
	padding: 8px;
	border-radius: 7px;
	background: #f6f9fe;
}

:global(.review-product-detail-popover .review-product-popover-stats span) {
	display: block;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

:global(.review-product-detail-popover .review-product-popover-stats strong) {
	display: block;
	margin-top: 2px;
	color: #1f2937;
	font-size: 15px;
}

.pagination-band {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 10px;
	padding: 10px 12px;
	border-radius: 8px;

	> span {
		font-size: 12px;
		color: var(--el-text-color-secondary);
	}
}

.review-detail-drawer {
	:global(.el-drawer__body) {
		padding: 0;
		overflow: hidden;
	}
}

@media (max-width: 980px) {
	.status-strip {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.filter-panel {
		flex-wrap: wrap;
	}

	.filter-actions {
		width: 100%;
		margin-left: 0;
		justify-content: flex-end;
	}
}
</style>
