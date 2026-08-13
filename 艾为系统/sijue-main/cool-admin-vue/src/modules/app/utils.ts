import type { ComposeOption } from "echarts/core";
import type { BarSeriesOption } from "echarts/charts";
import type { TooltipComponentOption, GridComponentOption } from "echarts/components";
import { useUserStore } from "/$/base/store/user";
import { computed } from "vue";
import { isDev } from "/@/config";
import { uuid } from "/@/cool/utils";

type EChartsOption = ComposeOption<TooltipComponentOption | GridComponentOption | BarSeriesOption>;

// 1. 定义精准的TS类型（匹配你的数据结构）
interface SearchVolumeItem {
	date: number | string; // 20241201这类数字/字符串
	searches: number;
	expected_orders?: number; // 可选，对应show_expected_orders逻辑
}
interface CompetitorHistoryItem {
	date: number | string;
	amount: number;
}

// 新增：通用数据解析函数（处理JSON字符串/数组，带容错）
/**
 * 解析数据（兼容JSON字符串/数组，解析失败返回空数组）
 * @param data 输入数据（JSON字符串 | 数组 | undefined | null）
 * @returns 解析后的数组
 */
function parseData<T>(data: string | T[] | undefined | null): T[] {
	// 空值直接返回空数组
	if (!data) return [];

	// 如果是字符串，尝试解析为JSON
	if (typeof data === "string") {
		try {
			const parsed = JSON.parse(data);
			// 解析后必须是数组才返回，否则返回空数组
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			console.warn("JSON字符串解析失败，返回空数组", e);
			return [];
		}
	}

	// 如果是数组，直接返回；否则返回空数组
	return Array.isArray(data) ? data : [];
}

// 新增：日期格式化函数
function formatDate(dateNum: number | string): string {
	const dateStr = String(dateNum).trim();
	if (/^\d{8}$/.test(dateStr)) {
		const year = dateStr.slice(0, 4);
		const month = dateStr.slice(4, 6);
		const day = dateStr.slice(6, 8);
		return `${year}-${month}-${day}`;
	}
	return dateStr;
}

// 2. 修复搜索量图表函数（兼容字符串/数组输入）
export function generateKeywordSearchVolumeChartOption(
	search_volume_data: string | SearchVolumeItem[] | undefined | null, // 入参新增string类型
	show_search_volume: boolean = true,
	show_expected_orders: boolean = false,
	inventory?: number,
	brush_tool: boolean = false
): EChartsOption {
	// 核心修改：先解析数据（兼容字符串/数组），再兜底
	const validData: SearchVolumeItem[] = parseData<SearchVolumeItem>(search_volume_data);

	const options: EChartsOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "shadow" },
			formatter: (params: any) => {
				const date = params[0].axisValue;
				let html = `<div>${date}</div>`;
				params.forEach((p: any) => {
					html += `<div>${p.seriesName}：${p.value}</div>`;
				});
				return html;
			}
		},
		grid: {
			top: brush_tool ? "20%" : "10%",
			bottom: "5%",
			left: "8%",
			right: "5%",
			containLabel: true
		},
		xAxis: [
			{
				type: "category",
				data: validData.map((d) => formatDate(d.date)),
				axisTick: { alignWithLabel: true },
				axisLabel: {
					rotate: 30,
					fontSize: 12
				}
			}
		],
		yAxis: [
			{
				type: "value",
				min: 0,
				axisLabel: {
					fontSize: 12
				}
			}
		],
		series: []
	};

	if (show_search_volume) {
		options.series.push({
			type: "bar",
			name: "搜索量",
			barWidth: "50%",
			barGap: "15%",
			barCategoryGap: "30%",
			label: {
				show: !show_expected_orders,
				position: "top",
				fontSize: 11
			},
			data: validData.map((d) =>
				Number.isFinite(d.searches) ? (d.searches === -1 ? 0 : d.searches) : 0
			),
			stack: "stack",
			itemStyle: {
				color: "#4a65bf"
			}
		});
	}

	if (show_expected_orders) {
		let accumulated_order_count = 0;
		const expectedOrdersSeries: BarSeriesOption = {
			type: "bar",
			name: "预期单量（周）",
			barWidth: "50%",
			label: {
				show: true,
				position: "top",
				fontSize: 11
			},
			data: validData.map((d) => {
				const orderVal = Number.isFinite(d.expected_orders) ? d.expected_orders : 0;
				accumulated_order_count += orderVal;
				return {
					value: orderVal,
					itemStyle: {
						color: accumulated_order_count < (inventory || 0) ? "#86c56a" : "#d79032"
					}
				};
			}),
			stack: "stack"
		};
		options.series.push(expectedOrdersSeries);
	}

	if (brush_tool) {
		options.brush = {
			toolbox: ["lineX"],
			throttleDelay: 100
		};
	}

	return options;
}

// 3. 修复竞品历史图表函数（同步兼容字符串/数组输入）
export function generateCompetitorHistoryChartOption(
	competitor_amount_history: string | CompetitorHistoryItem[] | undefined | null // 入参新增string类型
) {
	// 核心修改：解析字符串/数组
	const validData: CompetitorHistoryItem[] =
		parseData<CompetitorHistoryItem>(competitor_amount_history);

	const options: EChartsOption = {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "shadow" }
		},
		grid: {
			top: "10%",
			bottom: "5%",
			left: "8%",
			right: "5%",
			containLabel: true
		},
		xAxis: [
			{
				type: "category",
				data: validData.map((d) => formatDate(d.date)),
				axisTick: { alignWithLabel: true },
				axisLabel: {
					rotate: 30,
					fontSize: 12
				}
			}
		],
		yAxis: [
			{
				type: "value",
				min: 0,
				axisLabel: {
					fontSize: 12
				}
			}
		],
		series: [
			{
				type: "bar",
				name: "数量",
				barWidth: "60%",
				barGap: "15%",
				barCategoryGap: "30%",
				label: {
					show: true,
					position: "top",
					fontSize: 11
				},
				data: validData.map((d) => (Number.isFinite(d.amount) ? d.amount : 0)),
				itemStyle: {
					color: "#4a65bf"
				}
			}
		]
	};
	return options;
}

export function normalizeCandidateLinkVariants(data: any) {
	const factory_links = Array.isArray(data?.factory_links) ? data.factory_links : [];
	const variant_Combination = Array.isArray(data?.variant_Combination)
		? data.variant_Combination
		: [];

	return {
		factory_links: factory_links.map((link: any) =>
			link && typeof link === "object" ? { ...link, id: link.id || uuid() } : link
		),
		variant_Combination: variant_Combination.map((variant: any) =>
			variant && typeof variant === "object"
				? { ...variant, id: variant.id || uuid() }
				: variant
		)
	};
}

export function ensureCandidateIds(data: any) {
	if (!data) return;

	if (Array.isArray(data.factory_links)) {
		data.factory_links.forEach((link: any) => {
			if (link && typeof link === "object" && !link.id) {
				link.id = uuid();
			}
		});
	}

	if (Array.isArray(data.variant_Combination)) {
		data.variant_Combination.forEach((variant: any) => {
			if (variant && typeof variant === "object" && !variant.id) {
				variant.id = uuid();
			}
		});
	}
}

export type ValidateVariantsOptions = {
	/** 是否要求每条变体都必须选择至少一个工厂链接，默认 true */
	requireEachVariantHasLinks?: boolean;
};

/**
 * 校验选品变体数据（名称、工厂链接组合、比例），用于保存前拦截。
 * @returns { valid: true } 或 { valid: false, message: string }
 */
export function validateBsrCandidateVariants(
	data: { variant_Combination?: any[] },
	options: ValidateVariantsOptions = {}
): { valid: true } | { valid: false; message: string } {
	const { requireEachVariantHasLinks = true } = options;
	const variants = Array.isArray(data?.variant_Combination) ? data.variant_Combination : [];

	for (let i = 0; i < variants.length; i++) {
		const v = variants[i];
		const idx = i + 1;
		if (!v || typeof v !== "object") continue;

		if (!v.name || String(v.name).trim() === "") {
			return { valid: false, message: `变体${idx}未填写名称` };
		}
		
		if (!v.description || String(v.description).trim() === "") {
			return { valid: false, message: `变体${idx}未填写描述` };
		}
		
		if (!v.image_url || String(v.image_url).trim() === "") {
			return { valid: false, message: `变体${idx}未上传图片` };
		}

		if (requireEachVariantHasLinks) {
			if (!v.selectedGroups || v.selectedGroups.length === 0) {
				return { valid: false, message: `变体${idx}未选择工厂链接组合` };
			}
			if (!v.groupProportions) v.groupProportions = {};
			for (const groupName of v.selectedGroups) {
				const raw = v.groupProportions[groupName];
				if (raw === undefined || raw === null || raw === "") {
					return { valid: false, message: `变体${idx}的${groupName}比例未填写` };
				}
				const num = typeof raw === "number" ? raw : Number(raw);
				if (!Number.isFinite(num)) {
					return { valid: false, message: `变体${idx}的${groupName}比例不是有效数字` };
				}
				v.groupProportions[groupName] = num;
			}
		}
	}
	return { valid: true };
}

// 保留原有代码
const userStore = useUserStore();
export const is_admin = computed(() => {
	return "admin" === userStore.info?.username;
});

export function convert_image_url(image_url: string) {
	return convert_image_url_to_self_proxy(image_url);
}

export function convert_image_url_to_wsrv_proxy(image_url: string) {
	return `https://wsrv.nl/?url=${encodeURIComponent(image_url)}`;
}

export function convert_image_url_to_self_proxy(image_url: string) {
	return (isDev ? `/dev/` : `/api/`) + `/proxy/image/?url=${encodeURIComponent(image_url)}`;
}

/** 选品主图展示 URL（与 BSR 选品列表一致：非空则走同源 /proxy/image） */
export function product_main_image_display_url(image_url?: string | null): string {
	const raw = String(image_url ?? "").trim();
	if (!raw) return "";
	return convert_image_url(raw);
}

/**
 * 图片位排序函数
 * 按照 "-" 分割，前后都是数字
 * 先排后面的数字，再排前面的数字
 * 例如：1-1, 2-1, 3-1, 1-2, 2-2, 3-2
 * @param a 第一个项目（需要有 key 或 label 属性）
 * @param b 第二个项目（需要有 key 或 label 属性）
 * @returns 排序结果
 */
/** 图需任务状态码 -> 展示文案 */
export const DESIGN_TASK_STATUS_MAP: Record<number, string> = {
	101: "待选参考图",
	102: "AI生成图需中",
	103: "待审核",
	201: "待摄影领取",
	202: "拍摄中",
	301: "待美工领取",
	302: "美工做图中",
	401: "待上传",
	500: "已完成",
	509: "已关闭"
};

export function designTaskStatusText(code: number): string {
	return DESIGN_TASK_STATUS_MAP[code] ?? `状态${code}`;
}

/** 编号 *-1 仅允许主图（与选图弹窗一致） */
export function isSlotLabelMinus1(label: string): boolean {
	return /^\d+-1$/.test(String(label || "").trim());
}

export type ImageSlotSortMode = "position" | "set";

const IMAGE_SLOT_SORT_MODE_STORAGE_KEY = "image_slot_sort_mode_by_sku_v1";

function readImageSlotSortModeMap(): Record<string, ImageSlotSortMode> {
	if (typeof localStorage === "undefined") return {};
	try {
		const raw = localStorage.getItem(IMAGE_SLOT_SORT_MODE_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const out: Record<string, ImageSlotSortMode> = {};
		for (const [k, v] of Object.entries(parsed || {})) {
			if (v === "position" || v === "set") out[k] = v;
		}
		return out;
	} catch {
		return {};
	}
}

function normalizeSortModeSku(sku: string): string {
	return String(sku || "")
		.trim()
		replace(/\s+/g, " ")
		.toUpperCase();
}

export function getImageSlotSortModeBySku(sku: string): ImageSlotSortMode {
	const key = normalizeSortModeSku(sku);
	if (!key) return "position";
	const map = readImageSlotSortModeMap();
	return map[key] || "position";
}

export function setImageSlotSortModeBySku(sku: string, mode: ImageSlotSortMode): void {
	const key = normalizeSortModeSku(sku);
	if (!key || typeof localStorage === "undefined") return;
	const map = readImageSlotSortModeMap();
	map[key] = mode;
	try {
		localStorage.setItem(IMAGE_SLOT_SORT_MODE_STORAGE_KEY, JSON.stringify(map));
	} catch {}
}

export function sortImageSlots(
	a: { key?: string; label?: string },
	b: { key?: string; label?: string },
	mode: ImageSlotSortMode = "position"
): number {
	const keyA = a.key || a.label || "";
	const keyB = b.key || b.label || "";

	// 按照 "-" 分割
	const partsA = keyA.split("-");
	const partsB = keyB.split("-");

	// 如果格式不正确，保持原顺序
	if (partsA.length !== 2 || partsB.length !== 2) {
		return 0;
	}

	const a1 = Number(partsA[0]);
	const a2 = Number(partsA[1]);
	const b1 = Number(partsB[0]);
	const b2 = Number(partsB[1]);

	// 如果数字无效，保持原顺序
	if (isNaN(a1) || isNaN(a2) || isNaN(b1) || isNaN(b2)) {
		return 0;
	}

	if (mode === "set") {
		// 按套图：先排前面的数字（a1, b1），再排后面的数字（a2, b2）
		if (a1 !== b1) return a1 - b1;
		return a2 - b2;
	}

	// 按位置：先排后面的数字（a2, b2），再排前面的数字（a1, b1）
	if (a2 !== b2) return a2 - b2;
	return a1 - b1;
}
