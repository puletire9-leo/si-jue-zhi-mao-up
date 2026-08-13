import { service } from "/@/cool";
import { product_main_image_display_url } from "/$/app/utils";
import { normalizeRequiredLanguages } from "../../utils/listing-ai-required-languages";
import type { LcsSkuRow, LcsWorkbenchMsku } from "./types";

function mapSite(countryCode?: string) {
	const code = String(countryCode || "").trim().toLowerCase();
	if (code === "de") return "DE";
	if (code === "fr") return "FR";
	if (code === "it") return "IT";
	if (code === "es") return "ES";
	return "UK";
}

function buildThumbStyle(imageUrl?: string) {
	const url = product_main_image_display_url(imageUrl);
	if (!url) return { background: "linear-gradient(135deg, #eff3ff 0%, #dce7ff 100%)" };
	return {
		backgroundImage: `url(${url})`,
		backgroundSize: "cover",
		backgroundPosition: "center"
	};
}

const sellerNameMapCache = new Map<string, string>();
let sellerMapLoaded = false;

async function ensureSellerNameMap() {
	if (sellerMapLoaded) return;
	try {
		const api = (service as any).app?.seller;
		if (!api?.list) return;
		const res = await api.list();
		const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
		for (const row of rows) {
			const id = String(row?.seller_account_id || "").trim();
			if (!id) continue;
			const name = String(row?.account_name || row?.name || "").trim();
			if (name) sellerNameMapCache.set(id, name);
		}
		sellerMapLoaded = true;
	} catch {
		// ignore seller map failures and fallback to id
	}
}

function getAccountDisplay(item: any): string {
	const id = String(item?.seller_account_id || "").trim();
	const mapped = id ? sellerNameMapCache.get(id) : "";
	return String(
		mapped ||
		item?.seller_account_name ||
			item?.account_name ||
			item?.meta?.seller_account_name ||
			item?.meta?.account_name ||
			id ||
			""
	);
}

function getVariantDisplay(item: any): string {
	return String(
		item?.variant_name ||
			item?.meta?.variant_name ||
			item?.meta?.selected_variant ||
			item?.selected_variant ||
			item?.msku ||
			""
	);
}

function getOwnerDisplay(item: any): string {
	return String(
		item?.decision_owner ||
			item?.submitter_name ||
			item?.created_by ||
			item?.meta?.submitter_name ||
			item?.meta?.created_by ||
			""
	);
}

export async function loadStudioDetailBySku(sku: string, targetMsku?: string): Promise<{
	skuRow?: LcsSkuRow;
	mskuList: LcsWorkbenchMsku[];
}> {
	const code = String(sku || "").trim();
	if (!code) return { skuRow: undefined, mskuList: [] };
	const resp = await service.app.content_workbench.page({
		page: 1,
		size: 500,
		keyword: code
	});
	const data = resp?.data ?? resp;
	await ensureSellerNameMap();
	const rows: any[] = (Array.isArray(data?.list) ? data.list : []).filter(
		(x: any) => String(x?.sku || "") === code
	);
	if (!rows.length) return { skuRow: undefined, mskuList: [] };

	const mskuList: LcsWorkbenchMsku[] = rows.map((item: any, idx: number) => {
		const rawVid = String(item?.selected_variant_id || item?.meta?.selected_variant_id || "").trim();
		return {
			id: `${item?.id || idx}`,
			msku: String(item?.msku || ""),
			sellerSku: item?.seller_sku != null ? String(item.seller_sku).trim() || null : null,
			selectedVariantId: rawVid || undefined,
			amazonAccount: getAccountDisplay(item),
			variantLabel: getVariantDisplay(item),
			sites: [mapSite(item?.country_code)],
			owner: getOwnerDisplay(item) || "系统",
			asin: String(item?.meta?.asin || ""),
			workItemId: Number(item?.id || 0) || undefined,
			candidateId:
				item?.candidate_id != null ? Number(item.candidate_id) : undefined,
			currentAiTaskId:
				item?.current_ai_task_id != null ? Number(item.current_ai_task_id) : null,
			currentDesignTaskId:
				item?.current_design_task_id != null ? Number(item.current_design_task_id) : null,
			designTaskStatus:
				item?.design_task?.status != null ? Number(item.design_task.status) : undefined,
			designTaskCreateTime: item?.design_task?.createTime
				? String(item.design_task.createTime)
				: undefined,
			listingStatus: String(item?.listing_status || "todo") === "done" ? "done" : "todo",
			uploadStatus: String(item?.upload_status || "todo") === "done" ? "done" : "todo",
			requiredLanguages: normalizeRequiredLanguages(
				item?.required_languages ?? item?.requiredLanguages
			)
		};
	});
	const allAccounts = Array.from(new Set(mskuList.map((x) => x.amazonAccount))).filter(Boolean);
	const allVariants = Array.from(new Set(mskuList.map((x) => x.variantLabel))).filter(Boolean);
	const statusPoints = rows.map((item: any) => {
		const status = String(item?.status || "");
		const tone = status === "done" ? "uploaded" : status === "running" ? "pending_upload" : "blocked";
		const cardPoint =
			tone === "uploaded"
				? "已上传"
				: tone === "pending_upload"
				? `进行中(${item?.stage || "running"})`
				: `阻塞(${item?.stage || status})`;
		return {
			msku: String(item?.msku || ""),
			amazonAccount: getAccountDisplay(item),
			variantLabel: getVariantDisplay(item),
			cardPoint,
			tone,
			aiStatus: item?.ai_task?.status,
			aiStage: item?.ai_task?.stage,
			designStatus: item?.design_task?.status,
			designStage: item?.design_task?.status,
			designTaskCreateTime: item?.design_task?.createTime
				? String(item.design_task.createTime)
				: undefined,
			listingStatus: String(item?.listing_status || "todo") === "done" ? "done" : "todo",
			uploadStatus: String(item?.upload_status || "todo") === "done" ? "done" : "todo",
			requiredLanguages: normalizeRequiredLanguages(
				item?.required_languages ?? item?.requiredLanguages
			)
		};
	});
	const skuRow: LcsSkuRow = {
		sku: code,
		title: String(rows[0]?.meta?.candidate_name || ""),
		category: "",
		accounts: allAccounts,
		variants: allVariants,
		mskuCardPoints: statusPoints as any,
		mskuCount: mskuList.length,
		productImagesDone: 0,
		productImagesTotal: 0,
		aPlusImagesDone: 0,
		aPlusImagesTotal: 0,
		copyPercent: 0,
		status: "draft",
		updatedAt: String(rows[0]?.updateTime || ""),
		thumbStyle: buildThumbStyle(rows[0]?.meta?.image_url),
		activityTimeline: rows.map((item: any) => ({
			time: String(item?.updateTime || ""),
			content: `${item?.msku || ""} ${item?.stage || item?.status || ""}`,
			operator: "系统"
		}))
	};

	return {
		skuRow,
		// Always return all sibling MSKUs under the SKU; caller decides active selection.
		mskuList
	};
}
