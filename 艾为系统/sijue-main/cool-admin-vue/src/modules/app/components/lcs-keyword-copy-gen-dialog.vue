<!-- ListingContentStudio：SKU 选词 + 竞品参考 → 生成文案（纯前端 mock） -->
<template>
	<el-dialog
		:model-value="modelValue"
		title="选词生成文案"
		width="min(1180px, 96vw)"
		align-center
		class="lcs-kw-copy-dialog"
		destroy-on-close
		@update:model-value="$emit('update:modelValue', $event)"
	>
		<div v-if="skuCode" class="dialog-subhead muted">
			<span class="sub-sku">{{ skuCode }}</span>
			<span v-if="skuTitle" class="sub-title">{{ skuTitle }}</span>
		</div>
		<p class="scope-tip">
			作用域为<strong>整个 SKU</strong>；提交后由异步任务生成，此处仅配置关键词、参考竞品与补充说明。
		</p>

		<!-- 1. 关键词 -->
		<section class="lcs-section">
			<div class="section-head">
				<h3 class="section-title">1. 待选关键词</h3>
				<p class="section-desc">
					勾选纳入列表的关键词并指定类型；默认类型为<strong>长尾词</strong>。已选词中：<strong>核心大词必须且只能 1 条</strong>，<strong>核心词最多 2 条</strong>，其余可为长尾词。表头支持各列正序/倒序排序。
				</p>
			</div>
			<div class="table-wrap">
				<el-table
					ref="kwTableRef"
					:data="keywordTableData"
					border
					size="small"
					max-height="320"
					row-key="id"
					@selection-change="onKeywordSelection"
					@sort-change="onKwTableSortChange"
				>
					<el-table-column type="selection" width="44" reserve-selection />
					<el-table-column
						prop="keyword"
						label="关键词"
						min-width="200"
						sortable="custom"
						show-overflow-tooltip
					/>
					<el-table-column prop="status" label="状态" width="92" sortable="custom">
						<template #default="{ row }">
							<el-tag size="small" type="success">{{ row.status }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column
						prop="trafficRatio"
						label="流量占比"
						width="96"
						align="right"
						sortable="custom"
					/>
					<el-table-column label="关键词类型" prop="role" width="140" sortable="custom">
						<template #default="{ row }">
							<el-select
								v-model="row.role"
								size="small"
								placeholder="长尾词"
								:disabled="!isKeywordSelected(row.id)"
								style="width: 100%"
							>
								<el-option
									v-for="opt in KEYWORD_ROLE_OPTIONS"
									:key="opt.value"
									:label="opt.label"
									:value="opt.value"
								/>
							</el-select>
						</template>
					</el-table-column>
					<el-table-column prop="country" label="国家" width="72" sortable="custom" />
					<el-table-column
						prop="adCompetitors"
						label="广告竞品数"
						width="102"
						align="right"
						sortable="custom"
					/>
					<el-table-column
						prop="ppcBid"
						label="PPC 竞价"
						width="120"
						show-overflow-tooltip
						sortable="custom"
					/>
					<el-table-column
						prop="monthlySearch"
						label="月搜索量"
						width="88"
						align="right"
						sortable="custom"
					/>
					<el-table-column
						prop="compositeScore"
						label="综合评分"
						width="88"
						align="right"
						sortable="custom"
					/>
					<el-table-column
						label="评分"
						prop="scoreA"
						width="76"
						align="center"
						sortable="custom"
					>
						<template #default="{ row }">
							<div class="score-stack">
								<span>{{ row.scoreA }}</span>
								<span class="muted tiny">{{ row.scoreB }}</span>
							</div>
						</template>
					</el-table-column>
					<el-table-column prop="scoreAt" label="评分日期" width="158" sortable="custom" />
					<el-table-column label="操作" width="100" fixed="right">
						<template #default>
							<el-button link type="primary" size="small" @click="toastMock('编辑')">编辑</el-button>
							<el-button link type="danger" size="small" @click="toastMock('删除')">删除</el-button>
						</template>
					</el-table-column>
				</el-table>
			</div>
			<div class="section-foot muted small">
				已选 {{ selectedKeywordIds.size }} 条 · 已选中须含<strong>核心大词 1 条</strong>、<strong>核心词 ≤2 条</strong>，其余为长尾词
			</div>
		</section>

		<!-- 2. 竞品文案 -->
		<section class="lcs-section">
			<div class="section-head">
				<h3 class="section-title">2. 参考竞品文案</h3>
				<p class="section-desc">从内部已抓取的竞品中<strong>勾选 4 组</strong>，作为标题与卖点的风格参考。</p>
			</div>
			<el-checkbox-group
				v-model="selectedCompetitorIds"
				class="competitor-grid"
				@change="onCompetitorCheck"
			>
				<div
					v-for="c in competitorCopies"
					:key="c.id"
					class="competitor-card"
					:class="{ checked: selectedCompetitorIds.includes(c.id) }"
				>
					<div class="competitor-card-h">
						<el-checkbox :label="c.id">
							<span class="comp-asin">{{ c.asin }}</span>
							<span class="muted small">{{ c.marketplace }} · {{ c.brandHint }}</span>
						</el-checkbox>
					</div>
					<div class="comp-title">{{ c.title }}</div>
					<ul class="comp-bullets">
						<li v-for="(b, i) in c.bullets" :key="i">{{ b }}</li>
					</ul>
				</div>
			</el-checkbox-group>
			<div class="section-foot muted small">已选 {{ selectedCompetitorIds.length }} / 4 组</div>
		</section>

		<!-- 3. 补充 -->
		<section class="lcs-section">
			<div class="section-head">
				<h3 class="section-title">3. 补充说明</h3>
				<p class="section-desc">
					例如：各变体需在标题中体现的参数（颜色/尺寸）、禁用词、品牌调性等。
				</p>
			</div>
			<el-input
				v-model="extraNotes"
				type="textarea"
				:rows="5"
				placeholder="选填，将一并交给生成任务…"
				maxlength="2000"
				show-word-limit
			/>
		</section>

		<template #footer>
			<el-button @click="close">取消</el-button>
			<el-button type="primary" @click="submitMock">重新生成文案</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts" name="lcs-keyword-copy-gen-dialog">
import { ref, watch, nextTick, computed } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps<{
	modelValue: boolean;
	skuCode?: string;
	skuTitle?: string;
}>();

const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const KEYWORD_ROLE_OPTIONS = [
	{ label: "核心大词", value: "core_head" },
	{ label: "核心词", value: "core" },
	{ label: "长尾词", value: "long_tail" }
] as const;

export type KeywordRole = (typeof KEYWORD_ROLE_OPTIONS)[number]["value"] | "";

interface KeywordRow {
	id: string;
	keyword: string;
	status: string;
	trafficRatio: string;
	role: KeywordRole;
	country: string;
	adCompetitors: string;
	ppcBid: string;
	monthlySearch: string;
	compositeScore: string;
	scoreA: string;
	scoreB: string;
	scoreAt: string;
}

const keywordRows = ref<KeywordRow[]>([
	{
		id: "k1",
		keyword: "flying disc cat launcher set",
		status: "已入库",
		trafficRatio: "0.1240",
		role: "long_tail",
		country: "英国",
		adCompetitors: "19.00",
		ppcBid: "0.82 / 0.65 ~ 1.10",
		monthlySearch: "4200",
		compositeScore: "16.16",
		scoreA: "7.69",
		scoreB: "8.47",
		scoreAt: "2026-02-26 05:16:28"
	},
	{
		id: "k2",
		keyword: "cat flying disc shooter",
		status: "已入库",
		trafficRatio: "0.0890",
		role: "long_tail",
		country: "英国",
		adCompetitors: "14.00",
		ppcBid: "0.71 / 0.55 ~ 0.95",
		monthlySearch: "2800",
		compositeScore: "15.36",
		scoreA: "7.20",
		scoreB: "8.10",
		scoreAt: "2026-02-26 04:02:11"
	},
	{
		id: "k3",
		keyword: "pets light-up flying disc cat launcher set",
		status: "已入库",
		trafficRatio: "0.0412",
		role: "long_tail",
		country: "英国",
		adCompetitors: "5.00",
		ppcBid: "0.45 / 0.30 ~ 0.60",
		monthlySearch: "890",
		compositeScore: "12.88",
		scoreA: "6.10",
		scoreB: "7.22",
		scoreAt: "2026-02-25 18:40:05"
	},
	{
		id: "k4",
		keyword: "automatic cat disc launcher indoor",
		status: "已入库",
		trafficRatio: "0.0288",
		role: "long_tail",
		country: "英国",
		adCompetitors: "11.00",
		ppcBid: "0.55 / 0.40 ~ 0.78",
		monthlySearch: "1500",
		compositeScore: "13.90",
		scoreA: "6.55",
		scoreB: "7.80",
		scoreAt: "2026-02-25 12:10:00"
	},
	{
		id: "k5",
		keyword: "interactive cat toy flying saucer",
		status: "已入库",
		trafficRatio: "0.0195",
		role: "long_tail",
		country: "英国",
		adCompetitors: "8.00",
		ppcBid: "0.38 / 0.28 ~ 0.52",
		monthlySearch: "620",
		compositeScore: "11.20",
		scoreA: "5.90",
		scoreB: "6.40",
		scoreAt: "2026-02-24 09:00:00"
	},
	{
		id: "k6",
		keyword: "usb rechargeable cat disc launcher",
		status: "已入库",
		trafficRatio: "0.0150",
		role: "long_tail",
		country: "英国",
		adCompetitors: "6.00",
		ppcBid: "0.50 / 0.35 ~ 0.68",
		monthlySearch: "410",
		compositeScore: "10.05",
		scoreA: "5.20",
		scoreB: "6.10",
		scoreAt: "2026-02-24 08:15:00"
	}
]);

interface CompetitorCopy {
	id: string;
	asin: string;
	marketplace: string;
	brandHint: string;
	title: string;
	bullets: string[];
}

const competitorCopies = ref<CompetitorCopy[]>([
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
	},
	{
		id: "c5",
		asin: "B0MEOWSHOT5",
		marketplace: "UK",
		brandHint: "竞品 E",
		title: "MeowShot Disc Gun — Ergonomic Grip for Daily Play Sessions",
		bullets: [
			"Ergonomic pistol grip reduces wrist strain",
			"Magazine holds 5 discs; quick reload slot",
			"Rubberized nozzle protects teeth if caught mid-air",
			"Replaceable spring kit for heavy users",
			"Matches modern grey home decor"
		]
	},
	{
		id: "c6",
		asin: "B0PAWFLING6",
		marketplace: "UK",
		brandHint: "竞品 F",
		title: "PawFling USB Launcher + Spare Disc Value Pack",
		bullets: [
			"Value pack: launcher + 6 spare discs",
			"Low-battery LED reminder",
			"Indoor/outdoor rated IP44 housing",
			"Supports wall mount (bracket optional)",
			"30-day return policy"
		]
	},
	{
		id: "c7",
		asin: "B0WHISKFLY7",
		marketplace: "UK",
		brandHint: "竞品 G",
		title: "WhiskFly Silent Launcher — Night Mode Under 40dB",
		bullets: [
			"Night mode under 40dB for apartment living",
			"Gradual speed ramp avoids startling shy cats",
			"Matte ceramic white finish",
			"Compatible with third-party 5.5\" discs",
			"UKCA marked"
		]
	},
	{
		id: "c8",
		asin: "B0ZOOMCAT8",
		marketplace: "UK",
		brandHint: "竞品 H",
		title: "ZoomCat Multi-Angle Disc Tower Launcher",
		bullets: [
			"Three launch angles: low / mid / high arc",
			"Tower design channels discs back to hopper",
			"Rubber feet + suction cups for tile floors",
			"App-free hardware only — no pairing",
			"Gift-ready packaging"
		]
	}
]);

const kwTableRef = ref();
const selectedKeywordIds = ref<Set<string>>(new Set());
const selectedCompetitorIds = ref<string[]>([]);
const extraNotes = ref("");

type KwTableSortOrder = "ascending" | "descending";

/** 用户点的表头排序；为 null 时表示未选列排序，行序为「已勾选在前、未勾选在后」 */
const kwUserSort = ref<{ prop: string; order: KwTableSortOrder } | null>(null);

const ROLE_SORT_ORDER: Record<string, number> = { core_head: 0, core: 1, long_tail: 2 };

function sortTrafficRatio(a: KeywordRow, b: KeywordRow) {
	return parseFloat(a.trafficRatio) - parseFloat(b.trafficRatio);
}

function sortByRole(a: KeywordRow, b: KeywordRow) {
	return (ROLE_SORT_ORDER[a.role] ?? 9) - (ROLE_SORT_ORDER[b.role] ?? 9);
}

function sortAdCompetitors(a: KeywordRow, b: KeywordRow) {
	return parseFloat(a.adCompetitors) - parseFloat(b.adCompetitors);
}

function ppcFirstNumber(s: string): number {
	const m = String(s).match(/[\d.]+/);
	return m ? parseFloat(m[0]) : 0;
}

function sortPpcBid(a: KeywordRow, b: KeywordRow) {
	return ppcFirstNumber(a.ppcBid) - ppcFirstNumber(b.ppcBid);
}

function sortMonthlySearch(a: KeywordRow, b: KeywordRow) {
	return (parseFloat(a.monthlySearch) || 0) - (parseFloat(b.monthlySearch) || 0);
}

function sortCompositeScore(a: KeywordRow, b: KeywordRow) {
	return (parseFloat(a.compositeScore) || 0) - (parseFloat(b.compositeScore) || 0);
}

function sortScoreA(a: KeywordRow, b: KeywordRow) {
	return (parseFloat(a.scoreA) || 0) - (parseFloat(b.scoreA) || 0);
}

function compareKwByProp(a: KeywordRow, b: KeywordRow, prop: string, order: KwTableSortOrder): number {
	let cmp = 0;
	switch (prop) {
		case "keyword":
			cmp = a.keyword.localeCompare(b.keyword, "zh-CN");
			break;
		case "status":
			cmp = a.status.localeCompare(b.status, "zh-CN");
			break;
		case "trafficRatio":
			cmp = sortTrafficRatio(a, b);
			break;
		case "role":
			cmp = sortByRole(a, b);
			break;
		case "country":
			cmp = a.country.localeCompare(b.country, "zh-CN");
			break;
		case "adCompetitors":
			cmp = sortAdCompetitors(a, b);
			break;
		case "ppcBid":
			cmp = sortPpcBid(a, b);
			break;
		case "monthlySearch":
			cmp = sortMonthlySearch(a, b);
			break;
		case "compositeScore":
			cmp = sortCompositeScore(a, b);
			break;
		case "scoreA":
			cmp = sortScoreA(a, b);
			break;
		case "scoreAt":
			cmp = a.scoreAt.localeCompare(b.scoreAt);
			break;
		default:
			cmp = 0;
	}
	return order === "descending" ? -cmp : cmp;
}

const keywordRowStableIndex = computed(() => {
	const m = new Map<string, number>();
	keywordRows.value.forEach((r, i) => m.set(r.id, i));
	return m;
});

const keywordTableData = computed(() => {
	const rows = [...keywordRows.value];
	const sel = selectedKeywordIds.value;
	const stable = keywordRowStableIndex.value;

	if (kwUserSort.value) {
		const { prop, order } = kwUserSort.value;
		rows.sort((a, b) => {
			const c = compareKwByProp(a, b, prop, order);
			if (c !== 0) return c;
			return (stable.get(a.id) ?? 0) - (stable.get(b.id) ?? 0);
		});
		return rows;
	}

	rows.sort((a, b) => {
		const sa = sel.has(a.id) ? 0 : 1;
		const sb = sel.has(b.id) ? 0 : 1;
		if (sa !== sb) return sa - sb;
		return (stable.get(a.id) ?? 0) - (stable.get(b.id) ?? 0);
	});
	return rows;
});

function onKwTableSortChange(payload: { prop?: string; order: string | null }) {
	const prop = payload.prop;
	const order = payload.order;
	if (!prop || order === null) {
		kwUserSort.value = null;
		return;
	}
	kwUserSort.value = { prop, order: order as KwTableSortOrder };
}

function isKeywordSelected(id: string): boolean {
	return selectedKeywordIds.value.has(id);
}

function onKeywordSelection(rows: KeywordRow[]) {
	selectedKeywordIds.value = new Set(rows.map((r) => r.id));
}

/** el-checkbox-group :max 在部分版本不生效，手动截断 */
function onCompetitorCheck() {
	if (selectedCompetitorIds.value.length > 4) {
		selectedCompetitorIds.value = selectedCompetitorIds.value.slice(0, 4);
		ElMessage.warning("最多选择 4 组竞品文案");
	}
}

watch(
	() => selectedCompetitorIds.value.length,
	(len) => {
		if (len > 4) {
			selectedCompetitorIds.value = selectedCompetitorIds.value.slice(0, 4);
		}
	}
);

function resetKeywordRolesDefault() {
	keywordRows.value.forEach((r) => {
		r.role = "long_tail";
	});
}

function resetDefaults() {
	kwUserSort.value = null;
	resetKeywordRolesDefault();
	selectedKeywordIds.value = new Set(["k1", "k2", "k3"]);
	selectedCompetitorIds.value = ["c1", "c2", "c3", "c4"];
	extraNotes.value =
		"黑色款标题需含 Large；白色款强调 narrow base；五点里至少 1 条写清充电方式与续航。";
}

function syncTableSelection() {
	const t = kwTableRef.value as {
		clearSelection: () => void;
		toggleRowSelection: (row: KeywordRow, selected?: boolean) => void;
	} | null;
	if (!t) return;
	t.clearSelection();
	keywordRows.value.forEach((row) => {
		if (selectedKeywordIds.value.has(row.id)) {
			t.toggleRowSelection(row, true);
		}
	});
}

watch(
	() => props.modelValue,
	(open) => {
		if (!open) return;
		resetDefaults();
		nextTick(() => syncTableSelection());
	}
);

function close() {
	emit("update:modelValue", false);
}

function submitMock() {
	if (selectedKeywordIds.value.size === 0) {
		ElMessage.warning("请至少选择一条关键词");
		return;
	}
	const selected = keywordRows.value.filter((r) => selectedKeywordIds.value.has(r.id));
	const missingType = selected.filter((r) => !r.role);
	if (missingType.length) {
		ElMessage.warning("已选关键词请全部指定类型（核心大词 / 核心词 / 长尾词）");
		return;
	}
	const nCoreHead = selected.filter((r) => r.role === "core_head").length;
	if (nCoreHead !== 1) {
		ElMessage.warning("在已选关键词中，核心大词必须且只能有 1 条");
		return;
	}
	const nCore = selected.filter((r) => r.role === "core").length;
	if (nCore > 2) {
		ElMessage.warning("核心词最多 2 条");
		return;
	}
	if (selectedCompetitorIds.value.length !== 4) {
		ElMessage.warning("请选择 4 组参考竞品文案");
		return;
	}
	const rc = { core_head: 0, core: 0, long_tail: 0 };
	selected.forEach((r) => {
		if (r.role === "core_head" || r.role === "core" || r.role === "long_tail") {
			rc[r.role]++;
		}
	});
	ElMessage.success(
		`[演示] 已提交异步「重新生成文案」：关键词 ${selected.length} 条（大词 ${rc.core_head} / 核心 ${rc.core} / 长尾 ${rc.long_tail}），竞品 4 组`
	);
	close();
}

function toastMock(action: string) {
	ElMessage.info(`[演示] ${action}`);
}
</script>

<style scoped lang="scss">
.dialog-subhead {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 10px;
	margin-bottom: 6px;
	font-size: 13px;
}

.sub-sku {
	font-weight: 600;
}

.sub-title {
	flex: 1;
	min-width: 0;
	line-height: 1.4;
}

.scope-tip {
	font-size: 13px;
	color: var(--el-text-color-regular);
	line-height: 1.55;
	margin: 0 0 16px;
}

.lcs-section {
	margin-bottom: 22px;
}

.section-head {
	margin-bottom: 10px;
}

.section-title {
	margin: 0 0 6px;
	font-size: 15px;
	font-weight: 600;
}

.section-desc {
	margin: 0;
	font-size: 12px;
	color: var(--el-text-color-secondary);
	line-height: 1.5;
}

.table-wrap {
	width: 100%;
	overflow-x: auto;
}

.section-foot {
	margin-top: 8px;
}

.score-stack {
	display: flex;
	flex-direction: column;
	gap: 2px;
	line-height: 1.2;
	font-size: 12px;
}

.tiny {
	font-size: 11px;
}

.competitor-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 12px;
}

.competitor-card {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	padding: 10px 12px;
	background: var(--el-fill-color-blank);
	transition:
		border-color 0.15s,
		box-shadow 0.15s;
}

.competitor-card.checked {
	border-color: var(--el-color-primary-light-5);
	box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.competitor-card-h {
	margin-bottom: 8px;
}

.com-asin {
	font-weight: 600;
	margin-right: 8px;
}

.comp-title {
	font-size: 13px;
	font-weight: 600;
	line-height: 1.4;
	margin-bottom: 8px;
	color: var(--el-text-color-primary);
}

.comp-bullets {
	margin: 0;
	padding-left: 18px;
	font-size: 12px;
	line-height: 1.45;
	color: var(--el-text-color-regular);
}

.muted {
	color: var(--el-text-color-secondary);
}
</style>