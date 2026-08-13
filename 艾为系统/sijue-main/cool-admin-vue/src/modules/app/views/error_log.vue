<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-multi-delete-btn />

			<el-button type="danger" @click="clearHandled">清理已处理/忽略</el-button>

			<cl-flex1 />

			<cl-filter label="来源">
				<cl-select prop="source" :width="120" :options="sourceOptions" clearable />
			</cl-filter>

			<cl-filter label="等级">
				<cl-select prop="level" :width="100" :options="levelOptions" clearable />
			</cl-filter>

			<cl-filter label="状态">
				<cl-select prop="handledStatus" :width="120" :options="handledOptions" clearable />
			</cl-filter>

			<cl-search-key placeholder="搜索消息、接口、模块、用户" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-level="{ scope }">
					<el-tag :type="levelTagType(scope.row.level)" size="small">
						{{ scope.row.level || "-" }}
					</el-tag>
				</template>

				<template #column-source="{ scope }">
					<el-tag size="small" effect="plain">
						{{ sourceText(scope.row.source) }}
					</el-tag>
				</template>

				<template #column-message="{ scope }">
					<span class="error-log-message">{{ scope.row.message || "-" }}</span>
				</template>

				<template #column-handledStatus="{ scope }">
					<el-tag :type="handledTagType(scope.row.handledStatus)" size="small">
						{{ handledText(scope.row.handledStatus) }}
					</el-tag>
				</template>

				<template #slot-btn="{ scope }">
					<el-button link type="primary" @click="showDetail(scope.row)">详情</el-button>
					<el-button
						v-if="scope.row.handledStatus !== 1"
						link
						type="success"
						@click="markHandled(scope.row, 1)"
					>
						已处理
					</el-button>
					<el-button
						v-if="scope.row.handledStatus !== 2"
						link
						type="warning"
						@click="markHandled(scope.row, 2)"
					>
						忽略
					</el-button>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>
	</cl-crud>

	<el-dialog v-model="detailVisible" title="错误详情" width="920px" class="error-log-dialog">
		<el-descriptions v-if="detailRow" :column="2" border>
			<el-descriptions-item label="来源">{{ sourceText(detailRow.source) }}</el-descriptions-item>
			<el-descriptions-item label="等级">{{ detailRow.level || "-" }}</el-descriptions-item>
			<el-descriptions-item label="模块">{{ detailRow.module || "-" }}</el-descriptions-item>
			<el-descriptions-item label="状态">
				{{ handledText(detailRow.handledStatus) }}
			</el-descriptions-item>
			<el-descriptions-item label="用户">{{ detailRow.userName || detailRow.userId || "-" }}</el-descriptions-item>
			<el-descriptions-item label="状态码">{{ detailRow.statusCode || "-" }}</el-descriptions-item>
			<el-descriptions-item label="方法">{{ detailRow.method || "-" }}</el-descriptions-item>
			<el-descriptions-item label="时间">{{ detailRow.createTime || "-" }}</el-descriptions-item>
			<el-descriptions-item label="地址" :span="2">{{ detailRow.url || "-" }}</el-descriptions-item>
			<el-descriptions-item label="消息" :span="2">{{ detailRow.message || "-" }}</el-descriptions-item>
			<el-descriptions-item label="处理备注" :span="2">
				{{ detailRow.handledRemark || "-" }}
			</el-descriptions-item>
		</el-descriptions>

		<el-tabs class="error-log-tabs">
			<el-tab-pane label="请求参数">
				<pre>{{ formatContent(detailRow?.requestParams) }}</pre>
			</el-tab-pane>
			<el-tab-pane label="返回内容">
				<pre>{{ formatContent(detailRow?.responseBody) }}</pre>
			</el-tab-pane>
			<el-tab-pane label="堆栈">
				<pre>{{ detailRow?.stack || "-" }}</pre>
			</el-tab-pane>
			<el-tab-pane label="额外信息">
				<pre>{{ formatContent(detailRow?.extra) }}</pre>
			</el-tab-pane>
		</el-tabs>
	</el-dialog>
</template>

<script lang="ts" name="app-error-log" setup>
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCool } from "/@/cool";
import { useCrud, useTable } from "@cool-vue/crud";

const { service } = useCool();
const errorLogService = (service.app as any).error_log;

const sourceOptions = [
	{ label: "前端", value: "frontend" },
	{ label: "后端", value: "backend" },
	{ label: "任务", value: "task" },
	{ label: "第三方", value: "third_party" }
];
const levelOptions = [
	{ label: "错误", value: "error" },
	{ label: "警告", value: "warn" },
	{ label: "信息", value: "info" }
];
const handledOptions = [
	{ label: "待处理", value: 0 },
	{ label: "已处理", value: 1 },
	{ label: "忽略", value: 2 }
];
const detailVisible = ref(false);
const detailRow = ref<any>(null);

const Table = useTable({
	contextMenu: ["refresh"],
	columns: [
		{ type: "selection" },
		{
			prop: "source",
			label: "来源",
			width: 100
		},
		{
			prop: "level",
			label: "等级",
			width: 90
		},
		{
			prop: "module",
			label: "模块",
			minWidth: 130,
			showOverflowTooltip: true
		},
		{
			prop: "message",
			label: "错误消息",
			minWidth: 260,
			showOverflowTooltip: true
		},
		{
			prop: "url",
			label: "地址",
			minWidth: 260,
			showOverflowTooltip: true
		},
		{
			prop: "method",
			label: "方法",
			width: 80
		},
		{
			prop: "statusCode",
			label: "状态码",
			width: 90
		},
		{
			prop: "userName",
			label: "用户",
			width: 120,
			showOverflowTooltip: true
		},
		{
			prop: "handledStatus",
			label: "处理状态",
			width: 100
		},
		{
			prop: "createTime",
			label: "时间",
			width: 160,
			sortable: "desc",
			component: { name: "cl-date-text" }
		},
		{
			type: "op",
			width: 230,
			buttons: ["slot-btn", "delete"]
		}
	]
});

const Crud = useCrud({ service: errorLogService }, (app) => {
	app.refresh();
});

function sourceText(value?: string) {
	return sourceOptions.find((item) => item.value === value)?.label || value || "-";
}

function levelTagType(value?: string) {
	if (value === "error") {
		return "danger";
	}

	if (value === "warn") {
		return "warning";
	}

	return "info";
}

function handledText(value?: number) {
	return handledOptions.find((item) => item.value === value)?.label || "待处理";
}

function handledTagType(value?: number) {
	if (value === 1) {
		return "success";
	}

	if (value === 2) {
		return "info";
	}

	return "danger";
}

function showDetail(row: any) {
	detailRow.value = row;
	detailVisible.value = true;
}

function formatContent(value: unknown) {
	if (!value) {
		return "-";
	}

	if (typeof value === "string") {
		try {
			return JSON.stringify(JSON.parse(value), null, 2);
		} catch (e) {
			return value;
		}
	}

	return JSON.stringify(value, null, 2);
}

async function markHandled(row: any, handledStatus: 1 | 2) {
	let handledRemark = handledStatus === 1 ? "已处理" : "忽略";

	if (handledStatus === 1) {
		const result = await ElMessageBox.prompt("可填写处理备注", "标记已处理", {
			inputType: "textarea",
			inputValue: "",
			confirmButtonText: "确认",
			cancelButtonText: "取消"
		}).catch(() => null);

		if (!result) {
			return;
		}

		handledRemark = result.value || handledRemark;
	} else {
		const result = await ElMessageBox.confirm("是否忽略这条错误日志？", "提示", {
			type: "warning"
		}).catch(() => null);

		if (!result) {
			return;
		}
	}

	await errorLogService.markHandled({
		ids: [row.id],
		handledStatus,
		handledRemark
	});

	ElMessage.success("已更新");
	Crud.value?.refresh();
}

function clearHandled() {
	ElMessageBox.confirm("是否清理已处理和已忽略的错误日志？", "提示", {
		type: "warning"
	})
		.then(() => errorLogService.clearHandled())
		.then((res: any) => {
			ElMessage.success(`已清理 ${res?.affected || 0} 条`);
			Crud.value?.refresh();
		})
		.catch(() => null);
}
</script>

<style lang="scss" scoped>
.error-log-message {
	color: var(--el-color-danger);
}

:global(.error-log-dialog) {
	pre {
		max-height: 360px;
		margin: 0;
		padding: 12px;
		overflow: auto;
		color: var(--el-text-color-primary);
		background: var(--el-fill-color-light);
		border: 1px solid var(--el-border-color-light);
		border-radius: 6px;
		white-space: pre-wrap;
		word-break: break-word;
	}
}

.error-log-tabs {
	margin-top: 16px;
}
</style>
