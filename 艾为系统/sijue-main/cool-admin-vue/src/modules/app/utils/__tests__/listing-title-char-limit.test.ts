import { describe, expect, it } from "vitest";
import {
	isListingTitleOverLimit,
	listingTitleCharCount,
	LISTING_TITLE_AMAZON_MAX
} from "../listing-title-char-limit";

describe("listing-title-char-limit", () => {
	it("uses 200 as amazon title cap", () => {
		expect(LISTING_TITLE_AMAZON_MAX).toBe(200);
	});

	it("counts full title length including suffix", () => {
		const title = `${"a".repeat(198)} (XL)`;
		expect(listingTitleCharCount(title)).toBe(203);
		expect(isListingTitleOverLimit(title)).toBe(true);
	});
});
