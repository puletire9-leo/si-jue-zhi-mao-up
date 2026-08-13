/** 从 langgraph base_copy.title（string 或 { title }）读出母版标题 */
export function resolveListingTitleText(raw: unknown): string {
	if (typeof raw === "string") return raw.trim();
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		return String((raw as { title?: unknown }).title ?? "").trim();
	}
	return String(raw ?? "").trim();
}

/** 从完整变体标题中剥离母版标题，得到变体后缀（括号内文案） */
export function extractVariantTitleSuffix(
	fullTitle: unknown,
	baseTitle?: unknown
): string {
	const full = String(fullTitle ?? "").trim();
	const base = String(baseTitle ?? "").trim();
	if (!full) return "";
	if (base && full.startsWith(base)) {
		const rest = full.slice(base.length).trim();
		if (!rest) return "";
		if (rest.startsWith("(") && rest.endsWith(")")) {
			return rest.slice(1, -1).trim();
		}
		return rest;
	}
	const m = full.match(/\(([^()]*)\)\s*$/);
	return m ? String(m[1] ?? "").trim() : "";
}

/** 从完整变体标题中去掉尾部变体后缀，保留母版标题 */
export function stripVariantTitleSuffix(
	fullTitle: unknown,
	baseTitle?: unknown
): string {
	const full = String(fullTitle ?? "").trim();
	const base = String(baseTitle ?? "").trim();
	if (base && full.startsWith(base)) {
		return base;
	}
	return full.replace(/\([^()]*\)\s*$/, "").trim();
}

/** 变体后缀经 base(suffix) 拼接后须能无损还原；否则保存会静默丢数据 */
export function assertVariantTitleSuffixRoundTrip(
	baseTitle: unknown,
	suffix: unknown,
	langLabel: string,
	variantLabel?: string
): void {
	const base = String(baseTitle ?? "").trim();
	const s = String(suffix ?? "").trim();
	if (!s || s === "-") return;
	const extracted = extractVariantTitleSuffix(`${base}(${s})`, base);
	if (extracted !== s) {
		const who = variantLabel ? `变体「${variantLabel}」的` : "";
		throw new Error(
			`${langLabel}${who}变体选项「${s}」保存后无法正确还原（通常因括号写法导致），请修改后再保存`
		);
	}
}
