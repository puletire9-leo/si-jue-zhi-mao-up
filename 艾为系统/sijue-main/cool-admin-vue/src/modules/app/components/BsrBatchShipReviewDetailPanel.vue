<template>
	<div class="review-detail-page" :class="{ 'is-editing': editing }" v-loading="loading">
		<div class="detail-head" :class="{ 'is-compact-edit-head': editing }">
			<template v-if="editing">
				<div class="edit-head-main">
					<el-button :icon="ArrowLeft" text bg @click="goBack">返回</el-button>
					<div class="edit-head-title">
						<strong>{{ review?.review_no || "批量发货审核详情" }}</strong>
						<el-tag
							v-if="review"
							:type="getReviewStatusMeta(review.status).type"
							effect="light"
							round
							size="small"
						>
							{{ getReviewStatusMeta(review.status).text }}
						</el-tag>
					</div>
					<div class="edit-head-tags">
						<el-tag
							v-for="item in compactEditMetrics"
							:key="item.label"
							size="small"
							effect="plain"
							:type="item.type"
						>
							{{ item.label }} {{ item.value }}
						</el-tag>
					</div>
				</div>
				<div class="head-actions">
					<el-button :icon="Refresh" :loading="loading" @click="loadDetail"
						>刷新</el-button
					>
					<el-button plain @click="cancelEditor">退出编辑</el-button>
				</div>
			</template>
			<template v-else>
				<div class="detail-title-wrap">
					<el-button :icon="ArrowLeft" text bg @click="goBack">返回</el-button>
					<div>
						<div class="detail-title">
							{{ review?.review_no || "批量发货审核详情" }}
							<el-tag
								v-if="review"
								:type="getReviewStatusMeta(review.status).type"
								effect="light"
								round
							>
								{{ getReviewStatusMeta(review.status).text }}
							</el-tag>
						</div>
						<div class="detail-subtitle">
							{{
								review
									? getReviewStatusMeta(review.status).description
									: "正在加载审核单数据"
							}}
						</div>
					</div>
				</div>
				<div class="head-actions">
					<el-button :icon="Refresh" :loading="loading" @click="loadDetail"
						>刷新</el-button
					>
					<el-button
						v-if="review && canEditSnapshot"
						type="primary"
						plain
						:icon="EditPen"
						:loading="editorLoading"
						@click="startEditSnapshot"
					>
						{{ review.status === "rejected" ? "按驳回原因修改" : "编辑审核单" }}
					</el-button>
					<el-button
						v-if="review && canWithdrawForEdit"
						type="primary"
						plain
						:icon="EditPen"
						:loading="withdrawing"
						@click="withdrawForEdit"
					>
						撤回后修改
					</el-button>
					<el-button
						v-if="review && canReviewAction(review.status, 'approve')"
						type="success"
						:icon="Check"
						@click="approveReview"
					>
						审核通过
					</el-button>
					<el-button
						v-if="review && canReviewAction(review.status, 'reject')"
						type="danger"
						plain
						:icon="Close"
						@click="rejectReview"
					>
						驳回
					</el-button>
					<el-button
						v-if="review && canReviewAction(review.status, 'execute')"
						type="warning"
						:icon="RefreshRight"
						:loading="executing"
						@click="executeReview"
					>
						{{ getExecuteButtonText(review) }}
					</el-button>
				</div>
			</template>
		</div>

		<el-empty v-if="!loading && !review" description="未找到审核单" />

		<template v-else-if="review">
			<bsr-batch-ship-review-snapshot-editor
				v-if="editing && editorPayload"
				v-loading="editorLoading"
				:payload="editorPayload"
				:review="review"
				:saving-draft="savingDraft"
				:submitting-review="submittingReview"
				@save-draft="saveEditorDraft"
				@submit-review="submitEditorReview"
				@cancel="cancelEditor"
				@summary-change="handleEditorSummaryChange"
			/>

			<template v-else>
				<el-alert
					v-if="review.status === 'rejected' && review.review_remark"
					type="warning"
					show-icon
					:closable="false"
					class="review-remark-alert"
				>
					<template #title>驳回原因：{{ review.review_remark }}</template>
					这张审核单已退回修改，请点击“按驳回原因修改”调整后重新提交审核。
				</el-alert>

				<div class="overview-band">
					<div class="identity-panel">
						<div class="identity-main">
							<strong>{{ review.review_no }}</strong>
							<span>版本 {{ currentVersion?.version_no || "-" }}</span>
						</div>
						<div class="identity-meta">
							<span>创建：{{ getOperatorName(review, "created_by") }}</span>
							<span>{{ formatReviewTime(review.createTime) }}</span>
							<span v-if="review.submitted_time">
								提交：{{ getOperatorName(review, "submitted_by") }}
							</span>
							<span v-if="review.submitted_time">{{
								formatReviewTime(review.submitted_time)
							}}</span>
							<span v-if="review.executed_batch_no" class="success-text">
								旧批次 {{ review.executed_batch_no }}
							</span>
						</div>
					</div>
					<div class="metric-list">
						<div v-for="item in metrics" :key="item.label" class="metric-item">
							<span>{{ item.label }}</span>
							<strong>{{ formatReviewNumber(item.value) }}</strong>
						</div>
					</div>
				</div>

				<div class="timeline-band">
					<div
						v-for="step in statusFlow"
						:key="step.key"
						class="flow-step"
						:class="{ active: step.active, done: step.done, danger: step.danger }"
					>
						<span>{{ step.index }}</span>
						<div>
							<strong>{{ step.label }}</strong>
							<em>{{ step.time || step.desc }}</em>
						</div>
					</div>
				</div>

				<div v-if="products.length" class="product-context-band">
					<div class="product-context-head">
						<div>
							<strong>按产品查看明细</strong>
							<span>
								当前
								<template v-if="selectedProduct">
									{{ selectedProduct.msku || "-" }} /
									{{ selectedProduct.marketplace || "-" }}
								</template>
								<template v-else>全部产品</template>
							</span>
						</div>
						<em>
							运输段 {{ formatReviewNumber(filteredSegments.length) }} / 采购单分配
							{{ formatReviewNumber(filteredAllocations.length) }}
						</em>
					</div>
					<div class="product-context-track">
						<button
							type="button"
							class="product-context-all"
							:class="{ active: activeProductLineNo === 0 }"
							@click="selectProductLine(0)"
						>
							<strong>全部产品</strong>
							<span>{{ formatReviewNumber(products.length) }} 个产品</span>
							<em>运输段 {{ formatReviewNumber(segments.length) }}</em>
						</button>

						<button
							v-for="item in productLineSummaries"
							:key="item.lineNo"
							type="button"
							class="product-context-card"
							:class="{ active: activeProductLineNo === item.lineNo }"
							@click="selectProductLine(item.lineNo)"
						>
							<el-image
								v-if="item.product.product_img"
								:src="item.product.product_img"
								fit="contain"
								class="product-context-img"
							/>
							<div v-else class="product-context-img is-empty">无图</div>
							<div class="product-context-info">
								<strong :title="item.product.product_name || '-'">
									{{ item.product.product_name || "-" }}
								</strong>
								<span>
									MSKU {{ item.product.msku || "-" }} /
									{{ item.product.marketplace || "-" }}
								</span>
								<em>
									发货 {{ formatReviewNumber(item.product.ship_qty) }} · 运输段
									{{ formatReviewNumber(item.segmentCount) }} · 分配
									{{ formatReviewNumber(item.allocationCount) }}
								</em>
							</div>
						</button>
					</div>
				</div>

				<el-tabs v-model="activeTab" class="detail-tabs">
					<el-tab-pane name="products">
						<template #label
							>产品快照 {{ formatReviewNumber(filteredProducts.length) }}</template
						>
						<el-table
							:data="filteredProducts"
							border
							height="100%"
							empty-text="暂无产品快照"
						>
							<el-table-column label="产品" min-width="320" fixed>
								<template #default="{ row }">
									<div class="product-cell">
										<el-image
											v-if="row.product_img"
											:src="row.product_img"
											fit="contain"
											class="product-img"
											:preview-src-list="[row.product_img]"
											preview-teleported
										/>
										<div v-else class="product-img is-empty">无图</div>
										<div>
											<strong>{{ row.product_name || "-" }}</strong>
											<span
												>MSKU {{ row.msku || "-" }} / ASIN
												{{ row.asin || "-" }}</span
											>
											<span
												>FNSKU {{ row.fnsku || "-" }} /
												{{ row.marketplace || "-" }}</span
											>
										</div>
									</div>
								</template>
							</el-table-column>
							<el-table-column
								prop="seller_name"
								label="店铺"
								width="140"
								show-overflow-tooltip
							>
								<template #default="{ row }">{{ row.seller_name || "-" }}</template>
							</el-table-column>
							<el-table-column label="发货" width="90" align="right">
								<template #default="{ row }">
									<strong class="primary-text">{{
										formatReviewNumber(row.ship_qty)
									}}</strong>
								</template>
							</el-table-column>
							<el-table-column label="FBA" width="80" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.fba_qty)
								}}</template>
							</el-table-column>
							<el-table-column label="在途" width="80" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.in_transit_qty)
								}}</template>
							</el-table-column>
							<el-table-column label="本地" width="80" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.local_qty)
								}}</template>
							</el-table-column>
							<el-table-column label="实际可发" width="100" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.actual_shippable_qty)
								}}</template>
							</el-table-column>
							<el-table-column label="采购计划" width="100" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.purchase_plan_qty)
								}}</template>
							</el-table-column>
							<el-table-column label="待交付" width="100" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.pending_delivery_qty)
								}}</template>
							</el-table-column>
							<el-table-column label="日均" width="90" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.daily_avg_sales)
								}}</template>
							</el-table-column>
							<el-table-column label="目标天数" width="100" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.target_stock_days)
								}}</template>
							</el-table-column>
							<el-table-column label="波动系数" width="100" align="right">
								<template #default="{ row }">{{
									formatNullableReviewNumber(row.volatility_coefficient)
								}}</template>
							</el-table-column>
						</el-table>
					</el-tab-pane>

					<el-tab-pane name="segments">
						<template #label
							>运输段 {{ formatReviewNumber(filteredSegments.length) }}</template
						>
						<el-table
							:data="filteredSegments"
							border
							height="100%"
							empty-text="暂无运输段"
						>
							<el-table-column label="运输方式" width="130" fixed>
								<template #default="{ row }">
									<span
										class="method-label"
										:style="{
											'--method-color': getMethodMeta(
												row.method_key,
												row.method_label
											).color
										}"
									>
										{{ getMethodMeta(row.method_key, row.method_label).icon }}
										{{
											row.method_label || getMethodMeta(row.method_key).label
										}}
									</span>
								</template>
							</el-table-column>
							<el-table-column label="产品" min-width="260" fixed>
								<template #default="{ row }">
									<div class="line-product-cell">
										<template v-if="getLineProduct(row.product_line_no)">
											<el-image
												v-if="
													getLineProduct(row.product_line_no).product_img
												"
												:src="
													getLineProduct(row.product_line_no).product_img
												"
												fit="contain"
												class="line-product-img"
											/>
											<div v-else class="line-product-img is-empty">无图</div>
											<div>
												<strong
													:title="
														getLineProduct(row.product_line_no)
															.product_name || '-'
													"
												>
													{{
														getLineProduct(row.product_line_no)
															.product_name || "-"
													}}
												</strong>
												<span>
													MSKU
													{{
														getLineProduct(row.product_line_no).msku ||
														"-"
													}}
												</span>
											</div>
										</template>
										<span v-else>产品行 {{ row.product_line_no || "-" }}</span>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="发货量" width="90" align="right">
								<template #default="{ row }">
									<strong class="primary-text">{{
										formatReviewNumber(row.ship_qty)
									}}</strong>
								</template>
							</el-table-column>
							<el-table-column
								prop="system_suggest_qty"
								label="系统建议"
								width="100"
								align="right"
							/>
							<el-table-column
								prop="warehouse_name"
								label="仓库"
								min-width="160"
								show-overflow-tooltip
							/>
							<el-table-column label="包装" width="120">
								<template #default="{ row }">{{
									row.packing_type_label || "-"
								}}</template>
							</el-table-column>
							<el-table-column prop="plan_ship_date" label="发货日期" width="120" />
							<el-table-column label="到货周期" min-width="180">
								<template #default="{ row }">
									{{
										formatDateRange(row.date_range_json) ||
										row.arrival_range_text ||
										"-"
									}}
								</template>
							</el-table-column>
							<el-table-column
								prop="batch_remark"
								label="批次备注"
								min-width="150"
								show-overflow-tooltip
							/>
							<el-table-column
								prop="detail_remark"
								label="明细备注"
								min-width="150"
								show-overflow-tooltip
							/>
						</el-table>
					</el-tab-pane>

					<el-tab-pane name="allocations">
						<template #label
							>采购单分配
							{{ formatReviewNumber(filteredAllocations.length) }}</template
						>
						<el-table
							:data="filteredAllocations"
							border
							height="100%"
							empty-text="暂无采购单分配"
						>
							<el-table-column label="产品" min-width="260" fixed>
								<template #default="{ row }">
									<div class="line-product-cell">
										<template v-if="getLineProduct(row.product_line_no)">
											<el-image
												v-if="
													getLineProduct(row.product_line_no).product_img
												"
												:src="
													getLineProduct(row.product_line_no).product_img
												"
												fit="contain"
												class="line-product-img"
											/>
											<div v-else class="line-product-img is-empty">无图</div>
											<div>
												<strong
													:title="
														getLineProduct(row.product_line_no)
															.product_name || '-'
													"
												>
													{{
														getLineProduct(row.product_line_no)
															.product_name || "-"
													}}
												</strong>
												<span>
													MSKU
													{{
														getLineProduct(row.product_line_no).msku ||
														"-"
													}}
												</span>
											</div>
										</template>
										<span v-else>产品行 {{ row.product_line_no || "-" }}</span>
									</div>
								</template>
							</el-table-column>
							<el-table-column
								prop="purchase_order_sn"
								label="采购单"
								min-width="150"
							/>
							<el-table-column
								prop="purchase_plan_sn"
								label="采购计划"
								min-width="150"
							/>
							<el-table-column
								prop="supplier_name"
								label="供应商"
								min-width="200"
								show-overflow-tooltip
							/>
							<el-table-column prop="order_status_text" label="状态" width="100" />
							<el-table-column label="本次分配" width="100" align="right">
								<template #default="{ row }">
									<strong class="primary-text">{{
										formatReviewNumber(row.ship_qty)
									}}</strong>
								</template>
							</el-table-column>
							<el-table-column
								prop="actual_shippable_qty"
								label="实际可发"
								width="100"
								align="right"
							/>
							<el-table-column
								prop="logistics_status_text"
								label="物流状态"
								min-width="120"
							/>
							<el-table-column prop="execute_status" label="执行状态" width="110">
								<template #default="{ row }">
									<el-tag
										size="small"
										:type="
											row.execute_status === 'success'
												? 'success'
												: row.execute_status === 'failed'
													? 'danger'
													: 'info'
										"
									>
										{{ getAllocationExecuteStatusText(row.execute_status) }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column
								prop="lingxing_seq"
								label="领星批次"
								min-width="130"
								show-overflow-tooltip
							/>
							<el-table-column
								prop="execute_error"
								label="执行错误"
								min-width="220"
								show-overflow-tooltip
							/>
						</el-table>
					</el-tab-pane>

					<el-tab-pane label="操作日志" name="logs">
						<div class="log-layout">
							<el-timeline>
								<el-timeline-item
									v-for="log in logs"
									:key="log.id"
									:timestamp="formatReviewTime(log.createTime)"
									:type="getLogTimelineType(log)"
									hollow
								>
									<div class="log-item">
										<strong>{{ getLogActionText(log.action) }}</strong>
										<span>
											{{
												log.operator_nickname ||
												log.operator_username ||
												"-"
											}}
											{{
												log.from_status
													? `${getReviewStatusMeta(log.from_status).text} → ${getReviewStatusMeta(log.to_status).text}`
													: ""
											}}
										</span>
										<p v-if="log.remark">{{ log.remark }}</p>
									</div>
								</el-timeline-item>
							</el-timeline>
							<el-empty v-if="logs.length === 0" description="暂无操作日志" />
						</div>
					</el-tab-pane>

					<el-tab-pane label="快照" name="snapshot">
						<div class="snapshot-layout">
							<div class="snapshot-block">
								<div class="snapshot-head">工作台快照</div>
								<pre>{{ formatJson(currentVersion?.workbench_snapshot_json) }}</pre>
							</div>
							<div class="snapshot-block">
								<div class="snapshot-head">最终提交 Payload</div>
								<pre>{{ formatJson(currentVersion?.submit_payload_json) }}</pre>
							</div>
						</div>
					</el-tab-pane>
				</el-tabs>

				<div v-if="executionVisible" class="execution-band">
					<div class="section-title">执行结果</div>
					<div class="execution-content">
						<el-alert
							:type="review.status === 'execute_success' ? 'success' : 'warning'"
							:closable="false"
							show-icon
						>
							<template #title>
								旧执行批次：{{
									execution?.batch_no || review.executed_batch_no || "-"
								}}
							</template>
							{{ execution?.error || getReviewStatusMeta(review.status).description }}
						</el-alert>
						<pre v-if="execution?.result">{{ formatJson(execution.result) }}</pre>
					</div>
				</div>
			</template>
		</template>
	</div>
</template>

<script lang="ts" name="app-bsr_batch_ship_review_detail_panel" setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft, Check, Close, EditPen, Refresh, RefreshRight } from "@element-plus/icons-vue";
import { useCool } from "/@/cool";
import BsrBatchShipReviewSnapshotEditor from "/@/modules/app/components/BsrBatchShipReviewSnapshotEditor.vue";
import {
	canReviewAction,
	formatReviewNumber,
	formatReviewTime,
	getMethodMeta,
	getReviewStatusMeta,
	normalizeReviewSummary
} from "/@/modules/app/utils/bsr-batch-ship-review";

const { service } = useCool();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const executing = ref(false);
const withdrawing = ref(false);
const editing = ref(false);
const editorLoading = ref(false);
const savingDraft = ref(false);
const submittingReview = ref(false);
const activeTab = ref("products");
const detail = ref<any | null>(null);
const editorPayload = ref<any | null>(null);
const editorSummary = ref<any | null>(null);
const activeProductLineNo = ref<number | null>(null);

const review = computed(() => detail.value?.review || null);
const currentVersion = computed(() => detail.value?.current_version || null);
const products = computed(() => detail.value?.products || []);
const segments = computed(() => detail.value?.segments || []);
const allocations = computed(() => detail.value?.allocations || []);
const logs = computed(() => detail.value?.logs || []);
const execution = computed(() => detail.value?.execution || null);
const summary = computed(() => normalizeReviewSummary(review.value || detail.value?.summary || {}));
const executionVisible = computed(() =>
	["executing", "execute_success", "execute_partial_failed", "execute_failed"].includes(
		String(review.value?.status || "")
	)
);
const canEditSnapshot = computed(() =>
	["draft", "rejected"].includes(String(review.value?.status || ""))
);
const canWithdrawForEdit = computed(() => String(review.value?.status || "") === "pending_review");

const productByLineNo = computed(() => {
	const map = new Map<number, any>();
	products.value.forEach((product: any) => {
		const lineNo = normalizeProductLineNo(product.product_line_no);
		if (lineNo) map.set(lineNo, product);
	});
	return map;
});

const productLineSummaries = computed(() =>
	products.value.map((product: any) => {
		const lineNo = normalizeProductLineNo(product.product_line_no);
		return {
			lineNo,
			product,
			segmentCount: segments.value.filter(
				(row: any) => normalizeProductLineNo(row.product_line_no) === lineNo
			).length,
			allocationCount: allocations.value.filter(
				(row: any) => normalizeProductLineNo(row.product_line_no) === lineNo
			).length
		};
	})
);

const selectedProduct = computed(() =>
	activeProductLineNo.value ? productByLineNo.value.get(activeProductLineNo.value) || null : null
);

const filteredProducts = computed(() => {
	if (!activeProductLineNo.value) return products.value;
	return products.value.filter(
		(row: any) => normalizeProductLineNo(row.product_line_no) === activeProductLineNo.value
	);
});

const filteredSegments = computed(() => {
	if (!activeProductLineNo.value) return segments.value;
	return segments.value.filter(
		(row: any) => normalizeProductLineNo(row.product_line_no) === activeProductLineNo.value
	);
});

const filteredAllocations = computed(() => {
	if (!activeProductLineNo.value) return allocations.value;
	return allocations.value.filter(
		(row: any) => normalizeProductLineNo(row.product_line_no) === activeProductLineNo.value
	);
});

const metrics = computed(() => [
	{ label: "发货总量", value: summary.value.totalShipQty },
	{ label: "产品", value: summary.value.productCount },
	{ label: "运输段", value: summary.value.segmentCount },
	{ label: "采购单", value: summary.value.orderCount },
	{ label: "运输方式", value: summary.value.methodCount },
	{ label: "仓库", value: summary.value.warehouseCount }
]);

const compactEditMetrics = computed(() => {
	const editor = editorSummary.value || {};
	const versionNo = editor.versionNo || currentVersion.value?.version_no || "-";
	const productCount = editor.productCount ?? summary.value.productCount ?? 0;
	const segmentCount = editor.segmentCount ?? summary.value.segmentCount ?? 0;
	const totalShipQty = editor.totalShipQty ?? summary.value.totalShipQty ?? 0;
	const validationErrorCount = editor.validationErrorCount ?? 0;
	return [
		{ label: "版本", value: versionNo, type: "info" as const },
		{ label: "产品", value: formatReviewNumber(productCount), type: "info" as const },
		{ label: "运输段", value: formatReviewNumber(segmentCount), type: "info" as const },
		{ label: "发货", value: formatReviewNumber(totalShipQty), type: "primary" as const },
		{
			label: "异常",
			value: formatReviewNumber(validationErrorCount),
			type: (validationErrorCount > 0 ? "danger" : "success") as const
		}
	];
});

const statusFlow = computed(() => {
	const status = String(review.value?.status || "");
	return [
		{
			index: 1,
			key: "submit",
			label: "保存/提交",
			desc: "已形成审核快照",
			time: formatReviewTime(review.value?.submitted_time || review.value?.createTime),
			done: true,
			active: status === "draft",
			danger: false
		},
		{
			index: 2,
			key: "review",
			label: "审核",
			desc: status === "pending_review" ? "等待审核" : "审核结果已记录",
			time: review.value?.reviewed_time ? formatReviewTime(review.value.reviewed_time) : "",
			done: [
				"approved",
				"executing",
				"execute_success",
				"execute_partial_failed",
				"execute_failed"
			].includes(status),
			active: status === "pending_review",
			danger: status === "rejected"
		},
		{
			index: 3,
			key: "execute",
			label: "发送",
			desc: review.value?.executed_batch_no || "审核后手动发送",
			time: review.value?.executed_time ? formatReviewTime(review.value.executed_time) : "",
			done: status === "execute_success",
			active: ["approved", "executing"].includes(status),
			danger: ["execute_failed", "execute_partial_failed"].includes(status)
		}
	];
});

onMounted(async () => {
	await loadDetail();
	if (String(route.query.mode || "") === "edit") {
		if (canEditSnapshot.value) {
			await startEditSnapshot();
		} else if (canWithdrawForEdit.value) {
			ElMessage.info("待审核单需要先撤回，才能修改快照数据");
		}
	}
});

const reviewRequest = (action: string, data: any = {}) => {
	return service.request({
		url: `/admin/app/bsr_batch_ship_review/${action}`,
		method: "POST",
		data
	});
};

async function loadDetail() {
	const reviewNo = String(route.query.review_no || "");
	if (!reviewNo) {
		ElMessage.warning("缺少审核单号");
		return null;
	}
	loading.value = true;
	try {
		detail.value = await reviewRequest("detail", { review_no: reviewNo });
		ensureActiveProductContext();
		return detail.value;
	} catch (error: any) {
		ElMessage.error(error?.message || "加载审核单详情失败");
		detail.value = null;
		return null;
	} finally {
		loading.value = false;
	}
}

function normalizeProductLineNo(value: any) {
	return Number(value) || 0;
}

function ensureActiveProductContext() {
	const lineNos = products.value
		.map((product: any) => normalizeProductLineNo(product.product_line_no))
		.filter(Boolean);
	if (!lineNos.length) {
		activeProductLineNo.value = 0;
		return;
	}
	if (activeProductLineNo.value === null) {
		activeProductLineNo.value = lineNos[0];
		return;
	}
	if (activeProductLineNo.value !== 0 && !lineNos.includes(activeProductLineNo.value)) {
		activeProductLineNo.value = lineNos[0];
	}
}

function selectProductLine(lineNo: number) {
	activeProductLineNo.value = lineNo;
}

function getLineProduct(lineNo: any) {
	return productByLineNo.value.get(normalizeProductLineNo(lineNo)) || null;
}

function getProductLineSummary(product: any) {
	const lineNo = normalizeProductLineNo(product?.product_line_no);
	return (
		productLineSummaries.value.find((item) => item.lineNo === lineNo) || {
			lineNo,
			product,
			segmentCount: 0,
			allocationCount: 0
		}
	);
}

function goBack() {
	router.push("/app/bsr_batch_ship_review");
}

async function startEditSnapshot() {
	if (!review.value?.review_no) return;
	if (!canEditSnapshot.value) {
		ElMessage.warning("当前状态不允许直接修改审核单");
		return;
	}
	editorLoading.value = true;
	try {
		editorSummary.value = null;
		editorPayload.value = await reviewRequest("restorePayload", {
			review_no: review.value.review_no
		});
		editing.value = true;
	} catch (error: any) {
		ElMessage.error(error?.message || "载入审核单快照失败");
	} finally {
		editorLoading.value = false;
	}
}

async function withdrawForEdit() {
	if (!review.value?.review_no) return;
	try {
		await ElMessageBox.confirm(
			`确认撤回 ${review.value.review_no} 并进入修改？撤回后审核单会回到草稿状态。`,
			"撤回后修改",
			{
				type: "warning",
				confirmButtonText: "撤回并修改",
				cancelButtonText: "取消"
			}
		);
	} catch (error) {
		return;
	}
	withdrawing.value = true;
	try {
		await reviewRequest("withdraw", {
			review_no: review.value.review_no,
			remark: "撤回后修改审核单快照"
		});
		ElMessage.success("审核单已撤回，可继续修改");
		await loadDetail();
		await startEditSnapshot();
	} catch (error: any) {
		ElMessage.error(error?.message || "撤回审核单失败");
	} finally {
		withdrawing.value = false;
	}
}

function cancelEditor() {
	editing.value = false;
	editorPayload.value = null;
	editorSummary.value = null;
}

function handleEditorSummaryChange(value: any) {
	editorSummary.value = value || null;
}

async function saveEditorDraft(payload: any) {
	savingDraft.value = true;
	try {
		await reviewRequest("saveDraft", payload);
		ElMessage.success("审核草稿已保存为新版本");
		cancelEditor();
		await loadDetail();
	} catch (error: any) {
		ElMessage.error(error?.message || "保存审核草稿失败");
	} finally {
		savingDraft.value = false;
	}
}

async function submitEditorReview(payload: any) {
	submittingReview.value = true;
	try {
		await reviewRequest("submitForReview", payload);
		ElMessage.success("审核单已重新提交");
		cancelEditor();
		await loadDetail();
	} catch (error: any) {
		ElMessage.error(error?.message || "重新提交审核失败");
	} finally {
		submittingReview.value = false;
	}
}

async function approveReview() {
	if (!review.value) return;
	await ElMessageBox.confirm(`确认审核通过 ${review.value.review_no}？`, "审核通过", {
		type: "success",
		confirmButtonText: "通过",
		cancelButtonText: "取消"
	});
	await reviewRequest("approve", { review_no: review.value.review_no });
	ElMessage.success("审核已通过");
	await loadDetail();
}

async function rejectReview() {
	if (!review.value) return;
	const { value } = await ElMessageBox.prompt("请填写驳回原因。", "驳回审核单", {
		type: "warning",
		inputType: "textarea",
		inputPlaceholder: "例如：仓库、日期或发货数量需要调整",
		confirmButtonText: "驳回",
		cancelButtonText: "取消",
		inputValidator: (value) => Boolean(String(value || "").trim()) || "请填写驳回原因"
	});
	await reviewRequest("reject", { review_no: review.value.review_no, remark: value });
	ElMessage.success("审核单已驳回");
	await loadDetail();
}

async function executeReview() {
	if (!review.value) return;
	const isRetry = ["execute_failed", "execute_partial_failed"].includes(
		String(review.value.status || "")
	);
	await ElMessageBox.confirm(
		isRetry
			? `确认重试 ${review.value.review_no} 的失败项？系统会复用旧批次号重试失败明细。`
			: `确认发送 ${review.value.review_no}？发送会调用旧批量发货提交链路。`,
		isRetry ? "重试失败项" : "发送发货计划",
		{
			type: "warning",
			confirmButtonText: isRetry ? "重试" : "发送",
			cancelButtonText: "取消"
		}
	);
	executing.value = true;
	try {
		await reviewRequest("execute", { review_no: review.value.review_no });
		ElMessage.success("发送任务已完成");
		await loadDetail();
	} catch (error: any) {
		ElMessage.error(error?.message || "发送失败");
		await loadDetail();
	} finally {
		executing.value = false;
	}
}

function getOperatorName(row: any, prefix: string) {
	return row?.[`${prefix}_nickname`] || row?.[`${prefix}_username`] || "-";
}

function getExecuteButtonText(row: any) {
	return ["execute_failed", "execute_partial_failed"].includes(String(row?.status || ""))
		? "重试失败项"
		: "发送";
}

function getAllocationExecuteStatusText(status: any) {
	const map: Record<string, string> = {
		pending: "待执行",
		success: "成功",
		failed: "失败",
		skipped: "跳过"
	};
	return map[String(status || "")] || "未执行";
}

function formatDateRange(value: any) {
	if (!Array.isArray(value) || value.length < 2) return "";
	return `${value[0]} ~ ${value[1]}`;
}

function formatNullableReviewNumber(value: any) {
	return value === null || value === undefined || value === "" ? "-" : formatReviewNumber(value);
}

function formatJson(value: any) {
	if (!value) return "{}";
	try {
		return JSON.stringify(value, null, 2);
	} catch (error) {
		return String(value);
	}
}

function getLogActionText(action: string) {
	const map: Record<string, string> = {
		save_draft: "保存草稿",
		submit_review: "提交审核",
		withdraw: "撤回",
		approve: "审核通过",
		reject: "驳回",
		execute: "发送",
		retry_execute: "重新发送"
	};
	return map[action] || action || "-";
}

function getLogTimelineType(log: any) {
	if (["approve", "execute"].includes(log.action)) return "success";
	if (["reject"].includes(log.action)) return "danger";
	if (["submit_review"].includes(log.action)) return "warning";
	return "primary";
}
</script>

<style lang="scss" scoped>
.review-detail-page {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	padding: 12px;
	box-sizing: border-box;
	background: var(--el-bg-color-page);
	overflow-y: auto;
	overflow-x: hidden;
}

.review-detail-page.is-editing {
	overflow: hidden;
	padding-top: 8px;
}

.detail-head,
.overview-band,
.timeline-band,
.execution-band {
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
}

.detail-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
}

.detail-head.is-compact-edit-head {
	gap: 12px;
	min-height: 46px;
	padding: 6px 10px;
	border-color: var(--el-border-color-lighter);
	border-radius: 6px;
	box-shadow: none;
}

.edit-head-main {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.edit-head-title {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;

	strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: Consolas, "Courier New", monospace;
		font-size: 15px;
	}
}

.edit-head-tags {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	min-width: 0;

	:deep(.el-tag) {
		border-radius: 4px;
	}
}

.detail-title-wrap,
.head-actions {
	display: flex;
	align-items: center;
	gap: 10px;
}

.detail-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 18px;
	font-weight: 700;
	line-height: 1.2;
}

.detail-subtitle {
	margin-top: 4px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.review-remark-alert {
	margin-top: 10px;
	border-radius: 8px;
}

.overview-band {
	display: grid;
	grid-template-columns: minmax(260px, 1.2fr) 2fr;
	gap: 16px;
	margin-top: 10px;
	padding: 14px;
}

.identity-panel {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 8px;
	min-width: 0;
}

.identity-main {
	display: flex;
	align-items: baseline;
	gap: 10px;

	strong {
		font-family: Consolas, "Courier New", monospace;
		font-size: 18px;
	}

	span {
		color: var(--el-text-color-secondary);
	}
}

.identity-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 14px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.metric-list {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 8px;
}

.metric-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 10px;
	border-radius: 6px;
	background: var(--el-fill-color-lighter);

	span {
		font-size: 12px;
		color: var(--el-text-color-secondary);
	}

	strong {
		font-size: 20px;
	}
}

.timeline-band {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0;
	margin-top: 10px;
	padding: 12px;
}

.flow-step {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 4px 12px;
	border-right: 1px solid var(--el-border-color-lighter);

	&:last-child {
		border-right: 0;
	}

	> span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--el-fill-color);
		color: var(--el-text-color-secondary);
		font-weight: 700;
	}

	div {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	strong {
		font-size: 13px;
	}

	em {
		font-style: normal;
		font-size: 12px;
		color: var(--el-text-color-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&.done > span {
		background: var(--el-color-success-light-8);
		color: var(--el-color-success);
	}

	&.active > span {
		background: var(--el-color-primary-light-8);
		color: var(--el-color-primary);
	}

	&.danger > span {
		background: var(--el-color-danger-light-8);
		color: var(--el-color-danger);
	}
}

.product-context-band {
	margin-top: 10px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: var(--el-bg-color);
}

.product-context-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;

	> div {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	strong {
		font-size: 13px;
		color: var(--el-text-color-primary);
		white-space: nowrap;
	}

	span,
	em {
		overflow: hidden;
		color: var(--el-text-color-secondary);
		font-size: 12px;
		font-style: normal;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	em {
		flex: 0 0 auto;
	}
}

.product-context-track {
	display: flex;
	gap: 8px;
	min-width: 0;
	overflow-x: auto;
	padding-bottom: 2px;
	scrollbar-width: thin;
}

.product-context-all,
.product-context-card {
	flex: 0 0 auto;
	border: 1px solid #e4ebf5;
	border-radius: 7px;
	background: #fff;
	cursor: pointer;
	text-align: left;
	transition:
		border-color 0.16s,
		background 0.16s,
		box-shadow 0.16s,
		transform 0.16s;
}

.product-context-all:hover,
.product-context-card:hover {
	border-color: #b9d8ff;
	box-shadow: 0 4px 12px rgba(31, 45, 61, 0.08);
	transform: translateY(-1px);
}

.product-context-all.active,
.product-context-card.active {
	border-color: var(--el-color-primary);
	background: #f5f9ff;
	box-shadow: 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 16%, transparent);
}

.product-context-all {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 4px;
	width: 112px;
	min-height: 64px;
	padding: 8px 10px;

	strong {
		color: #1f2d3d;
		font-size: 13px;
	}

	span,
	em {
		color: var(--el-text-color-secondary);
		font-size: 12px;
		font-style: normal;
	}
}

.product-context-card {
	display: grid;
	grid-template-columns: 46px minmax(0, 1fr);
	align-items: center;
	gap: 8px;
	width: 280px;
	min-height: 64px;
	padding: 8px;
}

.product-context-img {
	width: 46px;
	height: 46px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: var(--el-fill-color-lighter);

	&.is-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--el-text-color-placeholder);
		font-size: 12px;
	}
}

.product-context-info {
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;

	strong,
	span,
	em {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: #303133;
		font-size: 12px;
	}

	span {
		color: var(--el-text-color-secondary);
		font-size: 11px;
	}

	em {
		color: #529b2e;
		font-size: 11px;
		font-style: normal;
		font-weight: 700;
	}
}

.detail-tabs {
	flex: 1;
	min-height: 0;
	margin-top: 10px;
	padding: 0 12px 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	background: var(--el-bg-color);

	:deep(.el-tabs__content) {
		height: calc(100% - 55px);
	}

	:deep(.el-tab-pane) {
		height: 100%;
	}
}

.line-product-cell {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;

	> div:last-child {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	strong {
		overflow: hidden;
		color: #303133;
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	span {
		color: var(--el-text-color-secondary);
		font-size: 12px;
	}
}

.line-product-img {
	width: 36px;
	height: 36px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: var(--el-fill-color-lighter);
	flex: 0 0 auto;

	&.is-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--el-text-color-placeholder);
		font-size: 11px;
	}
}

.product-cell {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;

	> div:last-child {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	span {
		font-size: 12px;
		color: var(--el-text-color-secondary);
	}
}

.product-img {
	width: 48px;
	height: 48px;
	border-radius: 6px;
	border: 1px solid var(--el-border-color-light);
	background: var(--el-fill-color-lighter);
	flex: 0 0 auto;

	&.is-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		color: var(--el-text-color-placeholder);
	}
}

.method-label {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 4px 8px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--method-color) 10%, transparent);
	color: color-mix(in srgb, var(--method-color) 82%, #1f2d3d);
	font-weight: 600;
}

.primary-text {
	color: var(--el-color-primary);
}

.success-text {
	color: var(--el-color-success);
}

.log-layout {
	height: 100%;
	overflow: auto;
	padding: 12px 6px;
	box-sizing: border-box;
}

.log-item {
	display: flex;
	flex-direction: column;
	gap: 4px;

	span,
	p {
		margin: 0;
		color: var(--el-text-color-secondary);
		font-size: 12px;
	}
}

.snapshot-layout {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
	height: 100%;
}

.snapshot-block {
	display: flex;
	flex-direction: column;
	min-height: 0;
	border: 1px solid var(--el-border-color-light);
	border-radius: 8px;
	overflow: hidden;
}

.snapshot-head {
	padding: 10px 12px;
	background: var(--el-fill-color-lighter);
	font-weight: 650;
}

pre {
	flex: 1;
	min-height: 0;
	margin: 0;
	padding: 12px;
	overflow: auto;
	font-size: 12px;
	line-height: 1.55;
	font-family: Consolas, "Courier New", monospace;
	white-space: pre-wrap;
	word-break: break-word;
}

.execution-band {
	margin-top: 10px;
	padding: 12px;
}

.section-title {
	margin-bottom: 10px;
	font-weight: 700;
}

.execution-content {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

@media (max-width: 1120px) {
	.overview-band {
		grid-template-columns: 1fr;
	}

	.metric-list {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
}
</style>
