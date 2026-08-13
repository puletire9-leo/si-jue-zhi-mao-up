export type LcsStatus = "draft" | "asset" | "copy" | "ready";

/** 列表用：每个 MSKU 的卡点摘要（账号+变体 定位一行） */
export type LcsMskuCardTone = "blocked" | "pending_upload" | "uploaded";

export interface LcsMskuCardPoint {
	msku: string;
	amazonAccount: string;
	variantLabel: string;
	/** 卡点/进度一句：如「文案:待审」「已上传」 */
	cardPoint: string;
	tone: LcsMskuCardTone;
}

/** 与 `timeline.vue` 的 TimelineItem 对齐 */
export interface LcsActivityTimelineItem {
	time: string;
	content: string;
	operator?: string;
}

export interface LcsSkuRow {
	sku: string;
	title: string;
	category: string;
	/** 聚合：本选品下涉及的卖家账号（演示） */
	accounts: string[];
	/** 聚合：本 SKU 下全部 MSKU 对应的变体（去重，顺序与生成 MSKU 一致） */
	variants: string[];
	/** 按 MSKU 拆分的卡点，与工作室侧栏 MSKU 一一对应 */
	mskuCardPoints: LcsMskuCardPoint[];
	mskuCount: number;
	/** 商品图已定稿数 / 计划数（数量随选品变化） */
	productImagesDone: number;
	productImagesTotal: number;
	aPlusImagesDone: number;
	aPlusImagesTotal: number;
	copyPercent: number;
	status: LcsStatus;
	updatedAt: string;
	thumbStyle: Record<string, string>;
	/** 综合时间线（与图需列表 timeline 结构一致，供 Timeline 组件） */
	activityTimeline: LcsActivityTimelineItem[];
}

function thumbHue(seed: string): Record<string, string> {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 13) % 360;
	return {
		background: `linear-gradient(135deg, hsl(${h},42%,88%) 0%, hsl(${(h + 40) % 360},50%,78%) 100%)`
	};
}

/** 业务侧仅运营这五国；展示顺序固定 */
export const LCS_MARKETPLACES = ["UK", "DE", "FR", "IT", "ES"] as const;
export type LcsMarketplace = (typeof LCS_MARKETPLACES)[number];

/** 站点 → 资料语言（一对一，非英语国不补 EN） */
export const LCS_SITE_LOCALE: Record<LcsMarketplace, string> = {
	UK: "EN",
	DE: "DE",
	FR: "FR",
	IT: "IT",
	ES: "ES"
};

/** 一个 MSKU = 卖家账号 + 变体；站点/国家为 MSKU 下子数据 */
export interface LcsMockMsku {
	id: string;
	msku: string;
	/** 卖家账号标识 */
	amazonAccount: string;
	/** 变体（如颜色/尺码组合） */
	variantLabel: string;
	/** 子数据：该 MSKU 关联的站点/国家（1 个或多个） */
	sites: string[];
	owner: string;
	asin: string;
}

/** 账号名不含国家：同一卖家账号可对应多国站点 */
const MOCK_ACCOUNTS = ["店铺-主账号", "店铺-账号二", "店铺-账号三"];
const MOCK_OWNERS = ["张三", "李四", "王五", "赵六"];
const MOCK_VARIANTS = ["黑色-S", "黑色-L", "白色-O/S", "蓝-均码", "红-S", "灰-M"];
/** 仅 UK / DE / FR / IT / ES 的子集，用于演示不同 MSKU 覆盖范围 */
const COUNTRY_POOLS: LcsMarketplace[][] = [
	["UK"],
	["DE", "FR"],
	["IT", "ES"],
	["UK", "DE", "FR", "IT", "ES"],
	["DE", "FR", "IT"],
	["UK", "DE"]
];

/** 按 SKU 生成演示用 MSKU：账号 + 变体 + 负责人；sites 为子数据 */
export function mockMskusForSku(parentSku: string, count: number): LcsMockMsku[] {
	const base = parentSku.replace(/\D/g, "") || "0";
	const n = Math.max(1, Math.min(count || 3, 8));
	return Array.from({ length: n }, (_, i) => {
		const sites = [...COUNTRY_POOLS[i % COUNTRY_POOLS.length]];
		// 前几条同店，便于看左侧分组与站点并集
		const account = i < 3 ? MOCK_ACCOUNTS[0] : i < 5 ? MOCK_ACCOUNTS[1] : MOCK_ACCOUNTS[i % MOCK_ACCOUNTS.length];
		return {
			id: `${parentSku}-MS-${i + 1}`,
			msku: `AMZ-${base}-${String(i + 1).padStart(2, "0")}`,
			amazonAccount: account,
			variantLabel: MOCK_VARIANTS[i % MOCK_VARIANTS.length],
			sites,
			owner: MOCK_OWNERS[i % MOCK_OWNERS.length],
			asin: `B0${base.slice(-6).padStart(8, "0").slice(0, 8)}`.slice(0, 10)
		};
	});
}

function aggregateVariantLabels(parentSku: string, mskuCount: number): string[] {
	const labels = mockMskusForSku(parentSku, mskuCount).map((m) => m.variantLabel);
	return [...new Set(labels)];
}

function skuStrSeed(s: string): number {
	let x = 0;
	for (let i = 0; i < s.length; i++) x = (x + s.charCodeAt(i) * (i + 11)) % 10007;
	return x;
}

/** 演示：按 SKU+序号伪随机分配卡点，与 mockMskusForSku 列表对齐 */
function mockCardPointForIndex(parentSku: string, index: number): Pick<LcsMskuCardPoint, "cardPoint" | "tone"> {
	const r = (skuStrSeed(parentSku) + index * 31) % 9;
	const steps: Pick<LcsMskuCardPoint, "cardPoint" | "tone">[] = [
		{ cardPoint: "已上传", tone: "uploaded" },
		{ cardPoint: "材料齐·待上传", tone: "pending_upload" },
		{ cardPoint: "文案:AI 生成中", tone: "blocked" },
		{ cardPoint: "文案:待运营确认", tone: "blocked" },
		{ cardPoint: "商品图:第 3 张未定稿", tone: "blocked" },
		{ cardPoint: "图需:待美工接单", tone: "blocked" },
		{ cardPoint: "图需:设计中", tone: "blocked" },
		{ cardPoint: "A+:模块 2 待出图", tone: "blocked" },
		{ cardPoint: "A+:待运营选图", tone: "blocked" }
	];
	return steps[r];
}

export function buildMskuCardPoints(parentSku: string, mskuCount: number): LcsMskuCardPoint[] {
	const list = mockMskusForSku(parentSku, mskuCount);
	return list.map((m, i) => {
		const { cardPoint, tone } = mockCardPointForIndex(parentSku, i);
		return {
			msku: m.msku,
			amazonAccount: m.amazonAccount,
			variantLabel: m.variantLabel,
			cardPoint,
			tone
		};
	});
}

/** 演示：MSKU 相关文案/图需/商品图/A+/上传等状态变更 */
export function buildActivityTimeline(parentSku: string, mskuCount: number): LcsActivityTimelineItem[] {
	const ms = mockMskusForSku(parentSku, mskuCount);
	const w = (i: number) => {
		const m = ms[Math.min(Math.max(i, 0), ms.length - 1)];
		return `${m.amazonAccount}·${m.variantLabel}`;
	};
	const seed = skuStrSeed(parentSku);
	const pool: LcsActivityTimelineItem[] = [
		{ time: "04-01 15:40", content: `${w(0)} Listing 上传完成`, operator: "系统" },
		{ time: "04-01 14:05", content: `${w(1)} 商品图第 5 张已定稿`, operator: "美工-小陈" },
		{ time: "04-01 12:20", content: `${w(0)} A+ 模块 3 运营已选图`, operator: "张三" },
		{ time: "04-01 10:08", content: `${w(2)} 图需状态：设计中`, operator: "李四" },
		{ time: "03-31 18:30", content: `${w(1)} 文案 AI 推荐已生成，待确认`, operator: "系统" },
		{ time: "03-31 16:12", content: `图需任务已关联本 SKU（${parentSku}）`, operator: "王五" },
		{ time: "03-31 11:00", content: `${w(0)} 加入 Listing 内容工作室`, operator: "系统" }
	];
	const n = 4 + (seed % 4);
	return pool.slice(0, Math.min(n, pool.length));
}

type LcsSkuRowRaw = Omit<LcsSkuRow, "variants" | "mskuCardPoints" | "activityTimeline">;

const LCS_MOCK_SKU_ROWS_RAW: LcsSkuRowRaw[] = [
	{
		sku: "SKU-10021",
		title: "不锈钢沥水架 · 厨房窄边款",
		category: "厨具",
		mskuCount: 4,
		accounts: ["店铺-主账号", "店铺-账号二"],
		productImagesDone: 7,
		productImagesTotal: 7,
		aPlusImagesDone: 5,
		aPlusImagesTotal: 8,
		copyPercent: 100,
		status: "ready",
		updatedAt: "04-01 10:20",
		thumbStyle: thumbHue("10021")
	},
	{
		sku: "SKU-10022",
		title: "磁吸理线夹套装",
		category: "3C",
		mskuCount: 2,
		accounts: ["店铺-主账号"],
		productImagesDone: 4,
		productImagesTotal: 6,
		aPlusImagesDone: 2,
		aPlusImagesTotal: 6,
		copyPercent: 60,
		status: "copy",
		updatedAt: "03-31 16:02",
		thumbStyle: thumbHue("10022")
	},
	{
		sku: "SKU-10023",
		title: "婴儿硅胶餐盘分格",
		category: "母婴",
		mskuCount: 6,
		accounts: ["店铺-主账号", "店铺-账号三"],
		productImagesDone: 2,
		productImagesTotal: 9,
		aPlusImagesDone: 0,
		aPlusImagesTotal: 10,
		copyPercent: 20,
		status: "asset",
		updatedAt: "03-30 09:15",
		thumbStyle: thumbHue("10023")
	},
	{
		sku: "SKU-10024",
		title: "户外折叠椅轻量款",
		category: "运动",
		mskuCount: 3,
		accounts: ["店铺-主账号", "店铺-账号三"],
		productImagesDone: 0,
		productImagesTotal: 5,
		aPlusImagesDone: 0,
		aPlusImagesTotal: 7,
		copyPercent: 0,
		status: "draft",
		updatedAt: "03-29 14:40",
		thumbStyle: thumbHue("10024")
	},
	{
		sku: "SKU-10025",
		title: "真空压缩袋电动泵套装",
		category: "家居",
		mskuCount: 1,
		accounts: ["店铺-主账号"],
		productImagesDone: 6,
		productImagesTotal: 6,
		aPlusImagesDone: 7,
		aPlusImagesTotal: 7,
		copyPercent: 85,
		status: "copy",
		updatedAt: "04-01 08:55",
		thumbStyle: thumbHue("10025")
	},
	{
		sku: "SKU-10026",
		title: "玻璃密封罐六角系列",
		category: "厨具",
		mskuCount: 8,
		accounts: ["店铺-主账号", "店铺-账号二"],
		productImagesDone: 5,
		productImagesTotal: 10,
		aPlusImagesDone: 3,
		aPlusImagesTotal: 12,
		copyPercent: 45,
		status: "asset",
		updatedAt: "03-31 11:30",
		thumbStyle: thumbHue("10026")
	},
	{
		sku: "SKU-10027",
		title: "瑜伽砖高密度 EVA",
		category: "运动",
		mskuCount: 2,
		accounts: ["店铺-主账号"],
		productImagesDone: 8,
		productImagesTotal: 8,
		aPlusImagesDone: 4,
		aPlusImagesTotal: 9,
		copyPercent: 100,
		status: "ready",
		updatedAt: "03-28 19:12",
		thumbStyle: thumbHue("10027")
	},
	{
		sku: "SKU-10028",
		title: "宠物随行水杯斜跨款",
		category: "宠物",
		mskuCount: 5,
		accounts: ["店铺-主账号", "店铺-账号二", "店铺-账号三"],
		productImagesDone: 3,
		productImagesTotal: 7,
		aPlusImagesDone: 1,
		aPlusImagesTotal: 8,
		copyPercent: 30,
		status: "asset",
		updatedAt: "03-27 10:08",
		thumbStyle: thumbHue("10028")
	},
	{
		sku: "SKU-10029",
		title: "LED 镜前补光灯可充电",
		category: "家居",
		mskuCount: 3,
		accounts: ["店铺-主账号", "店铺-账号二"],
		productImagesDone: 5,
		productImagesTotal: 8,
		aPlusImagesDone: 6,
		aPlusImagesTotal: 8,
		copyPercent: 72,
		status: "copy",
		updatedAt: "04-01 12:00",
		thumbStyle: thumbHue("10029")
	},
	{
		sku: "SKU-10030",
		title: "儿童防撞角透明加厚",
		category: "母婴",
		mskuCount: 4,
		accounts: ["店铺-主账号", "店铺-账号三"],
		productImagesDone: 1,
		productImagesTotal: 6,
		aPlusImagesDone: 0,
		aPlusImagesTotal: 5,
		copyPercent: 10,
		status: "draft",
		updatedAt: "03-26 15:45",
		thumbStyle: thumbHue("10030")
	},
	{
		sku: "SKU-10031",
		title: "自行车手机支架防震",
		category: "3C",
		mskuCount: 2,
		accounts: ["店铺-账号二"],
		productImagesDone: 7,
		productImagesTotal: 7,
		aPlusImagesDone: 8,
		aPlusImagesTotal: 8,
		copyPercent: 95,
		status: "ready",
		updatedAt: "03-25 09:20",
		thumbStyle: thumbHue("10031")
	},
	{
		sku: "SKU-10032",
		title: "布艺收纳筐可折叠",
		category: "家居",
		mskuCount: 7,
		accounts: ["店铺-主账号", "店铺-账号二", "店铺-账号三"],
		productImagesDone: 4,
		productImagesTotal: 12,
		aPlusImagesDone: 2,
		aPlusImagesTotal: 11,
		copyPercent: 38,
		status: "asset",
		updatedAt: "03-24 18:33",
		thumbStyle: thumbHue("10032")
	}
];

export const LCS_MOCK_SKU_ROWS: LcsSkuRow[] = LCS_MOCK_SKU_ROWS_RAW.map((r) => ({
	...r,
	variants: aggregateVariantLabels(r.sku, r.mskuCount),
	mskuCardPoints: buildMskuCardPoints(r.sku, r.mskuCount),
	activityTimeline: buildActivityTimeline(r.sku, r.mskuCount)
}));

export function findMockSku(sku: string): LcsSkuRow | undefined {
	return LCS_MOCK_SKU_ROWS.find((r) => r.sku === sku);
}
