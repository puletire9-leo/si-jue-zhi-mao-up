/**
 * AI 生成文案任务 — 纯前端 mock（Run + Steps + Timeline）
 */

export type ListingAiRunPhase =
	| "queued"
	| "ai_params_running"
	| "ai_params_done"
	| "ai_params_failed"
	| "ai_copy_running"
	| "ai_copy_done"
	| "ai_copy_failed"
	| "awaiting_review"
	| "accepted"
	| "closed"
	| "rejected"
	| "superseded";

export type ListingAiRunStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface ListingAiRunStep {
	key: "enqueue" | "ai_params" | "ai_copy" | "publish_studio" | "review";
	label: string;
	status: ListingAiRunStepStatus;
	startedAt?: string;
	endedAt?: string;
	detail?: string;
}

export interface ListingAiRunTimelineEvent {
	at: string;
	title: string;
	desc?: string;
	level?: "info" | "success" | "warning" | "danger";
}

export type SnapshotKeywordRole = "core_head" | "core" | "long_tail";

/** 与选词生成文案弹窗一致：入参侧「已选关键词」一行 */
export interface ListingAiSnapshotKeyword {
	keyword: string;
	role: SnapshotKeywordRole;
	trafficRatio: string;
	monthlySearch: string;
	compositeScore: string;
	country: string;
}

/** AI 拆词结果（单 token 一行，供详情页矩阵左侧） */
export interface ListingAiSplitToken {
	/** 单词 / token */
	token: string;
	/** 拆词类型，如 核心名词、修饰词 */
	tokenType: string;
	/** 词频（演示：标题/五点出现次数或相对频次） */
	wordFreq: string;
	/** 搜索量（演示） */
	searchVolume: string;
	/** 相关度或质量分（演示） */
	score: string;
}

/** 单一语言：拆词表 + 系统关键词表（详情页 EN/DE 各一组） */
export interface ListingAiKeywordLocaleBlock {
	aiSplitTokens: ListingAiSplitToken[];
	systemKeywords: ListingAiSnapshotKeyword[];
	warningWords?: Array<{
		word: string;
		type: "品牌词" | "无关词" | "潜在风险词" | "违禁词";
		reason: string;
		/** 人工标注忽略后，关键词检测与审核校验均跳过该词 */
		ignored?: boolean;
	}>;
	selectedTitleWords?: {
		mainWords: string[];
		coreWords: string[];
		longTailPhrases: Array<Record<string, any>>;
	};
}

/** 与弹窗「参考竞品文案」卡片一致 */
export interface ListingAiSnapshotCompetitor {
	id: string;
	asin: string;
	marketplace: string;
	brandHint: string;
	title: string;
	bullets: string[];
}

export interface ListingAiParamsSnapshot {
	language: string;
	coreKeywordsCount: number;
	longTailCount: number;
	competitorGroupsUsed: number;
	paramsNote?: string;
	/** 实际勾选并参与生成的词（表格展示） */
	selectedKeywords: ListingAiSnapshotKeyword[];
	/** 实际勾选 4 组竞品 */
	selectedCompetitors: ListingAiSnapshotCompetitor[];
	/** 英语 / 德语 各：拆词 + 系统词（详情页四表） */
	keywordsByLocale: {
		en: ListingAiKeywordLocaleBlock;
		de: ListingAiKeywordLocaleBlock;
	};
	/** 补充说明，对应弹窗第 3 段 */
	extraNotes: string;
	rawPreview?: Record<string, unknown>;
}

export interface ListingAiCopySnapshot {
	/** 生成标题（Amazon Title） */
	titleDraft: string;
	/** 五点描述，固定 5 条 */
	bullets: string[];
	/** 长描述全文 */
	description: string;
	threadRef?: string;
}

export type ListingAiRequiredLang = "en" | "de";

export interface ListingAiCopyRun {
	id: string;
	runUuid: string;
	taskMode?: "full" | "delta";
	rootTaskId?: number | null;
	mergeIntoTaskId?: number | null;
	sku: string;
	/** 选品 ASIN，用于打开亚马逊产品页 */
	asin?: string;
	msku: string;
	productTitle: string;
	/** 选品主图（阿里云或亚马逊图 URL） */
	candidateImageUrl?: string;
	accountName: string;
	/** 按店铺采购 uk/de 推导的需生成语言 */
	requiredLanguages?: ListingAiRequiredLang[];
	/** 申请人（运营）展示名 */
	applicantName?: string;
	goTaskId?: string;
	langgraphRunId?: string;
	marketplace: string;
	phase: ListingAiRunPhase;
	trigger: "auto_msku" | "manual_retry" | "batch";
	triggerLabel: string;
	createdAt: string;
	updatedAt: string;
	errorMessage?: string;
	steps: ListingAiRunStep[];
	timeline: ListingAiRunTimelineEvent[];
	params?: ListingAiParamsSnapshot;
	copy?: ListingAiCopySnapshot;
}

function mkStep(
	key: ListingAiRunStep["key"],
	label: string,
	status: ListingAiRunStepStatus,
	extra?: Partial<ListingAiRunStep>
): ListingAiRunStep {
	return { key, label, status, ...extra };
}

function buildPipeline(phase: ListingAiRunPhase): {
	steps: ListingAiRunStep[];
	timeline: ListingAiRunTimelineEvent[];
	errorMessage?: string;
} {
	const t0 = "2026-04-01 09:00:05";
	const t1 = "2026-04-01 09:01:22";
	const t2 = "2026-04-01 09:03:18";
	const t3 = "2026-04-01 09:05:40";

	const timeline: ListingAiRunTimelineEvent[] = [
		{ at: t0, title: "任务入队", desc: "MSKU 维度触发自动流水线", level: "info" }
	];

	if (phase === "queued") {
		return {
			steps: [
				mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
				mkStep("ai_params", "AI 选参", "pending"),
				mkStep("ai_copy", "AI 生成文案", "pending"),
				mkStep("publish_studio", "写入 Studio", "pending"),
				mkStep("review", "人工确认", "pending")
			],
			timeline
		};
	}

	if (phase === "ai_params_running") {
		timeline.push({ at: t1, title: "AI 选参进行中", desc: "整理关键词与竞品上下文", level: "info" });
		return {
			steps: [
				mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
				mkStep("ai_params", "AI 选参", "running", { startedAt: t1 }),
				mkStep("ai_copy", "AI 生成文案", "pending"),
				mkStep("publish_studio", "写入 Studio", "pending"),
				mkStep("review", "人工确认", "pending")
			],
			timeline
		};
	}

	if (phase === "ai_params_failed") {
		timeline.push({
			at: t1,
			title: "AI 选参失败",
			desc: "上游 threads 504，trace_id: demo-9f2a",
			level: "danger"
		});
		return {
			steps: [
				mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
				mkStep("ai_params", "AI 选参", "failed", {
					startedAt: t1,
					endedAt: t1,
					detail: "网关超时"
				}),
				mkStep("ai_copy", "AI 生成文案", "skipped"),
				mkStep("publish_studio", "写入 Studio", "skipped"),
				mkStep("review", "人工确认", "skipped")
			],
			timeline,
			errorMessage: "AI 选参：网关超时"
		};
	}

	if (phase === "ai_params_done") {
		timeline.push({
			at: t1,
			title: "AI 选参完成",
			desc: "待调度文案生成",
			level: "success"
		});
		return {
			steps: [
				mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
				mkStep("ai_params", "AI 选参", "done", { startedAt: t0, endedAt: t1 }),
				mkStep("ai_copy", "AI 生成文案", "pending"),
				mkStep("publish_studio", "写入 Studio", "pending"),
				mkStep("review", "人工确认", "pending")
			],
			timeline
		};
	}

	if (phase === "ai_copy_running") {
		timeline.push(
			{ at: t1, title: "AI 选参完成", desc: "核心词 2、长尾 9、竞品 4 组", level: "success" },
			{ at: t2, title: "AI 生成文案进行中", level: "info" }
		);
		return {
			steps: [
				mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
				mkStep("ai_params", "AI 选参", "done", { startedAt: t0, endedAt: t1 }),
				mkStep("ai_copy", "AI 生成文案", "running", { startedAt: t2 }),
				mkStep("publish_studio", "写入 Studio", "pending"),
				mkStep("review", "人工确认", "pending")
			],
			timeline
		};
	}

	if (phase === "ai_copy_failed") {
		timeline.push(
			{ at: t1, title: "AI 选参完成", level: "success" },
			{
				at: t2,
				title: "AI 生成文案失败",
				desc: "输出 JSON 与 schema 不符",
				level: "danger"
			}
		);
		return {
			steps: [
				mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
				mkStep("ai_params", "AI 选参", "done", { startedAt: t0, endedAt: t1 }),
				mkStep("ai_copy", "AI 生成文案", "failed", {
					startedAt: t1,
					endedAt: t2,
					detail: "JSON schema"
				}),
				mkStep("publish_studio", "写入 Studio", "skipped"),
				mkStep("review", "人工确认", "skipped")
			],
			timeline,
			errorMessage: "文案 JSON 校验失败"
		};
	}

	// awaiting_review, ai_copy_done, accepted, rejected, superseded
	timeline.push(
		{ at: t1, title: "AI 选参完成", level: "success" },
		{ at: t2, title: "AI 生成文案完成", level: "success" },
		{ at: t3, title: "草稿已写入 Studio", desc: "可在工作室编辑与确认", level: "info" }
	);

	if (phase === "accepted") {
		timeline.push({
			at: "2026-04-02 14:20:00",
			title: "运营已确认",
			desc: "采纳当前版本",
			level: "success"
		});
	}
	if (phase === "rejected") {
		timeline.push({
			at: "2026-04-02 11:05:00",
			title: "运营已废弃",
			desc: "禁用词未剔除干净",
			level: "warning"
		});
	}
	if (phase === "superseded") {
		timeline.push({
			at: "2026-04-02 16:00:00",
			title: "已被新 Run 替代",
			desc: "run_uuid: demo-new-001",
			level: "info"
		});
	}

	const reviewStatus: ListingAiRunStepStatus =
		phase === "awaiting_review" || phase === "ai_copy_done"
			? "running"
			: phase === "accepted" || phase === "rejected" || phase === "superseded"
				? "done"
				: "pending";

	const reviewDetail =
		phase === "rejected"
			? "已废弃"
			: phase === "superseded"
				? "被替代"
				: phase === "accepted"
					? "已确认"
					: "待确认";

	return {
		steps: [
			mkStep("enqueue", "入队", "done", { startedAt: t0, endedAt: t0 }),
			mkStep("ai_params", "AI 选参", "done", { startedAt: t0, endedAt: t1 }),
			mkStep("ai_copy", "AI 生成文案", "done", { startedAt: t1, endedAt: t2 }),
			mkStep("publish_studio", "写入 Studio", "done", { startedAt: t2, endedAt: t3 }),
			mkStep("review", "人工确认", reviewStatus, { detail: reviewDetail })
		],
		timeline
	};
}

/** 弹窗同款竞品 c1–c4（演示） */
const DEMO_SELECTED_COMPETITORS: ListingAiSnapshotCompetitor[] = [
	{
		id: "c1",
		asin: "B0CATLAUNCH1",
		marketplace: "UK",
		brandHint: "竞品 A",
		title: "Cat Flying Disc Launcher — Indoor Training Toy with LED Ring",
		bullets: [
			"One-button launch keeps cats active and reduces boredom",
			"Soft-edge disc safe for paws; suitable for hardwood floors",
			"USB-C rechargeable base, up to 200 launches per charge",
			"Adjustable distance: short toss for kittens, longer for energetic cats",
			"Quiet motor mode for evening play without startling pets"
		]
	},
	{
		id: "c2",
		asin: "B0PETDISC02",
		marketplace: "UK",
		brandHint: "竞品 B",
		title: "Automatic Pet Disc Shooter for Cats & Small Dogs",
		bullets: [
			"Works with standard 6\" soft discs (two included)",
			"Anti-tip weighted base for enthusiastic jumpers",
			"Timer mode: auto launch every 30s / 60s",
			"Easy-clean hopper; fur-resistant matte finish",
			"CE certified adapter included"
		]
	},
	{
		id: "c3",
		asin: "B0FLYSAUCER3",
		marketplace: "DE",
		brandHint: "竞品 C",
		title: "Interaktives Katzenspielzeug — Flying Saucer Launcher Set",
		bullets: [
			"Kompatibel mit EU-Stecker, 2 Geschwindigkeitsstufen",
			"Leuchtender Ring fuer Dämmerungsspiel",
			"Rutschfeste Silikonfüße",
			"Ideal für Wohnungen ohne grossen Laufraum",
			"Deutsche Bedienungsanleitung beiliegt"
		]
	},
	{
		id: "c4",
		asin: "B0KITTYDISC4",
		marketplace: "UK",
		brandHint: "竞品 D",
		title: "Kitty Disc Launcher — Compact Narrow Base for Small Spaces",
		bullets: [
			"Footprint under A4 paper; fits next to litter area",
			"Includes 3 glow-in-the-dark discs",
			"Training guide PDF via QR on box",
			"1-year motor warranty",
			"Designed with feline behaviourist input"
		]
	}
];

function countRoles(kws: ListingAiSnapshotKeyword[]) {
	let core_head = 0;
	let core = 0;
	let long_tail = 0;
	for (const k of kws) {
		if (k.role === "core_head") core_head++;
		else if (k.role === "core") core++;
		else long_tail++;
	}
	return { core_head, core, long_tail };
}

function sampleParams(): ListingAiParamsSnapshot {
	const selectedKeywordsEn: ListingAiSnapshotKeyword[] = [
		{
			keyword: "flying disc cat launcher set",
			role: "core_head",
			trafficRatio: "0.1240",
			monthlySearch: "4200",
			compositeScore: "16.16",
			country: "英国"
		},
		{
			keyword: "cat flying disc shooter",
			role: "core",
			trafficRatio: "0.0890",
			monthlySearch: "2800",
			compositeScore: "15.36",
			country: "英国"
		},
		{
			keyword: "pets light-up flying disc cat launcher set",
			role: "core",
			trafficRatio: "0.0412",
			monthlySearch: "890",
			compositeScore: "12.88",
			country: "英国"
		},
		{
			keyword: "automatic cat disc launcher indoor",
			role: "long_tail",
			trafficRatio: "0.0288",
			monthlySearch: "1500",
			compositeScore: "13.90",
			country: "英国"
		},
		{
			keyword: "usb rechargeable cat disc launcher",
			role: "long_tail",
			trafficRatio: "0.0150",
			monthlySearch: "410",
			compositeScore: "10.05",
			country: "英国"
		}
	];
	const rc = countRoles(selectedKeywordsEn);
	const aiSplitTokensEn: ListingAiSplitToken[] = [
		{ token: "cat", tokenType: "核心名词", wordFreq: "18", searchVolume: "210000", score: "92" },
		{ token: "launcher", tokenType: "核心名词", wordFreq: "14", searchVolume: "8900", score: "88" },
		{ token: "disc", tokenType: "核心名词", wordFreq: "12", searchVolume: "12400", score: "85" },
		{ token: "flying", tokenType: "修饰词", wordFreq: "9", searchVolume: "5600", score: "78" },
		{ token: "usb", tokenType: "卖点词", wordFreq: "7", searchVolume: "3200", score: "72" },
		{ token: "rechargeable", tokenType: "卖点词", wordFreq: "6", searchVolume: "4100", score: "74" },
		{ token: "indoor", tokenType: "场景词", wordFreq: "5", searchVolume: "2800", score: "68" },
		{ token: "glow", tokenType: "修饰词", wordFreq: "4", searchVolume: "1900", score: "62" },
		{ token: "compact", tokenType: "修饰词", wordFreq: "4", searchVolume: "1500", score: "60" },
		{ token: "narrow", tokenType: "长尾修饰", wordFreq: "3", searchVolume: "620", score: "55" }
	];

	const systemKeywordsDe: ListingAiSnapshotKeyword[] = [
		{
			keyword: "Katzen Scheibenwerfer Set",
			role: "core_head",
			trafficRatio: "0.0920",
			monthlySearch: "2900",
			compositeScore: "15.40",
			country: "德国"
		},
		{
			keyword: "USB Katzen Spielzeug Werfer",
			role: "core",
			trafficRatio: "0.0610",
			monthlySearch: "1800",
			compositeScore: "14.20",
			country: "德国"
		},
		{
			keyword: "Leuchtscheibe Katze Innenbereich",
			role: "core",
			trafficRatio: "0.0380",
			monthlySearch: "720",
			compositeScore: "12.60",
			country: "德国"
		},
		{
			keyword: "automatischer Scheibenwerfer Katze",
			role: "long_tail",
			trafficRatio: "0.0240",
			monthlySearch: "960",
			compositeScore: "13.10",
			country: "德国"
		},
		{
			keyword: "schmale Basis Katzenlauncher",
			role: "long_tail",
			trafficRatio: "0.0110",
			monthlySearch: "380",
			compositeScore: "9.80",
			country: "德国"
		}
	];

	const aiSplitTokensDe: ListingAiSplitToken[] = [
		{ token: "Katze", tokenType: "Kernbegriff", wordFreq: "17", searchVolume: "165000", score: "91" },
		{ token: "Werfer", tokenType: "Kernbegriff", wordFreq: "13", searchVolume: "7200", score: "87" },
		{ token: "Scheibe", tokenType: "Kernbegriff", wordFreq: "11", searchVolume: "9800", score: "84" },
		{ token: "USB", tokenType: "Feature", wordFreq: "7", searchVolume: "4100", score: "73" },
		{ token: "aufladbar", tokenType: "Feature", wordFreq: "6", searchVolume: "3500", score: "71" },
		{ token: "Innen", tokenType: "Szenario", wordFreq: "5", searchVolume: "2400", score: "67" },
		{ token: "leuchtend", tokenType: "Modifikator", wordFreq: "4", searchVolume: "1200", score: "61" },
		{ token: "kompakt", tokenType: "Modifikator", wordFreq: "4", searchVolume: "980", score: "58" },
		{ token: "schmal", tokenType: "Long-tail", wordFreq: "3", searchVolume: "510", score: "54" },
		{ token: "Set", tokenType: "Modifikator", wordFreq: "3", searchVolume: "8800", score: "63" }
	];

	return {
		language: "English (UK)",
		coreKeywordsCount: rc.core_head + rc.core,
		longTailCount: rc.long_tail,
		competitorGroupsUsed: DEMO_SELECTED_COMPETITORS.length,
		paramsNote: "强调 USB 充电与室内小型底座",
		selectedKeywords: selectedKeywordsEn,
		keywordsByLocale: {
			en: { aiSplitTokens: aiSplitTokensEn, systemKeywords: selectedKeywordsEn },
			de: { aiSplitTokens: aiSplitTokensDe, systemKeywords: systemKeywordsDe }
		},
		selectedCompetitors: DEMO_SELECTED_COMPETITORS,
		extraNotes:
			"黑色款标题需含 Large；白色款强调 narrow base；五点里至少 1 条写清充电方式与续航。",
		rawPreview: {
			duplicate_num: 1,
			key_parameters: ["USB-C", "narrow base", "glow disc"],
			package_info: { units: "1 launcher + 3 discs" }
		}
	};
}

export function snapshotKeywordRoleLabel(role: SnapshotKeywordRole): string {
	const map: Record<SnapshotKeywordRole, string> = {
		core_head: "核心大词",
		core: "核心词",
		long_tail: "长尾词"
	};
	return map[role];
}

function sampleCopyDiscLauncher(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — USB-C Rechargeable, Glow Discs, Compact Base for Small Rooms`,
		bullets: [
			"Keep indoor cats engaged with one-touch launch and three glow-in-the-dark discs; quiet motor suits flats and evening play.",
			"USB-C rechargeable base delivers up to 200 launches per charge; low-battery LED reminds you before sessions stop.",
			"Compact narrow base fits next to litter areas with a footprint under A4 paper—ideal for kitchens and hallway corners.",
			"Adjustable toss distance for kittens vs energetic cats; soft-edge discs designed for paws and hardwood-friendly play.",
			"Includes quick-start training guide (QR on box), anti-tip weighted housing, and 1-year motor warranty for peace of mind."
		],
		description: `Bring high-energy play into small spaces. This launcher is built for UK indoor living: a narrow base, USB-C charging, and discs you can spot at dusk. The motor ramps gradually so shy cats are not startled, while confident hunters get a longer arc at the tap of a button.

We designed the hopper for quick reloads between sessions and easy wipe-down after treat time. The package contains the launcher, three glow discs, and a printed QR that opens a short training PDF—perfect for first-time disc users.

Whether you are redirecting a bored climber or adding variety to a multi-cat home, the launcher keeps sessions short, repeatable, and safe on hard floors. UKCA-oriented documentation is included; always supervise play and replace discs if edges show wear.`,
		threadRef: "thread_demo_7c21"
	};
}

function sampleCopyFeatherWand(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — Replaceable Tips, Soft Grip Handle, Quiet Play`,
		bullets: [
			"Interchangeable feather / worm tips snap in securely; refresh prey drive without buying a whole new wand.",
			"Lightweight ergonomic handle reduces wrist fatigue during long bonding sessions with kittens and seniors.",
			"Flexible fibreglass spine adds unpredictable motion while staying gentle if paws intercept the line.",
			"Tip caps tuck into the handle for travel; stash in a drawer or take to cattery visits without tangling.",
			"Washable faux-fur bodies; air-dry and reattach—no motor, no batteries, apartment-friendly quiet play."
		],
		description: `A wand toy should feel like an extension of your hand: responsive, quiet, and easy to refresh. This set ships with multiple tip styles so you can rotate textures and keep hunting instincts sharp.

The spine is tuned for fluttery, bird-like motion without aggressive snap-back. When play ends, coil the line into the handle channel and cap the tip—ready for the next session.

Supervise all interactive toys and inspect tips regularly; replace if fibres loosen. Designed for indoor use on carpet and rugs.`,
		threadRef: "thread_demo_fe88"
	};
}

function sampleCopyFountain(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — 2.5L, Triple Filtration, Ultra-Quiet Pump`,
		bullets: [
			"2.5-litre tank supports multi-pet households; translucent window shows when to refill without lifting the lid.",
			"Three-stage filter softens tap water and catches hair—replace monthly in hard-water areas for best flow.",
			"DC pump under 35 dB at 30 cm; rubber feet isolate vibration so timid cats approach faster.",
			"Cordless pump lift for cleaning: separate base, rinse tray and impeller under running water.",
			"Includes USB power adapter with EU plug; spare filter and cleaning brush in the box."
		],
		description: `Hydration habits improve when water tastes better and the pump stays whisper-quiet. This fountain pairs a wide drinking surface with a stable, tip-resistant base for enthusiastic whiskers.

The filtration stack targets odour and debris while keeping flow steady between cartridge changes. Weekly rinsing keeps slime down; descale the pump monthly in limescale-heavy regions.

Always place on a level surface away from food bowls to reduce splash. Unplug before maintenance; do not immerse the adapter.`,
		threadRef: "thread_demo_aq02"
	};
}

function sampleCopyTunnel(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — 3-Way Tunnel, Ball Pit, Foldable for Storage`,
		bullets: [
			"Three peek holes and a central ball pit encourage stalking, hiding, and pounce practice in one compact layout.",
			"Wire-spring frame pops open in seconds; folds flat with ties for under-bed or wardrobe storage between play weeks.",
			"Ripstop polyester shell wipes clean; reinforced seams stand up to multi-cat households and holiday zoomies.",
			"Non-slip base dots reduce sliding on tile; tunnel diameter fits average adult cats without shoulder squeeze.",
			"Includes four crinkle balls; add your own toys to the pit for scent-swapping and solo enrichment."
		],
		description: `Give cats a circuit they can own: a tunnel that branches, crinkles, and ends in a ball corral. The frame is self-supporting so you are not fighting poles—just unfold, zip the pit rim, and let them explore.

When guests visit or you need floor space back, collapse the tunnels, roll, and secure with the built-in straps. Spot-clean the shell or vacuum fur from the pit weekly.

Supervise first sessions with kittens; remove damaged balls if plastic cracks. Not intended for outdoor weather.`,
		threadRef: "thread_demo_tn91"
	};
}

function sampleCopyLaser(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — Wall Mount, Adjustable Sweep, Session Timer`,
		bullets: [
			"Mounts above shelf height to keep beams off floors and away from eyes; includes template and anchors for drywall.",
			"Wide-angle head covers ceiling corners where cats love to chase; micro-adjust knobs lock your favourite sweep.",
			"Three speed patterns plus random mode reduce predictability for clever hunters who memorize loops.",
			"Auto shut-off at 15 / 30 minutes prevents overstimulation when you step out; resumes with one tap.",
			"USB-powered brick hides behind furniture; 2 m cable reaches nearest outlet without dangling across walkways."
		],
		description: `Wall-mounted lasers keep play vertical and clutter-free. Aim the dot along crown moulding, down door frames, or across the sofa back—cats get cardio without you holding a pointer.

The timer protects shy pets from fixation; pair with treat rewards at session end to create a cool-down ritual. Check wall material before install; use appropriate anchors for plaster or brick.

Never aim at eyes; supervise play and combine with physical toys for full enrichment.`,
		threadRef: "thread_demo_lz33"
	};
}

function sampleCopyFeeder(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — Elevated Dual Bowls, Non-Slip Mat, Dishwasher Safe`,
		bullets: [
			"15° tilted stainless bowls reduce whisker fatigue and neck strain for cats who graze throughout the day.",
			"Dual trays separate wet and dry rations; 350 ml each suits average adults—refill markers embossed inside.",
			"Raised ABS stand channels spills into the included silicone mat; rinse mat weekly to keep floors stain-free.",
			"Rubber feet and mat grip stop enthusiastic eaters from pushing the station across tile or laminate.",
			"Bowls pop out for dishwasher top rack; stand wipes clean with a damp cloth—no crevices for ant trails."
		],
		description: `Elevated feeding keeps posture neutral and mess contained. The mat catches kibble scatter and water drips before they hit grout lines, while tilted bowls keep food centred for flat-faced breeds.

Assembly is tool-free: press bowls into rings, place on stand, position mat. Stainless resists odour better than plastic for raw or oily diets.

Hand-wash stand if using enzymatic cleaners; avoid abrasive pads on the matte finish.`,
		threadRef: "thread_demo_fd55"
	};
}

function sampleCopyBedMat(productTitle: string): ListingAiCopySnapshot {
	return {
		titleDraft: `${productTitle} — 3 Heat Levels, Auto Shut-Off, Washable Cover`,
		bullets: [
			"Carbon-film heating warms the sleep surface—not the room—so senior joints get gentle relief without drying fur.",
			"Three temperature steps with LED memory; returns to last setting after unplugging for travel.",
			"12-hour auto power-down if you forget the panel; chew-resistant cord sheath routes away from the nest area.",
			"Removable plush cover machine-washes cold; line-dry to preserve the waterproof inner liner.",
			"40×50 cm footprint fits most carriers and window perches; folds for storage when seasons change."
		],
		description: `A heated mat should feel like a sun patch you can schedule. The controller lives on a short tether so curious paws do not toggle settings mid-nap.

Layer the mat under your cat's favourite blanket for extra insulation in drafty flats. Always plug into a grounded outlet; do not puncture the liner or use outdoors.

Veterinary advice recommended for pets with reduced mobility or circulation conditions.`,
		threadRef: "thread_demo_bd77"
	};
}

function sampleCopyForProduct(productTitle: string): ListingAiCopySnapshot {
	const t = productTitle.toLowerCase();
	if (t.includes("fountain") || t.includes("water")) return sampleCopyFountain(productTitle);
	if (t.includes("feather") || t.includes("wand")) return sampleCopyFeatherWand(productTitle);
	if (t.includes("tunnel")) return sampleCopyTunnel(productTitle);
	if (t.includes("laser")) return sampleCopyLaser(productTitle);
	if (t.includes("feeder") || t.includes("raised cat")) return sampleCopyFeeder(productTitle);
	if (t.includes("bed mat") || t.includes("heated")) return sampleCopyBedMat(productTitle);
	return sampleCopyDiscLauncher(productTitle);
}

function makeRun(partial: Omit<ListingAiCopyRun, "steps" | "timeline" | "errorMessage"> & { id: string }): ListingAiCopyRun {
	const { steps, timeline, errorMessage } = buildPipeline(partial.phase);
	const hasAiOutput =
		partial.phase !== "queued" &&
		partial.phase !== "ai_params_running" &&
		partial.phase !== "ai_params_failed";

	const hasFullCopy =
		hasAiOutput &&
		partial.phase !== "ai_copy_running" &&
		partial.phase !== "ai_copy_failed";

	return {
		...partial,
		steps,
		timeline,
		errorMessage,
		params: hasAiOutput ? sampleParams() : undefined,
		copy: hasFullCopy ? sampleCopyForProduct(partial.productTitle) : undefined
	};
}

/** 演示数据：覆盖各阶段 */
export const LISTING_AI_COPY_MOCK_RUNS: ListingAiCopyRun[] = [
	makeRun({
		id: "lac-001",
		runUuid: "a1b2c3d4-0001-4e00-8000-000000000001",
		sku: "SKU-10021",
		msku: "AMZ-UK-10021-L-BLK",
		productTitle: "Kitty Disc Launcher Set (Large, Black)",
		accountName: "UK · PetHive",
		marketplace: "UK",
		phase: "awaiting_review",
		trigger: "auto_msku",
		triggerLabel: "MSKU 自动生成",
		createdAt: "2026-04-02 08:55:00",
		updatedAt: "2026-04-02 09:05:40"
	}),
	makeRun({
		id: "lac-002",
		runUuid: "a1b2c3d4-0002-4e00-8000-000000000002",
		sku: "SKU-10021",
		msku: "AMZ-UK-10021-L-WHT",
		productTitle: "Kitty Disc Launcher Set (Large, White)",
		accountName: "UK · PetHive",
		marketplace: "UK",
		phase: "ai_copy_running",
		trigger: "auto_msku",
		triggerLabel: "MSKU 自动生成",
		createdAt: "2026-04-02 09:10:12",
		updatedAt: "2026-04-02 09:12:30"
	}),
	makeRun({
		id: "lac-003",
		runUuid: "a1b2c3d4-0003-4e00-8000-000000000003",
		sku: "SKU-10088",
		msku: "AMZ-DE-10088-STD",
		productTitle: "Silent Cat Feather Wand with Replaceable Tips",
		accountName: "DE · KatzenPro",
		marketplace: "DE",
		phase: "accepted",
		trigger: "manual_retry",
		triggerLabel: "人工重试",
		createdAt: "2026-04-01 16:00:00",
		updatedAt: "2026-04-02 14:20:00"
	}),
	makeRun({
		id: "lac-004",
		runUuid: "a1b2c3d4-0004-4e00-8000-000000000004",
		sku: "SKU-10040",
		msku: "AMZ-US-10040-RED",
		productTitle: "Automatic Laser Cat Toy — Wall Mount Kit",
		accountName: "US · PawsLab",
		marketplace: "US",
		phase: "ai_params_failed",
		trigger: "batch",
		triggerLabel: "批次任务",
		createdAt: "2026-04-02 07:30:00",
		updatedAt: "2026-04-02 07:31:22"
	}),
	makeRun({
		id: "lac-005",
		runUuid: "a1b2c3d4-0005-4e00-8000-000000000005",
		sku: "SKU-10055",
		msku: "AMZ-UK-10055-S",
		productTitle: "Foldable Cat Tunnel 3-Way with Ball Pit",
		accountName: "UK · PetHive",
		marketplace: "UK",
		phase: "ai_copy_failed",
		trigger: "auto_msku",
		triggerLabel: "MSKU 自动生成",
		createdAt: "2026-04-02 06:12:00",
		updatedAt: "2026-04-02 06:15:18"
	}),
	makeRun({
		id: "lac-006",
		runUuid: "a1b2c3d4-0006-4e00-8000-000000000006",
		sku: "SKU-10021",
		msku: "AMZ-UK-10021-L-BLK",
		productTitle: "Kitty Disc Launcher Set (Large, Black)",
		accountName: "UK · PetHive",
		marketplace: "UK",
		phase: "superseded",
		trigger: "auto_msku",
		triggerLabel: "MSKU 自动生成",
		createdAt: "2026-04-01 10:00:00",
		updatedAt: "2026-04-02 16:00:00"
	}),
	makeRun({
		id: "lac-007",
		runUuid: "a1b2c3d4-0007-4e00-8000-000000000007",
		sku: "SKU-10070",
		msku: "AMZ-FR-10070-1",
		productTitle: "Cordless Pet Water Fountain 2.5L with Filter",
		accountName: "FR · AquaMiau",
		marketplace: "FR",
		phase: "rejected",
		trigger: "auto_msku",
		triggerLabel: "MSKU 自动生成",
		createdAt: "2026-03-30 18:00:00",
		updatedAt: "2026-04-02 11:05:00"
	}),
	makeRun({
		id: "lac-008",
		runUuid: "a1b2c3d4-0008-4e00-8000-000000000008",
		sku: "SKU-10200",
		msku: "AMZ-UK-10200-DUO",
		productTitle: "Dual-Tray Raised Cat Feeder with Mat",
		accountName: "UK · PetHive",
		marketplace: "UK",
		phase: "queued",
		trigger: "auto_msku",
		triggerLabel: "MSKU 自动生成",
		createdAt: "2026-04-02 09:40:00",
		updatedAt: "2026-04-02 09:40:00"
	}),
	makeRun({
		id: "lac-009",
		runUuid: "a1b2c3d4-0009-4e00-8000-000000000009",
		sku: "SKU-10112",
		msku: "AMZ-IT-10112-SM",
		productTitle: "Heated Cat Bed Mat 40×50cm",
		accountName: "IT · NannaGatto",
		marketplace: "IT",
		phase: "ai_params_running",
		trigger: "batch",
		triggerLabel: "批次任务",
		createdAt: "2026-04-02 09:41:00",
		updatedAt: "2026-04-02 09:41:05"
	}),
	makeRun({
		id: "lac-010",
		runUuid: "a1b2c3d4-000a-4e00-8000-00000000000a",
		sku: "SKU-10112",
		msku: "AMZ-IT-10112-SM",
		productTitle: "Heated Cat Bed Mat 40×50cm",
		accountName: "IT · NannaGatto",
		marketplace: "IT",
		phase: "ai_params_done",
		trigger: "batch",
		triggerLabel: "批次任务",
		createdAt: "2026-04-02 09:35:00",
		updatedAt: "2026-04-02 09:36:40"
	})
];

export function getListingAiCopyRunById(id: string): ListingAiCopyRun | undefined {
	return LISTING_AI_COPY_MOCK_RUNS.find((r) => r.id === id);
}

export const LISTING_AI_RUN_PHASE_OPTIONS: { value: ListingAiRunPhase | ""; label: string }[] = [
	{ value: "", label: "全部阶段" },
	{ value: "queued", label: "排队中" },
	{ value: "ai_params_running", label: "AI 选参中" },
	{ value: "ai_params_done", label: "选参完成" },
	{ value: "ai_params_failed", label: "选参失败" },
	{ value: "ai_copy_running", label: "文案生成中" },
	{ value: "ai_copy_done", label: "文案完成" },
	{ value: "ai_copy_failed", label: "文案失败" },
	{ value: "awaiting_review", label: "待 Studio 确认" },
	{ value: "accepted", label: "已确认" },
	{ value: "closed", label: "已关闭" },
	{ value: "rejected", label: "已废弃" },
	{ value: "superseded", label: "已替代" }
];

export function phaseLabel(phase: ListingAiRunPhase): string {
	const row = LISTING_AI_RUN_PHASE_OPTIONS.find((o) => o.value === phase);
	return row?.label ?? phase;
}

export function phaseTagType(
	phase: ListingAiRunPhase
): "success" | "warning" | "danger" | "info" {
	if (
		phase === "accepted" ||
		phase === "ai_params_done" ||
		phase === "ai_copy_done"
	) {
		return "success";
	}
	if (phase === "closed") return "info";
	if (
		phase === "ai_params_failed" ||
		phase === "ai_copy_failed" ||
		phase === "rejected"
	) {
		return "danger";
	}
	if (
		phase === "awaiting_review" ||
		phase === "ai_params_running" ||
		phase === "ai_copy_running" ||
		phase === "queued"
	) {
		return "warning";
	}
	if (phase === "superseded") return "info";
	return "info";
}

export function runProgressText(run: ListingAiCopyRun): string {
	const done = run.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
	return `${done}/${run.steps.length}`;
}
