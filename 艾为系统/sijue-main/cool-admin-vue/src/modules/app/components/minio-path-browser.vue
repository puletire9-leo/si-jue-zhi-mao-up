<template>
	<div class="asset-path-browser" v-loading="loading">
		<!-- 路径条 -->
		<div class="mpb-bar">
			<el-breadcrumb separator="/" class="mpb-breadcrumb">
				<el-breadcrumb-item>
					<el-link
						type="primary"
						:underline="false"
						:disabled="!canGoAbove"
						@click="goTo(rootPath)"
					>
						{{ bucketLabel }}
					</el-link>
				</el-breadcrumb-item>
				<el-breadcrumb-item v-for="(seg, idx) in breadcrumbSegments" :key="idx">
					<el-link type="primary" :underline="false" @click="goTo(seg.path)">
						{{ seg.name }}
					</el-link>
				</el-breadcrumb-item>
			</el-breadcrumb>
			<div class="mpb-actions">
				<el-tooltip content="刷新当前目录" placement="top">
					<el-button size="small" :icon="Refresh" @click="refresh" />
				</el-tooltip>
				<el-tooltip
					v-if="canGoAbove && currentPath !== rootPath"
					content="返回上一级"
					placement="top"
				>
					<el-button size="small" :icon="ArrowUp" @click="goUp" />
				</el-tooltip>
			</div>
		</div>

		<!-- 错误提示 -->
		<div v-if="errorMsg" class="mpb-error">
			<el-alert :title="errorMsg" type="error" :closable="false" show-icon />
		</div>

		<!-- 空状态 -->
		<div
			v-else-if="!loading && !folders.length && !files.length"
			class="mpb-empty"
		>
			<el-empty :description="`目录为空：${currentPath || '/'}`" :image-size="60" />
		</div>

		<!-- 网格视图 -->
		<div v-else class="mpb-grid">
			<!-- 子目录 -->
			<div
				v-for="d in folders"
				:key="'d-' + d.path"
				class="mpb-card folder"
				@dblclick="goTo(d.path)"
				@click="folderActiveKey = d.path"
				:class="{ active: folderActiveKey === d.path }"
			>
				<div class="mpb-card-icon">
					<el-icon><Folder /></el-icon>
				</div>
				<div class="mpb-card-name" :title="d.name">{{ d.name }}</div>
				<div class="mpb-card-meta">目录</div>
				<el-button
					class="mpb-open-btn"
					link
					type="primary"
					size="small"
					@click.stop="goTo(d.path)"
				>进入</el-button>
			</div>

			<!-- 文件 -->
			<div
				v-for="f in files"
				:key="'f-' + f.key"
				class="mpb-card"
				:class="{ image: isImage(f.name) }"
				@click="previewFile(f)"
			>
				<div class="mpb-card-icon">
					<template v-if="isImage(f.name)">
						<img
							v-if="thumbs[f.key]"
							:src="thumbs[f.key]"
							class="mpb-thumb"
							alt=""
							@error="thumbs[f.key] = ''"
						/>
						<el-icon v-else class="loading-icon"><Picture /></el-icon>
					</template>
					<el-icon v-else><Document /></el-icon>
				</div>
				<div class="mpb-card-name" :title="f.name">{{ f.name }}</div>
				<div class="mpb-card-meta">
					{{ formatSize(f.size) }} · {{ formatTime(f.lastModified) }}
				</div>
				<div class="mpb-card-actions">
					<el-button
						v-if="isImage(f.name)"
						link
						type="primary"
						size="small"
						@click.stop="previewFile(f)"
					>预览</el-button>
					<el-button
						link
						type="primary"
						size="small"
						@click.stop="downloadFile(f)"
					>下载</el-button>
				</div>
			</div>
		</div>

		<!-- 加载更多 -->
		<div v-if="truncated" class="mpb-truncated">
			<el-text type="warning" size="small">
				当前目录条目较多，仅显示前 1000 项。如需完整列表请进入子目录或在浏览器中用专门工具查看。
			</el-text>
		</div>

		<!-- 图片大图预览 dialog -->
		<el-dialog
			v-model="imagePreviewVisible"
			:title="imagePreview.name"
			width="80%"
			append-to-body
			class="mpb-image-preview-dialog"
		>
			<div class="mpb-image-preview-wrap">
				<img v-if="imagePreview.url" :src="imagePreview.url" alt="" />
			</div>
			<template #footer>
				<el-button @click="imagePreviewVisible = false">关闭</el-button>
				<el-button type="primary" @click="downloadFile(imagePreview)">下载</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import {
	Folder,
	Document,
	Picture,
	Refresh,
	ArrowUp
} from "@element-plus/icons-vue";
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

const props = withDefaults(
	defineProps<{
		/** 起始路径（以 / 结尾，根目录传空串）*/
		path: string;
		/** 是否允许往上跳到根目录（默认 false，限制只能在 path 内浏览） */
		allowGoAbove?: boolean;
		/** 自动加载图片缩略图（默认 true）*/
		autoThumbnails?: boolean;
	}>(),
	{
		allowGoAbove: false,
		autoThumbnails: true
	}
);

const currentPath = ref("");
const folders = ref<AssetFolder[]>([]);
const files = ref<AssetFile[]>([]);
const truncated = ref(false);
const loading = ref(false);
const errorMsg = ref("");
const folderActiveKey = ref("");
const thumbs = ref<Record<string, string>>({});

const imagePreview = ref<{ name: string; key: string; url: string }>({
	name: "",
	key: "",
	url: ""
});
const imagePreviewVisible = ref(false);

const rootPath = computed(() => props.path || "");
const canGoAbove = computed(() => props.allowGoAbove);
const bucketLabel = computed(() => {
	if (props.allowGoAbove) return "素材库";
	// 不允许跳出 path 时，"根" 显示为初始 path 的最末段
	if (!rootPath.value) return "素材库";
	const segs = rootPath.value.replace(/\/$/, "").split("/");
	return segs[segs.length - 1] || rootPath.value;
});

const breadcrumbSegments = computed(() => {
	if (!currentPath.value || currentPath.value === rootPath.value) return [];
	// 显示从 rootPath 开始的相对路径
	const start = rootPath.value;
	const rel = currentPath.value.startsWith(start)
		? currentPath.value.slice(start.length)
		: currentPath.value;
	const segs = rel.split("/").filter(Boolean);
	const out: Array<{ name: string; path: string }> = [];
	let acc = start;
	for (const s of segs) {
		acc += s + "/";
		out.push({ name: s, path: acc });
	}
	return out;
});

watch(
	() => props.path,
	(p) => {
		if (p === undefined) return;
		goTo(p || "");
	}
);

onMounted(() => {
	if (props.path !== undefined) goTo(props.path || "");
});

async function goTo(targetPath: string) {
	const p = (targetPath || "").replace(/^\/+/, "");
	const normalized = !p ? "" : p.endsWith("/") ? p : p + "/";
	// 限制：不允许跳出 rootPath
	if (!props.allowGoAbove && rootPath.value && !normalized.startsWith(rootPath.value)) {
		// 如果用户尝试跳到 rootPath 之外，直接回到 rootPath
		return goTo(rootPath.value);
	}
	loading.value = true;
	errorMsg.value = "";
	thumbs.value = {};
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
		if (props.autoThumbnails) {
			loadThumbnails();
		}
	} catch (e: any) {
		errorMsg.value = e?.message || "加载目录失败";
		folders.value = [];
		files.value = [];
	} finally {
		loading.value = false;
	}
}

function goUp() {
	const cur = currentPath.value.replace(/\/$/, "");
	const idx = cur.lastIndexOf("/");
	const parent = idx >= 0 ? cur.slice(0, idx + 1) : "";
	goTo(parent);
}

function refresh() {
	goTo(currentPath.value);
}

async function loadThumbnails() {
	const imageFiles = files.value.filter((f) => isImage(f.name));
	if (!imageFiles.length) return;
	for (const f of imageFiles) {
		if (thumbs.value[f.key]) continue;
		try {
			// 缩略图：w=400，midway 端 sharp resize 成 webp 并落盘缓存
			const url = await sign(f.key, f.name, true, 400);
			if (url) {
				thumbs.value = { ...thumbs.value, [f.key]: url };
			}
		} catch {
			thumbs.value = { ...thumbs.value, [f.key]: "" };
		}
	}
}

async function previewFile(f: AssetFile) {
	if (!isImage(f.name)) {
		return downloadFile(f);
	}
	try {
		// 预览：拉个 1280px 的中等图（既不像缩略图模糊，又不至于直接拽原图）
		const url = await sign(f.key, f.name, true, 1280);
		imagePreview.value = { name: f.name, key: f.key, url };
		imagePreviewVisible.value = true;
	} catch (e: any) {
		ElMessage.error(e?.message || "预览失败");
	}
}

async function downloadFile(f: { name: string; key: string }) {
	try {
		// 下载：必须是原图，不传 width
		const url = await sign(f.key, f.name, false, 0);
		const a = document.createElement("a");
		a.href = url;
		a.target = "_blank";
		a.rel = "noopener";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	} catch (e: any) {
		ElMessage.error(e?.message || "下载失败");
	}
}

async function sign(
	key: string,
	filename: string,
	inline: boolean,
	width: number = 0
): Promise<string> {
	const r: any = await (service as any).app.asset.request({
		url: "/sign",
		method: "POST",
		data: { key, filename, inline, expiresIn: 3600, width }
	});
	const path = r?.url || "";
	if (!path) return "";
	// 后端返回 "/admin/app/asset/file?..." 是相对路径，
	// 必须拼上 cool 的 baseUrl（dev=/dev, prod=/api）走 vite/nginx 代理到 midway
	return (config.baseUrl || "") + path;
}

function isImage(name: string): boolean {
	return /\.(jpe?g|png|gif|webp|bmp|tiff|svg)$/i.test(name || "");
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

defineExpose({ refresh, goTo });
</script>

<style scoped lang="scss">
.asset-path-browser {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	background: var(--el-fill-color-blank);
	padding: 10px 12px;
	min-height: 180px;
}
.mpb-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	margin-bottom: 8px;
	flex-wrap: wrap;
}
.mpb-breadcrumb {
	flex: 1;
	min-width: 0;
	overflow-x: auto;
	white-space: nowrap;
	font-size: 13px;
}
.mpb-actions {
	display: flex;
	gap: 6px;
}
.mpb-error,
.mpb-empty {
	padding: 16px 8px;
}
.mpb-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: 10px;
}
.mpb-card {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	padding: 8px;
	cursor: pointer;
	transition: all 0.15s;
	background: var(--el-fill-color-light);
	&:hover {
		border-color: var(--el-color-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}
	&.active {
		border-color: var(--el-color-primary);
		background: var(--el-color-primary-light-9);
	}
	&.folder {
		.mpb-card-icon {
			color: var(--el-color-warning);
		}
	}
}
.mpb-card-icon {
	width: 100%;
	height: 80px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 36px;
	color: var(--el-text-color-secondary);
	margin-bottom: 6px;
	overflow: hidden;
	border-radius: 4px;
	background: var(--el-fill-color);
}
.mpb-thumb {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.loading-icon {
	opacity: 0.4;
}
.mpb-card-name {
	font-size: 12px;
	color: var(--el-text-color-primary);
	width: 100%;
	text-align: center;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	margin-bottom: 2px;
}
.mpb-card-meta {
	font-size: 11px;
	color: var(--el-text-color-placeholder);
	margin-bottom: 4px;
}
.mpb-card-actions {
	display: flex;
	gap: 4px;
}
.mpb-open-btn {
	position: absolute;
	top: 4px;
	right: 4px;
}
.mpb-truncated {
	margin-top: 10px;
	padding: 6px;
	text-align: center;
	background: var(--el-fill-color);
	border-radius: 4px;
}
.mpb-image-preview-dialog {
	:deep(.el-dialog__body) {
		padding-top: 0;
	}
}
.mpb-image-preview-wrap {
	max-height: 70vh;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: auto;
	img {
		max-width: 100%;
		max-height: 70vh;
		display: block;
	}
}
</style>
