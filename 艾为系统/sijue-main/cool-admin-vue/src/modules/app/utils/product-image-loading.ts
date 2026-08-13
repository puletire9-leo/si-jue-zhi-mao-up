import {
	enqueueImagePreload,
	type ImageLoadPriority,
	type ImageLoadResult
} from "/@/cool/utils/image-loading";
import { convert_image_url } from "/$/app/utils";

type ProductImageRow = Record<string, any>;

interface ProductImageLoadOptions {
	prefixes?: string[];
	reason?: string;
	priority?: ImageLoadPriority;
	includeDetails?: boolean;
	detailAfterMainTimeoutMs?: number;
}

interface ProductImageUrls {
	mainUrl: string;
	detailUrls: string[];
	allUrls: string[];
}

const DEFAULT_PREFIXES = ["image_url"];
const IMAGE_INDEXES = [1, 2, 3, 4, 5, 6];
const DEFAULT_DETAIL_AFTER_MAIN_TIMEOUT_MS = 5 * 60 * 1000;

function imageField(prefix: string, index: number) {
	return index === 1 ? prefix : `${prefix}${index}`;
}

function displayField(prefix: string) {
	return `${prefix}_display`;
}

function toDisplayUrl(rawUrl: unknown) {
	const url = String(rawUrl || "").trim();
	return url ? convert_image_url(url) : "";
}

function uniquePush(urls: string[], url: string) {
	const normalized = String(url || "").trim();
	if (normalized && !urls.includes(normalized)) urls.push(normalized);
}

export function getProductImageUrls(row: ProductImageRow, prefix = "image_url"): ProductImageUrls {
	const allUrls: string[] = [];
	const mainUrl = String(row?.[displayField(prefix)] || toDisplayUrl(row?.[prefix]) || "").trim();

	uniquePush(allUrls, mainUrl);

	for (const index of IMAGE_INDEXES) {
		uniquePush(allUrls, toDisplayUrl(row?.[imageField(prefix, index)]));
	}

	return {
		mainUrl,
		detailUrls: allUrls.filter((url) => url !== mainUrl),
		allUrls
	};
}

export function preloadProductImages(
	rows: ProductImageRow[] = [],
	options: ProductImageLoadOptions = {}
) {
	const prefixes = options.prefixes?.length ? options.prefixes : DEFAULT_PREFIXES;
	const validRows = rows.filter(Boolean);

	const mainLoads = preloadProductMainImages(validRows, {
		...options,
		priority: options.priority || "visible"
	});

	if (options.includeDetails === false) return mainLoads;

	const enqueueDetails = () => {
		const detailLoads: Promise<ImageLoadResult>[] = [];

		for (const prefix of prefixes) {
			for (const row of validRows) {
				const { detailUrls } = getProductImageUrls(row, prefix);
				for (const url of detailUrls) {
					detailLoads.push(
						enqueueImagePreload(url, {
							priority: "detail",
							reason: options.reason || `${prefix}:detail`
						})
					);
				}
			}
		}

		return detailLoads;
	};

	if (!mainLoads.length || typeof window === "undefined") return enqueueDetails();

	const timeoutMs = options.detailAfterMainTimeoutMs ?? DEFAULT_DETAIL_AFTER_MAIN_TIMEOUT_MS;
	void Promise.race([
		Promise.allSettled(mainLoads),
		new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))
	]).then(enqueueDetails);

	return mainLoads;
}

export function preloadProductMainImages(
	rows: ProductImageRow[] = [],
	options: ProductImageLoadOptions = {}
) {
	const prefixes = options.prefixes?.length ? options.prefixes : DEFAULT_PREFIXES;
	const validRows = rows.filter(Boolean);
	const loads: Promise<ImageLoadResult>[] = [];

	for (const prefix of prefixes) {
		for (const row of validRows) {
			const { mainUrl } = getProductImageUrls(row, prefix);
			if (mainUrl) {
				loads.push(
					enqueueImagePreload(mainUrl, {
						priority: options.priority || "visible",
						reason: options.reason || `${prefix}:main`
					})
				);
			}
		}
	}

	return loads;
}

export function boostProductImages(
	row: ProductImageRow,
	options: ProductImageLoadOptions & { priority?: ImageLoadPriority } = {}
) {
	const prefixes = options.prefixes?.length ? options.prefixes : DEFAULT_PREFIXES;

	for (const prefix of prefixes) {
		const { allUrls } = getProductImageUrls(row, prefix);
		for (const url of allUrls) {
			enqueueImagePreload(url, {
				priority: options.priority || "hover",
				reason: options.reason || `${prefix}:hover`
			});
		}
	}
}
