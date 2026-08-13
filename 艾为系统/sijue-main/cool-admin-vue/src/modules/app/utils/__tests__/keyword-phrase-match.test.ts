import { describe, expect, it } from "vitest";
import {
	pickNonOverlappingKeywordMatches,
	type KeywordHighlightSpan
} from "../keyword-phrase-match";

describe("pickNonOverlappingKeywordMatches", () => {
	it("prefers banned over longer core match at same start", () => {
		const matches: KeywordHighlightSpan[] = [
			{ start: 0, end: 9, text: "powakaddy", term: "powakaddy", type: "banned" },
			{
				start: 0,
				end: 28,
				text: "powakaddy umbrella holder",
				term: "powakaddy umbrella holder",
				type: "core"
			}
		];
		const picked = pickNonOverlappingKeywordMatches(matches);
		expect(picked).toHaveLength(1);
		expect(picked[0].type).toBe("banned");
		expect(picked[0].text).toBe("powakaddy");
	});

	it("allows non-overlapping core after banned prefix", () => {
		const matches: KeywordHighlightSpan[] = [
			{ start: 0, end: 9, text: "powakaddy", term: "powakaddy", type: "banned" },
			{
				start: 10,
				end: 25,
				text: "umbrella holder",
				term: "umbrella holder",
				type: "core"
			}
		];
		const picked = pickNonOverlappingKeywordMatches(matches);
		expect(picked.map((m) => m.type)).toEqual(["banned", "core"]);
	});
});
