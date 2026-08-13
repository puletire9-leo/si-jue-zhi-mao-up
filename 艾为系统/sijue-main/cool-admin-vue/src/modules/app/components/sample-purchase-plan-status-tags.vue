<template>
	<div class="sample-plan-tags">
		<template v-if="plans.length">
			<el-popover
				v-for="plan in plans"
				:key="planKey(plan)"
				trigger="click"
				placement="left-start"
				:width="540"
				:teleported="true"
				popper-class="candidate-logistics-popover"
				@show="handlePlanPopoverShow(plan)"
			>
				<template #reference>
					<el-tag
						:type="getSamplePlanStatusTagType(plan.status)"
						size="small"
						effect="plain"
						class="sample-plan-tag sample-plan-tag--clickable"
					>
						{{ plan.status_text }}
					</el-tag>
				</template>

				<div class="logistics-popover">
					<div class="logistics-popover__header">
						<div>
							<div class="logistics-popover__title">
								{{ plan.plan_sn || "-" }}
							</div>
							<div class="logistics-popover__hint">
								{{ plan.lingxing_sku || "样品采购计划" }} · {{ plan.status_text }}
							</div>
						</div>
					</div>

					<template v-if="getPlanOrders(plan).length">
						<div
							v-for="order in getPlanOrders(plan)"
							:key="getOrderSn(order)"
							class="logistics-order-block"
						>
							<div class="logistics-popover__header logistics-order-block__header">
								<div>
									<div class="logistics-popover__title">
										{{ getOrderSn(order) || "-" }}
									</div>
									<div class="logistics-popover__hint">
										{{ getOrderLogisticsReason(order) }}
									</div>
									<div
										v-if="getOrderLatestTrace(order).text"
										class="logistics-popover__latest"
									>
										<b>最新轨迹：</b>{{ getOrderLatestTraceText(order) }}
									</div>
								</div>
								<el-button
									link
									type="primary"
									size="small"
									:loading="isLogisticsLoading(order)"
									@click.stop="refreshOrderLogisticsOverview(order)"
								>
									刷新轨迹
								</el-button>
							</div>

							<div v-if="getLogisticsError(order)" class="logistics-popover__error">
								{{ getLogisticsError(order) }}
							</div>

							<div
								v-if="getLogisticsPackageSummary(order) || getQuerySummaryText(order)"
								class="logistics-popover__stats"
							>
								<span v-if="getLogisticsPackageSummary(order)">
									{{ getLogisticsPackageSummary(order) }}
								</span>
								<span v-if="getQuerySummaryText(order)">
									{{ getQuerySummaryText(order) }}
								</span>
							</div>

							<template v-if="getLogisticsPackages(order).length">
								<div
									v-for="pkg in getLogisticsPackages(order)"
									:key="pkg.id || pkg.tracking_no || pkg.logistics_order_no"
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
											<b>包裹状态：</b>{{ getPackageLogisticsStatusText(pkg) }}
										</div>
										<div>
											<b>联系电话：</b>{{ getPackagePhoneText(pkg) }}
										</div>
									</div>

									<div v-if="getTraceList(pkg).length" class="logistics-trace-list">
										<div
											v-for="(trace, index) in getTraceList(pkg)"
											:key="index"
											class="logistics-trace-item"
										>
											<span class="logistics-trace-item__time">
												{{ getTraceTime(trace) }}
											</span>
											<span class="logistics-trace-item__text">
												{{ getTraceText(trace) }}
											</span>
										</div>
									</div>
								</div>
							</template>

							<div
								v-else
								v-loading="isLogisticsLoading(order)"
								class="logistics-popover__empty"
							>
								{{ getOrderLogisticsDisplayText(order) }}
							</div>
						</div>
					</template>

					<div v-else class="logistics-popover__empty">
						暂无关联采购单，物流信息将在下采购单后可用
					</div>
				</div>
			</el-popover>
		</template>
		<el-tag v-else size="small" effect="plain" type="info" class="sample-plan-tag">
			未建样品计划
		</el-tag>
	</div>
</template>

<script setup lang="ts">
import { usePurchaseOrderLogistics } from "/$/app/composables/use-purchase-order-logistics";
import {
	getSamplePlanStatusTagType,
	type SamplePurchasePlanItem
} from "/$/app/utils/sample-purchase-plan-status";

const props = defineProps<{
	plans?: SamplePurchasePlanItem[] | null;
}>();

const {
	getOrderSn,
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
	refreshOrderLogisticsOverview,
	preloadOrdersLogistics,
	formatDateTime,
	getTraceList,
	getTraceTime,
	getTraceText
} = usePurchaseOrderLogistics();

function planKey(plan: SamplePurchasePlanItem) {
	return `${plan.id || 0}-${plan.plan_sn || ""}`;
}

function getPlanOrders(plan: SamplePurchasePlanItem) {
	return Array.isArray(plan.orders) ? plan.orders : [];
}

function handlePlanPopoverShow(plan: SamplePurchasePlanItem) {
	preloadOrdersLogistics(getPlanOrders(plan));
}
</script>

<style scoped lang="scss">
.sample-plan-tags {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 4px;
}

.sample-plan-tag {
	max-width: 100%;
	cursor: default;
}

.sample-plan-tag--clickable {
	cursor: pointer;
}

.logistics-order-block + .logistics-order-block {
	margin-top: 12px;
	padding-top: 12px;
	border-top: 1px dashed var(--el-border-color-lighter);
}

.logistics-order-block__header {
	position: static;
	padding: 0 0 8px;
	border-bottom: none;
}
</style>

<style lang="scss">
.candidate-logistics-popover {
	padding: 0 !important;
	max-width: min(540px, calc(100vw - 48px));
	border: 1px solid var(--el-border-color-light);
	box-shadow: 0 10px 28px rgba(31, 45, 61, 0.16);
}

.candidate-logistics-popover .logistics-popover {
	box-sizing: border-box;
	max-height: min(620px, calc(100vh - 140px));
	overflow-y: auto;
	padding: 12px 14px;
	background: var(--el-bg-color);
	font-size: 13px;
	line-height: 1.55;
}

.candidate-logistics-popover .logistics-popover__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 10px;
}

.candidate-logistics-popover .logistics-popover__title {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-primary);
}

.candidate-logistics-popover .logistics-popover__hint,
.candidate-logistics-popover .logistics-popover__latest {
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.candidate-logistics-popover .logistics-popover__error {
	margin-bottom: 8px;
	padding: 8px 10px;
	border-radius: 4px;
	background: var(--el-color-danger-light-9);
	color: var(--el-color-danger);
}

.candidate-logistics-popover .logistics-popover__stats {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 10px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.candidate-logistics-popover .logistics-popover__empty {
	min-height: 48px;
	color: var(--el-text-color-secondary);
}

.candidate-logistics-popover .logistics-package {
	margin-bottom: 10px;
	padding: 10px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	background: var(--el-fill-color-blank);
}

.candidate-logistics-popover .logistics-package__head {
	display: flex;
	justify-content: space-between;
	gap: 12px;
}

.candidate-logistics-popover .logistics-package__tracking {
	font-weight: 600;
}

.candidate-logistics-popover .logistics-package__company,
.candidate-logistics-popover .logistics-package__time,
.candidate-logistics-popover .logistics-package__latest {
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
}

.candidate-logistics-popover .logistics-meta-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 6px 12px;
	margin-top: 8px;
	font-size: 12px;
}

.candidate-logistics-popover .logistics-trace-list {
	margin-top: 8px;
	max-height: 180px;
	overflow-y: auto;
}

.candidate-logistics-popover .logistics-trace-item {
	display: flex;
	gap: 8px;
	padding: 4px 0;
	border-bottom: 1px dashed var(--el-border-color-extra-light);
	font-size: 12px;
}

.candidate-logistics-popover .logistics-trace-item__time {
	flex: 0 0 132px;
	color: var(--el-text-color-secondary);
}
</style>
