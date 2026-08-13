<template>
	<div v-if="summary" class="sample-purchase-status">
		<el-tag :type="tagType" size="small" effect="plain" class="sample-purchase-status__tag">
			{{ summary.status_text }}
		</el-tag>
		<div class="sample-purchase-status__meta">
			<span v-if="summary.has_plan">计划 {{ summary.plan_count }}</span>
			<span v-if="summary.has_po"> · PO {{ summary.po_count }}单</span>
			<span v-else-if="summary.has_plan"> · 未下PO</span>
		</div>
		<div v-if="summary.orders?.length" class="sample-purchase-status__orders">
			<span
				v-for="o in summary.orders"
				:key="o.order_sn"
				class="sample-purchase-status__order"
				:title="orderTitle(o)"
			>
				{{ o.order_sn }}
			</span>
		</div>
	</div>
	<div v-else class="sample-purchase-status sample-purchase-status--empty">—</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
	getSamplePurchaseTagType,
	type SamplePurchaseOrderBrief,
	type SamplePurchaseSummary
} from "/$/app/utils/sample-purchase-status";

const props = defineProps<{
	summary?: SamplePurchaseSummary | null;
}>();

const tagType = computed(() => getSamplePurchaseTagType(props.summary?.status));

function orderTitle(o: SamplePurchaseOrderBrief) {
	const parts = [o.order_sn, o.status_text, o.status_shipped_text].filter(Boolean);
	return parts.join(" · ");
}
</script>

<style scoped lang="scss">
.sample-purchase-status {
	padding: 4px 0;
	font-size: 12px;
	line-height: 1.4;
}

.sample-purchase-status--empty {
	color: #c0c4cc;
}

.sample-purchase-status__tag {
	margin-bottom: 4px;
	max-width: 100%;
}

.sample-purchase-status__meta {
	color: #909399;
	font-size: 11px;
}

.sample-purchase-status__orders {
	margin-top: 4px;
	display: flex;
	flex-direction: column;
	gap: 2px;
	max-height: 48px;
	overflow-y: auto;
}

.sample-purchase-status__order {
	color: #606266;
	font-size: 11px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
