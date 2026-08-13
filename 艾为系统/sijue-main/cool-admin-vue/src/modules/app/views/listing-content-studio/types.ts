import type { ListingAiRequiredLang } from "../../utils/listing-ai-required-languages";

export type LcsStatus = "draft" | "asset" | "copy" | "ready";
export type LcsMskuCardTone = "blocked" | "pending_upload" | "uploaded";

export interface LcsMskuCardPoint {
	msku: string;
	amazonAccount: string;
	variantLabel: string;
	cardPoint: string;
	tone: LcsMskuCardTone;
	aiStatus?: string | number;
	aiStage?: string | number;
	designStatus?: string | number;
	designStage?: string | number;
	designTaskCreateTime?: string;
	listingStatus?: "todo" | "done";
	uploadStatus?: "todo" | "done";
	/** 该 MSKU 采购 uk/de > 0 推导的需做语言 */
	requiredLanguages?: ListingAiRequiredLang[];
}

export interface LcsActivityTimelineItem {
	time: string;
	content: string;
	operator?: string;
}

export interface LcsSkuRow {
	sku: string;
	title: string;
	category: string;
	accounts: string[];
	owners: string[];
	variants: string[];
	mskuCardPoints: LcsMskuCardPoint[];
	mskuCount: number;
	productImagesDone: number;
	productImagesTotal: number;
	aPlusImagesDone: number;
	aPlusImagesTotal: number;
	copyPercent: number;
	status: LcsStatus;
	updatedAt: string;
	thumbStyle: Record<string, string>;
	/** 详情页聚合时间线；列表页按需懒加载 */
	activityTimeline?: LcsActivityTimelineItem[];
}

export const LCS_MARKETPLACES = ["UK", "DE", "FR", "IT", "ES"] as const;
export type LcsMarketplace = (typeof LCS_MARKETPLACES)[number];

export const LCS_SITE_LOCALE: Record<LcsMarketplace, string> = {
	UK: "EN",
	DE: "DE",
	FR: "FR",
	IT: "IT",
	ES: "ES"
};

export interface LcsWorkbenchMsku {
	id: string;
	msku: string;
	/** 上架 SKU（app_amz_msku.seller_sku），空表示上架时用系统 MSKU */
	sellerSku?: string | null;
	/** 对齐 AI `variant_titles` / marker 的 app_amz_bsr_candidate_variant.id */
	selectedVariantId?: string;
	amazonAccount: string;
	variantLabel: string;
	sites: string[];
	owner: string;
	asin: string;
	workItemId?: number;
	candidateId?: number;
	currentAiTaskId?: number | null;
	currentDesignTaskId?: number | null;
	designTaskStatus?: number;
	designTaskCreateTime?: string;
	listingStatus?: "todo" | "done";
	uploadStatus?: "todo" | "done";
	/** 该 MSKU 采购 uk/de > 0 推导的需做语言 */
	requiredLanguages?: ListingAiRequiredLang[];
}
