<template>
	<div class="upload-task-list-page">
		<el-card class="section-card" shadow="never">
			<template #header>
				<div class="section-header">
					<span>上传任务列表</span>
					<el-tag type="info">{{ total }}</el-tag>
				</div>
			</template>

			<div class="table-wrapper">
				<div class="search-bar">
					<el-input
						v-model="searchKeyword"
						placeholder="请输入关键词搜索（MSKU、父SKU、店铺、提交人等）"
						clearable
						style="width: 320px"
						@keyup.enter="handleSearch"
						@clear="handleSearch"
					>
						<template #prefix>
							<el-icon><search /></el-icon>
						</template>
					</el-input>
					<el-button
						type="primary"
						style="margin-left: 8px"
						:loading="loading"
						@click="handleSearch"
						>搜索</el-button
					>
				</div>

				<el-table v-loading="loading" :data="getTableData()" border style="width: 100%">
					<el-table-column prop="msku" label="MSKU" width="160" />
					<el-table-column prop="sku" label="父SKU" width="120" />
					<el-table-column prop="image" label="图片" width="100" align="center">
						<template #default="{ row }">
							<image-zoom
								v-if="row.image"
								:src="row.image"
								fit="cover"
								class="product-image"
							/>
							<span v-else class="empty-img">-</span>
						</template>
					</el-table-column>
					<el-table-column prop="shop" label="店铺" width="120" />
					<el-table-column
						prop="product_name"
						label="产品名"
						min-width="140"
						show-overflow-tooltip
					/>
					<el-table-column
						prop="variant_name"
						label="变体名"
						width="120"
						show-overflow-tooltip
					/>
					<el-table-column prop="submitter" label="提交人" width="100" />
					<el-table-column prop="status" label="状态" width="150" align="center">
						<template #default="{ row }">
							<el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column label="分项进度" width="150" align="center">
						<template #default="{ row }">
							<span v-if="row.progress" class="progress-text">{{
								row.progress
							}}</span>
							<span v-else class="progress-text">-</span>
						</template>
					</el-table-column>
					<el-table-column label="更新时间" width="168" align="left">
						<template #default="{ row }">
							<lazy-activity-timeline
								v-if="row.designTaskId"
								:updated-at="row.updateTime"
								:dialog-title="`上传任务时间线 · ${row.msku}`"
								:load="() => loadUploadTaskTimeline(row.designTaskId)"
							/>
							<span v-else class="muted">{{ row.updateTime || "—" }}</span>
						</template>
					</el-table-column>
					<el-table-column label="操作" width="120" fixed="right">
						<template #default="{ row }">
							<el-button link type="primary" @click="handleView(row)"
								>查看详情</el-button
							>
						</template>
					</el-table-column>
				</el-table>

				<div class="pagination-wrapper">
					<el-pagination
						:current-page="currentPage"
						:page-size="pageSize"
						:page-sizes="[10, 20, 50, 100]"
						:total="total"
						layout="total, sizes, prev, pager, next, jumper"
						@size-change="handleSizeChange"
						@current-change="handleCurrentChange"
					/>
				</div>
			</div>
		</el-card>

		<!-- 上传任务详情模态框 -->
		<design-upload-task-detail
			v-model="detailDialogVisible"
			:task-id="currentTaskId"
			@closed="fetchList"
		/>
	</div>
</template>

<script setup lang="ts" name="app-design-upload-task-list">
import { computed, ref, onMounted, onActivated } from "vue";
import { Search } from "@element-plus/icons-vue";
// @ts-ignore
import DesignUploadTaskDetail from "./design-upload-task-detail.vue";
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";
// @ts-ignore
import LazyActivityTimeline from "/$/app/components/lazy-activity-timeline.vue";
import { fetchDesignTaskTimelineItems } from "/$/app/utils/activity-timeline";
import { product_main_image_display_url } from "../utils";
import { service } from "/@/cool";

interface UploadTaskItem {
	id: number | string;
	msku: string;
	sku: string;
	image: string;
	shop: string;
	product_name: string;
	variant_name: string;
	submitter: string;
	status: string;
	progress?: string;
	updateTime?: string;
	designTaskId?: number;
}

const detailDialogVisible = ref(false);
const currentTaskId = ref<string | number>();

const searchKeyword = ref("");
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const tasks = ref<UploadTaskItem[]>([]);
const pageTasks = computed(() => {
	if (tasks.value.length <= pageSize.value) return tasks.value;
	const start = (currentPage.value - 1) * pageSize.value;
	return tasks.value.slice(start, start + pageSize.value);
});

function mapRowToTask(row: any): UploadTaskItem {
	return {
		id: row.id,
		msku: row.msku ?? "",
		sku: row.sku ?? "",
		image: product_main_image_display_url(row.list_image),
		shop: row.shop ?? "",
		product_name: row.product_name ?? "",
		variant_name: row.variant_name ?? "",
		submitter: row.submitter ?? "",
		status: row.statusText ?? "待上传",
		progress: row.progress ?? "",
		updateTime: String(row.updateTime || ""),
		designTaskId: Number(row.design_task_id || 0) || undefined
	};
}

function loadUploadTaskTimeline(designTaskId?: number) {
	if (!designTaskId) return Promise.resolve([]);
	return fetchDesignTaskTimelineItems(designTaskId);
}

async function fetchList() {
	if (!(service as any).app?.design_task?.request) return;
	loading.value = true;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/pageUploadTasks",
			method: "GET",
			params: {
				keyword: searchKeyword.value?.trim() || undefined,
				page: currentPage.value,
				size: pageSize.value
			}
		});
		const data = res?.data ?? res;
		const list = data?.list ?? [];
		const pagination = data?.pagination ?? {};
		tasks.value = list.map(mapRowToTask);
		total.value = pagination.total ?? 0;
	} catch (e) {
		console.error(e);
		tasks.value = [];
		total.value = 0;
	} finally {
		loading.value = false;
	}
}

onMounted(() => fetchList());
onActivated(() => fetchList());

function getTableData() {
	return pageTasks.value;
}

function statusTagType(status: string) {
	if (status.includes("待")) return "warning";
	if (status.includes("中")) return "primary";
	if (status.includes("完成") || status.includes("已")) return "success";
	return "info";
}

function handleView(row: UploadTaskItem) {
	currentTaskId.value = row.id;
	detailDialogVisible.value = true;
}

function handleSearch() {
	currentPage.value = 1;
	fetchList();
}

function handleSizeChange(size: number) {
	pageSize.value = size;
	currentPage.value = 1;
	fetchList();
}

function handleCurrentChange(page: number) {
	currentPage.value = page;
	fetchList();
}
</script>

<style scoped lang="scss">
.upload-task-list-page {
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
}

.table-wrapper {
	width: 100%;
}

.search-bar {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 16px;
}

.product-image {
	width: 64px;
	height: 64px;
	border-radius: 4px;
}

.empty-img {
	color: #909399;
	font-size: 12px;
}
.progress-text {
	font-size: 14px;
	color: #303133;
	font-weight: 500;
}

.pagination-wrapper {
	display: flex;
	justify-content: flex-end;
	margin-top: 16px;
}
</style>
