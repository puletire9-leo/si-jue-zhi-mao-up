export type ListingKeywordLocale = "en" | "de";

export type SystemKeywordSourceRow = {
	keyword?: string;
	parentSearchVolume?: number;
	monthlySearch?: string | number;
};

export type KeywordWordAggregateRow = {
	word: string;
	/** 出现在多少条选中关键词中（每行最多计 1 次） */
	totalFreq: number;
	/** 含该词的关键词父体搜索量之和 */
	totalParentSearchVolume: number;
	/** 拆词来源的关键词短语（去重，按 systemKeywords 顺序） */
	sourceKeywords: string[];
};

const STOPWORDS_EN = new Set([
	"a",
	"an",
	"the",
	"and",
	"or",
	"for",
	"with",
	"of",
	"in",
	"on",
	"at",
	"to",
	"from",
	"by",
	"as",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"it",
	"its",
	"this",
	"that",
	"these",
	"those",
	"your",
	"our",
	"their",
	"my",
	"into",
	"over",
	"under",
	"between",
	"through",
	"during",
	"before",
	"after",
	"above",
	"below",
	"up",
	"down",
	"out",
	"off",
	"than",
	"then",
	"so",
	"if",
	"but",
	"not",
	"no",
	"nor",
	"can",
	"will",
	"just",
	"only",
	"also",
	"very",
	"more",
	"most",
	"some",
	"any",
	"all",
	"about",
	"into",
	"via",
	"per",
	"vs"
]);

const STOPWORDS_DE = new Set([
	"und",
	"oder",
	"der",
	"die",
	"das",
	"den",
	"dem",
	"des",
	"ein",
	"eine",
	"einer",
	"eines",
	"einem",
	"einen",
	"für",
	"mit",
	"von",
	"zu",
	"auf",
	"in",
	"an",
	"bei",
	"nach",
	"aus",
	"über",
	"unter",
	"zwischen",
	"durch",
	"vor",
	"hinter",
	"neben",
	"ohne",
	"um",
	"so",
	"als",
	"auch",
	"nur",
	"noch",
	"schon",
	"sehr",
	"mehr",
	"nicht",
	"keine",
	"kein",
	"keinen",
	"ihr",
	"ihre",
	"seinem",
	"seinen",
	"wird",
	"sind",
	"ist",
	"war",
	"waren",
	"beim",
	"zum",
	"zur",
	"vom",
	"im",
	"am",
	"ans",
	"ins",
	"ab",
	"bis",
	"da",
	"doch",
	"je",
	"wie",
	"was",
	"wer",
	"wir",
	"sie",
	"er",
	"es",
	"man"
]);

function stopwordsFor(locale: ListingKeywordLocale) {
	return locale === "de" ? STOPWORDS_DE : STOPWORDS_EN;
}

function normalizeToken(raw: string) {
	return String(raw || "")
		.toLowerCase()
		.replace(/^[^a-z0-9\u00c0-\u024f]+|[^a-z0-9\u00c0-\u024f]+$/gi, "")
		.trim();
}

/** 从关键词短语拆出单词（去停用词、去重仅用于单行内计数） */
export function tokenizeKeywordPhrase(phrase: string, locale: ListingKeywordLocale): string[] {
	const stop = stopwordsFor(locale);
	const parts = String(phrase || "")
		.split(/[\s/|,;+]+/)
		.map(normalizeToken)
		.filter(Boolean);
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const p of parts) {
		if (stop.has(p)) continue;
		if (/^\d+$/.test(p)) continue;
		if (seen.has(p)) continue;
		seen.add(p);
		unique.push(p);
	}
	return unique;
}

/**
 * 从「关键词模式」列表拆词聚合：总频率=出现关键词条数，总父体搜索量=含该词各条 volume 求和。
 */
export function aggregateWordsFromSystemKeywords(
	keywords: SystemKeywordSourceRow[] | undefined,
	locale: ListingKeywordLocale
): KeywordWordAggregateRow[] {
	const map = new Map<
		string,
		{ totalFreq: number; totalParentSearchVolume: number; sourceKeywords: Set<string> }
	>();
	for (const row of keywords || []) {
		const phrase = String(row?.keyword || "").trim();
		if (!phrase) continue;
		const volume =
			Number(row?.parentSearchVolume ?? row?.monthlySearch ?? 0) || 0;
		const tokens = tokenizeKeywordPhrase(phrase, locale);
		for (const token of tokens) {
			const prev = map.get(token) || {
				totalFreq: 0,
				totalParentSearchVolume: 0,
				sourceKeywords: new Set<string>()
			};
			prev.totalFreq += 1;
			prev.totalParentSearchVolume += volume;
			prev.sourceKeywords.add(phrase);
			map.set(token, prev);
		}
	}
	return Array.from(map.entries())
		.map(([word, agg]) => ({
			word,
			totalFreq: agg.totalFreq,
			totalParentSearchVolume: agg.totalParentSearchVolume,
			sourceKeywords: Array.from(agg.sourceKeywords)
		}))
		.sort((a, b) => {
			if (b.totalFreq !== a.totalFreq) return b.totalFreq - a.totalFreq;
			return b.totalParentSearchVolume - a.totalParentSearchVolume;
		});
}
