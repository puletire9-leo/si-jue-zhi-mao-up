<template>
	<el-dialog
		:model-value="visible"
		@update:modelValue="$emit('update:visible', $event)"
		title="选择素材路径"
		width="860px"
		:close-on-click-modal="false"
		append-to-body
		class="asset-path-picker"
	>
		<!-- 路径条 + 操作 -->
		<div class="mpp-toolbar">
			<el-breadcrumb separator="/" class="mpp-breadcrumb">
				<el-breadcrumb-item>
					<el-link type="primary" :underline="false" @click="goTo('')">素材库</el-link>
				</el-breadcrumb-item>
				<el-breadcrumb-item v-for="(seg, idx) in breadcrumbSegments" :key="idx">
					<el-link
						type="primary"
						:underline="false"
						@click="goTo(seg.path)"
					>{{ seg.name }}</el-link>
				</el-breadcrumb-item>
			</el-breadcrumb>

			<div class="mpp-actions">
				<el-input
					v-model="manualPath"
					placeholder="可粘贴 D:\comfyui共享\xxx 或相对路径"
					size="small"
					clearable
					style="width: 280px"
					@keyup.enter="goTo(normalizeInput(manualPath))"
				/>
				<el-button size="small" @click="goTo(normalizeInput(manualPath))">跳转</el-button>
				<el-button size="small" @click="refresh" :loading="loading">刷新</el-button>
			</div>
		</div>

		<!-- 选中状态条 -->
		<div class="mpp-selected">
			<span class="label">已选路径：</span>
			<span class="value" :class="{ empty: !pickedPath }">
				{{ pickedPath || "（尚未选择，请在下方点选目录或点「选择当前目录」）" }}
			</span>
			<el-button
				v-if="pickedPath"
				link
				size="small"
				type="info"
				@click="pickedPath = ''"
			>清除</el-button>
		</div>

		<!-- 内容区 -->
		<div class="mpp-body" v-loading="loading">
			<div v-if="errorMsg" class="mpp-error">
				<el-alert :title="errorMsg" type="error" :closable="false" show-icon />
			</div>

			<el-table
				v-else
				:data="combinedList"
				size="small"
				border
				height="420"
				highlight-current-row
				@row-click="handleRowClick"
				@row-dblclick="handleRowDblclick"
			>
				<el-table-column label="名称" min-width="320">
					<template #default="{ row }">
						<div class="mpp-name-cell">
							<el-icon v-if="row.type === 'folder'" class="folder-icon">
								<Folder />
							</el-icon>
							<el-icon v-else class="file-icon">
								<Document />
							</el-icon>
							<span :class="{ 'is-folder': row.type === 'folder' }">{{ row.name }}</span>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="类型" width="80" align="center">
					<template #default="{ row }">
						<el-tag v-if="row.type === 'folder'" size="small" type="warning">目录</el-tag>
						<el-tag v-else size="small" type="info">文件</el-tag>
					</template>
				</el-table-column>
				<el-table-column label="大小" width="110" align="right">
					<template #default="{ row }">
						<span v-if="row.type === 'file'">{{ formatSize(row.size) }}</span>
						<span v-else>—</span>
					</template>
				</el-table-column>
				<el-table-column label="修改时间" width="170">
					<template #default="{ row }">
						<span v-if="row.lastModified">{{ formatTime(row.lastModified) }}</span>
						<span v-else>—</span>
					</template>
				</el-table-column>
				<el-table-column label="操作" width="100" align="center">
					<template #default="{ row }">
						<el-button
							v-if="row.type === 'folder'"
							link
							type="primary"
							size="small"
							@click.stop="goTo(row.path)"
						>进入</el-button>
						<el-button
							v-else
							link
							type="primary"
							size="small"
							@click.stop="preview(row)"
						>预览</el-button>
					</template>
				</el-table-column>
			</el-table>

			<div v-if="truncated" class="mpp-truncated">
				<el-text type="warning" size="small">
					当前目录条目较多，仅显示前 1000 项。请进入更深层目录或用手动跳转。
				</el-text>
			</div>
		</div>

		<template #footer>
			<div class="mpp-footer">
				<el-button @click="$emit('update:visible', false)">取消</el-button>
				<el-button
					type="success"
					@click="pickCurrent"
					:disabled="loading || !!errorMsg"
				>
					选择当前目录: {{ currentPath || "/" }}
				</el-button>
				<el-button
					type="primary"
					:disabled="!pickedPath"
					@click="confirm"
				>确定</el-button>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { ElMessage } from "element-plus";
import { Folder, Document } from "@element-plus/icons-vue";
import {
	normalizeAssetUploadPath,
	toAssetUploadDirectoryPath
} from "../utils/asset-upload-paths";
import { service } from "/@/cool";
import { config } from "/@/config";
import dayjs from "dayjs";

interface AssetFolder {
	name: string;
	path: string;
}
interface AssetFile {
	name: string;
	key: string;
	size: number;
	lastModified: string | null;
}
interface CombinedItem {
	type: "folder" | "file";
	name: string;
	path?: string;
	key?: string;
	size?: number;
	lastModified?: string | null;
}

const props = defineProps<{
	visible: boolean;
	/** 初始打开时定位的路径（必须以 '/' 结尾，根目录传空串） */
	initialPath?: string;
	/** 仅允许选择目录，false 时也允许选择文件 key（默认 true） */
	folderOnly?: boolean;
}>();

const emit = defineEmits<{
	(e: "update:visible", v: boolean): void;
	(e: "confirm", path: string): void;
}>();

const currentPath = ref(""); // 当前所在目录（始终以 / 结尾，或为空串=根）
const folders = ref<AssetFolder[]>([]);
const files = ref<AssetFile[]>([]);
const truncated = ref(false);
const loading = ref(false);
const errorMsg = ref("");
const manualPath = ref("");
const pickedPath = ref("");

const breadcrumbSegments = computed(() => {
	if (!currentPath.value) return [];
	const segs = currentPath.value.split("/").filter(Boolean);
	const out: Array<{ name: string; path: string }> = [];
	let acc = "";
	for (const s of segs) {
		acc += s + "/";
		out.push({ name: s, path: acc });
	}
	return out;
});

const combinedList = computed<CombinedItem[]>(() => {
	const f: CombinedItem[] = folders.value.map((d) => ({
		type: "folder",
		name: d.name,
		path: d.path
	}));
	const fl: CombinedItem[] = files.value.map((x) => ({
		type: "file",
		name: x.name,
		key: x.key,
		size: x.size,
		lastModified: x.lastModified
	}));
	return [...f, ...fl];
});

watch(
	() => props.visible,
	(v) => {
		if (v) {
			const start = props.initialPath || "";
			currentPath.value = "";
			pickedPath.value = start;
			manualPath.value = start;
			goTo(start);
		}
	}
);

async function goTo(targetPath: string) {
	const p = (targetPath || "").replace(/^\/+/, "");
	const normalized = !p ? "" : p.endsWith("/") ? p : p + "/";
	loading.value = true;
	errorMsg.value = "";
	try {
		const r: any = await (service as any).app.asset.request({
			url: "/list",
			method: "POST",
			data: { prefix: normalized }
		});
		currentPath.value = r?.prefix || "";
		folders.value = r?.folders || [];
		files.value = r?.files || [];
		truncated.value = !!r?.truncated;
		manualPath.value = currentPath.value;
		await nextTick();
	} catch (e: any) {
		errorMsg.value = e?.message || "素材库列目录失败，检查 dufs/frpc 是否就绪";
		folders.value = [];
		files.value = [];
	} finally {
		loading.value = false;
	}
}

function refresh() {
	goTo(currentPath.value);
}

function handleRowClick(row: CombinedItem) {
	if (row.type === "folder" && row.path) {
		pickedPath.value = row.path;
	} else if (row.type === "file" && !props.folderOnly && row.key) {
		pickedPath.value = row.key;
	}
}

function handleRowDblclick(row: CombinedItem) {
	if (row.type === "folder" && row.path) {
		goTo(row.path);
	}
}

function pickCurrent() {
	pickedPath.value = currentPath.value;
}

async function preview(row: CombinedItem) {
	if (!row.key) return;
	try {
		const r: any = await (service as any).app.asset.request({
			url: "/sign",
			method: "POST",
			data: { key: row.key, filename: row.name, inline: true, width: 1280 }
		});
		if (r?.url) {
			window.open((config.baseUrl || "") + r.url, "_blank");
		}
	} catch (e: any) {
		ElMessage.error(e?.message || "预览失败");
	}
}

function confirm() {
	if (!pickedPath.value) {
		ElMessage.warning("请先选择一个路径");
		return;
	}
	emit("confirm", pickedPath.value);
	emit("update:visible", false);
}

function normalizeInput(s: string): string {
	const relative = normalizeAssetUploadPath(s);
	return relative ? toAssetUploadDirectoryPath(relative) : "";
}

function formatSize(b: number): string {
	if (!Number.isFinite(b) || b <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let i = 0;
	let v = b;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTime(s: string | null): string {
	if (!s) return "—";
	return dayjs(s).format("YYYY-MM-DD HH:mm");
}
</script>

<style scoped lang="scss">
.asset-path-picker {
	:deep(.el-dialog__body) {
		padding-top: 8px;
	}
}
.mpp-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 4px 0 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	margin-bottom: 10px;
	flex-wrap: wrap;
}
.mpp-breadcrumb {
	flex: 1;
	min-width: 0;
	overflow-x: auto;
	white-space: nowrap;
}
.mpp-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}
.mpp-selected {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	margin-bottom: 10px;
	background: var(--el-fill-color-light);
	border-radius: 6px;
	font-size: 13px;
	.label {
		color: var(--el-text-color-secondary);
	}
	.value {
		color: var(--el-color-success);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		word-break: break-all;
		flex: 1;
		min-width: 0;
		&.empty {
			color: var(--el-text-color-placeholder);
		}
	}
}
.mpp-body {
	min-height: 300px;
}
.mpp-error {
	padding: 24px 12px;
}
.mpp-name-cell {
	display: flex;
	align-items: center;
	gap: 6px;
	.folder-icon {
		color: var(--el-color-warning);
	}
	.file-icon {
		color: var(--el-color-info);
	}
	.is-folder {
		color: var(--el-color-primary);
		font-weight: 500;
	}
}
.mpp-truncated {
	margin-top: 8px;
	text-align: center;
}
.mpp-footer {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
