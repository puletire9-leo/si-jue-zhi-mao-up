import { ref } from "vue";
import { ElMessage } from "element-plus";
import { service } from "/@/cool";
import { product_main_image_display_url } from "/$/app/utils";
import {
	normalizeRequiredLanguages,
	type ListingAiRequiredLang
} from "../../utils/listing-ai-required-languages";
import type {
	LcsMskuCardPoint,
	LcsMskuCardTone,
	LcsSkuRow
} from "./types";

type WorkbenchRow = any;

function mapTone(status?: string): LcsMskuCardTone {
	if (status === "done") return "uploaded";
	if (status === "running") return "pending_upload";
	return "blocked";
}

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

export function useContentWorkbenchListData() {
	const loading = ref(false);
	const mskuRows = ref<
		Array<{
			id: string;
			sku: string;
			msku: string;
			title: string;
			thumbStyle: Record<string, string>;
			amazonAccount: string;
			owner: string;
			variantLabel: string;
			cardPoint: string;
			tone: LcsMskuCardTone;
			updatedAt: string;
			workItemId?: number;
			site?: string;
			aiStatus?: string | number;
			aiStage?: string | number;
			designStatus?: string | number;
			designStage?: string | number;
			listingStatus?: "todo" | "done";
			uploadStatus?: "todo" | "done";
			requiredLanguages: ListingAiRequiredLang[];
		}>
	>([]);
	const skuRows = ref<LcsSkuRow[]>([]);

	async function load(options?: { keyword?: string; uploadStatus?: "done" | "todo" }) {
		loading.value = true;
		try {
			const resp = await service.app.content_workbench.page({
				page: 1,
				size: 500,
				keyword: options?.keyword || undefined,
				uploadStatus: options?.uploadStatus
			});
			const data = resp?.data ?? resp;
			const list: WorkbenchRow[] = Array.isArray(data?.list) ? data.list : [];
			const mapped = list.map((item) => {
				const tone = mapTone(item?.status);
				const cardPoint =
					tone === "uploaded"
						? "已上传"
						: tone === "pending_upload"
						? `进行中(${item?.stage || "running"})`
						: `阻塞(${item?.stage || item?.status || "unknown"})`;
				return {
					id: `${item?.id || ""}`,
					sku: String(item?.sku || ""),
					msku: String(item?.msku || ""),
					title: String(item?.meta?.candidate_name || ""),
					thumbStyle: buildThumbStyle(item?.meta?.image_url),
					amazonAccount: String(
						item?.seller_account_name || item?.account_name || item?.seller_account_id || ""
					),
					owner: String(item?.decision_owner || item?.created_by || "").trim(),
					variantLabel: String(item?.meta?.variant_name || item?.msku || ""),
					cardPoint,
					tone,
					updatedAt: String(item?.updateTime || ""),
					workItemId: Number(item?.id || 0) || undefined,
					site: mapSite(item?.country_code),
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
			mskuRows.value = mapped;

			const skuMap = new Map<string, LcsSkuRow>();
			for (const row of mapped) {
				const curr =
					skuMap.get(row.sku) ||
					({
						sku: row.sku,
						title: row.title,
						category: "",
						accounts: [],
						owners: [],
						variants: [],
						mskuCardPoints: [],
						mskuCount: 0,
						productImagesDone: 0,
						productImagesTotal: 0,
						aPlusImagesDone: 0,
						aPlusImagesTotal: 0,
						copyPercent: 0,
						status: "draft",
						updatedAt: row.updatedAt,
						thumbStyle: row.thumbStyle
					} as LcsSkuRow);
				if (!curr.accounts.includes(row.amazonAccount)) curr.accounts.push(row.amazonAccount);
				if (row.owner && !curr.owners.includes(row.owner)) curr.owners.push(row.owner);
				if (!curr.variants.includes(row.variantLabel)) curr.variants.push(row.variantLabel);
				curr.mskuCardPoints.push({
					msku: row.msku,
					amazonAccount: row.amazonAccount,
					variantLabel: row.variantLabel,
					cardPoint: row.cardPoint,
					tone: row.tone,
					aiStatus: row.aiStatus,
					aiStage: row.aiStage,
					designStatus: row.designStatus,
					designStage: row.designStage,
					designTaskCreateTime: row.designTaskCreateTime,
					listingStatus: row.listingStatus,
					uploadStatus: row.uploadStatus,
					requiredLanguages: row.requiredLanguages
				} as LcsMskuCardPoint);
				curr.mskuCount = curr.mskuCardPoints.length;
				curr.updatedAt =
					String(curr.updatedAt || "") > String(row.updatedAt || "")
						? String(curr.updatedAt || "")
						: String(row.updatedAt || "");
				skuMap.set(row.sku, curr);
			}

			skuRows.value = Array.from(skuMap.values()).map((row) => {
				const total = row.mskuCardPoints.length || 1;
				const uploaded = row.mskuCardPoints.filter((x) => x.tone === "uploaded").length;
				row.copyPercent = Math.round((uploaded / total) * 100);
				row.status =
					uploaded === total
						? "ready"
						: uploaded > 0
						? "copy"
						: row.mskuCardPoints.some((x) => x.tone === "pending_upload")
						? "asset"
						: "draft";
				return row;
			});
		} catch (e: any) {
			ElMessage.error(e?.message || "内容工作台数据加载失败");
		} finally {
			loading.value = false;
		}
	}

	return {
		loading,
		mskuRows,
		skuRows,
		load
	};
}
