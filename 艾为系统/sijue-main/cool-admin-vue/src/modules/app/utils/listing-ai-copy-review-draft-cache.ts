const REVIEW_DRAFT_CACHE_PREFIX = "lact_review_draft_v1";

export type ReviewDraftCopyRow = {
	fieldLabel: string;
	rowType?: "normal" | "variant_option";
	variantTitle?: string;
	variantDesc?: string;
	en: string;
	de: string;
};

export type ReviewDraftCachePayload = {
	savedAt: number;
	auditCopyRows: ReviewDraftCopyRow[];
	warningWordIgnores: {
		en: Record<string, boolean>;
		de: Record<string, boolean>;
	};
};

export function reviewDraftCacheKey(taskId: number | string) {
	return `${REVIEW_DRAFT_CACHE_PREFIX}:${String(taskId)}`;
}

export function loadReviewDraftCache(taskId: number | string): ReviewDraftCachePayload | null {
	if (!taskId) return null;
	try {
		const raw = localStorage.getItem(reviewDraftCacheKey(taskId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ReviewDraftCachePayload;
		if (!Array.isArray(parsed?.auditCopyRows)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveReviewDraftCache(taskId: number | string, payload: ReviewDraftCachePayload) {
	if (!taskId) return;
	try {
		localStorage.setItem(
			reviewDraftCacheKey(taskId),
			JSON.stringify({
				...payload,
				savedAt: payload.savedAt || Date.now()
			})
		);
	} catch {
		// quota / private mode
	}
}

export function clearReviewDraftCache(taskId: number | string) {
	if (!taskId) return;
	try {
		localStorage.removeItem(reviewDraftCacheKey(taskId));
	} catch {
		// ignore
	}
}
