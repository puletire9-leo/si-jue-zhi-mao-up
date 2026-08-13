import { describe, expect, it } from "vitest";
import {
	assertVariantTitleSuffixRoundTrip,
	extractVariantTitleSuffix,
	stripVariantTitleSuffix
} from "../listing-variant-title-suffix";

describe("listing-variant-title-suffix", () => {
	const base = "Product Title";

	it("extracts suffix with nested parentheses", () => {
		const full = `${base}(Red (Large))`;
		expect(extractVariantTitleSuffix(full, base)).toBe("Red (Large)");
	});

	it("extracts suffix when user wraps in parentheses", () => {
		const full = `${base}((XL))`;
		expect(extractVariantTitleSuffix(full, base)).toBe("(XL)");
	});

	it("strip keeps base title", () => {
		const full = `${base}(Red (Large))`;
		expect(stripVariantTitleSuffix(full, base)).toBe(base);
	});

	it("round-trip passes for common parenthesis patterns", () => {
		for (const suffix of ["Red (Large)", "(XL)", "Set (3 Pack)", "Size (L"]) {
			expect(() =>
				assertVariantTitleSuffixRoundTrip(base, suffix, "德语")
			).not.toThrow();
		}
	});
});
