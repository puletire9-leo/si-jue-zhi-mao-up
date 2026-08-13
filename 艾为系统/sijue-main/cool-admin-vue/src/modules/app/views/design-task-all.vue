<!-- http://localhost:9000/#/app/design-task-all -->
<template>
	<div class="design-task-all-page">
		<el-card class="section-card" shadow="never">
			<template #header>
				<div class="section-header">
					<span>全部美工任务</span>
					<el-tag type="info">{{ total }}</el-tag>
				</div>
			</template>

			<el-tabs v-model="statusTab" class="status-tabs">
				<el-tab-pane label="全部" name="all" />
				<el-tab-pane label="创建阶段" name="requirement" />
				<el-tab-pane label="拍摄阶段" name="shoot" />
				<el-tab-pane label="做图阶段" name="design" />
				<el-tab-pane label="已完成" name="finished" />
				<el-tab-pane label="已关闭" name="closed" />
			</el-tabs>

			<design-task-table
				:data="allTasks"
				:status-tag-type="statusTagType"
				:status-width="160"
				:action-width="160"
				:total="total"
				:current-page="page"
				:page-size="pageSize"
				@search="handleSearch"
				@size-change="handleSizeChange"
				@current-change="handleCurrentChange"
			>
				<template #action="{ row }">
					<el-button link type="primary" @click="handleView(row)">查看详情</el-button>
					<el-button
						v-if="row.statusCode === 509"
						link
						@click="reopenRequirementTask(row)"
					>
						重新打开图需任务
					</el-button>
					<el-button
						v-if="canRegenerateRequirement(row.statusCode)"
						link
						type="primary"
						@click="openRequirementDialog(row)"
					>
						重新生成图需
					</el-button>
				</template>
			</design-task-table>
		</el-card>

		<design-task-detail
			v-model="detailDialogVisible"
			:task-id="currentTaskId"
			@step-progress-change="handleStepProgressChange"
			@closed="fetchList"
		/>

		<design-requirement-regenerate-dialog ref="regenerateDialogRef" @success="fetchList" />
	</div>
</template>

<script setup lang="ts" name="app-design-task-all">
import { ref, watch, onMounted, onActivated } from "vue";
import { ElMessage } from "element-plus";
// @ts-ignore
import DesignTaskDetail from "./design-task-detail.vue";
// @ts-ignore
import DesignTaskTable, { type DesignTaskTableItem } from "/$/app/components/design-task-table.vue";
// @ts-ignore
import DesignRequirementRegenerateDialog from "../components/design-requirement-regenerate-dialog.vue";
import { designTaskStatusText, product_main_image_display_url } from "../utils";
import { service } from "/@/cool";

type DesignTask = DesignTaskTableItem;

const detailDialogVisible = ref(false);
const currentTaskId = ref<string | number>();
type StatusTab = "all" | "requirement" | "shoot" | "design" | "finished" | "closed";

const statusTab = ref<StatusTab>("all");
const regenerateDialogRef = ref<InstanceType<typeof DesignRequirementRegenerateDialog>>();

function handleStepProgressChange(payload: {
	taskId: number;
	stepDone: number;
	stepTotal: number;
}) {
	const row = allTasks.value.find((x) => x.id === payload.taskId);
	if (row) {
		row.progress = payload.stepTotal > 0 ? `${payload.stepDone}/${payload.stepTotal}` : "";
	}
}

function isPhotographerStatus(statusCode?: number) {
	const code = Number(statusCode ?? 0);
	return code >= 200 && code < 300;
}

/** 2xx 拍摄阶段或 509 已关闭：可在全部任务里重新生成图需 */
function canRegenerateRequirement(statusCode?: number) {
	const code = Number(statusCode ?? 0);
	return (code >= 200 && code < 300) || code === 509;
}

async function reopenRequirementTask(row: DesignTask) {
	try {
		await (service as any).app.design_task.request({
			url: "/design/reopen",
			method: "POST",
			data: { taskId: row.id }
		});
		ElMessage.success("已重新打开");
		fetchList();
	} catch (e: any) {
		ElMessage.error(e?.message ?? "重新打开失败");
	}
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
		updatedAt: String(row.updateTime || "")
	};
}

const allTasks = ref<DesignTask[]>([]);
const total = ref(0);
const keyword = ref("");
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);

function sceneForStatusTab(tab: StatusTab): string {
	if (tab === "requirement") return "requirement";
	if (tab === "shoot") return "shoot";
	if (tab === "design") return "design";
	if (tab === "finished") return "finished";
	if (tab === "closed") return "closed";
	return "all";
}

async function fetchList() {
	const api = (service as any).app?.design_task;
	if (!api?.pageByScene) return;
	loading.value = true;
	try {
		const res = await api.pageByScene({
			scene: sceneForStatusTab(statusTab.value),
			keyword: keyword.value || undefined,
			page: page.value,
			size: pageSize.value
		});
		const data = res?.data ?? res;
		const list: any[] = Array.isArray(data.list) ? data.list : [];
		allTasks.value = list.map(mapRowToTask);
		total.value = data.pagination?.total ?? 0;
	} finally {
		loading.value = false;
	}
}

watch(statusTab, () => {
	page.value = 1;
	fetchList();
});

function statusTagType(status: string) {
	if (status.includes("待领取")) return "warning";
	if (status.includes("确认")) return "info";
	if (status.includes("修图")) return "primary";
	if (status.includes("完成")) return "success";
	if (status.includes("关闭")) return "info";
	return "info";
}

function handleView(row: DesignTask) {
	currentTaskId.value = row.id;
	detailDialogVisible.value = true;
}

function openRequirementDialog(row: DesignTask) {
	regenerateDialogRef.value?.open(Number(row.id));
}

function handleSearch(k: string) {
	keyword.value = k;
	page.value = 1;
	fetchList();
}

function handleSizeChange(size: number) {
	pageSize.value = size;
	page.value = 1;
	fetchList();
}

function handleCurrentChange(p: number) {
	page.value = p;
	fetchList();
}

onMounted(() => fetchList());
onActivated(() => fetchList());
</script>

<style scoped lang="scss">
.design-task-all-page {
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

.status-tabs {
	margin-bottom: 12px;
}
</style>
