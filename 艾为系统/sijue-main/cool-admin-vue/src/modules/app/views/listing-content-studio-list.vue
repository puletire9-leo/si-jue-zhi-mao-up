<!-- ListingContentStudio — 列表（默认 MSKU 维度，纯前端 mock） -->
<!-- 访问: #/app/listing-content-studio -->
<template>
	<div class="lcs-list-page">
		<el-card class="section-card" shadow="never">
			<template #header>
				<div class="section-header">
					<span>Listing 内容工作室</span>
					<el-tag type="info">{{ filteredTotal }}</el-tag>
					<span class="section-sub">默认 MSKU 维度 · 下列为演示数据</span>
					<div class="section-header-actions">
						<el-button link type="primary" @click="goAiCopyTasks">AI 文案任务</el-button>
					</div>
				</div>
			</template>

			<div class="toolbar">
				<el-radio-group v-model="viewMode" class="toolbar-segment" @change="applyFilters">
					<el-radio-button label="msku">MSKU 视图</el-radio-button>
					<el-radio-button label="sku">父SKU 视图</el-radio-button>
				</el-radio-group>
				<el-radio-group
					v-model="filters.uploadStatus"
					class="toolbar-segment"
					@change="applyFilters"
				>
					<el-radio-button label="all">全部</el-radio-button>
					<el-radio-button label="todo">进行中</el-radio-button>
					<el-radio-button label="done">已完成</el-radio-button>
				</el-radio-group>
				<el-input
					v-model="filters.keyword"
					class="toolbar-item toolbar-search"
					clearable
					placeholder="父SKU / 名称 / 变体 / MSKU 状态 / 时间线"
					@clear="applyFilters"
					@keyup.enter="applyFilters"
				/>
				<el-select
					v-model="filters.shop"
					class="toolbar-item"
					clearable
					filterable
					placeholder="店铺"
					@change="applyFilters"
				>
					<el-option
						v-for="shop in shopOptions"
						:key="shop"
						:label="shop"
						:value="shop"
					/>
				</el-select>
				<el-select
					v-model="filters.owner"
					class="toolbar-item"
					clearable
					filterable
					placeholder="运营"
					@change="applyFilters"
				>
					<el-option
						v-for="owner in ownerOptions"
						:key="owner"
						:label="owner"
						:value="owner"
					/>
				</el-select>
				<el-button type="primary" @click="applyFilters">查询</el-button>
				<el-button @click="resetFilters">重置</el-button>
			</div>

			<el-table
				v-loading="loading"
				:data="pageRows"
				stripe
				border
				class="lcs-table"
				:row-key="getRowKey"
			>
				<el-table-column label="父SKU" prop="sku" width="112" fixed="left" />
				<el-table-column label="选品 / 名称" min-width="220">
					<template #default="{ row }">
						<div class="name-cell">
							<div class="thumb" :style="row.thumbStyle" />
							<div class="name-meta">
								<div class="title-line">{{ row.title }}</div>
							</div>
						</div>
					</template>
				</el-table-column>
				<el-table-column v-if="viewMode === 'msku'" label="MSKU" prop="msku" width="130" />
				<el-table-column v-if="viewMode === 'msku'" label="店铺" prop="amazonAccount" width="180" />
				<el-table-column
					v-if="viewMode === 'msku'"
					label="运营"
					prop="owner"
					width="120"
					show-overflow-tooltip
				/>
				<el-table-column v-if="viewMode === 'msku'" label="变体" prop="variantLabel" min-width="180" />
				<el-table-column v-if="viewMode === 'msku'" label="语言" width="120" align="center">
					<template #default="{ row }">
						<div v-if="row.requiredLanguages?.length" class="lang-tags">
							<el-tag
								v-for="lang in row.requiredLanguages"
								:key="lang"
								size="small"
								type="info"
								effect="plain"
							>
								{{ labelForRequiredLang(lang) }}
							</el-tag>
						</div>
						<span v-else class="muted">—</span>
					</template>
				</el-table-column>
				<el-table-column v-if="viewMode === 'sku'" label="店铺" min-width="180" show-overflow-tooltip>
					<template #default="{ row }">
						{{ (row.accounts || []).join(" / ") || "—" }}
					</template>
				</el-table-column>
				<el-table-column v-if="viewMode === 'sku'" label="运营" min-width="120" show-overflow-tooltip>
					<template #default="{ row }">
						{{ (row.owners || []).join(" / ") || "—" }}
					</template>
				</el-table-column>
				<el-table-column v-if="viewMode === 'sku'" label="父SKU 状态" min-width="240" align="center">
					<template #default="{ row }">
						<div class="sku-state-cell">
							<el-tag size="small" :type="skuStatusTagType(skuOverallStatus(row))">
								{{ skuOverallStatus(row) }}
							</el-tag>
							<state-chain-lite :tags="skuCompactTags(row)" />
						</div>
					</template>
				</el-table-column>
				<el-table-column label="MSKU 状态" min-width="260">
					<template #default="{ row }">
						<div v-if="viewMode === 'msku'" class="msku-cp-cell">
							<state-chain-lite :tags="compactStateTags(row)" />
						</div>
						<div v-else class="msku-cp-cell">
							<div
								v-for="cp in row.mskuCardPoints.slice(0, 2)"
								:key="cp.msku"
								class="msku-cp-block"
							>
								<div class="msku-cp-who">
									<span>{{ cp.amazonAccount }} · {{ cp.variantLabel }}</span>
									<span
										v-if="cp.requiredLanguages?.length"
										class="msku-cp-langs"
									>
										<el-tag
											v-for="lang in cp.requiredLanguages"
											:key="`${cp.msku}-${lang}`"
											size="small"
											type="info"
											effect="plain"
										>
											{{ labelForRequiredLang(lang) }}
										</el-tag>
									</span>
								</div>
								<state-chain-lite :tags="compactStateTagsFromPoint(cp)" />
							</div>
							<el-tooltip
								v-if="row.mskuCardPoints.length > 2"
								placement="top"
								:show-after="200"
							>
								<template #content>
									<div class="lcs-msku-cp-tooltip">
										<div
											v-for="cp in row.mskuCardPoints"
											:key="cp.msku"
											class="lcs-msku-cp-tip-block"
										>
											<div class="lcs-msku-cp-tip-who">{{ cp.amazonAccount }} · {{ cp.variantLabel }}</div>
											<div class="lcs-msku-cp-tip-pt">
												<state-chain-lite :tags="compactStateTagsFromPoint(cp)" />
											</div>
										</div>
									</div>
								</template>
								<el-tag size="small" type="info" class="lcs-overflow-more">
									+{{ row.mskuCardPoints.length - 2 }}
								</el-tag>
							</el-tooltip>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="更新时间" width="168">
					<template #default="{ row }">
						<lazy-activity-timeline
							v-if="viewMode === 'msku' && row.workItemId"
							:updated-at="row.updatedAt"
							:dialog-title="`工作台时间线 · ${row.msku}`"
							:load="() => loadWorkbenchTimeline(row.workItemId)"
						/>
						<span v-else class="lact-updated-time">{{ row.updatedAt || "—" }}</span>
					</template>
				</el-table-column>
				<el-table-column label="操作" width="120" fixed="right" align="center">
					<template #default="{ row }">
						<el-button link type="primary" @click="openStudio(row)">进入工作室</el-button>
					</template>
				</el-table-column>
			</el-table>

			<div class="pager">
				<el-pagination
					:current-page="page"
					:page-size="pageSize"
					:total="filteredTotal"
					:page-sizes="[10, 20, 50]"
					layout="total, sizes, prev, pager, next"
					background
					@size-change="onPageSizeChange"
					@current-change="onPageChange"
				/>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts" name="app-listing-content-studio-list">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useContentWorkbenchListData } from "./listing-content-studio/useContentWorkbenchListData";
import { labelForRequiredLang } from "../utils/listing-ai-required-languages";
import type {
	LcsMskuCardTone,
	LcsMskuCardPoint,
	LcsSkuRow as LcsRow
} from "./listing-content-studio/types";
import {
	deriveCompactTags,
	deriveNodeSnapshots,
	mapNodeToCompactTag
} from "./listing-content-studio/state-machine";
// @ts-ignore
import StateChainLite from "/$/app/components/state-chain-lite.vue";
// @ts-ignore
import LazyActivityTimeline from "/$/app/components/lazy-activity-timeline.vue";
import { fetchWorkbenchTimelineItems } from "/$/app/utils/activity-timeline";

function loadWorkbenchTimeline(workItemId?: number) {
	if (!workItemId) return Promise.resolve([]);
	return fetchWorkbenchTimelineItems(workItemId);
}

const router = useRouter();
const viewMode = ref<"msku" | "sku">("msku");
const { loading, mskuRows, skuRows, load } = useContentWorkbenchListData();

interface LcsMskuListRow {
	id: string;
	sku: string;
	msku: string;
	title: string;
	thumbStyle: Record<string, string>;
	amazonAccount: string;
	owner?: string;
	variantLabel: string;
	cardPoint: string;
	tone: LcsMskuCardTone;
	updatedAt: string;
	workItemId?: number;
	aiStatus?: string | number;
	aiStage?: string | number;
	designStatus?: string | number;
	designStage?: string | number;
	designTaskCreateTime?: string;
	listingStatus?: "todo" | "done";
	uploadStatus?: "todo" | "done";
	requiredLanguages?: LcsMskuCardPoint["requiredLanguages"];
}

interface StateChainLiteTag {
	text: string;
	type: "success" | "warning" | "danger" | "info";
}

function compactStateTags(row: LcsMskuListRow): StateChainLiteTag[] {
	return deriveCompactTags(
		{
			aiStatus: row.aiStatus,
			aiStage: row.aiStage,
			designStatus: row.designStatus,
			designStage: row.designStage,
			designTaskCreateTime: row.designTaskCreateTime,
			listingStatus: row.listingStatus,
			uploadStatus: row.uploadStatus
		},
		2
	);
}

function compactStateTagsFromPoint(point: LcsMskuCardPoint): StateChainLiteTag[] {
	return deriveCompactTags(
		{
			aiStatus: point.aiStatus,
			aiStage: point.aiStage,
			designStatus: point.designStatus,
			designStage: point.designStage,
			designTaskCreateTime: point.designTaskCreateTime,
			listingStatus: point.listingStatus,
			uploadStatus: point.uploadStatus
		},
		2
	);
}

type SkuOverallStatus = "需处理" | "进行中" | "已完成";

function skuOverallStatus(row: LcsRow): SkuOverallStatus {
	const points = row.mskuCardPoints || [];
	if (!points.length) return "进行中";
	const nodesByPoint = points.map((point) =>
		deriveNodeSnapshots({
			aiStatus: point.aiStatus,
			aiStage: point.aiStage,
			designStatus: point.designStatus,
			designStage: point.designStage,
			listingStatus: point.listingStatus,
			uploadStatus: point.uploadStatus
		})
	);
	const allDone = nodesByPoint.every((nodes) => nodes.every((n) => n.state === "done"));
	if (allDone) return "已完成";
	const hasNeedAction = nodesByPoint.some((nodes) => nodes.some((n) => n.state === "need_action"));
	return hasNeedAction ? "需处理" : "进行中";
}

function skuStatusTagType(s: SkuOverallStatus): "success" | "danger" | "info" {
	if (s === "已完成") return "success";
	if (s === "需处理") return "danger";
	return "info";
}

function skuCompactTags(row: LcsRow): StateChainLiteTag[] {
	const points = row.mskuCardPoints || [];
	if (!points.length) return [{ text: "已完成", type: "success" }];
	const priority = ["listing", "design", "copy", "upload"];
	const bestByKey = new Map<
		string,
		{
			key: string;
			label: string;
			state: string;
			detail: string;
			score: number;
			designStatus?: string | number;
			designStage?: string | number;
			designTaskCreateTime?: string;
		}
	>();
	const scoreOf = (state: string) => (state === "need_action" ? 2 : state === "in_progress" ? 1 : 0);
	for (const point of points) {
		const nodes = deriveNodeSnapshots({
			aiStatus: point.aiStatus,
			aiStage: point.aiStage,
			designStatus: point.designStatus,
			designStage: point.designStage,
			listingStatus: point.listingStatus,
			uploadStatus: point.uploadStatus
		});
		nodes.forEach((node) => {
			const score = scoreOf(node.state);
			if (!score) return;
			const prev = bestByKey.get(node.key);
			if (!prev || score > prev.score) {
				bestByKey.set(node.key, {
					...node,
					score,
					designStatus: point.designStatus,
					designStage: point.designStage,
					designTaskCreateTime: point.designTaskCreateTime
				});
			}
		});
	}
	const tags = Array.from(bestByKey.values())
		.sort((a, b) => {
			if (a.score !== b.score) return b.score - a.score;
			return priority.indexOf(a.key) - priority.indexOf(b.key);
		})
		.slice(0, 2)
		.map((node) =>
			mapNodeToCompactTag(node, {
				designStatus: node.designStatus,
				designStage: node.designStage,
				designTaskCreateTime: node.designTaskCreateTime
			})
		);
	return tags.length ? tags : [{ text: "已完成", type: "success" }];
}

function getRowKey(row: any) {
	return row.id ?? row.sku;
}

const filters = reactive({
	keyword: "",
	uploadStatus: "all" as "all" | "done" | "todo",
	shop: "",
	owner: ""
});

const shopOptions = computed(() =>
	Array.from(
		new Set(
			mskuRows.value
				.map((row) => String(row.amazonAccount || "").trim())
				.filter(Boolean)
		)
	).sort((a, b) => a.localeCompare(b, "zh-CN"))
);

const ownerOptions = computed(() =>
	Array.from(
		new Set(
			mskuRows.value
				.map((row) => String(row.owner || "").trim())
				.filter(Boolean)
		)
	).sort((a, b) => a.localeCompare(b, "zh-CN"))
);

const page = ref(1);
const pageSize = ref(10);

const filteredRows = computed(() => {
	let list: Array<LcsRow | LcsMskuListRow> =
		viewMode.value === "msku" ? [...(mskuRows.value as any)] : [...(skuRows.value as any)];
	const kw = filters.keyword.trim().toLowerCase();
	if (kw) {
		list = list.filter(
			(r: any) =>
				r.sku.toLowerCase().includes(kw) ||
				r.title.toLowerCase().includes(kw) ||
				(r.msku && r.msku.toLowerCase().includes(kw)) ||
				(r.variantLabel && r.variantLabel.toLowerCase().includes(kw)) ||
				(r.amazonAccount && r.amazonAccount.toLowerCase().includes(kw)) ||
				(r.cardPoint && r.cardPoint.toLowerCase().includes(kw)) ||
				((r as LcsRow).mskuCardPoints &&
					skuOverallStatus(r as LcsRow).toLowerCase().includes(kw)) ||
				(r.mskuCardPoints &&
					r.mskuCardPoints.some(
					(cp) =>
						cp.msku.toLowerCase().includes(kw) ||
						cp.amazonAccount.toLowerCase().includes(kw) ||
						cp.variantLabel.toLowerCase().includes(kw) ||
						cp.cardPoint.toLowerCase().includes(kw)
				)) ||
				String(r.updatedAt || "").toLowerCase().includes(kw)
		);
	}
	if (filters.shop) {
		list = list.filter((r: any) =>
			viewMode.value === "msku"
				? String(r.amazonAccount || "") === filters.shop
				: Array.isArray(r.accounts) && r.accounts.includes(filters.shop)
		);
	}
	if (filters.owner) {
		list = list.filter((r: any) =>
			viewMode.value === "msku"
				? String(r.owner || "") === filters.owner
				: Array.isArray(r.owners) && r.owners.includes(filters.owner)
		);
	}
	return list;
});

const filteredTotal = computed(() => filteredRows.value.length);

const pageRows = computed(() => {
	const start = (page.value - 1) * pageSize.value;
	return filteredRows.value.slice(start, start + pageSize.value);
});

watch([filteredTotal, pageSize], () => {
	const maxPage = Math.max(1, Math.ceil(filteredTotal.value / pageSize.value));
	if (page.value > maxPage) page.value = maxPage;
});

function buildLoadOptions() {
	return {
		keyword: filters.keyword,
		uploadStatus:
			filters.uploadStatus === "done" || filters.uploadStatus === "todo"
				? filters.uploadStatus
				: undefined
	};
}

function applyFilters() {
	load(buildLoadOptions());
	page.value = 1;
}

function resetFilters() {
	filters.keyword = "";
	filters.uploadStatus = "all";
	filters.shop = "";
	filters.owner = "";
	load();
	page.value = 1;
}

function onPageSizeChange(size: number) {
	pageSize.value = size;
	page.value = 1;
}

function onPageChange(p: number) {
	page.value = p;
}

function openStudio(row: LcsRow | LcsMskuListRow) {
	const query: Record<string, string> = { sku: row.sku };
	if ("msku" in row && row.msku) query.msku = row.msku;
	router.push({ path: "/app/listing-content-studio/studio", query });
}

function goAiCopyTasks() {
	router.push({ path: "/app/listing-ai-copy-task" });
}

onMounted(() => {
	load();
});
</script>

<style scoped lang="scss">
.lcs-list-page {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 20px;
	background-color: #fff;
	min-height: 100%;
	box-sizing: border-box;
}

.section-card {
	border-radius: 6px;
}

.section-header {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 15px;
	font-weight: 600;
	flex-wrap: wrap;
}

.section-header-actions {
	margin-left: auto;
}

.section-sub {
	font-size: 12px;
	font-weight: 400;
	color: var(--el-text-color-secondary);
	margin-left: 4px;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	margin-bottom: 16px;
}

.toolbar-segment {
	margin-right: 4px;
}

.toolbar-item {
	width: 160px;
}

.toolbar-search {
	width: 260px;
	max-width: 100%;
}

.lcs-table {
	width: 100%;
}

.name-cell {
	display: flex;
	align-items: center;
	gap: 12px;
}

.thumb {
	width: 44px;
	height: 44px;
	border-radius: 8px;
	flex-shrink: 0;
	border: 1px solid var(--el-border-color-lighter);
}

.name-meta {
	min-width: 0;
}

.title-line {
	font-weight: 500;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.muted {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-top: 2px;
}

.muted.tiny {
	margin-top: 4px;
	text-align: center;
}

.shop-tags,
.lang-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	justify-content: center;
}

.lact-updated-time {
	font-size: 13px;
	color: var(--el-text-color-regular);
}

.pager {
	display: flex;
	justify-content: flex-end;
	margin-top: 16px;
}

.lcs-overflow-more {
	cursor: default;
	vertical-align: middle;
}

.msku-cp-cell {
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: flex-start;
}

.sku-state-cell {
	display: flex;
	flex-direction: column;
	gap: 6px;
	align-items: flex-start;
}

.msku-cp-block {
	width: 100%;
	min-width: 0;
}

.msku-cp-who {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	font-size: 11px;
	color: var(--el-text-color-secondary);
	line-height: 1.3;
	margin-bottom: 4px;
}

.msku-cp-langs {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 4px;
}

.msku-cp-tag {
	max-width: 100%;
	white-space: normal;
	height: auto;
	line-height: 1.35;
	padding: 2px 8px;
}
</style>

<style lang="scss">
.lcs-overflow-tooltip {
	max-width: min(320px, 70vw);
	max-height: 240px;
	overflow-y: auto;
	padding: 2px 0;
	line-height: 1.45;
	font-size: 13px;
}

.lcs-overflow-line {
	padding: 2px 0;
	white-space: normal;
	word-break: break-all;
}

.lcs-msku-cp-tooltip {
	max-width: min(360px, 85vw);
	max-height: 280px;
	overflow-y: auto;
	padding: 4px 0;
	font-size: 13px;
	line-height: 1.45;
}

.lcs-msku-cp-tip-block {
	padding: 8px 0;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.lcs-msku-cp-tip-block:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.lcs-msku-cp-tip-who {
	font-weight: 600;
	margin-bottom: 4px;
	word-break: break-all;
}

.lcs-msku-cp-tip-pt {
	color: var(--el-text-color-regular);
	word-break: break-word;
}
</style>
