/** AI 文案任务需生成语言（由店铺采购 uk/de 数量推导） */
export type ListingAiRequiredLang = "en" | "de";

export const LISTING_AI_REQUIRED_LANG_LABELS: Record<ListingAiRequiredLang, string> = {
	en: "英语",
	de: "德语"
};

export function normalizeRequiredLanguages(raw: unknown): ListingAiRequiredLang[] {
	const list = Array.isArray(raw) ? raw : [];
	const out: ListingAiRequiredLang[] = [];
	for (const item of list) {
		const key = String(item || "")
			.trim()
			.toLowerCase();
		if (key === "en" || key === "uk") {
			if (!out.includes("en")) out.push("en");
		} else if (key === "de") {
			if (!out.includes("de")) out.push("de");
		}
	}
	return out;
}

export function labelForRequiredLang(lang: ListingAiRequiredLang): string {
	return LISTING_AI_REQUIRED_LANG_LABELS[lang] || lang;
}

/** 从图需/选品采购行汇总：店铺下 uk/de 任一 > 0 即需要对应语言 */
export function requiredLanguagesFromPurchaseRows(
	rows: Array<{ uk?: number; de?: number; seller_account_id?: string }>,
	sellerAccountId?: string
): ListingAiRequiredLang[] {
	const accountId = String(sellerAccountId || "").trim();
	let needEn = false;
	let needDe = false;
	for (const row of rows || []) {
		if (accountId) {
			const sid = String(row?.seller_account_id || "").trim();
			// 与后端 resolveRequiredLanguagesFromPurchaseRows 一致：空店铺不归入任一账号
			if (!sid || sid !== accountId) continue;
		}
		if (Number(row?.uk || 0) > 0) needEn = true;
		if (Number(row?.de || 0) > 0) needDe = true;
	}
	const out: ListingAiRequiredLang[] = [];
	if (needEn) out.push("en");
	if (needDe) out.push("de");
	return out;
}

export type PictureMountPurchaseRow = {
	uk?: number;
	de?: number;
	msku?: string;
	variantId?: string;
	selected_variant_id?: string;
	seller_account_id?: string;
};

export type PictureMountLangStatus = { en: boolean; de: boolean };

export type PictureMountFilter = {
	/** 主图：仅按 MSKU 汇总 */
	isMainPicture?: boolean;
	msku?: string;
	/** 空 = 全部变体 */
	variantId?: string;
	/** 空 = 全部店铺 */
	sellerAccountId?: string;
};

function matchPurchaseVariant(row: PictureMountPurchaseRow, variantId: string): boolean {
	return (
		String(row.variantId || row.selected_variant_id || "").trim() === variantId
	);
}

function matchPurchaseSeller(row: PictureMountPurchaseRow, sellerAccountId: string): boolean {
	return String(row.seller_account_id || "").trim() === sellerAccountId;
}

/** 按图位挂载方式筛选采购行 */
export function filterPurchasesForPictureMount(
	rows: PictureMountPurchaseRow[],
	mount: PictureMountFilter
): PictureMountPurchaseRow[] {
	const list = Array.isArray(rows) ? rows : [];
	const msku = String(mount.msku || "").trim();
	if (mount.isMainPicture) {
		if (!msku) return [];
		return list.filter((p) => String(p.msku || "").trim() === msku);
	}
	const variantId = String(mount.variantId || "").trim();
	const sellerId = String(mount.sellerAccountId || "").trim();
	return list.filter((p) => {
		if (variantId && sellerId) {
			return matchPurchaseVariant(p, variantId) && matchPurchaseSeller(p, sellerId);
		}
		if (sellerId) {
			return matchPurchaseSeller(p, sellerId);
		}
		if (variantId) {
			return matchPurchaseVariant(p, variantId);
		}
		return true;
	});
}

export function sumUkDeFromPurchaseRows(
	rows: PictureMountPurchaseRow[]
): { uk: number; de: number } {
	let uk = 0;
	let de = 0;
	for (const row of rows || []) {
		uk += Number(row.uk || 0);
		de += Number(row.de || 0);
	}
	return { uk, de };
}

/** 图位挂载维度：汇总 uk/de，>0 为需做（对号） */
export function pictureMountLangStatus(
	rows: PictureMountPurchaseRow[],
	mount: PictureMountFilter
): PictureMountLangStatus {
	const matched = filterPurchasesForPictureMount(rows, mount);
	const { uk, de } = sumUkDeFromPurchaseRows(matched);
	return { en: uk > 0, de: de > 0 };
}
