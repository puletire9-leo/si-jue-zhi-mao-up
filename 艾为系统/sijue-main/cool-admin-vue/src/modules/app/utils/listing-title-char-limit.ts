/** Amazon Listing 标题平台上限 */
export const LISTING_TITLE_AMAZON_MAX = 200;

export function listingTitleCharCount(text: unknown): number {
	return String(text ?? "").length;
}

export function isListingTitleOverLimit(text: unknown): boolean {
	return listingTitleCharCount(text) > LISTING_TITLE_AMAZON_MAX;
}

export function listingTitleLimitLabel(text: unknown): string {
	const n = listingTitleCharCount(text);
	return `${n} / ${LISTING_TITLE_AMAZON_MAX}`;
}
