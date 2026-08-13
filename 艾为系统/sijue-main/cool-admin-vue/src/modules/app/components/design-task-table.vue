<template>
	<div class="table-wrapper">
		<div class="search-bar">
			<el-input
				v-model="searchKeyword"
				placeholder="请输入关键词搜索（父SKU、产品名等）"
				clearable
				style="width: 300px"
				@input="handleSearch"
			>
				<template #prefix>
					<el-icon><search /></el-icon>
				</template>
			</el-input>
		</div>
		<div class="table-scroll">
			<el-table
				:data="data"
				border
				style="width: 100%"
				:size="compact ? 'small' : 'default'"
				:class="{ 'design-task-table--compact': compact }"
				:row-class-name="getRowClass"
			>
				<el-table-column prop="sku" label="父SKU" :width="col.sku" />
				<el-table-column
					prop="name"
					label="产品名"
					:min-width="col.name"
					show-overflow-tooltip
				/>
				<el-table-column prop="image" label="图片" :width="col.image" align="center">
					<template #default="{ row }">
						<image-zoom :src="row.image" fit="cover" class="product-image" />
					</template>
				</el-table-column>
				<el-table-column label="店铺" :min-width="col.shop">
					<template #default="{ row }">
						<div v-if="row.shopList?.length" class="label-list">
							<el-tag
								v-for="shop in row.shopList"
								:key="shop"
								size="small"
								effect="plain"
								class="label-tag"
							>
								{{ shop }}
							</el-tag>
						</div>
						<span v-else class="empty-text">-</span>
					</template>
				</el-table-column>
				<el-table-column label="运营" :min-width="col.submitter">
					<template #default="{ row }">
						<div v-if="row.submitterList?.length" class="label-list">
							<el-tag
								v-for="submitter in row.submitterList"
								:key="submitter"
								size="small"
								effect="plain"
								type="success"
								class="label-tag"
							>
								{{ submitter }}
							</el-tag>
						</div>
						<span v-else class="empty-text">-</span>
					</template>
				</el-table-column>
				<el-table-column
					v-if="showRequiredLanguages"
					label="语言"
					:width="col.lang"
					align="center"
				>
					<template #default="{ row }">
						<div v-if="row.requiredLanguages?.length" class="label-list lang-list">
							<el-tag
								v-for="lang in row.requiredLanguages"
								:key="lang"
								size="small"
								type="info"
								effect="plain"
								class="label-tag"
							>
								{{ labelForRequiredLang(lang) }}
							</el-tag>
						</div>
						<span v-else class="empty-text">-</span>
					</template>
				</el-table-column>
				<el-table-column prop="status" label="状态" :width="effectiveStatusWidth" align="center">
					<template #default="{ row }">
						<div class="status-cell">
							<el-tag :type="getStatusTagType(row.status)" size="small">{{
								row.status
							}}</el-tag>
							<sample-purchase-plan-status-tags
								v-if="showSamplePurchase"
								:plans="row.samplePurchasePlans"
							/>
						</div>
					</template>
				</el-table-column>
			<el-table-column label="分项进度" :width="col.progress" align="center">
				<template #default="{ row }">
					<span v-if="row.progress" class="progress-text">{{ row.progress }}</span>
					<span v-else class="progress-text">-</span>
				</template>
			</el-table-column>
			<el-table-column label="更新时间" :width="col.updatedAt" align="left">
				<template #default="{ row }">
					<lazy-activity-timeline
						:updated-at="row.updatedAt"
						:dialog-title="`图需时间线 · #${row.id} · ${row.sku}`"
						:load="() => fetchDesignTaskTimelineItems(row.id)"
					/>
				</template>
			</el-table-column>
			<el-table-column label="操作" :width="actionWidth" fixed="right">
				<template #default="{ row }">
					<div class="action-cell">
						<slot name="action" :row="row" />
					</div>
				</template>
			</el-table-column>
			</el-table>
		</div>
		<div class="pagination-wrapper">
			<el-pagination
				:current-page="props.currentPage"
				:page-size="props.pageSize"
				:page-sizes="[10, 20, 50, 100]"
				:total="total"
				layout="total, sizes, prev, pager, next, jumper"
				@size-change="handleSizeChange"
				@current-change="handleCurrentChange"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Search } from "@element-plus/icons-vue";
import { fetchDesignTaskTimelineItems } from "/$/app/utils/activity-timeline";
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";
// @ts-ignore
import LazyActivityTimeline from "/$/app/components/lazy-activity-timeline.vue";
// @ts-ignore
import SamplePurchasePlanStatusTags from "/$/app/components/sample-purchase-plan-status-tags.vue";
import { type SamplePurchasePlanItem } from "/$/app/utils/sample-purchase-plan-status";
import {
	labelForRequiredLang,
	type ListingAiRequiredLang
} from "/$/app/utils/listing-ai-required-languages";

export interface DesignTaskTableItem {
	id: number;
	sku: string;
	name: string;
	shop?: string;
	submitter?: string;
	shopList?: string[];
	submitterList?: string[];
	status: string;
	statusCode?: number;
	aiTaskId?: number;
	image: string;
	progress?: string; // 分享进度，格式如 "7/9"
	updatedAt?: string;
	/** 样品采购计划列表（拍摄任务列表） */
	samplePurchasePlans?: SamplePurchasePlanItem[];
	/** 图需任务是否创建未满 3 天，用于置灰与按钮提示 */
	isTooNew?: boolean;
	/** 102 且最后更新时间已超过阈值，可重新触发生成 */
	canRegenerateAiRequirement?: boolean;
	/** 选品全部采购 uk/de 汇总推导的需做语言 */
	requiredLanguages?: ListingAiRequiredLang[];
}

interface Props {
	data: DesignTaskTableItem[];
	statusTagType?: (status: string) => "success" | "info" | "warning" | "danger" | "primary";
	statusWidth?: number;
	actionWidth?: number;
	total?: number; // 总记录数，用于分页
	currentPage?: number;
	pageSize?: number;
	/** 时间线左侧展示样品采购状态（拍摄任务） */
	showSamplePurchase?: boolean;
	/** 运营列后展示语言（图需列表） */
	showRequiredLanguages?: boolean;
	/** 左右分栏列表页：收窄列宽、小号表格 */
	compact?: boolean;
}

const emit = defineEmits<{
	search: [keyword: string];
	sizeChange: [size: number];
	currentChange: [page: number];
}>();

const searchKeyword = ref("");
const props = withDefaults(defineProps<Props>(), {
	statusTagType:
		() =>
		(status: string): "success" | "info" | "warning" | "danger" | "primary" => {
			if (status.includes("待")) return "warning";
			if (status.includes("完成")) return "success";
			if (status.includes("确认")) return "info";
			if (status.includes("修图")) return "primary";
			return "info";
		},
	statusWidth: 160,
	actionWidth: 140,
	total: 0,
	currentPage: 1,
	pageSize: 10,
	showSamplePurchase: false,
	showRequiredLanguages: false,
	compact: false
});

const col = computed(() =>
	props.compact
		? {
				sku: 96,
				name: 100,
				image: 64,
				shop: 92,
				submitter: 88,
				lang: 76,
				progress: 72,
				updatedAt: 120
			}
		: {
				sku: 140,
				name: 200,
				image: 100,
				shop: 180,
				submitter: 160,
				lang: 120,
				progress: 150,
				updatedAt: 168
			}
);

const effectiveStatusWidth = computed(() =>
	props.showSamplePurchase ? Math.max(props.statusWidth, props.compact ? 148 : 168) : props.statusWidth
);

function getStatusTagType(status: string) {
	return props.statusTagType(status);
}

function getRowClass({ row }: { row: DesignTaskTableItem }) {
	return row.isTooNew ? "design-task-row--too-new" : "";
}

function handleSearch() {
	emit("search", searchKeyword.value);
}

function handleSizeChange(size: number) {
	emit("sizeChange", size);
}

function handleCurrentChange(page: number) {
	emit("currentChange", page);
}
</script>

<style scoped lang="scss">
.table-wrapper {
	width: 100%;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.table-scroll {
	flex: 1;
	min-height: 0;
	overflow: auto;
}

:deep(.el-table) {
	width: 100% !important;
}

.product-image {
	width: 64px;
	height: 64px;
	border-radius: 4px;
}

.design-task-table--compact .product-image {
	width: 44px;
	height: 44px;
}

:deep(.design-task-table--compact .el-table__cell) {
	padding: 6px 0;
}

:deep(.design-task-table--compact .label-list) {
	padding: 4px 0;
	gap: 4px;
}

:deep(.design-task-table--compact .progress-text) {
	font-size: 12px;
}

.status-cell {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
}

:deep(.status-cell .sample-plan-tags) {
	width: 100%;
}

.progress-text {
	font-size: 14px;
	color: #303133;
	font-weight: 500;
}

.label-list {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	padding: 10px 0;
}

.label-tag {
	max-width: 100%;
}

.empty-text {
	color: #c0c4cc;
}

.search-bar {
	flex-shrink: 0;
	display: flex;
	justify-content: flex-end;
	margin-bottom: 16px;
}

.pagination-wrapper {
	flex-shrink: 0;
	display: flex;
	justify-content: flex-end;
	margin-top: 16px;
}

.action-cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 8px;

	:deep(.el-button) {
		justify-content: flex-start;
		padding-left: 0;
		margin: 0;
		text-align: left;
		align-self: flex-start;
	}
}

:deep(.design-task-row--too-new) {
	/* 整行变淡，但仍可清晰阅读 */
	opacity: 1;
	background-color: #f6f7fb !important;
}

:deep(.design-task-row--too-new .el-table__cell) {
	color: #9ea2a9 !important; /* 比普通行略浅一档 */
}

:deep(.design-task-row--too-new .el-tag) {
	--el-tag-bg-color: #f3f4f7;
	--el-tag-text-color: #a3a7ae;
	border-color: #e4e7ed;
}

:deep(.design-task-row--too-new .product-image) {
	filter: grayscale(80%);
	opacity: 0.85;
}

/* 行内所有链接按钮一并变浅（包括“AI生成图需”） */
:deep(.design-task-row--too-new .el-button.is-link) {
	color: #b3b6bc !important;
}
</style>
