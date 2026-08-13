<template>
	<el-dialog
		v-model="visibleProxy"
		:title="dialogTitle"
		width="min(1280px, 96vw)"
		top="4vh"
		append-to-body
		destroy-on-close
		class="auto-detail-dialog"
	>
		<div ref="detailShellRef" v-loading="loading" class="detail-shell">
			<div class="status-banner" :class="`status-banner--${statusBanner.type}`">
				<div class="status-dot"></div>
				<div class="status-banner-main">
					<div class="status-banner-title">{{ statusBanner.title }}</div>
					<div class="status-banner-desc">{{ statusBanner.description }}</div>
				</div>
				<el-tag size="small" effect="plain" :type="statusBanner.type === 'error' ? 'danger' : statusBanner.type">
					{{ statusLabel }}
				</el-tag>
			</div>

			<section class="detail-section">
				<div class="section-head">
					<div>
						<div class="section-title">状态概览</div>
						<div class="section-subtitle">最近一次自动补全的结果、指纹和可发货状态。</div>
					</div>
				</div>
				<div class="mini-grid">
					<div class="mini-card">
						<span>状态</span>
						<b>{{ statusLabel }}</b>
					</div>
					<div class="mini-card">
						<span>最近运行</span>
						<b>{{ formatDate(detail?.status?.last_run_time) }}</b>
					</div>
					<div class="mini-card">
						<span>采购计划</span>
						<b>{{ detail?.status?.plan_sn || "-" }}</b>
					</div>
					<div class="mini-card">
						<span>采购单</span>
						<b>{{ orderSnText }}</b>
					</div>
					<div class="mini-card mini-card-wide">
						<span>商品</span>
						<b class="ellipsis" :title="fullText(detail?.listing?.item_name || detail?.purchase_plan?.item_name)">
							{{ detail?.listing?.item_name || detail?.purchase_plan?.item_name || "-" }}
						</b>
					</div>
					<div class="mini-card">
						<span>采购数量 / 分配合计</span>
						<b>{{ formatNumber(detail?.status?.purchase_qty) }} / {{ formatNumber(detail?.status?.allocation_total) }}</b>
					</div>
					<div class="mini-card">
						<span>仓库</span>
						<b>{{ detail?.status?.warehouse_name || (detail?.status?.warehouse_confirmation_required ? "未匹配" : "-") }}</b>
					</div>
					<div class="mini-card">
						<span>内容指纹</span>
						<div class="value-with-action">
							<b class="ellipsis mono-value" :title="fullText(detail?.status?.remark_hash)">
								{{ detail?.status?.remark_hash || "-" }}
							</b>
							<el-button
								v-if="detail?.status?.remark_hash"
								link
								type="primary"
								size="small"
								@click="copyText(detail.status.remark_hash, '内容指纹')"
							>
								复制
							</el-button>
						</div>
					</div>
					<div class="mini-card">
						<span>上下文指纹</span>
						<div class="value-with-action">
							<b class="ellipsis mono-value" :title="fullText(detail?.status?.context_hash)">
								{{ detail?.status?.context_hash || "-" }}
							</b>
							<el-button
								v-if="detail?.status?.context_hash"
								link
								type="primary"
								size="small"
								@click="copyText(detail.status.context_hash, '上下文指纹')"
							>
								复制
							</el-button>
						</div>
					</div>
					<div class="mini-card">
						<span>分析记录</span>
						<b>{{ detail?.status?.analysis_record_id || "-" }}</b>
					</div>
					<div class="mini-card">
						<span>快照ID</span>
						<b>{{ detail?.status?.snapshot_id || "-" }}</b>
					</div>
					<div class="mini-card">
						<span>可发货</span>
						<b>{{ detail?.snapshot_state?.blocks_shipping ? "否" : "是" }}</b>
					</div>
				</div>
			</section>

			<section class="detail-section">
				<div class="section-head">
					<div>
						<div class="section-title">备注原文 / 解析结果</div>
						<div class="section-subtitle">只读查看解析配置、语法结果和生成草稿，不允许编辑。</div>
					</div>
				</div>
				<div class="remark-block">
					<div class="remark-card">
						<div class="remark-card-head">
							<span>原始备注</span>
							<el-tag size="small" type="info" effect="plain">{{ parseLabel }}</el-tag>
						</div>
						<pre class="remark-text">{{ detail?.purchase_plan?.plan_remark || "-" }}</pre>
					</div>
					<div class="remark-card">
						<div class="remark-card-head">
							<span>解析摘要</span>
							<el-tag size="small" :type="previewValid ? 'success' : 'danger'" effect="plain">
								{{ previewValid ? "已解析" : "解析异常" }}
							</el-tag>
						</div>
						<div class="summary-grid">
							<div class="summary-item">
								<span>算法</span>
								<b>{{ parsedConfig.algorithm_label || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>计划开始</span>
								<b>{{ detail?.preview?.validation?.shipping?.plan_start?.value || parsedConfig.plan_start_date || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>缓冲天数</span>
								<b>
									{{ detail?.preview?.validation?.shipping?.buffer_days ?? parsedConfig.shipping_buffer_days ?? "-" }}
								</b>
							</div>
							<div class="summary-item">
								<span>采购仓库</span>
								<b>{{ detail?.preview?.validation?.warehouse?.warehouse_name || parsedConfig.warehouse_name || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>运输配置</span>
								<b>{{ parsedConfig.shipping_profile_label || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>人工备注</span>
								<b class="ellipsis" :title="fullText(parsedConfig.manual_remark)">
									{{ parsedConfig.manual_remark || "-" }}
								</b>
							</div>
							<div class="summary-item">
								<span>发货分配</span>
								<b>{{ parseSummary.allocation_total ?? "-" }}</b>
							</div>
							<div class="summary-item">
								<span>最终判断</span>
								<b>{{ detail?.preview?.validation?.readiness?.text || detail?.snapshot_state?.auto_complete_status_label || "-" }}</b>
							</div>
						</div>
						<el-alert
							v-if="detail?.preview_error"
							:title="detail.preview_error"
							type="warning"
							:closable="false"
							show-icon
							class="sub-alert"
						/>
						<el-alert
							v-if="previewErrors.length"
							:title="previewErrors.join('；')"
							type="error"
							:closable="false"
							show-icon
							class="sub-alert"
						/>
						<el-alert
							v-if="previewWarnings.length"
							:title="previewWarnings.join('；')"
							type="warning"
							:closable="false"
							show-icon
							class="sub-alert"
						/>
					</div>
				</div>
			</section>

			<section class="detail-section">
				<div class="section-head">
					<div>
						<div class="section-title">上下文详情</div>
						<div class="section-subtitle">采购单、采购计划、商品和快照都可以折叠展开查看。</div>
					</div>
				</div>
				<el-collapse v-model="detailPanels" class="detail-collapse">
					<el-collapse-item name="order">
						<template #title>
							<div class="collapse-title">
								<span>采购单信息</span>
								<span class="collapse-subtitle">订单号、状态、供应商、仓库、时间和明细数</span>
							</div>
						</template>
						<el-table
							:data="orderCards"
							border
							stripe
							size="small"
							class="context-table"
							empty-text="暂无采购单上下文"
						>
							<el-table-column label="采购单" min-width="180">
								<template #default="{ row }">
									<div class="context-main">
										<strong :title="fullText(row.order_sn)">{{ row.order_sn || "-" }}</strong>
										<div class="context-sub" :title="fullText(row.custom_order_sn)">
											{{ row.custom_order_sn || "-" }}
										</div>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="状态" width="100">
								<template #default="{ row }">{{ row.status_text || row.status || "-" }}</template>
							</el-table-column>
							<el-table-column label="供应商" min-width="160">
								<template #default="{ row }">
									<span class="ellipsis-cell" :title="fullText(row.supplier_name)">{{ row.supplier_name || "-" }}</span>
								</template>
							</el-table-column>
							<el-table-column label="仓库" min-width="120">
								<template #default="{ row }">{{ row.ware_house_name || "-" }}</template>
							</el-table-column>
							<el-table-column label="创建时间" width="170">
								<template #default="{ row }">{{ formatDate(row.create_time_remote) }}</template>
							</el-table-column>
							<el-table-column label="明细数" width="90" align="center">
								<template #default="{ row }">{{ row.order_item_count || 0 }}</template>
							</el-table-column>
						</el-table>

						<el-table
							:data="orderItems"
							border
							stripe
							size="small"
							class="context-table context-table-spaced"
							empty-text="暂无采购单明细"
							:max-height="220"
						>
							<el-table-column label="明细" min-width="190">
								<template #default="{ row }">
									<div class="context-main">
										<strong :title="fullText(row.product_name)">{{ row.product_name || "-" }}</strong>
										<div class="context-sub" :title="`订单 ${row.order_sn || '-'} · 计划 ${row.plan_sn || '-'}`">
											订单 {{ row.order_sn || "-" }} · 计划 {{ row.plan_sn || "-" }}
										</div>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="MSKU / SKU" min-width="220">
								<template #default="{ row }">
									<div class="context-list">
										<span :title="fullText(row.first_msku)"><b>首个MSKU</b>{{ row.first_msku || "-" }}</span>
										<span :title="fullText(row.sku)"><b>SKU</b>{{ row.sku || "-" }}</span>
										<span :title="fullText(row.fnsku)"><b>FNSKU</b>{{ row.fnsku || "-" }}</span>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="数量" min-width="180">
								<template #default="{ row }">
									<div class="context-list">
										<span><b>计划</b>{{ formatNumber(row.quantity_plan) }}</span>
										<span><b>实采</b>{{ formatNumber(row.quantity_real) }}</span>
										<span><b>待到货</b>{{ formatNumber(row.quantity_wait) }}</span>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="计划上下文" min-width="220">
								<template #default="{ row }">
									<div class="context-list">
										<span><b>仓库</b>{{ row.purchase_plan?.warehouse_name || "-" }}</span>
										<span><b>国家</b>{{ row.purchase_plan?.marketplace || row.plan_marketplace || "-" }}</span>
										<span :title="fullText(row.purchase_plan?.plan_remark_snippet)">
											<b>备注</b>{{ row.purchase_plan?.plan_remark_snippet || "-" }}
										</span>
									</div>
								</template>
							</el-table-column>
						</el-table>
					</el-collapse-item>

					<el-collapse-item name="plan">
						<template #title>
							<div class="collapse-title">
								<span>采购计划信息</span>
								<span class="collapse-subtitle">计划号、批次、仓库、备注和时间</span>
							</div>
						</template>
						<div class="summary-grid plan-summary-grid">
							<div class="summary-item">
								<span>计划号</span>
								<b>{{ detail?.status?.plan_sn || detail?.purchase_plan?.plan_sn || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>批次号</span>
								<b>{{ detail?.purchase_plan?.ppg_sn || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>店铺</span>
								<b>{{ detail?.purchase_plan?.seller_name || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>国家</span>
								<b>{{ detail?.purchase_plan?.marketplace || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>采购仓库</span>
								<b>{{ detail?.purchase_plan?.warehouse_name || "-" }}</b>
							</div>
							<div class="summary-item">
								<span>创建时间</span>
								<b>{{ formatDate(detail?.purchase_plan?.create_time_remote) }}</b>
							</div>
							<div class="summary-item">
								<span>更新时间</span>
								<b>{{ formatDate(detail?.purchase_plan?.update_time_remote) }}</b>
							</div>
							<div class="summary-item">
								<span>备注摘要</span>
								<b class="ellipsis" :title="fullText(detail?.purchase_plan?.plan_remark_snippet)">
									{{ detail?.purchase_plan?.plan_remark_snippet || "-" }}
								</b>
							</div>
						</div>
					</el-collapse-item>

					<el-collapse-item name="listing">
						<template #title>
							<div class="collapse-title">
								<span>商品信息 / 匹配依据</span>
								<span class="collapse-subtitle">店铺商品和匹配规则逐条比对</span>
							</div>
						</template>
						<div class="listing-card" v-if="detail?.listing">
							<div class="listing-image-wrap">
								<el-image
									v-if="detail?.listing?.pic_url"
									:src="detail.listing.pic_url"
									fit="contain"
									class="listing-image"
									:preview-src-list="[detail.listing.pic_url]"
									preview-teleported
								/>
								<span v-else class="image-empty">无图</span>
							</div>
							<div class="listing-main">
								<div class="listing-head">
									<strong :title="fullText(detail?.listing?.item_name)">{{ detail?.listing?.item_name || "-" }}</strong>
									<el-tag
										size="small"
										:type="detail?.match_detail?.unique_match ? 'success' : 'warning'"
										effect="plain"
									>
										{{ detail?.match_detail?.unique_match ? "唯一命中" : "待确认" }}
									</el-tag>
								</div>
								<div class="listing-meta">
									<span :title="fullText(detail?.listing?.asin)"><b>ASIN</b>{{ detail?.listing?.asin || "-" }}</span>
									<span :title="fullText(detail?.listing?.msku)"><b>MSKU</b>{{ detail?.listing?.msku || "-" }}</span>
									<span :title="fullText(detail?.listing?.local_sku)"><b>本地SKU</b>{{ detail?.listing?.local_sku || "-" }}</span>
									<span :title="fullText(detail?.listing?.seller_name)"><b>店铺</b>{{ detail?.listing?.seller_name || "-" }}</span>
									<span :title="fullText(detail?.listing?.marketplace)"><b>国家</b>{{ detail?.listing?.marketplace || "-" }}</span>
									<span :title="fullText(detail?.listing?.store_id)"><b>店铺ID</b>{{ detail?.listing?.store_id || "-" }}</span>
								</div>
							</div>
						</div>
						<el-table
							:data="detail?.match_detail?.candidate_rows || []"
							border
							stripe
							size="small"
							class="context-table context-table-spaced"
							empty-text="暂无匹配候选"
						>
							<el-table-column label="校验项" min-width="150">
								<template #default="{ row }">
									{{ row.source_label || "-" }}
								</template>
							</el-table-column>
							<el-table-column label="采购单 / 计划值" min-width="170">
								<template #default="{ row }">
									<span class="ellipsis-cell" :title="fullText(row.value)">{{ row.value || "-" }}</span>
								</template>
							</el-table-column>
							<el-table-column label="店铺商品值" min-width="170">
								<template #default="{ row }">
									<span class="ellipsis-cell" :title="fullText(row.matched_listing_ids?.length ? row.value : '')">
										{{ row.matched_listing_ids?.length ? row.value : "-" }}
									</span>
								</template>
							</el-table-column>
							<el-table-column label="命中情况" width="140">
								<template #default="{ row }">
									<el-tag size="small" :type="getCandidateStatusType(row.status)" effect="plain">
										{{ getCandidateStatusLabel(row.status) }}
									</el-tag>
								</template>
							</el-table-column>
							<el-table-column label="命中列表" min-width="160">
								<template #default="{ row }">
									<span class="muted-text ellipsis-cell" :title="formatIdList(row.matched_listing_ids)">
										{{ formatIdList(row.matched_listing_ids) }}
									</span>
								</template>
							</el-table-column>
							<el-table-column label="市场" min-width="140">
								<template #default="{ row }">
									<span class="ellipsis-cell" :title="formatTextList(row.matched_marketplaces)">
										{{ formatTextList(row.matched_marketplaces) }}
									</span>
								</template>
							</el-table-column>
						</el-table>
					</el-collapse-item>

					<el-collapse-item name="snapshot">
						<template #title>
							<div class="collapse-title">
								<span>快照 / 运输分段</span>
								<span class="collapse-subtitle">自动补全写入结果和每段建议数量</span>
							</div>
						</template>
						<div class="mini-grid mini-grid-four">
							<div class="mini-card">
								<span>快照状态</span>
								<b>{{ detail?.snapshot_state?.auto_complete_status_label || "-" }}</b>
							</div>
							<div class="mini-card">
								<span>来源后缀</span>
								<b>{{ detail?.snapshot_state?.source_label_suffix || "-" }}</b>
							</div>
							<div class="mini-card">
								<span>是否拦截</span>
								<b>{{ detail?.snapshot_state?.blocks_shipping ? "是" : "否" }}</b>
							</div>
							<div class="mini-card">
								<span>仓库确认</span>
								<b>{{ detail?.snapshot_state?.warehouse_confirmation_required ? "需要" : "无需" }}</b>
							</div>
						</div>
						<el-table
							:data="shippingSegments"
							border
							stripe
							size="small"
							class="context-table context-table-spaced"
							empty-text="暂无运输分段"
						>
							<el-table-column label="运输方式" min-width="120">
								<template #default="{ row }">
									{{ row.method_label || row.method_key || "-" }}
								</template>
							</el-table-column>
							<el-table-column label="预计到达" min-width="120">
								<template #default="{ row }">{{ formatDateOnly(row.start_date) }}</template>
							</el-table-column>
							<el-table-column label="覆盖周期" min-width="190">
								<template #default="{ row }">
									{{ formatRange(row.start_date, row.end_date) }}
								</template>
							</el-table-column>
							<el-table-column label="系统建议" min-width="120">
								<template #default="{ row }">{{ formatNumber(row.system_suggested_qty) }}</template>
							</el-table-column>
							<el-table-column label="运营填写" min-width="120">
								<template #default="{ row }">{{ formatNumber(row.final_qty) }}</template>
							</el-table-column>
							<el-table-column label="计算痕迹" min-width="280">
								<template #default="{ row }">
									<span class="muted-text ellipsis-cell" :title="formatTrace(row.calculation_trace)">
										{{ formatTrace(row.calculation_trace) }}
									</span>
								</template>
							</el-table-column>
						</el-table>
					</el-collapse-item>

					<el-collapse-item name="issues">
						<template #title>
							<div class="collapse-title">
								<span>错误与警告</span>
								<span class="collapse-subtitle">阻断错误影响发货，警告提示人工确认</span>
							</div>
						</template>
						<div class="message-list">
							<div class="message-card danger">
								<div class="message-label">错误</div>
								<div class="message-text">{{ formatTextList(detail?.status?.errors) || "-" }}</div>
							</div>
							<div class="message-card warning">
								<div class="message-label">警告</div>
								<div class="message-text">{{ formatTextList(detail?.status?.warnings) || "-" }}</div>
							</div>
							<div class="message-card info">
								<div class="message-label">备注解析原文</div>
								<div class="message-text">{{ detail?.purchase_plan?.plan_remark_snippet || "-" }}</div>
							</div>
						</div>
					</el-collapse-item>
				</el-collapse>
			</section>
		</div>
	</el-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps<{
	visible: boolean;
	loading?: boolean;
	detail: any;
}>();

const emit = defineEmits<{
	(e: "update:visible", value: boolean): void;
}>();

const visibleProxy = computed({
	get: () => props.visible,
	set: (value: boolean) => emit("update:visible", value)
});

const statusLabel = computed(() => props.detail?.status?.status_label || props.detail?.snapshot_state?.auto_complete_status_label || "-");
const dialogTitle = computed(() => `自动补全详情 · ${props.detail?.status?.plan_sn || "-"}`);
const orderSnText = computed(() => {
	const orderSns = props.detail?.purchase_order?.order_sns;
	if (Array.isArray(orderSns) && orderSns.length) return orderSns.join(" / ");
	return props.detail?.status?.order_sn || "-";
});
const parseLabel = computed(() => props.detail?.purchase_plan?.auto_block_matched ? "【自动补全V1】" : "普通备注");
const parsedConfig = computed(() => props.detail?.preview?.parsed?.config || props.detail?.parsed?.config || {});
const parseSummary = computed(() => props.detail?.preview?.summary || props.detail?.parse_summary || {});
const previewValid = computed(() => Boolean(props.detail?.preview?.parsed?.valid ?? props.detail?.parsed?.valid));
const orderCards = computed(() => Array.isArray(props.detail?.purchase_order?.orders) ? props.detail.purchase_order.orders : []);
const orderItems = computed(() => Array.isArray(props.detail?.purchase_order?.order_items) ? props.detail.purchase_order.order_items : []);
const shippingSegments = computed(() => props.detail?.preview?.validation?.shipping?.segments || props.detail?.snapshot?.shipping_json?.segments || []);
const detailPanels = ref<string[]>([]);
const detailShellRef = ref<HTMLElement | null>(null);

watch(
	() => props.visible,
	value => {
		if (value) {
			detailPanels.value = [];
			nextTick(() => {
				detailShellRef.value?.scrollTo({ top: 0 });
			});
		}
	}
);
const previewErrors = computed(() => {
	const errors = props.detail?.preview?.errors;
	return Array.isArray(errors) ? errors.filter(Boolean) : [];
});
const previewWarnings = computed(() => {
	const warnings = props.detail?.preview?.warnings;
	return Array.isArray(warnings) ? warnings.filter(Boolean) : [];
});

const statusBanner = computed(() => {
	const status = String(props.detail?.status?.status || "");
	if (status === "success") {
		return { type: "success", title: "自动补全成功", description: "可直接展示的完整结果。" };
	}
	if (status === "success_with_warnings") {
		return { type: "warning", title: "自动补全成功但有警告", description: "可以查看，但建议留意仓库、配置或上下文差异。" };
	}
	if (status === "failed") {
		return { type: "error", title: "自动补全失败", description: "存在阻断错误，当前记录不能用于发货。" };
	}
	if (status === "needs_attention") {
		return { type: "warning", title: "自动补全需处理", description: "已有结果，但存在需要人工确认的项。" };
	}
	return { type: "info", title: "自动补全详情", description: "查看本次自动补全的完整上下文。" };
});

function formatTextList(value: any) {
	if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean).join("；");
	return String(value ?? "").trim();
}

function fullText(value: any) {
	const text = Array.isArray(value) ? formatTextList(value) : String(value ?? "").trim();
	return text || "-";
}

async function copyText(value: any, label: string) {
	const text = fullText(value);
	if (!text || text === "-") return;
	try {
		await navigator.clipboard.writeText(text);
		ElMessage.success(`${label}已复制`);
	} catch {
		ElMessage.error("复制失败，请手动选择复制");
	}
}

function formatIdList(value: any) {
	if (!Array.isArray(value) || !value.length) return "-";
	return value.map(item => String(item)).join(", ");
}

function formatNumber(value: any) {
	const num = Number(value);
	if (!Number.isFinite(num)) return "-";
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function formatDate(value: any) {
	if (!value) return "-";
	return String(value).replace("T", " ").slice(0, 16);
}

function formatDateOnly(value: any) {
	if (!value) return "-";
	return String(value).slice(0, 10);
}

function formatRange(start: any, end: any) {
	const left = formatDateOnly(start);
	const right = formatDateOnly(end);
	if (left === "-" && right === "-") return "-";
	return `${left} ~ ${right}`;
}

function formatTrace(trace: any) {
	if (!trace) return "-";
	if (Array.isArray(trace)) return trace.map(item => String(item)).filter(Boolean).join("；");
	if (typeof trace === "string") return trace;
	if (typeof trace === "object") {
		return Object.entries(trace)
			.map(([key, value]) => `${key}:${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
			.join("；");
	}
	return String(trace);
}

function getCandidateStatusType(status: string) {
	if (status === "matched") return "success";
	if (status === "ambiguous") return "warning";
	if (status === "marketplace_mismatch") return "danger";
	return "info";
}

function getCandidateStatusLabel(status: string) {
	if (status === "matched") return "匹配";
	if (status === "ambiguous") return "重复命中";
	if (status === "marketplace_mismatch") return "站点不一致";
	return "未命中";
}
</script>

<style scoped lang="scss">
.detail-shell {
	display: flex;
	flex-direction: column;
	gap: 14px;
	max-height: calc(100vh - 180px);
	overflow: auto;
	padding-right: 2px;
	padding-top: 6px;
}

.status-banner {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: 12px;
	min-height: 58px;
	padding: 12px 14px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	background: var(--el-fill-color-extra-light);
}

.status-dot {
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: var(--el-color-info);
	box-shadow: 0 0 0 4px var(--el-color-info-light-8);
}

.status-banner-main {
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 3px;
}

.status-banner-title {
	font-size: 15px;
	font-weight: 800;
	line-height: 20px;
	color: var(--el-text-color-primary);
}

.status-banner-desc {
	font-size: 12px;
	line-height: 18px;
	color: var(--el-text-color-secondary);
	white-space: normal;
	word-break: break-word;
}

.status-banner--success {
	border-color: var(--el-color-success-light-7);
	background: var(--el-color-success-light-9);
}

.status-banner--success .status-dot {
	background: var(--el-color-success);
	box-shadow: 0 0 0 4px var(--el-color-success-light-8);
}

.status-banner--warning {
	border-color: var(--el-color-warning-light-7);
	background: var(--el-color-warning-light-9);
}

.status-banner--warning .status-dot {
	background: var(--el-color-warning);
	box-shadow: 0 0 0 4px var(--el-color-warning-light-8);
}

.status-banner--error {
	border-color: var(--el-color-danger-light-7);
	background: var(--el-color-danger-light-9);
}

.status-banner--error .status-dot {
	background: var(--el-color-danger);
	box-shadow: 0 0 0 4px var(--el-color-danger-light-8);
}

.detail-section {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 14px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 10px;
	background: #fff;
}

.detail-collapse {
	display: flex;
	flex-direction: column;
	gap: 8px;
	border: 0;
}

.detail-collapse :deep(.el-collapse-item) {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	overflow: hidden;
	background: var(--el-fill-color-extra-light);
}

.detail-collapse :deep(.el-collapse-item__header) {
	height: auto;
	padding: 12px 14px;
	line-height: 1.2;
	font-weight: 700;
	background: inherit;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.detail-collapse :deep(.el-collapse-item__wrap) {
	border: 0;
	background: #fff;
}

.detail-collapse :deep(.el-collapse-item__content) {
	padding: 14px;
}

.collapse-title {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.collapse-subtitle {
	color: var(--el-text-color-secondary);
	font-size: 12px;
	font-weight: 400;
}

.section-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
}

.section-title {
	font-size: 15px;
	font-weight: 800;
	color: var(--el-text-color-primary);
}

.section-subtitle {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.mini-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: 10px;
}

.mini-grid-four {
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.mini-card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-lighter);
	min-width: 0;
}

.mini-card-wide {
	grid-column: span 2;
}

.mini-card span,
.summary-item span,
.context-sub,
.muted-text,
.remark-card-head {
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.mini-card > span,
.summary-item > span {
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.mini-card b,
.summary-item b {
	color: var(--el-text-color-primary);
	font-size: 13px;
}

.ellipsis {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ellipsis-cell {
	display: inline-block;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	vertical-align: bottom;
}

.value-with-action {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.value-with-action .ellipsis {
	flex: 1;
	min-width: 0;
}

.mono-value {
	font-family: Consolas, Monaco, "Courier New", monospace;
	font-size: 12px;
}

.remark-block {
	display: grid;
	grid-template-columns: 1.1fr 1fr;
	gap: 12px;
}

.remark-card {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: #fff;
	min-width: 0;
}

.remark-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	font-weight: 700;
}

.remark-text {
	margin: 0;
	padding: 10px 12px;
	border-radius: 8px;
	background: var(--el-fill-color-light);
	color: var(--el-text-color-primary);
	font-size: 12px;
	line-height: 1.6;
	white-space: pre-wrap;
	word-break: break-word;
	min-height: 180px;
	max-height: 260px;
	overflow: auto;
}

.summary-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
}

.plan-summary-grid {
	grid-template-columns: repeat(4, minmax(0, 1fr));
}

.summary-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 9px 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-lighter);
	min-width: 0;
}

.sub-alert {
	margin-top: 8px;
}

.context-table {
	width: 100%;
}

.context-table-spaced {
	margin-top: 8px;
}

.context-main {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
}

.context-main strong {
	color: var(--el-text-color-primary);
	font-size: 13px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.context-sub {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.context-list {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 10px;
	font-size: 12px;
	color: var(--el-text-color-primary);
}

.context-list b {
	margin-right: 4px;
	color: var(--el-text-color-secondary);
	font-weight: 600;
}

.listing-card {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: rgba(64, 158, 255, 0.04);
}

.listing-image-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 72px;
	width: 72px;
	height: 72px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	overflow: hidden;
	background: #fff;
}

.listing-image {
	width: 100%;
	height: 100%;
}

.listing-main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.listing-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	min-width: 0;
}

.listing-head strong {
	font-size: 14px;
	font-weight: 800;
	color: var(--el-text-color-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.listing-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 12px;
	font-size: 12px;
	color: var(--el-text-color-primary);
}

.listing-meta b {
	margin-right: 4px;
	color: var(--el-text-color-secondary);
	font-weight: 600;
}

.message-list {
	display: grid;
	gap: 10px;
}

.message-card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 12px;
	border-radius: 8px;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
}

.message-card.danger {
	border-color: var(--el-color-danger-light-7);
	background: var(--el-color-danger-light-9);
}

.message-card.warning {
	border-color: var(--el-color-warning-light-7);
	background: var(--el-color-warning-light-9);
}

.message-card.info {
	border-color: var(--el-color-info-light-7);
	background: var(--el-color-info-light-9);
}

.message-label {
	font-weight: 700;
	color: var(--el-text-color-primary);
}

.message-text {
	color: var(--el-text-color-regular);
	font-size: 13px;
	line-height: 1.6;
	word-break: break-word;
}

:deep(.el-dialog__body) {
	padding-top: 8px;
}

@media (max-width: 1200px) {
	.summary-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.remark-block {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 760px) {
	.mini-grid,
	.mini-grid-four,
	.summary-grid {
		grid-template-columns: 1fr;
	}

	.mini-card-wide {
		grid-column: span 1;
	}
}
</style>
