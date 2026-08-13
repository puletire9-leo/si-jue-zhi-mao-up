<template>
	<div
		class="resilient-product-image"
		:class="{
			'is-loaded': loadStatus === 'loaded',
			'is-failed': loadStatus === 'failed'
		}"
		:style="containerStyle"
		@mouseenter="handleMouseEnter"
	>
		<el-image
			v-if="currentSrc && loadStatus !== 'failed'"
			:key="currentSrc"
			class="resilient-product-image__img"
			:src="currentSrc"
			:alt="alt"
			:fit="fit"
			:preview-src-list="normalizedPreviewSrcList"
			:hide-on-click-modal="hideOnClickModal"
			:preview-teleported="previewTeleported"
			:z-index="zIndex"
			:initial-index="initialIndex"
			:referrerpolicy="referrerpolicy || referrerPolicy"
			:lazy="lazy"
			:loading="loading"
			:scroll-container="scrollContainer"
			:decoding="decoding"
			@load="handleLoad"
			@error="handleError"
			@show="handleShow"
		>
			<template #placeholder>
				<div class="resilient-product-image__inline-status">{{ loadingText }}</div>
			</template>
			<template #error>
				<slot name="error">
					<div class="resilient-product-image__inline-status">{{ loadingText }}</div>
				</slot>
			</template>
		</el-image>
		<div v-if="showStatus" class="resilient-product-image__status">
			<slot v-if="loadStatus === 'failed'" name="error">{{ failedText }}</slot>
			<template v-else>{{ loadingText }}</template>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
	buildImageRetryUrl,
	enqueueImagePreload,
	getImageRetryDelay,
	stripImageRetryParams,
	type ImageLoadPriority
} from "/@/cool/utils/image-loading";

type LoadStatus = "idle" | "loading" | "loaded" | "failed";

const props = withDefaults(
	defineProps<{
		src?: string;
		alt?: string;
		width?: string;
		height?: string;
		fit?: "contain" | "cover" | "fill" | "none" | "scale-down";
		priority?: ImageLoadPriority;
		retryWindowMs?: number;
		loadingText?: string;
		failedText?: string;
		previewSrcList?: string[];
		hideOnClickModal?: boolean;
		previewTeleported?: boolean;
		zIndex?: number;
		initialIndex?: number;
		referrerpolicy?: string;
		referrerPolicy?: string;
		lazy?: boolean;
		loading?: "eager" | "lazy";
		scrollContainer?: string;
		decoding?: "sync" | "async" | "auto";
		stalledRetryMs?: number;
	}>(),
	{
		src: "",
		alt: "",
		width: "",
		height: "",
		fit: "contain",
		priority: "visible",
		retryWindowMs: 5 * 60 * 1000,
		loadingText: "正在加载",
		failedText: "加载超时",
		previewSrcList: () => [],
		hideOnClickModal: false,
		previewTeleported: false,
		zIndex: 2000,
		initialIndex: 0,
		referrerpolicy: "",
		referrerPolicy: "",
		lazy: false,
		loading: "eager",
		scrollContainer: "",
		decoding: "async",
		stalledRetryMs: 10000
	}
);

const emit = defineEmits<{
	(event: "mouseenter", value: MouseEvent): void;
	(event: "load"): void;
	(event: "error"): void;
	(event: "show"): void;
}>();

const baseSrc = ref("");
const currentSrc = ref("");
const loadStatus = ref<LoadStatus>("idle");
const firstErrorAt = ref(0);
const retryCount = ref(0);
const retryTimer = ref<number>();
const stalledRetryTimer = ref<number>();

const containerStyle = computed(() => ({
	...(props.width ? { width: props.width } : {}),
	...(props.height ? { height: props.height } : {})
}));

const normalizedPreviewSrcList = computed(() => {
	return props.previewSrcList?.length ? props.previewSrcList : [];
});

const showStatus = computed(() => loadStatus.value !== "loaded");

function clearRetryTimer() {
	if (retryTimer.value) {
		window.clearTimeout(retryTimer.value);
		retryTimer.value = undefined;
	}
}

function clearLoadingWatchdog() {
	if (stalledRetryTimer.value) {
		window.clearTimeout(stalledRetryTimer.value);
		stalledRetryTimer.value = undefined;
	}
}

function clearImageTimers() {
	clearRetryTimer();
	clearLoadingWatchdog();
}

function scheduleLoadingWatchdog() {
	clearLoadingWatchdog();

	if (
		!baseSrc.value ||
		loadStatus.value !== "loading" ||
		typeof window === "undefined" ||
		props.stalledRetryMs <= 0
	) {
		return;
	}

	stalledRetryTimer.value = window.setTimeout(() => {
		stalledRetryTimer.value = undefined;
		if (loadStatus.value === "loading") {
			scheduleRetry("retry");
		}
	}, props.stalledRetryMs);
}

function resetImage(rawSrc: string) {
	clearImageTimers();
	const normalized = String(rawSrc || "").trim();
	baseSrc.value = normalized ? stripImageRetryParams(normalized) : "";
	currentSrc.value = normalized;
	firstErrorAt.value = 0;
	retryCount.value = 0;
	loadStatus.value = normalized ? "loading" : "idle";

	if (normalized) {
		void enqueueImagePreload(normalized, {
			priority: props.priority,
			reason: "resilient-product-image"
		});
	}

	scheduleLoadingWatchdog();
}

function scheduleRetry(priority: ImageLoadPriority) {
	if (!baseSrc.value || typeof window === "undefined") return;

	const now = Date.now();
	if (!firstErrorAt.value) firstErrorAt.value = now;

	if (now - firstErrorAt.value >= props.retryWindowMs) {
		clearImageTimers();
		loadStatus.value = "failed";
		emit("error");
		return;
	}

	clearRetryTimer();
	clearLoadingWatchdog();
	loadStatus.value = "loading";
	retryCount.value += 1;
	void enqueueImagePreload(baseSrc.value, {
		priority,
		reason: priority === "hover" ? "resilient-product-image:hover" : "resilient-product-image:retry"
	});

	retryTimer.value = window.setTimeout(() => {
		if (loadStatus.value !== "loading" || !baseSrc.value) return;
		currentSrc.value = buildImageRetryUrl(baseSrc.value, retryCount.value);
		scheduleLoadingWatchdog();
	}, priority === "hover" ? 0 : getImageRetryDelay(retryCount.value));
}

function handleLoad() {
	clearImageTimers();
	loadStatus.value = "loaded";
	emit("load");
}

function handleError() {
	scheduleRetry("retry");
}

function handleMouseEnter(event: MouseEvent) {
	emit("mouseenter", event);
	if (loadStatus.value !== "loaded" && loadStatus.value !== "failed") {
		scheduleRetry("hover");
	}
}

function handleShow() {
	emit("show");
}

watch(
	() => props.src,
	(value) => resetImage(value),
	{ immediate: true }
);

onBeforeUnmount(clearImageTimers);
</script>

<style lang="scss" scoped>
.resilient-product-image {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	border-radius: 4px;
	background: #f8fafc;
	border: 1px solid #e5e7eb;
	cursor: pointer;
}

.resilient-product-image__img {
	display: block;
	width: 100%;
	height: 100%;
}

.resilient-product-image__img :deep(.el-image__inner) {
	width: 100%;
	height: 100%;
}

.resilient-product-image__status {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 4px;
	text-align: center;
	font-size: 12px;
	line-height: 1.3;
	color: #64748b;
	background: rgba(248, 250, 252, 0.86);
	pointer-events: none;
}

.resilient-product-image__inline-status {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 4px;
	text-align: center;
	font-size: 12px;
	line-height: 1.3;
	color: #64748b;
	background: rgba(248, 250, 252, 0.86);
}

.resilient-product-image.is-failed .resilient-product-image__status {
	color: #c2410c;
	background: #fff7ed;
}
</style>
