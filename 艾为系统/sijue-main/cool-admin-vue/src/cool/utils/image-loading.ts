export type ImageLoadPriority = "hover" | "visible" | "retry" | "detail" | "prefetch";
export type ImageLoadResult = "loaded" | "abandoned" | "skipped";

interface ImageLoadingOptions {
	concurrency?: number;
	retryWindowMs?: number;
}

interface EnqueueImageOptions {
	priority?: ImageLoadPriority;
	reason?: string;
}

interface QueueTask {
	url: string;
	loadUrl: string;
	priority: ImageLoadPriority;
	score: number;
	sequence: number;
	retryCount: number;
	firstQueuedAt: number;
	promise: Promise<ImageLoadResult>;
	resolve: (result: ImageLoadResult) => void;
	reason?: string;
}

interface DomImageRetryState {
	baseUrl: string;
	firstErrorAt: number;
	retryCount: number;
	timer?: number;
}

const RETRY_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_CONCURRENCY = 6;
const RETRY_PARAM = "_img_retry";
const RETRY_TS_PARAM = "_img_retry_ts";

const PRIORITY_SCORE: Record<ImageLoadPriority, number> = {
	hover: 0,
	visible: 10,
	retry: 15,
	detail: 20,
	prefetch: 30
};

let globalQueue: ImagePreloadQueue | undefined;
let globalOptimizerInstalled = false;
let domObserver: MutationObserver | undefined;

function isBrowser() {
	return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizeImageUrl(value: unknown) {
	return String(value || "").trim();
}

function isLoadableImageUrl(url: string) {
	if (!url) return false;

	const lower = url.toLowerCase();
	return !lower.startsWith("data:") && !lower.startsWith("blob:");
}

export function getImageRetryDelay(retryCount: number) {
	const safeRetryCount = Math.max(1, retryCount);
	return Math.min(10000, 1000 * Math.pow(2, safeRetryCount - 1));
}

export function stripImageRetryParams(rawUrl: string) {
	const url = normalizeImageUrl(rawUrl);
	if (!url) return "";

	try {
		const parsed = new URL(url, isBrowser() ? window.location.href : "http://localhost");
		parsed.searchParams.delete(RETRY_PARAM);
		parsed.searchParams.delete(RETRY_TS_PARAM);
		return parsed.href;
	} catch {
		return url
			.replace(new RegExp(`([?&])${RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
			.replace(new RegExp(`([?&])${RETRY_TS_PARAM}=[^&#]*&?`, "g"), "$1")
			.replace(/[?&]$/, "");
	}
}

export function buildImageRetryUrl(rawUrl: string, retryCount: number, now = Date.now()) {
	const url = stripImageRetryParams(rawUrl);
	if (!url) return "";

	try {
		const parsed = new URL(url, isBrowser() ? window.location.href : "http://localhost");
		parsed.searchParams.set(RETRY_PARAM, String(retryCount));
		parsed.searchParams.set(RETRY_TS_PARAM, String(now));
		return parsed.href;
	} catch {
		const separator = url.includes("?") ? "&" : "?";
		return `${url}${separator}${RETRY_PARAM}=${retryCount}&${RETRY_TS_PARAM}=${now}`;
	}
}

export class ImagePreloadQueue {
	private readonly concurrency: number;
	private readonly retryWindowMs: number;
	private readonly queue: QueueTask[] = [];
	private readonly queuedByUrl = new Map<string, QueueTask>();
	private readonly trackedByUrl = new Map<string, QueueTask>();
	private readonly loadedUrls = new Set<string>();
	private readonly activeByUrl = new Set<string>();
	private activeCount = 0;
	private sequence = 0;

	constructor(options: ImageLoadingOptions = {}) {
		this.concurrency = options.concurrency || DEFAULT_CONCURRENCY;
		this.retryWindowMs = options.retryWindowMs || RETRY_WINDOW_MS;
	}

	enqueue(rawUrl: string, options: EnqueueImageOptions = {}): Promise<ImageLoadResult> {
		if (!isBrowser()) return Promise.resolve("skipped");

		const normalized = normalizeImageUrl(rawUrl);
		if (!isLoadableImageUrl(normalized)) return Promise.resolve("skipped");

		const baseUrl = stripImageRetryParams(normalized);
		if (!baseUrl) return Promise.resolve("skipped");
		if (this.loadedUrls.has(baseUrl)) return Promise.resolve("loaded");

		const priority = options.priority || "detail";
		const score = PRIORITY_SCORE[priority];
		const existing = this.trackedByUrl.get(baseUrl);

		if (existing) {
			if (score < existing.score) {
				existing.priority = priority;
				existing.score = score;
				existing.reason = options.reason || existing.reason;
			}

			const isQueued = this.queuedByUrl.has(baseUrl);
			const isActive = this.activeByUrl.has(baseUrl);
			if (priority === "hover" && existing.retryCount > 0 && !isQueued && !isActive) {
				this.queue.push(existing);
				this.queuedByUrl.set(baseUrl, existing);
			}

			if (isQueued || priority === "hover") this.pump();
			return existing.promise;
		}

		let resolve!: (result: ImageLoadResult) => void;
		const promise = new Promise<ImageLoadResult>((done) => {
			resolve = done;
		});

		const task: QueueTask = {
			url: baseUrl,
			loadUrl: normalized,
			priority,
			score,
			sequence: ++this.sequence,
			retryCount: 0,
			firstQueuedAt: Date.now(),
			promise,
			resolve,
			reason: options.reason
		};

		this.queue.push(task);
		this.queuedByUrl.set(baseUrl, task);
		this.trackedByUrl.set(baseUrl, task);
		this.pump();
		return promise;
	}

	private pump() {
		if (!isBrowser()) return;

		this.queue.sort((a, b) => a.score - b.score || a.sequence - b.sequence);

		while (this.activeCount < this.concurrency && this.queue.length > 0) {
			const task = this.queue.shift();
			if (!task || this.loadedUrls.has(task.url) || this.activeByUrl.has(task.url)) continue;

			this.queuedByUrl.delete(task.url);
			this.run(task);
		}
	}

	private run(task: QueueTask) {
		this.activeCount += 1;
		this.activeByUrl.add(task.url);

		const img = new Image();
		img.decoding = "async";
		(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
			task.priority === "hover" || task.priority === "visible" ? "high" : "low";

		img.onload = () => {
			this.loadedUrls.add(task.url);
			this.activeByUrl.delete(task.url);
			this.trackedByUrl.delete(task.url);
			task.resolve("loaded");
			this.finish();
		};

		img.onerror = () => {
			this.activeByUrl.delete(task.url);
			this.retry(task);
		};

		img.src =
			task.retryCount > 0 ? buildImageRetryUrl(task.url, task.retryCount) : task.loadUrl;
	}

	private retry(task: QueueTask) {
		const nextRetryCount = task.retryCount + 1;
		const shouldRetry = Date.now() - task.firstQueuedAt < this.retryWindowMs;
		this.finish();

		if (!shouldRetry || this.loadedUrls.has(task.url)) {
			this.trackedByUrl.delete(task.url);
			task.resolve(this.loadedUrls.has(task.url) ? "loaded" : "abandoned");
			return;
		}

		const retryTask: QueueTask = {
			...task,
			loadUrl: buildImageRetryUrl(task.url, nextRetryCount),
			priority: task.priority === "hover" ? "hover" : "retry",
			score: task.priority === "hover" ? PRIORITY_SCORE.hover : PRIORITY_SCORE.retry,
			sequence: ++this.sequence,
			retryCount: nextRetryCount
		};
		this.trackedByUrl.set(retryTask.url, retryTask);

		window.setTimeout(() => {
			if (
				this.loadedUrls.has(retryTask.url) ||
				this.queuedByUrl.has(retryTask.url) ||
				this.activeByUrl.has(retryTask.url) ||
				this.trackedByUrl.get(retryTask.url) !== retryTask
			) {
				return;
			}

			this.queue.push(retryTask);
			this.queuedByUrl.set(retryTask.url, retryTask);
			this.pump();
		}, getImageRetryDelay(nextRetryCount));
	}

	private finish() {
		this.activeCount = Math.max(0, this.activeCount - 1);
		this.pump();
	}
}

export function getGlobalImageQueue() {
	if (!globalQueue) {
		globalQueue = new ImagePreloadQueue();
	}

	return globalQueue;
}

export function enqueueImagePreload(rawUrl: string, options: EnqueueImageOptions = {}) {
	return getGlobalImageQueue().enqueue(rawUrl, options);
}

export function installGlobalImageLoadingOptimizer(options: ImageLoadingOptions = {}) {
	if (!isBrowser() || globalOptimizerInstalled) return;

	globalOptimizerInstalled = true;
	const retryWindowMs = options.retryWindowMs || RETRY_WINDOW_MS;
	const watchedImages = new WeakSet<HTMLImageElement>();
	const retryStates = new WeakMap<HTMLImageElement, DomImageRetryState>();

	const clearRetry = (img: HTMLImageElement) => {
		const state = retryStates.get(img);
		if (state?.timer) window.clearTimeout(state.timer);
		retryStates.delete(img);
	};

	const retryDomImage = (img: HTMLImageElement) => {
		const rawUrl = img.currentSrc || img.src;
		const baseUrl = stripImageRetryParams(rawUrl);
		if (!isLoadableImageUrl(baseUrl)) return;

		const currentState = retryStates.get(img);
		const state: DomImageRetryState =
			currentState?.baseUrl === baseUrl
				? currentState
				: {
						baseUrl,
						firstErrorAt: Date.now(),
						retryCount: 0
					};

		if (Date.now() - state.firstErrorAt > retryWindowMs) return;

		if (state.timer) window.clearTimeout(state.timer);
		state.retryCount += 1;
		state.timer = window.setTimeout(() => {
			if (!img.isConnected) {
				clearRetry(img);
				return;
			}

			if (img.complete && img.naturalWidth > 0) {
				clearRetry(img);
				return;
			}

			img.src = buildImageRetryUrl(state.baseUrl, state.retryCount);
		}, getImageRetryDelay(state.retryCount));

		retryStates.set(img, state);
	};

	const watchImage = (img: HTMLImageElement) => {
		if (watchedImages.has(img)) return;

		watchedImages.add(img);
		if (!img.loading) img.loading = "eager";
		img.decoding = "async";
		(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
			img.loading === "eager" ? "high" : "auto";
		if (img.src) {
			enqueueImagePreload(img.src, { priority: img.loading === "eager" ? "visible" : "detail" });
		}

		img.addEventListener("load", () => clearRetry(img));
		img.addEventListener("error", () => retryDomImage(img));

		if (img.complete && img.naturalWidth === 0 && img.src) {
			retryDomImage(img);
		}
	};

	const scan = (root: ParentNode) => {
		if (root instanceof HTMLImageElement) {
			watchImage(root);
			return;
		}

		root.querySelectorAll?.("img").forEach((img) => watchImage(img as HTMLImageElement));
	};

	const start = () => {
		scan(document.body);
		domObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof HTMLElement) scan(node);
				});
			}
		});
		domObserver.observe(document.body, { childList: true, subtree: true });
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, { once: true });
	} else {
		start();
	}

	window.addEventListener(
		"beforeunload",
		() => {
			domObserver?.disconnect();
		},
		{ once: true }
	);
}
