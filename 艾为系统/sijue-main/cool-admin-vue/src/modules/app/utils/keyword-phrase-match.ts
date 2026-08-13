/**
 * 与后端 ai_listing_graph/keyword-phrase-match 对齐的文案匹配工具（前端检测/高亮）。
 */

export function normalizeListingText(value: string): string {
	return String(value || "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function escapeRegex(input: string): string {
	return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** AI 常返回合并项，如 `Infrared / Infrared Light Therapy`，拆成多个候选分别匹配 */
export function expandMergedKeywordTerms(term: string): string[] {
	const raw = String(term || "").trim();
	if (!raw) return [];
	const parts = raw
		.split(/\s*(?:\/|\|)\s*/)
		.map((p) => p.trim())
		.filter(Boolean);
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const part of parts.length ? parts : [raw]) {
		const key = normalizeListingText(part);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(part);
	}
	return unique;
}

/**
 * 构建可在原文中匹配的词组正则：token 之间允许空格、连字符、逗号、下划线等分隔符。
 * 匹配结果保留原文写法（便于高亮标注）。
 */
export function buildFlexiblePhraseRegex(term: string): RegExp | null {
	const normalized = normalizeListingText(term);
	if (!normalized) return null;
	const tokens = normalized.split(" ").filter(Boolean);
	if (!tokens.length) return null;
	// 允许 `wake & refresh` / `a/b` / `x+y` 等写法在词间匹配
	const betweenTokens = "[\\s\\-_,./&+]+";
	const body =
		tokens.length === 1
			? escapeRegex(tokens[0])
			: tokens.map((t) => escapeRegex(t)).join(betweenTokens);
	return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}

export function phraseAppearsInText(text: string, phrase: string): boolean {
	const source = String(text || "");
	return expandMergedKeywordTerms(phrase).some((fragment) => {
		const regex = buildFlexiblePhraseRegex(fragment);
		if (!regex) return false;
		regex.lastIndex = 0;
		return regex.test(source);
	});
}

export type KeywordHighlightMatch = {
	start: number;
	end: number;
	text: string;
	term: string;
};

/** 在原文中收集所有灵活匹配片段（用于高亮） */
export function collectFlexiblePhraseMatches(
	text: string,
	terms: string[]
): KeywordHighlightMatch[] {
	const source = String(text || "");
	const out: KeywordHighlightMatch[] = [];
	for (const rawTerm of terms || []) {
		const term = String(rawTerm || "").trim();
		if (!term) continue;
		for (const fragment of expandMergedKeywordTerms(term)) {
			const regex = buildFlexiblePhraseRegex(fragment);
			if (!regex) continue;
			let m: RegExpExecArray | null;
			while ((m = regex.exec(source))) {
				const start = Number(m.index || 0);
				const hit = String(m[0] || "");
				const end = start + hit.length;
				if (end > start) out.push({ start, end, text: hit, term });
				if (regex.lastIndex === m.index) regex.lastIndex += 1;
			}
		}
	}
	return out;
}

export type KeywordHighlightType = "core" | "other" | "brand" | "irrelevant" | "banned";

export type KeywordHighlightSpan = KeywordHighlightMatch & {
	type: KeywordHighlightType;
};

function rangesOverlap(
	a: { start: number; end: number },
	b: { start: number; end: number }
): boolean {
	return a.start < b.end && a.end > b.start;
}

/**
 * 高亮去重：违禁词 > 品牌词 > 无关词 > 核心词 > 其他词。
 * 同优先级内优先更长匹配；低优先级不得覆盖已选中的高优先级区间。
 */
export function pickNonOverlappingKeywordMatches(
	matches: KeywordHighlightSpan[]
): KeywordHighlightSpan[] {
	const typeOrder: KeywordHighlightType[] = [
		"banned",
		"brand",
		"irrelevant",
		"core",
		"other"
	];
	const picked: KeywordHighlightSpan[] = [];
	for (const type of typeOrder) {
		const group = matches
			.filter((m) => m.type === type)
			.sort((a, b) => {
				if (a.start !== b.start) return a.start - b.start;
				return b.end - b.start - (a.end - a.start);
			});
		for (const m of group) {
			if (picked.some((p) => rangesOverlap(m, p))) continue;
			picked.push(m);
		}
	}
	return picked.sort((a, b) => a.start - b.start);
}
