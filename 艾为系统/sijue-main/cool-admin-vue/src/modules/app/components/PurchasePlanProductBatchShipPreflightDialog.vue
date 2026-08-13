<template>
	<el-dialog
		v-model="dialogVisible"
		width="min(1240px, 96vw)"
		top="4vh"
		class="batch-ship-preflight-dialog"
		:close-on-click-modal="false"
	>
		<template #header>
			<div class="preflight-header">
				<div>
					<div class="preflight-title">产品发货前检查</div>
					<div class="preflight-subtitle">
						先看选中的产品能不能发；下面的采购单只是展开明细。
					</div>
				</div>
				<el-tag v-if="result?.generated_at" type="info" effect="plain">
					检查时间 {{ result.generated_at }}
				</el-tag>
			</div>
		</template>

		<div v-loading="loading" class="preflight-body">
			<div class="preflight-summary">
				<button
					v-for="item in summaryCards"
					:key="item.key"
					type="button"
					class="summary-card"
					:class="[`is-${item.type}`, { active: activeFilter === item.key }]"
					@click="activeFilter = item.key"
				>
					<span>{{ item.label }}</span>
					<strong>{{ item.count }}</strong>
					<em>{{ item.desc }}</em>
				</button>
				<el-tag v-if="warningProductCount" class="summary-warning-tag" type="warning" effect="plain">
					需留意 {{ warningProductCount }}
				</el-tag>
			</div>

			<div class="refresh-summary">
				本次刷新：
				采购计划 {{ formatCount(syncSectionMap.purchase_plan?.success, syncSectionMap.purchase_plan?.total) }}，
				采购单 {{ formatCount(syncSectionMap.purchase_order?.success, syncSectionMap.purchase_order?.total) }}，
				物流 {{ formatCount(syncSectionMap.logistics?.queried, syncSectionMap.logistics?.total) }}
			</div>

			<el-alert
				v-if="blockedOnly"
				type="warning"
				show-icon
				:closable="false"
				title="当前没有可进入批量发货的产品"
				description="请先处理下方原因，再重新检查。"
			/>

			<div v-if="!visibleCards.length" class="empty-wrap">
				<el-empty description="暂无检查结果" />
			</div>

			<div v-else class="product-card-list">
				<article v-for="card in visibleCards" :key="card.row_key" class="product-card">
					<div class="product-card-head">
						<div class="product-media">
							<el-image
								v-if="card.image_url"
								:src="card.image_url"
								fit="cover"
								class="product-image"
								:preview-src-list="[card.image_url]"
								preview-teleported
							/>
							<div v-else class="product-image empty">无图</div>
						</div>

						<div class="product-main">
							<div class="product-title-row">
								<div class="product-title" :title="card.product_title">
									{{ card.product_title || "-" }}
								</div>
								<el-tag :type="getStatusTagType(card.product_status)" effect="light">
									{{ card.product_status_text }}
								</el-tag>
							</div>

							<div class="product-meta">
								<span v-if="card.product.asin">ASIN {{ card.product.asin }}</span>
								<span v-if="card.product.msku">MSKU {{ card.product.msku }}</span>
								<span v-if="card.product.local_sku">本地SKU {{ card.product.local_sku }}</span>
								<span v-if="card.product.store_name">店铺 {{ card.product.store_name }}</span>
								<span v-if="card.product.marketplace">国家 {{ card.product.marketplace }}</span>
							</div>

							<div class="product-stats">
								<div>
									<span>可发数量</span>
									<strong>{{ formatNumber(card.actual_shippable_qty) }}</strong>
								</div>
								<div>
									<span>可继续采购单</span>
									<strong>{{ card.continuable_order_count }}</strong>
								</div>
								<div>
									<span>不可发采购单</span>
									<strong>{{ card.blocked_order_count }}</strong>
								</div>
								<div>
									<span>采购单总数</span>
									<strong>{{ card.order_count }}</strong>
								</div>
							</div>
						</div>

							<div class="product-summary-side">
								<el-tag :type="getStatusTagType(card.product_status)" effect="plain">
									{{ card.product_status_text }}
								</el-tag>
								<div class="summary-line">
									{{ card.summary_text }}
								</div>
								<div class="summary-reason" :title="card.primary_message">
									{{ card.primary_message || "检查通过" }}
								</div>
								<div v-if="card.note_text" class="summary-note" :title="card.note_text">
									{{ card.note_text }}
								</div>
							</div>
					</div>

					<div class="product-card-body">
						<div class="body-head">
							<div class="body-title">采购单明细</div>
							<el-button size="small" text @click="toggleCard(card.row_key)">
								{{ openCardKeys.includes(card.row_key) ? "收起明细" : "展开明细" }}
							</el-button>
						</div>

						<div v-if="openCardKeys.includes(card.row_key)" class="order-list">
							<div v-for="order in card.orders" :key="order.order_sn" class="order-item">
								<div class="order-item-head">
									<div class="order-code">{{ order.order_sn || "-" }}</div>
									<el-tag :type="getStatusTagType(order.preflight_status)" effect="light">
										{{ order.preflight_status_text }}
									</el-tag>
								</div>

								<div class="order-grid">
									<div>
										<span>计划</span>
										<strong>{{ order.plan_sn || "-" }}</strong>
									</div>
									<div>
										<span>物流</span>
										<strong>{{ order.logistics?.text || "-" }}</strong>
									</div>
									<div>
										<span>实际可发</span>
										<strong>{{ formatNumber(order.actual_shippable_qty) }}</strong>
									</div>
									<div>
										<span>采购数量</span>
										<strong>{{ formatNumber(order.quantity?.quantity_real_sum) }}</strong>
									</div>
								</div>

								<div class="order-logistics">
									包裹 {{ order.logistics?.package_count || 0 }}，
									签收 {{ order.logistics?.signed_count || 0 }}，
									未签 {{ order.logistics?.unsigned_count || 0 }}
									<span v-if="order.logistics?.query_hint" class="muted-dot">·</span>
									<span :title="order.logistics?.query_hint || ''">
										{{ order.logistics?.query_hint || order.logistics?.reason || "-" }}
									</span>
								</div>

								<div v-if="order.notes?.length" class="order-notes">
									<el-tag
										v-for="note in order.notes"
										:key="note"
										type="success"
										effect="plain"
										size="small"
									>
										{{ note }}
									</el-tag>
								</div>

								<div class="order-reasons">
									<div v-if="order.reasons?.length" class="reason-block is-blocked">
										<div class="reason-block-title">不可发原因</div>
										<div v-for="reason in order.reasons" :key="reason" :title="reason">
											{{ reason }}
										</div>
									</div>
									<div v-if="order.warnings?.length" class="reason-block is-warning">
										<div class="reason-block-title">提示</div>
										<div v-for="warning in order.warnings" :key="warning" :title="warning">
											{{ warning }}
										</div>
									</div>
									<span v-if="!order.reasons?.length && !order.warnings?.length" class="muted">
										检查通过
									</span>
								</div>
							</div>
						</div>
					</div>
				</article>
			</div>
		</div>

		<template #footer>
			<div class="preflight-footer">
				<div class="footer-hint">
					<span v-if="continuableProductCount">
						可继续 {{ continuableProductCount }} 个产品，合计可发
						{{ formatNumber(continuableOrderCount) }} 张采购单
					</span>
					<span v-else>暂无可继续发货的产品</span>
				</div>
				<div class="footer-actions">
					<el-button @click="dialogVisible = false">关闭</el-button>
					<el-button :loading="loading" @click="$emit('recheck')">重新检查</el-button>
					<el-button
						type="primary"
						:disabled="loading || !continuableOrderCount"
						@click="$emit('continue')"
					>
						仅带入可发货 {{ continuableOrderCount }} 张采购单继续
					</el-button>
				</div>
			</div>
		</template>
	</el-dialog>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { convert_image_url } from "/$/app/utils";

const props = defineProps<{
	visible: boolean;
	loading?: boolean;
	result?: any;
	rows?: any[];
}>();

const emit = defineEmits(["update:visible", "recheck", "continue"]);

const activeFilter = ref("continuable");
const openCardKeys = ref<string[]>([]);

const dialogVisible = computed({
	get: () => props.visible,
	set: (value: boolean) => emit("update:visible", value)
});

const sourceRows = computed(() => (Array.isArray(props.rows) ? props.rows : []));
const orders = computed(() => (Array.isArray(props.result?.orders) ? props.result.orders : []));

const syncSectionMap = computed(() => {
	const sections = props.result?.sync_result?.sections || {};
	return sections;
});

const productCards = computed(() => {
	const rowMap = new Map<string, any>();
	for (const row of sourceRows.value) {
		const key = String(row?.row_key || "").trim();
		if (!key) continue;
		rowMap.set(key, row);
	}

	const orderGroups = new Map<string, any[]>();
	for (const order of orders.value) {
		const key = String(order?.row_key || "").trim();
		if (!key) continue;
		const list = orderGroups.get(key) || [];
		list.push(order);
		orderGroups.set(key, list);
	}

	const keys = new Set<string>([...rowMap.keys(), ...orderGroups.keys()]);
	return Array.from(keys)
		.map(rowKey => {
			const row = rowMap.get(rowKey) || {};
			const product = row?.product || {};
			const itemOrders = (orderGroups.get(rowKey) || []).slice();
			const continuableOrders = itemOrders.filter((item: any) => item.preflight_status !== "blocked");
			const blockedOrders = itemOrders.filter((item: any) => item.preflight_status === "blocked");
			const warningOrders = itemOrders.filter((item: any) => item.preflight_status === "warning");
			const notes = Array.from(
				new Set(
					itemOrders.flatMap((item: any) =>
						Array.isArray(item?.notes) ? item.notes : []
					)
				)
			);
			const productStatus =
				itemOrders.length === 0
					? "blocked"
					: blockedOrders.length === itemOrders.length
						? "blocked"
						: blockedOrders.length > 0 && continuableOrders.length > 0
							? "mixed"
							: warningOrders.length > 0
								? "warning"
								: "eligible";
			const primaryMessage = blockedOrders.length
				? blockedOrders[0]?.reasons?.[0] || blockedOrders[0]?.warnings?.[0] || "不可发货"
				: warningOrders.length
					? warningOrders[0]?.warnings?.[0] || warningOrders[0]?.reasons?.[0] || "可继续，但需核对"
					: continuableOrders[0]?.warnings?.[0] || "可直接进入批量发货";

			const actualShippableQty = continuableOrders.reduce(
				(sum: number, order: any) => sum + Number(order?.actual_shippable_qty || 0),
				0
			);

			return {
				row_key: rowKey,
				row,
				product,
				image_url: resolveProductImageUrl(row),
				product_title: getProductTitle(row),
				product_status: productStatus,
				product_status_text: getProductStatusText(productStatus),
				actual_shippable_qty: actualShippableQty,
				order_count: itemOrders.length,
				continuable_order_count: continuableOrders.length,
				blocked_order_count: blockedOrders.length,
				warning_order_count: warningOrders.length,
				orders: itemOrders,
				primary_message: primaryMessage,
				note_text: notes.length ? `通过提示：${notes.join("；")}` : "",
				summary_text: buildProductSummaryText({
					continuableOrderCount: continuableOrders.length,
					blockedOrderCount: blockedOrders.length,
					warningOrderCount: warningOrders.length,
					orderCount: itemOrders.length,
					actualShippableQty
				})
			};
		})
		.sort((a, b) => {
			const rank = { eligible: 0, warning: 1, mixed: 2, blocked: 3 };
			const rankDiff = (rank[a.product_status] ?? 9) - (rank[b.product_status] ?? 9);
			if (rankDiff) return rankDiff;
			return String(a.product_title || "").localeCompare(String(b.product_title || ""));
		});
});

const visibleCards = computed(() => {
	if (activeFilter.value === "all") return productCards.value;
	if (activeFilter.value === "continuable") {
		return productCards.value.filter((card: any) => card.continuable_order_count > 0);
	}
	return productCards.value.filter((card: any) => card.blocked_order_count === card.order_count);
});

const continuableProductCount = computed(
	() => productCards.value.filter((card: any) => card.continuable_order_count > 0).length
);
const continuableOrderCount = computed(() =>
	orders.value.filter((row: any) => row.preflight_status !== "blocked").length
);
const blockedOnly = computed(
	() => Boolean(productCards.value.length) && continuableProductCount.value === 0
);
const warningProductCount = computed(
	() => productCards.value.filter((card: any) => card.warning_order_count > 0).length
);

const summaryCards = computed(() => {
	return [
		{
			key: "continuable",
			label: "可发产品",
			count: continuableProductCount.value,
			desc: "可以进入批量发货",
			type: "success"
		},
		{
			key: "blocked",
			label: "不可发产品",
			count:
				productCards.value.length > continuableProductCount.value
					? productCards.value.length - continuableProductCount.value
					: 0,
			desc: "需要先处理原因",
			type: "danger"
		},
		{
			key: "all",
			label: "全部产品",
			count: productCards.value.length,
			desc: "本次检查结果",
			type: "info"
		}
	];
});

watch(
	() => props.result?.generated_at,
	() => {
		activeFilter.value = "continuable";
		openCardKeys.value = visibleCards.value.slice(0, 1).map((card: any) => card.row_key);
	},
	{ immediate: true }
);

watch(
	() => visibleCards.value.map(card => card.row_key).join("|"),
	() => {
		if (!openCardKeys.value.length && visibleCards.value.length) {
			openCardKeys.value = [visibleCards.value[0].row_key];
		}
	},
	{ immediate: true }
);

function toggleCard(rowKey: string) {
	const index = openCardKeys.value.indexOf(rowKey);
	if (index >= 0) {
		openCardKeys.value.splice(index, 1);
		return;
	}
	openCardKeys.value.push(rowKey);
}

function formatCount(success: any, total: any) {
	return `${Number(success) || 0}/${Number(total) || 0}`;
}

function formatNumber(value: any) {
	const num = Number(value) || 0;
	return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function getStatusTagType(status: string) {
	if (status === "eligible") return "success";
	if (status === "warning") return "warning";
	if (status === "mixed") return "warning";
	return "danger";
}

function getProductStatusText(status: string) {
	if (status === "eligible") return "可发货";
	if (status === "warning") return "可发货（需留意）";
	if (status === "mixed") return "部分可发（需留意）";
	return "不可发货";
}

function getProductTitle(row: any) {
	const product = row?.product || {};
	return (
		product.product_name ||
		product.name ||
		row?.product_name ||
		row?.title ||
		row?.product_title ||
		"-"
	);
}

function resolveProductImageUrl(row: any) {
	const product = row?.product || {};
	const imageUrl =
		product.image_url ||
		product.pic_url ||
		row?.image_url ||
		row?.pic_url ||
		row?.product_image_url ||
		"";
	return imageUrl ? convert_image_url(imageUrl) : "";
}

function buildProductSummaryText(input: {
	continuableOrderCount: number;
	blockedOrderCount: number;
	warningOrderCount: number;
	orderCount: number;
	actualShippableQty: number;
}) {
	const parts = [`可发 ${input.continuableOrderCount} 张`];
	if (input.blockedOrderCount) parts.push(`不可发 ${input.blockedOrderCount} 张`);
	if (input.warningOrderCount) parts.push(`需留意 ${input.warningOrderCount} 张`);
	parts.push(`采购单 ${input.orderCount} 张`);
	parts.push(`合计可发 ${formatNumber(input.actualShippableQty)}`);
	return parts.join(" · ");
}

async function copyReason(row: any) {
	const text = [
		`产品：${row.product_title || "-"}`,
		`状态：${row.product_status_text || "-"}`,
		`采购单：${row.orders?.length || 0} 张`,
			`可发数量：${formatNumber(row.actual_shippable_qty)}`,
			...(row.orders || []).flatMap((order: any) => [
				`- ${order.order_sn || "-"}`,
				`  结果：${order.preflight_status_text || "-"}`,
				...(order.reasons || []).map((reason: string) => `  原因：${reason}`),
				...(order.warnings || []).map((warning: string) => `  提示：${warning}`),
				...(order.notes || []).map((note: string) => `  通过提示：${note}`)
			])
		].join("\n");

	try {
		await navigator.clipboard.writeText(text);
		ElMessage.success("已复制检查原因");
	} catch {
		ElMessage.warning("复制失败，请手动复制");
	}
}
</script>

<style scoped lang="scss">
.preflight-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
}

.preflight-title {
	font-size: 18px;
	font-weight: 700;
	color: #101828;
}

.preflight-subtitle {
	margin-top: 4px;
	font-size: 12px;
	color: #667085;
}

.preflight-body {
	min-height: 520px;
}

.preflight-summary {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	margin-bottom: 10px;
}

.summary-card {
	min-width: 160px;
	padding: 12px 14px;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	background: #fff;
	text-align: left;
	cursor: pointer;

	span,
	em {
		display: block;
		font-size: 12px;
		color: #667085;
		font-style: normal;
	}

	strong {
		display: block;
		margin: 4px 0;
		font-size: 24px;
		color: #101828;
	}

	&.active {
		border-color: #3b73ff;
		box-shadow: inset 0 0 0 1px #3b73ff;
	}

	&.is-success.active {
		background: #f0f9eb;
		border-color: #67c23a;
		box-shadow: inset 0 0 0 1px #67c23a;
	}

	&.is-danger.active {
		background: #fef0f0;
		border-color: #f56c6c;
		box-shadow: inset 0 0 0 1px #f56c6c;
	}

	&.is-info.active {
		background: #f4f7ff;
		border-color: #3b73ff;
		box-shadow: inset 0 0 0 1px #3b73ff;
	}
}

.summary-warning-tag {
	height: 28px;
}

.refresh-summary {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin: 2px 0 12px;
	font-size: 12px;
	color: #667085;
}

.empty-wrap {
	padding: 20px 0 8px;
}

.product-card-list {
	display: grid;
	gap: 12px;
}

.product-card {
	border: 1px solid #e4e7ed;
	border-radius: 10px;
	background: #fff;
	overflow: hidden;
}

.product-card-head {
	display: grid;
	grid-template-columns: 92px minmax(0, 1fr) 260px;
	gap: 12px;
	padding: 12px;
	background: #fcfcfd;
}

.product-media {
	width: 92px;
}

.product-image,
.product-image.empty {
	width: 92px;
	height: 92px;
	border-radius: 8px;
	border: 1px solid #e4e7ed;
	overflow: hidden;
	background: #f8fafc;
}

.product-image.empty {
	display: flex;
	align-items: center;
	justify-content: center;
	color: #98a2b3;
	font-size: 12px;
}

.product-main {
	min-width: 0;
}

.product-title-row {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
}

.product-title {
	font-size: 16px;
	font-weight: 700;
	line-height: 1.4;
	color: #101828;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.product-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-top: 8px;
	font-size: 12px;
	color: #667085;
}

.product-stats {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px;
	margin-top: 12px;

	div {
		padding: 8px 10px;
		border-radius: 8px;
		background: #f8fafc;
	}

	span {
		display: block;
		font-size: 12px;
		color: #667085;
	}

	strong {
		display: block;
		margin-top: 4px;
		font-size: 16px;
		color: #101828;
	}
}

.product-summary-side {
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 8px;
	padding-left: 8px;
	border-left: 1px solid #eef2f6;
}

.summary-line {
	font-size: 13px;
	font-weight: 600;
	color: #101828;
}

.summary-reason {
	font-size: 12px;
	line-height: 1.5;
	color: #667085;
}

.summary-note {
	margin-top: 4px;
	font-size: 12px;
	line-height: 1.5;
	color: #67c23a;
}

.product-card-body {
	padding: 0 12px 12px;
}

.body-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 8px 0;
}

.body-title {
	font-size: 13px;
	font-weight: 700;
	color: #101828;
}

.order-list {
	display: grid;
	gap: 10px;
}

.order-item {
	padding: 12px;
	border: 1px solid #eef2f6;
	border-radius: 8px;
	background: #fff;
}

.order-item-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.order-code {
	font-size: 14px;
	font-weight: 700;
	color: #101828;
}

.order-grid {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 8px;
	margin-top: 10px;

	div {
		padding: 8px 10px;
		border-radius: 8px;
		background: #f8fafc;
	}

	span {
		display: block;
		font-size: 12px;
		color: #667085;
	}

	strong {
		display: block;
		margin-top: 4px;
		font-size: 13px;
		color: #101828;
	}
}

.order-logistics {
	margin-top: 8px;
	font-size: 12px;
	color: #667085;
}

.order-notes {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 8px;
}

.muted-dot {
	margin: 0 4px;
	color: #d0d5dd;
}

.order-reasons {
	display: grid;
	gap: 8px;
	margin-top: 10px;
}

.reason-block {
	padding: 8px 10px;
	border-radius: 8px;
	font-size: 12px;
	line-height: 1.5;

	&.is-blocked {
		background: #fef0f0;
		color: #f56c6c;
	}

	&.is-warning {
		background: #fdf6ec;
		color: #b88230;
	}
}

.reason-block-title {
	margin-bottom: 4px;
	font-weight: 700;
}

.muted {
	font-size: 12px;
	color: #667085;
}

.preflight-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

.footer-hint {
	font-size: 13px;
	color: #667085;
}

.footer-actions {
	display: flex;
	gap: 8px;
}

@media (max-width: 1200px) {
	.product-card-head {
		grid-template-columns: 92px minmax(0, 1fr);
	}

	.product-summary-side {
		grid-column: 1 / -1;
		padding-left: 0;
		border-left: 0;
		border-top: 1px solid #eef2f6;
		padding-top: 8px;
	}

	.product-stats,
	.order-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}
</style>
