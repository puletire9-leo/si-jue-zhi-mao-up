<template>
	<div class="review-snapshot-editor">
		<el-alert
			v-if="review?.status === 'rejected' && review?.review_remark"
			type="warning"
			show-icon
			:closable="false"
			class="reject-alert"
		>
			<template #title>驳回原因：{{ review.review_remark }}</template>
			请按驳回原因调整发货数量、仓库、日期或采购单分配后重新提交审核。
		</el-alert>

		<el-alert
			v-if="hasValidationIssues"
			:type="validationAlertType"
			show-icon
			:closable="false"
			class="validation-alert"
			:class="`is-${validationAlertType}`"
		>
			<template #title>{{ validationAlertTitle }}</template>
			<span>{{ validationAlertDescription }}</span>
		</el-alert>

		<div class="editor-layout" :class="{ 'single-product-mode': isSingleProductMode }">
			<aside v-if="!isSingleProductMode" class="product-rail">
				<button
					v-for="product in model.products"
					:key="product.id"
					type="button"
					class="product-nav-item"
					:class="{ active: product.id === selectedProductId }"
					@click="selectProduct(product.id)"
				>
					<el-image
						v-if="product.productImg"
						:src="product.productImg"
						fit="contain"
						class="rail-img"
					/>
					<div v-else class="rail-img is-empty">无图</div>
					<div class="product-nav-info">
						<strong>{{ product.msku || product.asin || "未命名产品" }}</strong>
						<span
							>{{ product.marketplace || "-" }} ·
							{{ product.segments.length }} 段</span
						>
						<em>发货 {{ formatReviewNumber(getProductShipQty(product)) }}</em>
					</div>
					<div class="product-nav-state">
						<i v-if="getProductIssueCount(product) > 0">{{
							getProductIssueCount(product)
						}}</i>
						<span v-if="product.id === selectedProductId" class="product-active-badge">
							当前
						</span>
					</div>
				</button>
			</aside>

			<section class="editor-main">
				<el-empty v-if="!selectedProduct" description="暂无可编辑产品" />
				<template v-else>
					<div class="workspace-overview">
						<div class="workspace-product product-summary">
							<el-image
								v-if="selectedProduct.productImg"
								:src="selectedProduct.productImg"
								fit="contain"
								class="product-img"
								:preview-src-list="[selectedProduct.productImg]"
								preview-teleported
							/>
							<div v-else class="product-img is-empty">无图</div>
							<div class="product-summary-main">
								<strong>{{ selectedProduct.productName || "-" }}</strong>
								<span>
									MSKU {{ selectedProduct.msku || "-" }} / ASIN
									{{ selectedProduct.asin || "-" }} / FNSKU
									{{ selectedProduct.fnsku || "-" }}
								</span>
								<span>
									店铺
									{{
										selectedProduct.sellerName || selectedProduct.storeId || "-"
									}}
									· 产品编码 {{ selectedProduct.productCode || "-" }}
								</span>
							</div>
							<div class="product-metrics">
								<div>
									<span>发货</span>
									<strong>{{
										formatReviewNumber(getProductShipQty(selectedProduct))
									}}</strong>
								</div>
								<div>
									<span>可发</span>
									<strong>{{
										formatReviewNumber(selectedProduct.actualShippableQty)
									}}</strong>
								</div>
								<div>
									<span>计划</span>
									<strong>{{
										formatReviewNumber(selectedProduct.purchasePlanQty)
									}}</strong>
								</div>
								<div>
									<span>货源</span>
									<strong>{{
										formatReviewNumber(
											getProductAllocationTotal(selectedProduct)
										)
									}}</strong>
								</div>
								<div
									class="balance-metric"
									:class="getBalanceClass(selectedProduct)"
								>
									<span>配平</span>
									<strong>{{
										getProductBalanceState(selectedProduct).badgeText
									}}</strong>
								</div>
							</div>
						</div>

						<div class="segment-switcher" role="tablist">
							<button
								v-for="segment in selectedProduct.segments"
								:key="segment.id"
								type="button"
								class="segment-nav-card"
								:class="{
									active: isActiveSegment(segment),
									'is-error': getSegmentIssue(segment, selectedProduct)
								}"
								:style="{
									'--method-color': getMethodMeta(
										segment.methodKey,
										segment.methodLabel
									).color
								}"
								@click="selectSegment(segment)"
							>
								<div class="segment-nav-top">
									<span class="method-chip">
										{{
											getMethodMeta(segment.methodKey, segment.methodLabel)
												.icon
										}}
										{{
											segment.methodLabel ||
											getMethodMeta(segment.methodKey).label ||
											segment.methodKey
										}}
									</span>
									<div class="segment-nav-tags">
										<span
											v-if="isActiveSegment(segment)"
											class="segment-active-mark"
										>
											当前
										</span>
										<el-tag
											v-if="getSegmentIssue(segment, selectedProduct)"
											type="danger"
											effect="light"
											size="small"
											round
										>
											异常
										</el-tag>
									</div>
								</div>
								<div class="segment-nav-qty">
									<span>
										发货
										<strong>{{ formatReviewNumber(segment.shipQty) }}</strong>
									</span>
									<span class="auto-allocation-hint"> 保存时自动分摊 </span>
								</div>
								<div class="segment-nav-meta">
									<span>{{
										segment.warehouseName ||
										getWarehouseLabel(segment.warehouse) ||
										"仓库未选"
									}}</span>
									<span>{{ segment.planShipDate || "日期未选" }}</span>
								</div>
							</button>
						</div>
					</div>

					<section
						v-if="selectedSegment"
						class="segment-workbench segment-editor-panel"
						:class="{ 'is-error': selectedSegmentIssue }"
						:style="{
							'--method-color': getMethodMeta(
								selectedSegment.methodKey,
								selectedSegment.methodLabel
							).color
						}"
					>
						<header class="segment-editor-head">
							<div class="segment-title-row">
								<div class="segment-title">
									<span class="method-chip">
										{{
											getMethodMeta(
												selectedSegment.methodKey,
												selectedSegment.methodLabel
											).icon
										}}
										{{
											selectedSegment.methodLabel ||
											getMethodMeta(selectedSegment.methodKey).label ||
											selectedSegment.methodKey
										}}
									</span>
									<em>{{
										selectedSegment.arrivalRangeText ||
										formatSegmentDateRange(selectedSegment)
									}}</em>
								</div>
							</div>
							<div class="segment-editor-meta-row">
								<span class="segment-meta-pill is-strong">
									<em>发货量</em>
									<strong>{{
										formatReviewNumber(selectedSegment.shipQty)
									}}</strong>
								</span>
								<span
									class="segment-meta-pill"
									:class="selectedProduct ? getBalanceClass(selectedProduct) : ''"
								>
									<em>产品货源</em>
									<strong>{{
										formatReviewNumber(
											selectedProduct
												? getProductAllocationTotal(selectedProduct)
												: 0
										)
									}}</strong>
								</span>
								<span class="segment-meta-pill is-wide">
									<em>发货仓</em>
									<strong>{{
										selectedSegment.warehouseName ||
										getWarehouseLabel(selectedSegment.warehouse) ||
										"未选"
									}}</strong>
								</span>
								<span class="segment-meta-pill">
									<em>发货日</em>
									<strong>{{
										formatShortShipDate(selectedSegment.planShipDate)
									}}</strong>
								</span>
							</div>
						</header>

						<div class="segment-editor-body">
							<el-alert
								v-if="selectedSegmentIssue"
								type="error"
								show-icon
								:closable="false"
								class="segment-alert"
								:title="selectedSegmentIssue"
							/>

							<el-form label-position="top" class="segment-form">
								<el-form-item label="发货数量">
									<el-input-number
										v-model="selectedSegment.shipQty"
										:min="0"
										:precision="0"
										controls-position="right"
									/>
									<p
										v-if="selectedProduct"
										class="balance-field-hint"
										:class="getBalanceClass(selectedProduct)"
									>
										{{ getProductBalanceState(selectedProduct).fieldHint }}
									</p>
								</el-form-item>
								<el-form-item label="发货仓库">
									<el-select
										v-model="selectedSegment.warehouse"
										filterable
										placeholder="选择仓库"
										@change="() => handleWarehouseChange(selectedSegment)"
									>
										<el-option
											v-for="option in model.warehouseOptions"
											:key="option.value"
											:label="`${option.label}（${option.group}）`"
											:value="option.value"
										/>
									</el-select>
								</el-form-item>
								<el-form-item label="包装类型">
									<el-select
										v-model="selectedSegment.packageType"
										placeholder="选择包装"
										@change="() => handlePackageTypeChange(selectedSegment)"
									>
										<el-option
											v-for="option in REVIEW_EDITOR_PACKAGE_TYPE_OPTIONS"
											:key="option.value"
											:label="option.label"
											:value="option.value"
										/>
									</el-select>
								</el-form-item>
								<el-form-item label="计划发货日期">
									<el-date-picker
										v-model="selectedSegment.planShipDate"
										type="date"
										value-format="YYYY-MM-DD"
										placeholder="选择日期"
									/>
								</el-form-item>
								<el-form-item label="运输备注">
									<el-input
										v-model="selectedSegment.detailRemark"
										clearable
										placeholder="明细备注"
									/>
								</el-form-item>
								<el-form-item label="批次备注">
									<el-input
										v-model="selectedSegment.batchRemark"
										clearable
										placeholder="批次备注"
									/>
								</el-form-item>
							</el-form>

							<div class="allocation-panel">
								<div class="allocation-head">
									<div class="allocation-title">
										<strong>采购单货源池</strong>
										<em>保存时系统会自动把货源分摊到各运输方式。</em>
									</div>
									<span
										class="allocation-balance"
										:class="getBalanceClass(selectedProduct)"
									>
										产品发货
										{{ formatReviewNumber(getProductShipQty(selectedProduct)) }}
										/ 货源池
										{{
											formatReviewNumber(
												getProductAllocationTotal(selectedProduct)
											)
										}}
										/ {{ getProductBalanceState(selectedProduct).badgeText }}
									</span>
								</div>
								<div class="allocation-table-wrap">
									<el-table
										:data="selectedProduct.allocationPool"
										border
										size="small"
										:height="getAllocationTableHeight(selectedProduct)"
										empty-text="暂无采购单货源"
									>
										<el-table-column
											prop="purchaseOrderSn"
											label="采购单"
											min-width="150"
											fixed
										/>
										<el-table-column
											prop="purchasePlanSn"
											label="采购计划"
											min-width="150"
										/>
										<el-table-column
											prop="supplierName"
											label="供应商"
											min-width="180"
											show-overflow-tooltip
										/>
										<el-table-column
											prop="orderStatusText"
											label="状态"
											width="90"
										/>
										<el-table-column label="实际可发" width="100" align="right">
											<template #default="{ row }">
												{{ formatReviewNumber(row.actualShippableQty) }}
											</template>
										</el-table-column>
										<el-table-column label="本次使用" width="150" align="right">
											<template #default="{ row }">
												<el-input-number
													v-model="row.shipQty"
													:min="0"
													:precision="0"
													:max="getAllocationMax(row)"
													controls-position="right"
													size="small"
												/>
											</template>
										</el-table-column>
										<el-table-column
											prop="logisticsStatusText"
											label="物流"
											min-width="120"
											show-overflow-tooltip
										/>
									</el-table>
								</div>
							</div>
						</div>
					</section>
				</template>
			</section>
		</div>

		<div class="editor-bottom-bar">
			<div
				class="bottom-status"
				:class="{
					danger: hasBlockingValidationErrors,
					warning: !hasBlockingValidationErrors && hasValidationIssues
				}"
			>
				<span v-if="hasValidationIssues">
					{{ validationAlertTitle
					}}<em v-if="validationIssues.length > 1">
						等 {{ validationIssues.length }} 项</em
					>
				</span>
				<span v-else>校验通过，可以保存草稿或重新提交审核。</span>
			</div>
			<div class="bottom-actions">
				<el-button @click="emit('cancel')">取消编辑</el-button>
				<el-button
					type="primary"
					plain
					:loading="savingDraft"
					:disabled="hasValidationIssues"
					@click="handleSave('draft')"
				>
					保存草稿
				</el-button>
				<el-button
					type="primary"
					:loading="submittingReview"
					:disabled="hasValidationIssues"
					@click="handleSave('submit')"
				>
					重新提交审核
				</el-button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
	REVIEW_EDITOR_PACKAGE_TYPE_OPTIONS,
	buildReviewEditorSaveRequest,
	createReviewEditorModel,
	getReviewEditorAllocationMax,
	getReviewEditorPackageTypeLabel,
	getReviewEditorProductAllocationTotal,
	getReviewEditorProductBalanceState,
	getReviewEditorProductShipQty,
	type ReviewEditorModel,
	type ReviewEditorProduct,
	type ReviewEditorSegment,
	validateReviewEditorIssues,
	validateReviewEditorModel
} from "/@/modules/app/utils/bsr-batch-ship-review-editor";
import { formatReviewNumber, getMethodMeta } from "/@/modules/app/utils/bsr-batch-ship-review";

const props = defineProps<{
	payload: any;
	review?: any;
	savingDraft?: boolean;
	submittingReview?: boolean;
}>();

const emit = defineEmits<{
	(e: "save-draft", payload: any): void;
	(e: "submit-review", payload: any): void;
	(e: "cancel"): void;
	(e: "summary-change", payload: any): void;
}>();

const model = ref<ReviewEditorModel>(createReviewEditorModel(props.payload || {}));
const selectedProductId = ref("");
const activeSegmentKey = ref("");

const segmentCount = computed(() =>
	model.value.products.reduce((sum, product) => sum + product.segments.length, 0)
);
const totalShipQty = computed(() =>
	model.value.products.reduce((sum, product) => sum + getReviewEditorProductShipQty(product), 0)
);
const selectedProduct = computed(
	() =>
		model.value.products.find((product) => product.id === selectedProductId.value) ||
		model.value.products[0] ||
		null
);
const selectedSegment = computed(() => {
	const product = selectedProduct.value;
	if (!product) return null;
	return (
		product.segments.find(
			(segment) => makeSegmentKey(product, segment) === activeSegmentKey.value
		) ||
		product.segments[0] ||
		null
	);
});
const segmentValidationMap = computed(() => {
	const map = new Map<string, string>();
	model.value.products.forEach((product) => {
		product.segments.forEach((segment) => {
			const issue = buildSegmentIssue(segment);
			if (issue) {
				map.set(makeSegmentKey(product, segment), issue);
			}
		});
	});
	return map;
});
const selectedSegmentIssue = computed(() => {
	if (!selectedProduct.value || !selectedSegment.value) return "";
	return getSegmentIssue(selectedSegment.value, selectedProduct.value);
});
const validationIssues = computed(() => validateReviewEditorIssues(model.value));
const validationErrors = computed(() => validationIssues.value.map((issue) => issue.message));
const topValidationIssue = computed(
	() =>
		validationIssues.value.find((issue) => issue.type === "error") ||
		validationIssues.value[0] ||
		null
);
const hasValidationIssues = computed(() => validationIssues.value.length > 0);
const hasBlockingValidationErrors = computed(() =>
	validationIssues.value.some((issue) => issue.type === "error")
);
const validationAlertType = computed(() =>
	topValidationIssue.value?.type === "error" ? "error" : "warning"
);
const validationAlertTitle = computed(() => {
	const issue = topValidationIssue.value;
	if (!issue) return "";
	return issue.title || `还有 ${validationIssues.value.length} 项需要处理`;
});
const validationAlertDescription = computed(() => {
	const issue = topValidationIssue.value;
	if (!issue) return "";
	return issue.description || validationErrors.value.slice(0, 3).join("；");
});
const isSingleProductMode = computed(() => model.value.products.length <= 1);
const compactSummary = computed(() => ({
	reviewNo: model.value.reviewNo,
	versionNo: model.value.versionNo,
	productCount: model.value.products.length,
	segmentCount: segmentCount.value,
	totalShipQty: totalShipQty.value,
	validationErrorCount: validationIssues.value.length
}));

watch(
	() => props.payload,
	(value) => {
		model.value = createReviewEditorModel(value || {});
		const firstProduct = model.value.products[0];
		selectedProductId.value = firstProduct?.id || "";
		setActiveSegmentForProduct(firstProduct || null);
	},
	{ immediate: true }
);

watch(
	selectedProduct,
	(product) => {
		if (!product) {
			activeSegmentKey.value = "";
			return;
		}
		const exists = product.segments.some(
			(segment) => makeSegmentKey(product, segment) === activeSegmentKey.value
		);
		if (!exists) {
			setActiveSegmentForProduct(product);
		}
	},
	{ immediate: true }
);

watch(
	compactSummary,
	(value) => {
		emit("summary-change", value);
	},
	{ immediate: true }
);

function selectProduct(productId: string) {
	selectedProductId.value = productId;
	const product = model.value.products.find((item) => item.id === productId) || null;
	setActiveSegmentForProduct(product);
}

function selectSegment(segment: ReviewEditorSegment) {
	if (!selectedProduct.value) return;
	activeSegmentKey.value = makeSegmentKey(selectedProduct.value, segment);
}

function isActiveSegment(segment: ReviewEditorSegment) {
	if (!selectedProduct.value) return false;
	return activeSegmentKey.value === makeSegmentKey(selectedProduct.value, segment);
}

function setActiveSegmentForProduct(product: ReviewEditorProduct | null) {
	const firstSegment = product?.segments[0];
	activeSegmentKey.value = product && firstSegment ? makeSegmentKey(product, firstSegment) : "";
}

function makeSegmentKey(product: ReviewEditorProduct, segment: ReviewEditorSegment) {
	return `${product.id}::${segment.id}`;
}

function getProductShipQty(product: ReviewEditorProduct) {
	return getReviewEditorProductShipQty(product);
}

function getProductAllocationTotal(product: ReviewEditorProduct) {
	return getReviewEditorProductAllocationTotal(product);
}

function getProductBalanceState(product: ReviewEditorProduct) {
	return getReviewEditorProductBalanceState(product);
}

function getBalanceClass(product: ReviewEditorProduct) {
	return getProductBalanceState(product).severity === "success" ? "is-balanced" : "is-warning";
}

function getProductIssueCount(product: ReviewEditorProduct) {
	const segmentIssueCount = product.segments.reduce(
		(count, segment) =>
			count + (segmentValidationMap.value.get(makeSegmentKey(product, segment)) ? 1 : 0),
		0
	);
	return segmentIssueCount + getProductAllocationIssueCount(product);
}

function getProductAllocationIssueCount(product: ReviewEditorProduct) {
	let count = 0;
	if (!product.allocationPool.length) count += 1;
	if (getProductAllocationTotal(product) !== getProductShipQty(product)) count += 1;
	count += product.allocationPool.filter((allocation) => {
		const max = getReviewEditorAllocationMax(allocation);
		return max !== null && Number(allocation.shipQty || 0) > max;
	}).length;
	return count;
}

function getWarehouseLabel(value: any) {
	const normalized = String(value || "");
	return model.value.warehouseOptions.find((item) => item.value === normalized)?.label || "";
}

function handleWarehouseChange(segment: ReviewEditorSegment) {
	segment.warehouseName = getWarehouseLabel(segment.warehouse);
}

function handlePackageTypeChange(segment: ReviewEditorSegment) {
	segment.packageTypeLabel = getReviewEditorPackageTypeLabel(segment.packageType);
}

function getAllocationMax(row: any) {
	return getReviewEditorAllocationMax(row) ?? undefined;
}

function getAllocationTableHeight(product: ReviewEditorProduct) {
	const rowCount = Math.max(1, product.allocationPool.length);
	const tableHeight = 39 + rowCount * 36;
	return Math.min(Math.max(tableHeight, 96), 220);
}

function getSegmentIssue(segment: ReviewEditorSegment, product = selectedProduct.value) {
	if (product) {
		return segmentValidationMap.value.get(makeSegmentKey(product, segment)) || "";
	}
	return buildSegmentIssue(segment);
}

function buildSegmentIssue(segment: ReviewEditorSegment) {
	const shipQty = Number(segment.shipQty || 0);
	if (shipQty <= 0) return "发货数量必须大于 0";
	if (!segment.warehouse) return "请选择发货仓库";
	if (!segment.packageType) return "请选择包装类型";
	if (!segment.planShipDate) return "请选择计划发货日期";
	return "";
}

function formatSegmentDateRange(segment: ReviewEditorSegment) {
	if (!Array.isArray(segment.dateRange) || segment.dateRange.length < 2) return "";
	return `${segment.dateRange[0]} ~ ${segment.dateRange[1]}`;
}

function formatShortShipDate(value: string) {
	if (!value) return "未选";
	const parts = String(value).split("-");
	if (parts.length >= 3) return `${parts[1]}-${parts[2]}`;
	return value;
}

function handleSave(type: "draft" | "submit") {
	const errors = validateReviewEditorModel(model.value);
	if (errors.length) {
		ElMessage.warning(errors[0]);
		return;
	}
	const payload = buildReviewEditorSaveRequest(model.value, type);
	emit(type === "submit" ? "submit-review" : "save-draft", payload);
}
</script>

<style lang="scss" scoped>
.review-snapshot-editor {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 8px;
	min-height: 0;
	margin-top: 6px;
	padding-bottom: 0;
	overflow: hidden;
}

.reject-alert,
.validation-alert {
	border-radius: 6px;
}

.validation-alert.is-warning {
	border-color: var(--el-color-warning-light-7);
	background: #fff8ed;
}

.editor-layout {
	display: grid;
	grid-template-columns: 280px minmax(0, 1fr);
	gap: 10px;
	flex: 1;
	min-height: 0;

	&.single-product-mode {
		grid-template-columns: minmax(0, 1fr);
	}
}

.product-rail,
.editor-main {
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: var(--el-bg-color);
}

.product-rail {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 0;
	padding: 10px;
	overflow: auto;
}

.product-nav-item {
	display: grid;
	grid-template-columns: 44px minmax(0, 1fr) auto;
	gap: 10px;
	align-items: center;
	width: 100%;
	padding: 9px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-blank);
	text-align: left;
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		background 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;

	&:hover {
		border-color: var(--el-color-primary-light-5);
		background: var(--el-color-primary-light-9);
	}

	&.active {
		border-color: var(--el-color-primary);
		background: linear-gradient(90deg, var(--el-color-primary-light-9) 0%, #fff 84%);
		box-shadow:
			inset 3px 0 0 var(--el-color-primary),
			0 6px 14px rgba(43, 99, 217, 0.08);
		transform: translateX(1px);
	}

	&.active strong {
		color: var(--el-color-primary);
	}

	.product-nav-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}

	strong,
	span,
	em {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-size: 13px;
		color: var(--el-text-color-primary);
	}

	span,
	em {
		font-size: 12px;
		font-style: normal;
		color: var(--el-text-color-secondary);
	}

	.product-nav-state {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	i {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 999px;
		background: var(--el-color-danger-light-8);
		color: var(--el-color-danger);
		font-size: 12px;
		font-style: normal;
		font-weight: 700;
	}
}

.product-active-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 20px;
	padding: 0 7px;
	border: 1px solid var(--el-color-primary-light-5);
	border-radius: 999px;
	background: var(--el-color-primary-light-9);
	color: var(--el-color-primary);
	font-size: 11px;
	font-weight: 700;
	white-space: nowrap;
}

.rail-img,
.product-img {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: var(--el-fill-color-lighter);
}

.rail-img {
	width: 44px;
	height: 44px;
}

.product-img {
	width: 48px;
	height: 48px;
	flex: 0 0 auto;
}

.is-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: var(--el-text-color-placeholder);
}

.editor-main {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
	min-height: 0;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: transparent;
	overflow-y: hidden;
	overflow-x: hidden;
}

.workspace-overview {
	display: grid;
	grid-template-columns: minmax(320px, 0.85fr) minmax(0, 2.15fr);
	gap: 10px;
	align-items: stretch;
	flex: 0 0 auto;
	padding: 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: linear-gradient(180deg, #fbfcff 0%, var(--el-bg-color) 100%);
}

.product-summary {
	display: grid;
	grid-template-columns: 48px minmax(0, 1fr);
	gap: 9px;
	align-items: center;
	min-width: 0;
	padding: 0;
	background: transparent;
}

.product-summary-main {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;

	strong,
	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-size: 13px;
	}

	span {
		font-size: 11px;
		color: var(--el-text-color-secondary);
	}
}

.product-metrics {
	display: flex;
	align-items: center;
	gap: 6px;
	grid-column: 1 / -1;
	min-width: 0;

	div {
		display: inline-flex;
		align-items: baseline;
		gap: 4px;
		min-width: 0;
		padding: 3px 7px;
		border: 1px solid var(--el-border-color-lighter);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.72);

		&.is-warning {
			border-color: var(--el-color-warning-light-5);
			background: #fff8ed;

			strong {
				color: var(--el-color-warning-dark-2);
				transition: color 0.18s ease;
			}
		}

		&.is-balanced {
			border-color: var(--el-color-success-light-5);
			background: var(--el-color-success-light-9);

			strong {
				color: var(--el-color-success);
			}
		}
	}

	span {
		font-size: 11px;
		color: var(--el-text-color-secondary);
	}

	strong {
		font-size: 15px;
		line-height: 1;
	}
}

.method-chip {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-width: 86px;
	font-size: 13px;
	color: var(--method-color);
}

.segment-brief {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.segment-switcher {
	display: flex;
	flex-wrap: nowrap;
	gap: 8px;
	align-content: start;
	min-width: 0;
	padding: 0;
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: thin;
}

.segment-nav-card {
	display: flex;
	flex: 0 0 184px;
	flex-direction: column;
	gap: 7px;
	min-width: 184px;
	max-width: 210px;
	padding: 9px 10px;
	border: 1px solid color-mix(in srgb, var(--method-color) 30%, var(--el-border-color-light));
	border-radius: 6px;
	background: color-mix(in srgb, var(--method-color) 5%, var(--el-bg-color));
	text-align: left;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(29, 43, 76, 0.04);
	transition:
		border-color 0.18s ease,
		background 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;

	&:hover {
		border-color: var(--method-color);
		background: color-mix(in srgb, var(--method-color) 8%, var(--el-bg-color));
		box-shadow: 0 6px 18px rgba(29, 43, 76, 0.08);
	}

	&.active {
		border-color: var(--method-color);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--method-color) 12%, #fff) 0%,
			color-mix(in srgb, var(--method-color) 7%, var(--el-bg-color)) 100%
		);
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, var(--method-color) 68%, transparent),
			0 8px 20px rgba(29, 43, 76, 0.1);
		transform: translateY(-1px);
	}

	&.is-error {
		border-color: var(--el-color-danger-light-5);
		background: color-mix(in srgb, var(--el-color-danger) 7%, var(--el-bg-color));
	}

	&.is-error.active {
		border-color: var(--el-color-danger);
		box-shadow:
			inset 0 0 0 1px var(--el-color-danger-light-5),
			0 8px 20px rgba(220, 38, 38, 0.1);
	}
}

.segment-nav-top,
.segment-nav-qty,
.segment-nav-meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	min-width: 0;
}

.segment-nav-tags {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	flex: 0 0 auto;
}

.segment-active-mark {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 20px;
	padding: 0 7px;
	border: 1px solid color-mix(in srgb, var(--method-color) 38%, var(--el-border-color));
	border-radius: 999px;
	background: color-mix(in srgb, var(--method-color) 12%, #fff);
	color: color-mix(in srgb, var(--method-color) 82%, #111827);
	font-size: 11px;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

.segment-nav-qty,
.segment-nav-meta {
	font-size: 12px;
	color: var(--el-text-color-secondary);

	span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		margin-left: 3px;
		color: var(--el-text-color-primary);
		font-size: 16px;
	}

	.danger,
	.danger strong {
		color: var(--el-color-danger);
	}
}

.auto-allocation-hint {
	color: var(--el-text-color-placeholder);
	font-size: 11px;
}

.segment-editor-panel {
	display: flex;
	flex: 0 0 auto;
	flex-direction: column;
	min-height: 0;
	overflow: hidden;
	border: 1px solid color-mix(in srgb, var(--method-color) 34%, var(--el-border-color-light));
	border-radius: 6px;
	background: var(--el-bg-color);

	&.is-error {
		border-color: var(--el-color-danger-light-5);
	}
}

.segment-editor-head {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 8px;
	flex: 0 0 auto;
	padding: 8px 10px 10px;
	background: linear-gradient(
		180deg,
		color-mix(in srgb, var(--method-color) 10%, #fff) 0%,
		color-mix(in srgb, var(--method-color) 5%, var(--el-fill-color-lighter)) 100%
	);
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.segment-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-width: 0;
}

.segment-title {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;

	.method-chip {
		min-width: auto;
		padding: 1px 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--method-color) 10%, #fff);
		font-weight: 700;
	}

	em {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-style: normal;
		color: var(--el-text-color-secondary);
	}
}

.segment-editor-meta-row {
	display: grid;
	grid-template-columns:
		minmax(86px, max-content) minmax(112px, max-content) minmax(180px, 1fr)
		minmax(92px, max-content);
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.segment-meta-pill {
	display: inline-grid;
	grid-template-columns: auto minmax(0, auto);
	align-items: baseline;
	gap: 6px;
	min-width: 0;
	max-width: 260px;
	min-height: 30px;
	padding: 3px 8px;
	border: 1px solid color-mix(in srgb, var(--method-color) 14%, var(--el-border-color-lighter));
	border-radius: 4px;
	background: rgba(255, 255, 255, 0.72);
	font-size: 12px;
	line-height: 20px;

	em {
		color: var(--el-text-color-secondary);
		font-style: normal;
		white-space: nowrap;
	}

	strong {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--el-text-color-primary);
		font-size: 13px;
		font-weight: 700;
	}

	&.is-strong {
		border-color: color-mix(in srgb, var(--method-color) 24%, var(--el-border-color));
		background: color-mix(in srgb, var(--method-color) 8%, #fff);

		strong {
			color: color-mix(in srgb, var(--method-color) 84%, #111827);
			font-size: 14px;
		}
	}

	&.is-wide {
		flex: 1 1 170px;
		max-width: none;
	}

	&.danger,
	&.danger strong {
		color: var(--el-color-danger);
	}

	&.is-warning {
		border-color: var(--el-color-warning-light-5);
		background: #fff8ed;

		strong {
			color: var(--el-color-warning-dark-2);
		}
	}

	&.is-balanced {
		border-color: var(--el-color-success-light-5);
		background: var(--el-color-success-light-9);

		strong {
			color: var(--el-color-success);
		}
	}
}

.segment-editor-body {
	display: flex;
	flex-direction: column;
	gap: 8px;
	flex: 0 0 auto;
	min-height: 0;
	padding: 10px;
	overflow: auto;
}

.segment-form {
	display: grid;
	grid-template-columns: repeat(3, minmax(180px, 1fr));
	gap: 0 12px;
	flex: 0 0 auto;

	:deep(.el-form-item) {
		margin-bottom: 8px;
	}

	:deep(.el-form-item__label) {
		margin-bottom: 4px;
		line-height: 18px;
	}

	:deep(.el-select),
	:deep(.el-date-editor),
	:deep(.el-input-number) {
		width: 100%;
	}
}

.balance-field-hint {
	margin: 4px 0 0;
	font-size: 11px;
	line-height: 16px;
	color: var(--el-text-color-secondary);

	&.is-warning {
		color: var(--el-color-warning-dark-2);
	}

	&.is-balanced {
		color: var(--el-color-success);
	}
}

.segment-alert {
	border-radius: 6px;
}

.allocation-panel {
	display: flex;
	flex-direction: column;
	gap: 8px;
	flex: 0 0 auto;
	min-height: 0;
	overflow: hidden;
	padding-top: 8px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.allocation-table-wrap {
	flex: 0 0 auto;
	min-height: 0;
	overflow: hidden;

	:deep(.el-table) {
		border-radius: 4px;
	}
}

.allocation-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	font-size: 12px;

	span {
		color: var(--el-text-color-secondary);
	}
}

.allocation-title {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;

	strong {
		font-size: 13px;
	}

	em {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--el-text-color-secondary);
		font-style: normal;
	}
}

.allocation-balance {
	flex: 0 0 auto;
	padding: 2px 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 999px;
	background: var(--el-fill-color-lighter);
	white-space: nowrap;

	&.is-warning {
		border-color: var(--el-color-warning-light-5);
		background: #fff8ed;
		color: var(--el-color-warning-dark-2);
	}

	&.is-balanced {
		border-color: var(--el-color-success-light-5);
		background: var(--el-color-success-light-9);
		color: var(--el-color-success);
	}
}

.editor-bottom-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	position: relative;
	flex: 0 0 auto;
	z-index: 9;
	min-height: 48px;
	padding: 8px 10px;
	border: 0;
	border-top: 1px solid var(--el-border-color-light);
	border-radius: 0;
	background: var(--el-bg-color);
	box-shadow: none;
}

.bottom-status {
	min-width: 0;
	font-size: 12px;
	color: var(--el-color-success);

	span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	em {
		font-style: normal;
	}

	&.danger {
		color: var(--el-color-danger);
	}

	&.warning {
		color: var(--el-color-warning-dark-2);
	}
}

.bottom-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 0 0 auto;
}

@media (max-width: 1180px) {
	.editor-layout {
		grid-template-columns: 1fr;
	}

	.workspace-overview {
		grid-template-columns: 1fr;
	}

	.product-rail {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		min-height: 0;
	}

	.product-summary {
		grid-template-columns: 48px minmax(0, 1fr);
	}

	.product-metrics {
		grid-column: 1 / -1;
	}
}

@media (max-width: 760px) {
	.allocation-head,
	.editor-bottom-bar,
	.bottom-actions {
		align-items: stretch;
		flex-direction: column;
	}

	.segment-editor-meta-row {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.segment-meta-pill {
		max-width: none;
	}

	.product-rail,
	.segment-form {
		grid-template-columns: 1fr;
	}
}
</style>
