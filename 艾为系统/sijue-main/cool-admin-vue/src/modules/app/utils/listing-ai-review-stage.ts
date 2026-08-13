export const AI_LISTING_REVIEW_CLOSED_STAGE = "review_closed";

const REVIEW_APPROVED_STAGES = new Set(["review_approved", "accepted"]);

export function normalizeAiListingStage(stage?: string | null): string {
	return String(stage || "")
		.trim()
		.toLowerCase();
}

export function isAiListingReviewApprovedStage(stage?: string | null): boolean {
	return REVIEW_APPROVED_STAGES.has(normalizeAiListingStage(stage));
}

export function isAiListingReviewClosedStage(stage?: string | null): boolean {
	return normalizeAiListingStage(stage) === AI_LISTING_REVIEW_CLOSED_STAGE;
}

export function isAiListingReviewTerminalStage(stage?: string | null): boolean {
	const s = normalizeAiListingStage(stage);
	return REVIEW_APPROVED_STAGES.has(s) || s === AI_LISTING_REVIEW_CLOSED_STAGE;
}
