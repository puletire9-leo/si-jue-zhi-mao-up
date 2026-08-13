<template>
	<el-popover
		trigger="click"
		placement="bottom-start"
		:width="520"
		:show-after="80"
		popper-class="logistics-source-popover"
	>
		<template #reference>
			<slot name="reference" />
		</template>

		<div class="logistics-source-popover-content">
			<div class="source-popover-header">
				<div>
					<div class="source-popover-title">来源明细</div>
					<div class="source-popover-desc">
						同一采购单同一运单只生成一个包裹，下面保留领星返回的全部来源。
					</div>
				</div>
				<el-tag size="small" type="info">{{ sourceCount }} 条来源</el-tag>
			</div>

			<div class="source-popover-list">
				<div
					v-for="(source, index) in normalizedSources"
					:key="`${getSourceTrackingNo(source)}-${getSourcePolId(source)}-${index}`"
					class="source-popover-item"
				>
					<div class="source-popover-index">{{ index + 1 }}</div>
					<div class="source-popover-main">
						<div class="source-popover-company-line">
							<span class="source-popover-company">{{ getSourceCompany(source) || "-" }}</span>
							<el-tag
								size="small"
								:type="source?.is_exception_source ? 'info' : 'success'"
								effect="plain"
							>
								{{ source?.is_exception_source ? "例外来源" : "快递查询来源" }}
							</el-tag>
						</div>
						<div class="source-popover-fields">
							<span>pol_id：{{ getSourcePolId(source) || "-" }}</span>
							<span>运单号：{{ getSourceTrackingNo(source) || "-" }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</el-popover>
</template>

<script lang="ts" setup>
import { computed } from "vue";

const props = defineProps<{
	sources?: any[];
	count?: number;
}>();

const normalizedSources = computed(() => {
	return Array.isArray(props.sources) ? props.sources : [];
});

const sourceCount = computed(() => {
	return Number(props.count) || normalizedSources.value.length || 0;
});

function getSourceCompany(source: any) {
	return String(source?.logistics_company || source?.raw_company_name || "").trim();
}

function getSourcePolId(source: any) {
	return String(source?.pol_id || source?.source_pol_id || "").trim();
}

function getSourceTrackingNo(source: any) {
	return String(source?.logistics_order_no || source?.tracking_no || "").trim();
}
</script>

<style lang="scss" scoped>
.logistics-source-popover-content {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.source-popover-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--el-border-color-extra-light);
}

.source-popover-title {
	font-weight: 650;
	color: var(--el-text-color-primary);
	line-height: 1.4;
}

.source-popover-desc {
	margin-top: 2px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	line-height: 1.45;
}

.source-popover-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.source-popover-item {
	display: grid;
	grid-template-columns: 24px minmax(0, 1fr);
	gap: 8px;
	padding: 8px;
	border: 1px solid var(--el-border-color-extra-light);
	background: var(--el-fill-color-extra-light);
}

.source-popover-index {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: #fff;
	color: var(--el-color-primary);
	font-size: 12px;
	font-weight: 650;
}

.source-popover-main {
	min-width: 0;
}

.source-popover-company-line {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	min-width: 0;
}

.source-popover-company {
	color: var(--el-text-color-primary);
	font-weight: 650;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.source-popover-fields {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-top: 4px;
	color: var(--el-text-color-secondary);
	font-family: Monaco, Consolas, monospace;
	font-size: 12px;
	line-height: 1.45;
}
</style>
