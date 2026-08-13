<!-- http://localhost:9000/#/app/shoot-task -->
<template>
	<div class="shoot-task-page">
		<div class="tasks-container">
			<el-card class="section-card" shadow="never">
				<template #header>
					<div class="section-header">
						<span>我的任务</span>
						<el-tag type="info">{{ myTasks.length }}</el-tag>
					</div>
				</template>

				<design-task-table
					compact
					:data="myPageTasks"
					:show-sample-purchase="true"
					:status-tag-type="statusTagType"
					:status-width="148"
					:action-width="108"
					:total="myTotal"
					:current-page="myPage"
					:page-size="mySize"
					@search="handleMySearch"
					@size-change="handleMySizeChange"
					@current-change="handleMyCurrentChange"
				>
					<template #action="{ row }">
						<el-button link type="primary" @click="handleView(row)">查看详情</el-button>
						<el-button link type="danger" @click="handleCancelClaim(row)"
							>取消领取</el-button
						>
					</template>
				</design-task-table>
			</el-card>

			<el-card class="section-card" shadow="never">
				<template #header>
					<div class="section-header">
						<span>待领取任务</span>
						<el-tag type="warning">{{ pendingTasks.length }}</el-tag>
					</div>
				</template>

				<design-task-table
					compact
					:data="pendingPageTasks"
					:show-sample-purchase="true"
					:status-tag-type="statusTagType"
					:status-width="148"
					:action-width="100"
					:total="pendingTotal"
					:current-page="pendingPage"
					:page-size="pendingSize"
					@search="handlePendingSearch"
					@size-change="handlePendingSizeChange"
					@current-change="handlePendingCurrentChange"
				>
					<template #action="{ row }">
						<el-button link type="primary" @click="handleView(row)">查看详情</el-button>
						<el-button link type="success" @click="handleClaim(row)">领取</el-button>
					</template>
				</design-task-table>
			</el-card>
		</div>

		<!-- 任务详情模态框 -->
		<design-task-detail
			v-model="detailDialogVisible"
			:task-id="currentTaskId"
			@step-progress-change="handleStepProgressChange"
			@closed="
				() => {
					fetchMyTasks();
					fetchPendingTasks();
				}
			"
		/>
	</div>
</template>

<script setup lang="ts" name="app-design-shoot-task">
import { computed, ref, onMounted, onActivated } from "vue";
import { ElMessage } from "element-plus";
// @ts-ignore
import DesignTaskDetail from "./design-task-detail.vue";
// @ts-ignore
import DesignTaskTable, { type DesignTaskTableItem } from "/$/app/components/design-task-table.vue";
import { designTaskStatusText, product_main_image_display_url } from "../utils";
import { service } from "/@/cool";

type DesignTask = DesignTaskTableItem;

const detailDialogVisible = ref(false);
const currentTaskId = ref<string | number>();

function handleStepProgressChange(payload: {
	taskId: number;
	stepDone: number;
	stepTotal: number;
}) {
	const updateRow = (list: DesignTask[]) => {
		const row = list.find((x) => x.id === payload.taskId);
		if (row) {
			row.progress = payload.stepTotal > 0 ? `${payload.stepDone}/${payload.stepTotal}` : "";
		}
	};
	updateRow(myTasks.value);
	updateRow(pendingTasks.value);
}

function mapRowToTask(row: any): DesignTask {
	const total = Number(row.step_total ?? 0);
	const done = Number(row.step_done ?? 0);
	return {
		id: row.id,
		sku: row.sku ?? row.asin ?? "",
		name: row.produce_name ?? "",
		shop: row.shop ?? "",
		submitter: row.submitter ?? "",
		shopList: Array.isArray(row.shop_list) ? row.shop_list : [],
		submitterList: Array.isArray(row.submitter_list) ? row.submitter_list : [],
		status: designTaskStatusText(Number(row.status)),
		statusCode: Number(row.status),
		image: product_main_image_display_url(row.image_url),
		progress: total > 0 ? `${done}/${total}` : "",
		updatedAt: String(row.updateTime || ""),
		samplePurchasePlans: Array.isArray(row.sample_purchase_plans)
			? row.sample_purchase_plans
			: []
	};
}

const myTasks = ref<DesignTask[]>([]);
const myTotal = ref(0);
const myKeyword = ref("");
const myPage = ref(1);
const mySize = ref(10);
const myLoading = ref(false);
const myPageTasks = computed(() => {
	if (myTasks.value.length <= mySize.value) return myTasks.value;
	const start = (myPage.value - 1) * mySize.value;
	return myTasks.value.slice(start, start + mySize.value);
});

async function fetchMyTasks() {
	const api = (service as any).app?.design_task;
	if (!api?.pageByScene) return;
	myLoading.value = true;
	try {
		const res = await api.pageByScene({
			scene: "shoot_mine",
			keyword: myKeyword.value || undefined,
			page: myPage.value,
			size: mySize.value
		});
		const data = res?.data ?? res;
		myTasks.value = (data.list ?? []).map(mapRowToTask);
		myTotal.value = data.pagination?.total ?? 0;
	} finally {
		myLoading.value = false;
	}
}

const pendingTasks = ref<DesignTask[]>([]);
const pendingTotal = ref(0);
const pendingKeyword = ref("");
const pendingPage = ref(1);
const pendingSize = ref(10);
const pendingLoading = ref(false);
const pendingPageTasks = computed(() => {
	if (pendingTasks.value.length <= pendingSize.value) return pendingTasks.value;
	const start = (pendingPage.value - 1) * pendingSize.value;
	return pendingTasks.value.slice(start, start + pendingSize.value);
});

async function fetchPendingTasks() {
	const api = (service as any).app?.design_task;
	if (!api?.pageByScene) return;
	pendingLoading.value = true;
	try {
		const res = await api.pageByScene({
			scene: "shoot_pool",
			keyword: pendingKeyword.value || undefined,
			page: pendingPage.value,
			size: pendingSize.value
		});
		const data = res?.data ?? res;
		pendingTasks.value = (data.list ?? []).map(mapRowToTask);
		pendingTotal.value = data.pagination?.total ?? 0;
	} finally {
		pendingLoading.value = false;
	}
}

function statusTagType(status: string) {
	if (status.includes("待领取")) return "warning";
	if (status.includes("中")) return "primary";
	return "info";
}

function handleView(row: DesignTask) {
	currentTaskId.value = row.id;
	detailDialogVisible.value = true;
}

async function handleCancelClaim(row: DesignTask) {
	try {
		await (service as any).app.design_task.request({
			url: "/shoot/cancel",
			method: "POST",
			data: { taskId: row.id }
		});
		ElMessage.warning(`已取消领取：${row.sku}`);
		await fetchMyTasks();
		await fetchPendingTasks();
	} catch (e) {
		console.error(e);
		ElMessage.error("取消领取失败");
	}
}

async function handleClaim(row: DesignTask) {
	try {
		await (service as any).app.design_task.request({
			url: "/shoot/take",
			method: "POST",
			data: { taskId: row.id }
		});
		ElMessage.success(`已领取：${row.sku}`);
		await fetchMyTasks();
		await fetchPendingTasks();
	} catch (e) {
		console.error(e);
		ElMessage.error("领取失败");
	}
}

function handleMySearch(keyword: string) {
	myKeyword.value = keyword;
	myPage.value = 1;
	fetchMyTasks();
}

function handleMySizeChange(size: number) {
	mySize.value = size;
	myPage.value = 1;
	fetchMyTasks();
}

function handleMyCurrentChange(page: number) {
	myPage.value = page;
	fetchMyTasks();
}

function handlePendingSearch(keyword: string) {
	pendingKeyword.value = keyword;
	pendingPage.value = 1;
	fetchPendingTasks();
}

function handlePendingSizeChange(size: number) {
	pendingSize.value = size;
	pendingPage.value = 1;
	fetchPendingTasks();
}

function handlePendingCurrentChange(page: number) {
	pendingPage.value = page;
	fetchPendingTasks();
}

onMounted(() => {
	fetchMyTasks();
	fetchPendingTasks();
});
onActivated(() => {
	fetchMyTasks();
	fetchPendingTasks();
});
</script>

<style scoped lang="scss">
.shoot-task-page {
	padding: 20px;
	background-color: #fff;
	min-height: 100%;
	box-sizing: border-box;
}

.tasks-container {
	display: flex;
	gap: 16px;
	align-items: stretch;
	height: calc(100vh - 120px);
	min-height: 0;
}

.section-card {
	border-radius: 6px;
	flex: 1;
	min-width: 0;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;

	:deep(.el-card__header) {
		flex-shrink: 0;
	}

	:deep(.el-card__body) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding-bottom: 12px;
	}
}

.section-header {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 15px;
	font-weight: 600;
}
</style>
