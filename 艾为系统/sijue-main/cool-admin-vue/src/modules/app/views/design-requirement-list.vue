<!-- http://localhost:9000/#/app/design-requirement-list -->
<template>
	<div class="requirement-page">
		<el-card class="section-card" shadow="never">
			<template #header>
				<div class="section-header">
					<span>创建图需列表-beta</span>
					<el-tag type="info">{{ total }}</el-tag>
				</div>
			</template>

			<div class="page-filters">
				<el-select
					v-model="candidateCreatedWithin"
					class="filter-select filter-select--created-within"
					@change="onCandidateCreatedWithinChange"
				>
					<el-option
						v-for="opt in candidateCreatedWithinOptions"
						:key="opt.value"
						:label="opt.label"
						:value="opt.value"
					/>
				</el-select>
				<el-select
					v-model="relationFilters.shops"
					multiple
					filterable
					collapse-tags
					collapse-tags-tooltip
					clearable
					class="filter-select"
					placeholder="筛选店铺"
					@change="applyRelationFilters"
				>
					<el-option
						v-for="shop in shopOptions"
						:key="shop"
						:label="shop"
						:value="shop"
					/>
				</el-select>
				<el-select
					v-model="relationFilters.submitters"
					multiple
					filterable
					collapse-tags
					collapse-tags-tooltip
					clearable
					class="filter-select"
					placeholder="筛选运营"
					@change="applyRelationFilters"
				>
					<el-option
						v-for="submitter in submitterOptions"
						:key="submitter"
						:label="submitter"
						:value="submitter"
					/>
				</el-select>
				<el-button type="primary" @click="applyRelationFilters">查询</el-button>
				<el-button @click="resetRelationFilters">重置</el-button>
			</div>

			<design-task-table
				:data="pageTasks"
				show-required-languages
				:status-tag-type="statusTagType"
				:status-width="140"
				:action-width="140"
				:total="total"
				:current-page="page"
				:page-size="pageSize"
				@search="handleSearch"
				@size-change="handleSizeChange"
				@current-change="handleCurrentChange"
			>
				<template #action="{ row }">
					<el-button
						v-if="row.statusCode === 101"
						link
						:type="row.isTooNew ? 'info' : 'primary'"
						@click="handleGenerateClick(row)"
					>
						AI生成图需
					</el-button>
					<el-button
						v-else-if="row.canRegenerateAiRequirement"
						link
						type="warning"
						@click="handleGenerateClick(row)"
					>
						重新生成图需
					</el-button>
					<el-button
						v-if="row.statusCode === 103"
						link
						type="primary"
						@click="handleReview(row)"
					>
						审核图需
					</el-button>
					<el-button
						v-if="row.statusCode === 103"
						link
						@click="openRequirementDialog(row)"
					>
						生成图需
					</el-button>
					<el-button
						v-if="[101, 102, 103].includes(row.statusCode)"
						link
						type="danger"
						@click="openCloseConfirm(row)"
					>
						关闭图需任务
					</el-button>
				</template>
			</design-task-table>
		</el-card>

		<design-task-too-new-dialog v-model="tooNewDialogVisible" @confirm="onTooNewConfirm" />

		<el-dialog v-model="closeConfirmVisible" title="确认" width="400px" align-center>
			<div style="padding: 8px 0; color: #606266">确定关闭任务吗？</div>
			<template #footer>
				<el-button @click="closeConfirmVisible = false">取消</el-button>
				<el-button type="danger" @click="confirmCloseTask">确定关闭</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="taskDialogVisible" title="AI任务信息" width="720px" align-center>
			<div v-loading="taskDialogLoading" class="task-dialog">
				<el-descriptions :column="2" border>
					<el-descriptions-item label="任务ID">
						{{ taskInfo?.id ?? "-" }}
					</el-descriptions-item>
					<el-descriptions-item label="状态">
						<el-tag :type="taskInfo?.status === 1 ? 'success' : 'info'">
							{{ taskInfo?.status === 1 ? "运行中" : "已停止" }}
						</el-tag>
					</el-descriptions-item>
					<el-descriptions-item label="开始时间">
						{{ taskInfo?.startDate || taskInfo?.createTime || "-" }}
					</el-descriptions-item>
					<el-descriptions-item label="执行服务" :span="2">
						{{ taskInfo?.service || "-" }}
					</el-descriptions-item>
					<el-descriptions-item label="参数" :span="2">
						<pre class="task-data">{{ taskInfo?.data || "-" }}</pre>
					</el-descriptions-item>
				</el-descriptions>
			</div>
			<template #footer>
				<el-button @click="taskDialogVisible = false">关闭</el-button>
			</template>
		</el-dialog>

		<design-requirement-regenerate-dialog ref="regenerateDialogRef" @success="fetchList" />

		<!-- 任务详情模态框 -->
		<design-task-detail
			v-model="detailDialogVisible"
			:task-id="currentTaskId"
			@step-progress-change="handleStepProgressChange"
			@closed="fetchList"
		/>
	</div>
</template>

<script setup lang="ts" name="app-design-requirement-list">
import { computed, ref, onMounted, onActivated } from "vue";
import { ElMessage } from "element-plus";
// @ts-ignore
import DesignTaskTable, { type DesignTaskTableItem } from "../components/design-task-table.vue";
// @ts-ignore
import DesignTaskDetail from "./design-task-detail.vue";
// @ts-ignore
import DesignRequirementRegenerateDialog from "../components/design-requirement-regenerate-dialog.vue";
import DesignTaskTooNewDialog from "../components/design-task-too-new-dialog.vue";
import { designTaskStatusText, product_main_image_display_url } from "../utils";
import {
	evaluateDesignTaskTooNew,
	isDesignRequirementAiRegenerable
} from "../utils/design-task-too-new";
import { normalizeRequiredLanguages } from "../utils/listing-ai-required-languages";
import { service } from "/@/cool";

type RequirementTask = DesignTaskTableItem;

const candidateCreatedWithinOptions = [
	{ label: "选品创建时间：1个月内", value: "1" },
	{ label: "选品创建时间：2个月内", value: "2" },
	{ label: "选品创建时间：3个月内", value: "3" },
	{ label: "选品创建时间：4个月内", value: "4" },
	{ label: "选品创建时间：5个月内", value: "5" },
	{ label: "选品创建时间：6个月内", value: "6" },
	{ label: "选品创建时间：今年", value: "year" },
	{ label: "选品创建时间：全部", value: "all" }
] as const;

const candidateCreatedWithin = ref<(typeof candidateCreatedWithinOptions)[number]["value"]>("1");

const tasks = ref<RequirementTask[]>([]);
const total = ref(0);
const keyword = ref("");
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const relationFilters = ref({
	shops: [] as string[],
	submitters: [] as string[]
});
const shopOptions = ref<string[]>([]);
const submitterOptions = ref<string[]>([]);
const tooNewDialogVisible = ref(false);
const tooNewDialogRow = ref<RequirementTask | null>(null);
const closeConfirmVisible = ref(false);
const closeConfirmRow = ref<RequirementTask | null>(null);

const pageTasks = computed(() => {
	if (tasks.value.length <= pageSize.value) return tasks.value;
	const start = (page.value - 1) * pageSize.value;
	return tasks.value.slice(start, start + pageSize.value);
});

function mapRowToTask(row: any): RequirementTask {
	const statusCode = Number(row.status);
	const total = Number(row.step_total ?? 0);
	const done = Number(row.step_done ?? 0);
	const isTooNew = evaluateDesignTaskTooNew({
		statusCode,
		createTime: row.createTime
	}).tooNew;
	const canRegenerateAiRequirement = isDesignRequirementAiRegenerable({
		statusCode,
		updateTime: row.updateTime
	});
	return {
		id: row.id,
		sku: row.sku ?? row.asin ?? "",
		name: row.produce_name ?? "",
		shop: row.shop ?? "",
		submitter: row.submitter ?? "",
		shopList: Array.isArray(row.shop_list) ? row.shop_list : [],
		submitterList: Array.isArray(row.submitter_list) ? row.submitter_list : [],
		status: designTaskStatusText(statusCode),
		statusCode,
		aiTaskId: row.ai_task_id ? Number(row.ai_task_id) : undefined,
		image: product_main_image_display_url(row.image_url),
		progress: total > 0 ? `${done}/${total}` : "",
		updatedAt: String(row.updateTime || ""),
		isTooNew,
		canRegenerateAiRequirement,
		requiredLanguages: normalizeRequiredLanguages(
			row.required_languages ?? row.requiredLanguages
		)
	};
}

async function fetchList() {
	const api = (service as any).app?.design_task;
	if (!api?.pageByScene) return;
	loading.value = true;
	try {
		const res = await api.pageByScene({
			scene: "requirement",
			keyword: keyword.value || undefined,
			shop: relationFilters.value.shops.join(",") || undefined,
			submitter: relationFilters.value.submitters.join(",") || undefined,
			candidateCreatedWithin: candidateCreatedWithin.value,
			page: page.value,
			size: pageSize.value
		});
		const data = res?.data ?? res;
		const list: any[] = Array.isArray(data.list) ? data.list : [];
		tasks.value = list.map(mapRowToTask);
		total.value = data.pagination?.total ?? 0;
	} finally {
		loading.value = false;
	}
}

async function fetchFilterOptions() {
	const res = await (service as any).request({
		url: "/admin/app/design_task/pageBySceneFilters",
		method: "GET",
		params: {
			scene: "requirement",
			candidateCreatedWithin: candidateCreatedWithin.value
		}
	});
	const data = res?.data ?? res;
	shopOptions.value = Array.isArray(data?.shops) ? data.shops : [];
	submitterOptions.value = Array.isArray(data?.submitters) ? data.submitters : [];
}

function applyRelationFilters() {
	page.value = 1;
	void fetchList();
}

function onCandidateCreatedWithinChange() {
	page.value = 1;
	void fetchFilterOptions();
	void fetchList();
}

function resetRelationFilters() {
	relationFilters.value.shops = [];
	relationFilters.value.submitters = [];
	candidateCreatedWithin.value = "1";
	page.value = 1;
	void fetchFilterOptions();
	void fetchList();
}

onMounted(() => {
	fetchFilterOptions();
	fetchList();
});
onActivated(() => {
	fetchFilterOptions();
	fetchList();
});

const detailDialogVisible = ref(false);
const currentTaskId = ref<string | number>();
const regenerateDialogRef = ref<InstanceType<typeof DesignRequirementRegenerateDialog>>();
const taskDialogVisible = ref(false);
const taskDialogLoading = ref(false);
const taskInfo = ref<any>(null);

function handleStepProgressChange(payload: {
	taskId: number;
	stepDone: number;
	stepTotal: number;
}) {
	const row = tasks.value.find((x) => x.id === payload.taskId);
	if (row) {
		row.progress = payload.stepTotal > 0 ? `${payload.stepDone}/${payload.stepTotal}` : "";
	}
}

async function openAiTask(taskId: number) {
	if (!taskId || !(service as any).task?.info?.info) return;
	taskDialogVisible.value = true;
	taskDialogLoading.value = true;
	try {
		const res = await (service as any).task.info.info({ id: taskId });
		const data = res?.data ?? res;
		taskInfo.value = data;
	} catch (e) {
		console.error(e);
		ElMessage.error("获取任务信息失败");
		taskInfo.value = null;
	} finally {
		taskDialogLoading.value = false;
	}
}


function statusTagType(status: string) {
	if (status.includes("待")) return "warning";
	if (status.includes("完成")) return "success";
	return "info";
}

function handleGenerateClick(row: RequirementTask) {
	if (row.isTooNew) {
		tooNewDialogRow.value = row;
		tooNewDialogVisible.value = true;
		return;
	}
	openRequirementDialog(row);
}

function onTooNewConfirm() {
	const row = tooNewDialogRow.value;
	if (row) {
		openRequirementDialog(row);
	}
	tooNewDialogVisible.value = false;
	tooNewDialogRow.value = null;
}

function openRequirementDialog(row: RequirementTask) {
	regenerateDialogRef.value?.open(Number(row.id));
}

function openCloseConfirm(row: RequirementTask) {
	closeConfirmRow.value = row;
	closeConfirmVisible.value = true;
}

async function confirmCloseTask() {
	const row = closeConfirmRow.value;
	if (!row) return;
	try {
		await (service as any).app.design_task.request({
			url: "/design/close",
			method: "POST",
			data: { taskId: row.id }
		});
		ElMessage.success("已关闭");
		closeConfirmVisible.value = false;
		closeConfirmRow.value = null;
		fetchList();
	} catch (e: any) {
		ElMessage.error(e?.message ?? "关闭失败");
	}
}

function handleReview(row: RequirementTask) {
	currentTaskId.value = row.id;
	detailDialogVisible.value = true;
}

function handleSearch(kw: string) {
	keyword.value = kw;
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
</script>

<style scoped lang="scss">
.requirement-page {
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

.page-filters {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin-bottom: 16px;
}

.filter-select {
	width: 260px;
	max-width: 100%;

	&--created-within {
		width: 220px;
	}
}

.task-data {
	white-space: pre-wrap;
	word-break: break-all;
	background: #f7f7f7;
	padding: 8px 10px;
	border-radius: 4px;
	font-size: 12px;
	line-height: 1.4;
	margin: 0;
}

</style>
