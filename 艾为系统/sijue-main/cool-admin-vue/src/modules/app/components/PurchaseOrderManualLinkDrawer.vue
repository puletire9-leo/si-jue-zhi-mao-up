<template>
	<el-drawer
		v-model="drawerVisible"
		size="min(1120px, 94vw)"
		:destroy-on-close="true"
		:close-on-click-modal="false"
		class="manual-link-drawer"
	>
		<template #header>
			<div class="drawer-header">
				<div>
					<div class="drawer-title">采购单历史补全</div>
					<div class="drawer-subtitle">
						<span>采购单 {{ row?.order_sn || "-" }}</span>
						<span>计划 {{ row?.plan_sn || "-" }}</span>
						<span>{{ row?.purchase_order?.status_text || "-" }}</span>
					</div>
				</div>
				<div class="header-tags">
					<el-tag type="warning" effect="plain">人工历史补全</el-tag>
					<el-tag :type="matchStatusMap[row?.match_status || '']?.type || 'info'" effect="plain">
						{{ matchStatusMap[row?.match_status || ""]?.label || row?.match_status || "-" }}
					</el-tag>
				</div>
			</div>
		</template>

		<div v-if="row" v-loading="prepareLoading" class="drawer-body">
			<section class="summary-strip">
				<div class="product-summary">
					<div class="summary-image-wrap">
						<el-image
							v-if="selectedListing?.image_url || getProductImage(row)"
							:src="selectedListing?.image_url || getProductImage(row)"
							fit="contain"
							class="summary-image"
							:preview-src-list="[selectedListing?.image_url || getProductImage(row)]"
							preview-teleported
						/>
						<span v-else class="image-empty">无图</span>
					</div>
					<div class="summary-main">
						<div class="summary-title">
							{{ selectedListing?.item_name || selectedListing?.local_name || row.item?.product_name || row.purchase_plan?.product_name || "-" }}
						</div>
						<div class="summary-meta">
							<span><b>ASIN</b>{{ selectedListing?.asin || "-" }}</span>
							<span><b>MSKU</b>{{ selectedListing?.msku || row.item?.first_msku || "-" }}</span>
							<span><b>本地SKU</b>{{ selectedListing?.local_sku || row.purchase_plan?.sku || "-" }}</span>
							<span><b>店铺</b>{{ selectedListing?.shop || selectedListing?.seller_name || row.purchase_plan?.seller_name || "-" }}</span>
							<span><b>国家</b>{{ selectedListing?.marketplace || row.purchase_plan?.marketplace || "-" }}</span>
						</div>
					</div>
				</div>
				<div class="summary-metrics">
					<div>
						<span>明细计划</span>
						<b>{{ formatNumber(row.item?.quantity_plan) }}</b>
					</div>
					<div>
						<span>采购计划</span>
						<b>{{ formatNumber(row.purchase_plan?.quantity_plan) }}</b>
					</div>
					<div>
						<span>分段合计</span>
						<b :class="{ danger: hasSegmentMismatch }">{{ segmentTotal }}</b>
					</div>
					<div>
						<span>最终采购</span>
						<b>{{ form.final_purchase_qty || 0 }}</b>
					</div>
				</div>
			</section>

			<div class="content-grid">
				<section class="panel listing-panel">
					<div class="panel-head">
						<div class="panel-title">关联 Listing</div>
						<el-tag
							v-if="row.suggested_listing"
							size="small"
							:type="matchStatusMap[row.match_status]?.type || 'info'"
							effect="plain"
						>
							{{ matchStatusMap[row.match_status]?.label || "候选" }}
						</el-tag>
					</div>

					<div v-if="selectedListing" class="selected-listing">
						<div class="listing-image-wrap">
							<el-image v-if="selectedListing.image_url" :src="selectedListing.image_url" fit="contain" class="listing-image" />
							<span v-else class="image-empty">无图</span>
						</div>
						<div class="listing-main">
							<div class="listing-title">{{ selectedListing.item_name || selectedListing.local_name || "-" }}</div>
							<div class="listing-meta">
								<span><b>ASIN</b>{{ selectedListing.asin || "-" }}</span>
								<span><b>MSKU</b>{{ selectedListing.msku || "-" }}</span>
								<span><b>本地SKU</b>{{ selectedListing.local_sku || "-" }}</span>
								<span><b>店铺</b>{{ selectedListing.shop || selectedListing.seller_name || "-" }}</span>
							</div>
						</div>
						<el-button text :icon="Close" @click="clearSelectedListing" />
					</div>

					<div class="listing-search">
						<el-input
							v-model="listingKeyword"
							clearable
							placeholder="ASIN / MSKU / 本地SKU / 产品编码 / 店铺"
							@keyup.enter="searchListings"
							@clear="searchListings"
						>
							<template #prefix>
								<el-icon><Search /></el-icon>
							</template>
						</el-input>
						<el-button :icon="Search" :loading="listingLoading" @click="searchListings" />
					</div>

					<div class="listing-result-list" v-loading="listingLoading">
						<button
							v-for="item in listingList"
							:key="item.id"
							class="listing-result"
							:class="{ selected: Number(selectedListing?.id) === Number(item.id) }"
							type="button"
							@click="selectListing(item)"
						>
							<div class="listing-image-wrap small">
								<el-image v-if="item.image_url" :src="item.image_url" fit="contain" class="listing-image" />
								<span v-else class="image-empty">无图</span>
							</div>
							<div class="listing-main">
								<div class="listing-title">{{ item.item_name || item.local_name || "-" }}</div>
								<div class="listing-meta">
									<span><b>ASIN</b>{{ item.asin || "-" }}</span>
									<span><b>MSKU</b>{{ item.msku || "-" }}</span>
									<span><b>本地SKU</b>{{ item.local_sku || "-" }}</span>
									<span><b>国家</b>{{ item.marketplace || "-" }}</span>
								</div>
							</div>
							<el-icon v-if="Number(selectedListing?.id) === Number(item.id)" class="selected-icon">
								<Check />
							</el-icon>
						</button>
						<el-empty v-if="!listingLoading && listingList.length === 0" description="暂无 Listing" :image-size="46" />
					</div>
				</section>

				<section class="panel analysis-panel">
					<div class="panel-head">
						<div class="panel-title">分析基础</div>
						<el-button size="small" :icon="RefreshRight" @click="applyDailyDemand">应用日均测算</el-button>
					</div>

					<el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="analysis-form">
						<div class="form-grid">
							<el-form-item label="算法" prop="algorithm_key">
								<el-select v-model="form.algorithm_key" class="field">
									<el-option
										v-for="item in algorithmOptions"
										:key="item.key"
										:label="item.label"
										:value="item.key"
									/>
								</el-select>
							</el-form-item>
							<el-form-item label="日均销量" prop="daily_avg_sales">
								<el-input-number v-model="form.daily_avg_sales" :min="0.01" :precision="2" :step="1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="销售周期" prop="cycle_range" class="span-2">
								<el-date-picker
									v-model="form.cycle_range"
									type="daterange"
									value-format="YYYY-MM-DD"
									range-separator="~"
									start-placeholder="开始日期"
									end-placeholder="结束日期"
									class="field"
									@change="refreshSegmentDays"
								/>
							</el-form-item>
							<el-form-item label="目标库存天数" prop="target_stock_days">
								<el-input-number v-model="form.target_stock_days" :min="1" :precision="0" :step="1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="波动系数" prop="volatility_coefficient">
								<el-input-number v-model="form.volatility_coefficient" :min="0.01" :precision="2" :step="0.05" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="人工系数" prop="manual_coefficient">
								<el-input-number v-model="form.manual_coefficient" :min="0.01" :precision="2" :step="0.1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="装箱数">
								<el-input-number v-model="form.box_pcs" :min="1" :precision="0" :step="1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="系统建议量" prop="system_suggested_qty">
								<el-input-number v-model="form.system_suggested_qty" :min="1" :precision="0" :step="1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="装箱前实际采购" prop="actual_purchase_qty_before_box">
								<el-input-number v-model="form.actual_purchase_qty_before_box" :min="1" :precision="0" :step="1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="最终采购量" prop="final_purchase_qty">
								<el-input-number v-model="form.final_purchase_qty" :min="1" :precision="0" :step="1" controls-position="right" class="field" />
							</el-form-item>
							<el-form-item label="仓库" class="span-2">
								<div class="warehouse-row">
									<el-select v-model="form.warehouse_wid" clearable class="warehouse-select" @change="handleWarehouseChange">
										<el-option
											v-for="item in warehouseOptions"
											:key="`${item.wid}-${item.name}`"
											:label="item.name || item.wid"
											:value="item.wid"
										/>
									</el-select>
									<el-input v-model="form.warehouse_name" clearable placeholder="仓库名称" />
								</div>
							</el-form-item>
							<el-form-item label="人工备注" prop="manual_remark" class="span-4">
								<el-input
									v-model="form.manual_remark"
									type="textarea"
									:rows="3"
									maxlength="500"
									show-word-limit
									placeholder="历史补全原因、依据或确认说明"
								/>
							</el-form-item>
						</div>
					</el-form>
				</section>
			</div>

			<section class="panel segment-panel">
				<div class="panel-head">
					<div class="panel-title">运输分段</div>
					<div class="segment-actions">
						<span class="segment-total" :class="{ danger: hasSegmentMismatch }">合计 {{ segmentTotal }} / {{ form.final_purchase_qty || 0 }}</span>
						<el-button size="small" @click="applyCycleToActiveSegments">套用周期</el-button>
						<el-button size="small" @click="syncFinalFromSegments">同步采购量</el-button>
					</div>
				</div>

				<div class="segment-grid">
					<div
						v-for="segment in form.shipping_segments"
						:key="segment.method_key"
						class="segment-card"
						:class="{ active: segment.active }"
					>
						<div class="segment-card-head">
							<el-checkbox v-model="segment.active" @change="handleSegmentActiveChange(segment)" />
							<span class="method-dot" :style="{ backgroundColor: segment.color || '#909399' }"></span>
							<div class="method-title">
								<strong>{{ segment.method_label }}</strong>
								<span>{{ segment.days_to_arrive }} 天</span>
							</div>
						</div>
						<div class="segment-fields">
							<el-date-picker
								v-model="segment.start_date"
								type="date"
								value-format="YYYY-MM-DD"
								placeholder="开始"
								:disabled="!segment.active"
								class="segment-date"
								@change="refreshSegmentDays"
							/>
							<el-date-picker
								v-model="segment.end_date"
								type="date"
								value-format="YYYY-MM-DD"
								placeholder="结束"
								:disabled="!segment.active"
								class="segment-date"
								@change="refreshSegmentDays"
							/>
							<el-input-number
								v-model="segment.coefficient"
								:min="0.01"
								:precision="2"
								:step="0.05"
								:disabled="!segment.active"
								controls-position="right"
								class="segment-number"
							/>
							<el-input-number
								v-model="segment.system_suggested_qty"
								:min="0"
								:precision="0"
								:disabled="!segment.active"
								controls-position="right"
								class="segment-number"
							/>
							<el-input-number
								v-model="segment.final_qty"
								:min="0"
								:precision="0"
								:disabled="!segment.active"
								controls-position="right"
								class="segment-number strong"
							/>
						</div>
						<div class="segment-card-foot">
							<span>{{ segment.period_days || 0 }} 天</span>
							<button type="button" :disabled="!segment.active" @click="fillRemaining(segment)">填入剩余</button>
						</div>
					</div>
				</div>
			</section>

			<section class="panel inventory-panel">
				<div class="panel-head">
					<div class="panel-title">库存与抵扣</div>
					<el-tag size="small" effect="plain">历史上下文</el-tag>
				</div>
				<div class="inventory-grid">
					<label>
						<span>FBA 可售</span>
						<el-input-number v-model="form.inventory.fba_valid" :min="0" :precision="0" controls-position="right" />
					</label>
					<label>
						<span>FBA 在途</span>
						<el-input-number v-model="form.inventory.inbound_qty" :min="0" :precision="0" controls-position="right" />
					</label>
					<label>
						<span>本地库存</span>
						<el-input-number v-model="form.inventory.local_valid" :min="0" :precision="0" controls-position="right" />
					</label>
					<label>
						<span>本地采购计划</span>
						<el-input-number v-model="form.inventory.local_purchase_plan" :min="0" :precision="0" controls-position="right" />
					</label>
					<label>
						<span>本地待交付</span>
						<el-input-number v-model="form.inventory.local_pending_delivery" :min="0" :precision="0" controls-position="right" />
					</label>
					<label>
						<span>领星待交付</span>
						<el-input-number v-model="form.inventory.lingxing_pending_delivery" :min="0" :precision="0" controls-position="right" />
					</label>
				</div>
			</section>

			<section class="panel preview-panel">
				<div class="panel-head">
					<div class="panel-title">写入预览</div>
					<el-tag :type="hasSegmentMismatch ? 'danger' : 'success'" effect="plain">
						{{ hasSegmentMismatch ? "数量不一致" : "数量一致" }}
					</el-tag>
				</div>
				<div class="preview-grid">
					<div class="preview-card">
						<span>周期</span>
						<b>{{ form.cycle_range?.[0] || "-" }} ~ {{ form.cycle_range?.[1] || "-" }}</b>
					</div>
					<div class="preview-card">
						<span>算法</span>
						<b>{{ currentAlgorithmLabel }}</b>
					</div>
					<div class="preview-card">
						<span>建议测算</span>
						<b>{{ suggestedByDaily }}</b>
					</div>
					<div class="preview-card">
						<span>运输分段</span>
						<b>{{ activeSegments.length }}</b>
					</div>
				</div>
				<div class="formula-preview">{{ formulaPreview }}</div>
				<div class="active-segments">
					<el-tag v-for="segment in activeSegments" :key="segment.method_key" effect="plain">
						{{ segment.method_label }} {{ segment.start_date || "-" }}~{{ segment.end_date || "-" }} / {{ segment.final_qty || 0 }}
					</el-tag>
				</div>
			</section>
		</div>

		<template #footer>
			<div class="drawer-footer">
				<div class="footer-warning" :class="{ danger: hasSegmentMismatch || Boolean(validationText) }">
					{{ validationText || (hasSegmentMismatch ? "分段合计需要等于最终采购量" : "将写入本地分析记录和人工历史补全快照") }}
				</div>
				<div class="footer-actions">
					<el-button @click="drawerVisible = false">取消</el-button>
					<el-tooltip :disabled="Boolean(selectedListing)" content="请先选择真实 Listing" placement="top">
						<span>
							<el-button type="primary" :loading="submitting" :disabled="!selectedListing" @click="submit">
								确认补全
							</el-button>
						</span>
					</el-tooltip>
				</div>
			</div>
		</template>
	</el-drawer>
</template>

<script lang="ts" setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { Check, Close, RefreshRight, Search } from "@element-plus/icons-vue";

type MatchStatus =
	| "auto_item_first_msku"
	| "auto_plan_local_sku"
	| "auto_plan_msku"
	| "manual_required"
	| "blocked";

interface ShippingSegmentForm {
	method_key: string;
	method_label: string;
	days_to_arrive: number;
	color: string;
	active: boolean;
	start_date: string;
	end_date: string;
	period_days: number;
	coefficient: number;
	system_suggested_qty: number;
	final_qty: number;
	alpha_mode: string;
	manual_alpha: number | null;
}

const props = defineProps<{
	visible: boolean;
	row: any | null;
}>();

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
	(e: "completed"): void;
}>();

const { service } = useCool();
const manualLinkService = computed(() => (service.app as any).bsr_purchase_order_manual_link);

const drawerVisible = computed({
	get: () => props.visible,
	set: (value: boolean) => emit("update:visible", value)
});

const row = computed(() => props.row);
const formRef = ref<FormInstance>();
const prepareLoading = ref(false);
const listingLoading = ref(false);
const submitting = ref(false);
const selectedListing = ref<any | null>(null);
const listingKeyword = ref("");
const listingList = ref<any[]>([]);
const prepareData = ref<any | null>(null);
const validationText = ref("");

const fallbackAlgorithms = [
	{ key: "daily_avg", label: "日均单量" },
	{ key: "history", label: "历史销量" },
	{ key: "trend", label: "搜索词趋势" },
	{ key: "combined", label: "综合走势" }
];

const fallbackShippingMethods = [
	{ key: "express", label: "快递", days: 5, color: "#FF6B9D" },
	{ key: "air", label: "空快", days: 8, color: "#409EFF" },
	{ key: "air_slow", label: "空慢", days: 10, color: "#67B8FF" },
	{ key: "truck", label: "卡车", days: 30, color: "#67C23A" },
	{ key: "rail", label: "铁路", days: 35, color: "#E6A23C" },
	{ key: "sea", label: "海运", days: 60, color: "#F56C6C" }
];

const form = reactive({
	algorithm_key: "daily_avg",
	daily_avg_sales: undefined as number | undefined,
	cycle_range: [] as string[],
	target_stock_days: 20,
	volatility_coefficient: 0.75,
	manual_coefficient: 1,
	system_suggested_qty: undefined as number | undefined,
	actual_purchase_qty_before_box: undefined as number | undefined,
	final_purchase_qty: undefined as number | undefined,
	box_pcs: undefined as number | undefined,
	warehouse_wid: undefined as number | string | undefined,
	warehouse_name: "",
	shipping_adjust_mode: "independent",
	manual_remark: "",
	shipping_segments: [] as ShippingSegmentForm[],
	inventory: {
		fba_valid: 0,
		inbound_qty: 0,
		local_valid: 0,
		local_purchase_plan: 0,
		local_pending_delivery: 0,
		lingxing_purchase_plan: 0,
		lingxing_pending_delivery: 0
	}
});

const matchStatusMap: Record<string, { label: string; type: "success" | "warning" | "info" | "danger" | "primary" }> = {
	auto_item_first_msku: { label: "明细 MSKU 匹配", type: "success" },
	auto_plan_local_sku: { label: "计划本地 SKU 匹配", type: "primary" },
	auto_plan_msku: { label: "计划 MSKU 匹配", type: "primary" },
	manual_required: { label: "需人工选品", type: "warning" },
	blocked: { label: "无法处理", type: "danger" }
};

const positiveRule = (label: string) => ({
	validator: (_rule: any, value: any, callback: any) => {
		const num = Number(value);
		if (!Number.isFinite(num) || num <= 0) {
			callback(new Error(`${label}必须大于0`));
		} else {
			callback();
		}
	},
	trigger: "change"
});

const rules: FormRules = {
	algorithm_key: [{ required: true, message: "请选择算法", trigger: "change" }],
	daily_avg_sales: [positiveRule("日均销量")],
	target_stock_days: [positiveRule("目标库存天数")],
	volatility_coefficient: [positiveRule("波动系数")],
	manual_coefficient: [positiveRule("人工系数")],
	system_suggested_qty: [positiveRule("系统建议量")],
	actual_purchase_qty_before_box: [positiveRule("装箱前实际采购量")],
	final_purchase_qty: [positiveRule("最终采购量")],
	cycle_range: [
		{
			validator: (_rule: any, value: any, callback: any) => {
				if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) {
					callback(new Error("请选择销售周期"));
				} else {
					callback();
				}
			},
			trigger: "change"
		}
	],
	manual_remark: [{ required: true, message: "请填写人工备注", trigger: "blur" }]
};

const algorithmOptions = computed(() => prepareData.value?.options?.algorithms || fallbackAlgorithms);
const shippingMethodOptions = computed(() => prepareData.value?.options?.shipping_methods || fallbackShippingMethods);
const warehouseOptions = computed(() => prepareData.value?.options?.warehouses || []);
const activeSegments = computed(() => form.shipping_segments.filter((item) => item.active));
const segmentTotal = computed(() => activeSegments.value.reduce((sum, item) => sum + (Number(item.final_qty) || 0), 0));
const hasSegmentMismatch = computed(() => Number(form.final_purchase_qty) > 0 && segmentTotal.value !== Number(form.final_purchase_qty));
const currentAlgorithmLabel = computed(() => algorithmOptions.value.find((item: any) => item.key === form.algorithm_key)?.label || "-");
const totalDays = computed(() => {
	if (!Array.isArray(form.cycle_range) || form.cycle_range.length !== 2) return 0;
	return diffDays(form.cycle_range[0], form.cycle_range[1]);
});
const suggestedByDaily = computed(() => {
	const daily = Number(form.daily_avg_sales) || 0;
	return totalDays.value > 0 ? Math.round(daily * totalDays.value) : 0;
});
const formulaPreview = computed(() => {
	const segmentText = activeSegments.value.map((item) => `${item.method_label}${Number(item.final_qty) || 0}`).join(" + ") || "0";
	return `系统建议 ${Number(form.system_suggested_qty) || 0}；分段 ${segmentText} = ${segmentTotal.value}；最终采购 ${Number(form.final_purchase_qty) || 0}`;
});

watch(
	() => props.visible,
	(value) => {
		if (value && props.row) {
			initFromRow(props.row);
		}
	}
);

watch(
	() => props.row,
	(value) => {
		if (props.visible && value) {
			initFromRow(value);
		}
	}
);

async function initFromRow(current: any) {
	validationText.value = "";
	selectedListing.value = current.suggested_listing || null;
	listingList.value = current.suggested_listing ? [current.suggested_listing] : [];
	listingKeyword.value = current.item?.first_msku || current.purchase_plan?.sku || current.item?.sku || current.plan_sn || "";
	await loadPrepare();
	nextTick(() => formRef.value?.clearValidate());
}

async function loadPrepare() {
	if (!row.value) return;
	prepareLoading.value = true;
	try {
		const res = await manualLinkService.value.prepare({
			order_item_id: row.value.order_item_id,
			listing_id: selectedListing.value?.id || undefined
		});
		prepareData.value = res || {};
		if (!selectedListing.value && res?.listing) {
			selectedListing.value = res.listing;
			listingList.value = [res.listing];
		}
		resetForm(res || {});
	} catch (error: any) {
		ElMessage.error(error?.message || "加载补全草稿失败");
		resetForm({});
	} finally {
		prepareLoading.value = false;
	}
}

function resetForm(data: any) {
	const defaults = data?.defaults || {};
	const finalQty = Number(defaults.final_purchase_qty) || Number(row.value?.item?.quantity_plan) || Number(row.value?.purchase_plan?.quantity_plan) || undefined;
	form.algorithm_key = "daily_avg";
	form.daily_avg_sales = undefined;
	form.cycle_range = [];
	form.target_stock_days = Number(defaults.target_stock_days) || 20;
	form.volatility_coefficient = Number(defaults.volatility_coefficient) || 0.75;
	form.manual_coefficient = Number(defaults.manual_coefficient) || 1;
	form.system_suggested_qty = Number(defaults.system_suggested_qty) || finalQty;
	form.actual_purchase_qty_before_box = Number(defaults.actual_purchase_qty_before_box) || finalQty;
	form.final_purchase_qty = finalQty;
	form.box_pcs = Number(defaults.box_pcs) || undefined;
	form.warehouse_wid = defaults.warehouse_wid || undefined;
	form.warehouse_name = defaults.warehouse_name || "";
	form.shipping_adjust_mode = defaults.shipping_adjust_mode || "independent";
	form.manual_remark = "";
	form.inventory.fba_valid = 0;
	form.inventory.inbound_qty = 0;
	form.inventory.local_valid = 0;
	form.inventory.local_purchase_plan = 0;
	form.inventory.local_pending_delivery = 0;
	form.inventory.lingxing_purchase_plan = 0;
	form.inventory.lingxing_pending_delivery = 0;
	form.shipping_segments = shippingMethodOptions.value.map((item: any) => ({
		method_key: item.key,
		method_label: item.label,
		days_to_arrive: Number(item.days) || 0,
		color: item.color || "#909399",
		active: false,
		start_date: "",
		end_date: "",
		period_days: 0,
		coefficient: 1,
		system_suggested_qty: 0,
		final_qty: 0,
		alpha_mode: "system",
		manual_alpha: null
	}));
}

function clearSelectedListing() {
	selectedListing.value = null;
}

function selectListing(item: any) {
	selectedListing.value = item;
	if (!listingList.value.some((row) => Number(row.id) === Number(item.id))) {
		listingList.value.unshift(item);
	}
}

async function searchListings() {
	if (!row.value) return;
	listingLoading.value = true;
	try {
		const res = await manualLinkService.value.searchListings({
			keyWord: listingKeyword.value,
			store_id: row.value.purchase_plan?.sid || row.value.item?.sid || "",
			marketplace: row.value.purchase_plan?.marketplace || row.value.item?.plan_marketplace || "",
			size: 10
		});
		listingList.value = Array.isArray(res?.list) ? res.list : [];
		if (selectedListing.value && !listingList.value.some((item) => Number(item.id) === Number(selectedListing.value?.id))) {
			listingList.value.unshift(selectedListing.value);
		}
	} catch (error: any) {
		ElMessage.error(error?.message || "搜索 Listing 失败");
	} finally {
		listingLoading.value = false;
	}
}

function handleWarehouseChange(value: any) {
	const item = warehouseOptions.value.find((row: any) => String(row.wid) === String(value));
	if (item?.name) {
		form.warehouse_name = item.name;
	}
}

function handleSegmentActiveChange(segment: ShippingSegmentForm) {
	if (!segment.active) {
		segment.final_qty = 0;
		segment.system_suggested_qty = 0;
	}
	refreshSegmentDays();
}

function applyCycleToActiveSegments() {
	if (!form.cycle_range?.[0] || !form.cycle_range?.[1]) {
		ElMessage.warning("请先选择销售周期");
		return;
	}
	activeSegments.value.forEach((segment) => {
		segment.start_date = segment.start_date || form.cycle_range[0];
		segment.end_date = segment.end_date || form.cycle_range[1];
	});
	refreshSegmentDays();
}

function applyDailyDemand() {
	if (suggestedByDaily.value <= 0) {
		ElMessage.warning("请先填写日均销量和销售周期");
		return;
	}
	form.system_suggested_qty = suggestedByDaily.value;
	form.actual_purchase_qty_before_box = suggestedByDaily.value;
	if (!form.final_purchase_qty) {
		form.final_purchase_qty = suggestedByDaily.value;
	}
	activeSegments.value.forEach((segment) => {
		if (!segment.start_date || !segment.end_date) return;
		const days = diffDays(segment.start_date, segment.end_date);
		segment.system_suggested_qty = Math.round((Number(form.daily_avg_sales) || 0) * days * (Number(segment.coefficient) || 1));
	});
}

function fillRemaining(segment: ShippingSegmentForm) {
	const otherTotal = activeSegments.value
		.filter((item) => item.method_key !== segment.method_key)
		.reduce((sum, item) => sum + (Number(item.final_qty) || 0), 0);
	segment.final_qty = Math.max(0, (Number(form.final_purchase_qty) || 0) - otherTotal);
	if (!segment.system_suggested_qty) {
		segment.system_suggested_qty = segment.final_qty;
	}
}

function syncFinalFromSegments() {
	if (segmentTotal.value <= 0) {
		ElMessage.warning("运输分段合计为 0");
		return;
	}
	form.final_purchase_qty = segmentTotal.value;
	if (!form.actual_purchase_qty_before_box) {
		form.actual_purchase_qty_before_box = segmentTotal.value;
	}
	if (!form.system_suggested_qty) {
		form.system_suggested_qty = segmentTotal.value;
	}
}

function refreshSegmentDays() {
	form.shipping_segments.forEach((segment) => {
		segment.period_days = segment.start_date && segment.end_date ? Math.max(diffDays(segment.start_date, segment.end_date), 0) : 0;
	});
}

async function validateForm() {
	validationText.value = "";
	if (!selectedListing.value) {
		validationText.value = "请选择真实 Listing";
		return false;
	}
	const valid = await formRef.value?.validate().catch(() => false);
	if (!valid) return false;
	if (activeSegments.value.length === 0) {
		validationText.value = "至少启用一个运输分段";
		return false;
	}
	const [cycleStart, cycleEnd] = form.cycle_range;
	for (const segment of activeSegments.value) {
		if (!segment.start_date || !segment.end_date) {
			validationText.value = `${segment.method_label}缺少分段日期`;
			return false;
		}
		if (segment.start_date < cycleStart || segment.end_date > cycleEnd) {
			validationText.value = `${segment.method_label}日期超出销售周期`;
			return false;
		}
		if (diffDays(segment.start_date, segment.end_date) <= 0) {
			validationText.value = `${segment.method_label}结束日期必须大于等于开始日期`;
			return false;
		}
		if (Number(segment.final_qty) <= 0) {
			validationText.value = `${segment.method_label}最终数量必须大于0`;
			return false;
		}
	}
	if (segmentTotal.value !== Number(form.final_purchase_qty)) {
		validationText.value = "启用运输分段数量合计必须等于最终采购量";
		return false;
	}
	return true;
}

function buildPayload() {
	const [cycleStartDate, cycleEndDate] = form.cycle_range;
	return {
		order_item_id: row.value?.order_item_id,
		listing_id: selectedListing.value?.id,
		snapshot_draft: {
			algorithm_key: form.algorithm_key,
			daily_avg_sales: form.daily_avg_sales,
			target_stock_days: form.target_stock_days,
			volatility_coefficient: form.volatility_coefficient,
			manual_coefficient: form.manual_coefficient,
			cycle_start_date: cycleStartDate,
			cycle_end_date: cycleEndDate,
			system_suggested_qty: form.system_suggested_qty,
			actual_purchase_qty_before_box: form.actual_purchase_qty_before_box,
			final_purchase_qty: form.final_purchase_qty,
			box_pcs: form.box_pcs || null,
			warehouse_wid: form.warehouse_wid || null,
			warehouse_name: form.warehouse_name,
			shipping_adjust_mode: form.shipping_adjust_mode,
			manual_remark: form.manual_remark,
			inventory: { ...form.inventory },
			shipping_segments: form.shipping_segments.map((segment) => ({
				method_key: segment.method_key,
				method_label: segment.method_label,
				active: segment.active,
				start_date: segment.start_date,
				end_date: segment.end_date,
				period_days: segment.period_days,
				system_suggested_qty: segment.system_suggested_qty,
				final_qty: segment.final_qty,
				coefficient: segment.coefficient,
				alpha_mode: segment.alpha_mode,
				manual_alpha: segment.manual_alpha
			}))
		}
	};
}

async function submit() {
	if (!row.value) return;
	const valid = await validateForm();
	if (!valid) return;
	const payload = buildPayload();
	const listingText = [selectedListing.value?.asin, selectedListing.value?.msku, selectedListing.value?.local_sku].filter(Boolean).join(" / ");

	try {
		await ElMessageBox.confirm(
			`采购单 ${row.value.order_sn}，计划 ${row.value.plan_sn}，Listing ${listingText || selectedListing.value?.id}，最终采购 ${form.final_purchase_qty}，运输分段 ${activeSegments.value.length} 个。`,
			"确认补全",
			{
				type: "warning",
				confirmButtonText: "确认补全",
				cancelButtonText: "取消"
			}
		);
		submitting.value = true;
		await manualLinkService.value.complete(payload);
		ElMessage.success("补全成功");
		emit("completed");
		drawerVisible.value = false;
	} catch (error: any) {
		if (error !== "cancel") {
			ElMessage.error(error?.message || "补全失败");
		}
	} finally {
		submitting.value = false;
	}
}

function diffDays(start: string, end: string) {
	if (!start || !end) return 0;
	const startDate = new Date(`${start}T00:00:00`);
	const endDate = new Date(`${end}T00:00:00`);
	const diff = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
	return Number.isFinite(diff) ? diff : 0;
}

function getProductImage(current: any) {
	return current?.suggested_listing?.image_url || current?.purchase_plan?.pic_url || current?.item?.plan_pic_url || "";
}

function formatNumber(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}
</script>

<style lang="scss" scoped>
.manual-link-drawer :deep(.el-drawer__body) {
	padding: 0 16px 14px;
	background: var(--el-bg-color-page);
}

.drawer-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 14px;
	width: 100%;
}

.drawer-title {
	font-size: 17px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.drawer-subtitle,
.summary-meta,
.listing-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 12px;
	margin-top: 5px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.header-tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 6px;
}

.drawer-body {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 0;
}

.summary-strip,
.panel {
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	background: var(--el-bg-color);
}

.summary-strip {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 360px;
	gap: 12px;
	padding: 10px;
}

.product-summary {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.summary-image-wrap,
.listing-image-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 58px;
	width: 58px;
	height: 58px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: var(--el-fill-color-light);
	overflow: hidden;
}

.summary-image,
.listing-image {
	width: 100%;
	height: 100%;
}

.image-empty {
	color: var(--el-text-color-placeholder);
	font-size: 12px;
}

.summary-main,
.listing-main {
	min-width: 0;
	flex: 1;
}

.summary-title,
.listing-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 13px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.summary-meta b,
.listing-meta b {
	margin-right: 4px;
	color: var(--el-text-color-placeholder);
	font-weight: 600;
}

.summary-metrics {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 6px;
}

.summary-metrics div,
.preview-card {
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-width: 0;
	padding: 7px 9px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: #fff;
}

.summary-metrics span,
.preview-card span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.summary-metrics b,
.preview-card b {
	margin-top: 3px;
	color: var(--el-text-color-primary);
	font-size: 15px;
}

.danger {
	color: var(--el-color-danger) !important;
}

.content-grid {
	display: grid;
	grid-template-columns: 360px minmax(0, 1fr);
	gap: 10px;
	align-items: start;
}

.panel {
	padding: 12px;
}

.panel-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 10px;
}

.panel-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.selected-listing,
.listing-result {
	display: flex;
	align-items: center;
	gap: 9px;
	width: 100%;
	min-height: 68px;
	padding: 8px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: #fff;
	box-sizing: border-box;
}

.selected-listing {
	margin-bottom: 9px;
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.listing-image-wrap.small {
	flex-basis: 46px;
	width: 46px;
	height: 46px;
}

.listing-search {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 34px;
	gap: 8px;
	margin-bottom: 9px;
}

.listing-result-list {
	display: flex;
	flex-direction: column;
	gap: 7px;
	max-height: 322px;
	overflow: auto;
}

.listing-result {
	position: relative;
	text-align: left;
	cursor: pointer;
	transition: border-color 0.16s, background 0.16s;
}

.listing-result:hover,
.listing-result.selected {
	border-color: var(--el-color-primary);
	background: var(--el-color-primary-light-9);
}

.selected-icon {
	position: absolute;
	top: 9px;
	right: 9px;
	color: var(--el-color-primary);
}

.form-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 8px 10px;
}

.span-2 {
	grid-column: span 2;
}

.span-4 {
	grid-column: span 4;
}

.field {
	width: 100%;
}

.warehouse-row {
	display: grid;
	grid-template-columns: 160px minmax(0, 1fr);
	gap: 8px;
	width: 100%;
}

.warehouse-select {
	width: 160px;
}

.segment-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.segment-total {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.segment-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(142px, 1fr));
	gap: 8px;
}

.segment-card {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
	padding: 9px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: var(--el-fill-color-blank);
}

.segment-card.active {
	border-color: var(--el-color-primary-light-5);
	background: var(--el-color-primary-light-9);
}

.segment-card-head {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
}

.method-dot {
	flex: 0 0 8px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
}

.method-title {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 6px;
	min-width: 0;
	flex: 1;
}

.method-title strong {
	font-size: 13px;
	color: var(--el-text-color-primary);
}

.method-title span {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.segment-fields {
	display: grid;
	grid-template-columns: 1fr;
	gap: 6px;
}

.segment-date,
.segment-number {
	width: 100%;
}

.segment-card-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.segment-card-foot button {
	border: 0;
	background: transparent;
	color: var(--el-color-primary);
	cursor: pointer;
	font-size: 12px;
}

.segment-card-foot button:disabled {
	color: var(--el-text-color-placeholder);
	cursor: not-allowed;
}

.inventory-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 8px;
}

.inventory-grid label {
	display: flex;
	flex-direction: column;
	gap: 5px;
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.inventory-grid :deep(.el-input-number) {
	width: 100%;
}

.preview-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 8px;
}

.formula-preview {
	margin-top: 9px;
	padding: 8px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 5px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-regular);
	font-size: 12px;
	line-height: 1.5;
}

.active-segments {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 9px;
}

.drawer-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
}

.footer-warning {
	min-width: 0;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.footer-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

@media (max-width: 1180px) {
	.summary-strip,
	.content-grid {
		grid-template-columns: 1fr;
	}

	.segment-grid {
		grid-template-columns: repeat(3, minmax(150px, 1fr));
	}
}

@media (max-width: 760px) {
	.form-grid,
	.inventory-grid,
	.preview-grid,
	.summary-metrics {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.span-2,
	.span-4 {
		grid-column: span 2;
	}

	.segment-grid {
		grid-template-columns: 1fr;
	}

	.drawer-footer {
		align-items: stretch;
		flex-direction: column;
	}
}
</style>
