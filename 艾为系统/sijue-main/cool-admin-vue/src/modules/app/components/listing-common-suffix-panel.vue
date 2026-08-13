<template>
	<transition name="review-panel-pop">
		<div v-if="open" class="suffix-panel">
			<div class="suffix-panel-head">
				<div>
					<div class="suffix-title">常用后缀</div>
					<div class="suffix-sub">
						展示全员后缀，均可一键添加；仅可编辑本人提交的后缀
					</div>
				</div>
				<el-button link class="suffix-close" @click="close">收起</el-button>
			</div>
			<div v-loading="loading" class="suffix-panel-body">
				<div class="suffix-toolbar">
					<el-input
						v-model="searchKeyword"
						size="small"
						clearable
						placeholder="搜索场景或英/德后缀"
						class="suffix-search"
					/>
					<el-button size="small" type="primary" @click="startAdd">新增</el-button>
				</div>
				<el-table
					:data="filteredRows"
					border
					size="small"
					max-height="300"
					class="suffix-table"
				>
					<el-table-column label="使用场景" min-width="100">
						<template #default="{ row }">
							<el-input
								v-model="row.use_scene"
								size="small"
								placeholder="如：变体尺寸"
								maxlength="255"
								:disabled="!isRowEditable(row)"
							/>
						</template>
					</el-table-column>
					<el-table-column label="英文" min-width="110">
						<template #default="{ row }">
							<el-input
								v-model="row.suffix_en"
								size="small"
								placeholder="标题英文后缀"
								maxlength="500"
								:disabled="!isRowEditable(row) || row._translating"
								@blur="onSuffixEnBlur(row)"
							/>
						</template>
					</el-table-column>
					<el-table-column label="德文" min-width="110">
						<template #default="{ row }">
							<el-input
								v-model="row.suffix_de"
								size="small"
								placeholder="标题德文后缀"
								maxlength="500"
								:disabled="!isRowEditable(row) || row._translating"
							/>
						</template>
					</el-table-column>
					<el-table-column
						prop="submitter"
						label="提交人"
						width="80"
						show-overflow-tooltip
					/>
					<el-table-column label="操作" width="188" align="center" fixed="right">
						<template #default="{ row }">
							<el-button
								v-if="!isRowAppliedToTitle(row)"
								link
								type="primary"
								size="small"
								:disabled="
									Boolean(row._saving) ||
									savingAll ||
									Boolean(row._translating) ||
									(!trimRowFields(row).suffix_en && !trimRowFields(row).suffix_de)
								"
								@click="applyToTitle(row)"
								>一键添加</el-button
							>
							<el-button
								v-else
								link
								type="warning"
								size="small"
								:disabled="Boolean(row._saving) || savingAll"
								@click="revertFromTitle(row)"
								>取消添加</el-button
							>
							<template v-if="isRowOwned(row)">
								<el-button
									v-if="isRowDirty(row)"
									link
									type="primary"
									size="small"
									:loading="row._saving"
									:disabled="savingAll"
									@click="saveRow(row)"
									>保存</el-button
								>
								<el-button
									v-if="row._draft"
									link
									size="small"
									:disabled="Boolean(row._saving) || savingAll"
									@click="cancelDraft(row)"
									>取消</el-button
								>
								<el-button
									v-else
									link
									type="danger"
									size="small"
									:disabled="Boolean(row._saving) || savingAll"
									@click="submitDelete(row)"
									>删除</el-button
								>
							</template>
						</template>
					</el-table-column>
				</el-table>
				<div v-if="!filteredRows.length && !loading" class="suffix-empty">
					{{ searchKeyword.trim() ? "无匹配后缀" : "暂无常用后缀，点击「新增」添加" }}
				</div>
				<div class="suffix-panel-footer">
					<el-button
						size="small"
						type="primary"
						:disabled="!hasPendingChanges"
						:loading="savingAll"
						@click="saveAllPending"
						>保存全部</el-button
					>
				</div>
			</div>
		</div>
	</transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useBase } from "/$/base";
import {
	confirmReviewFloatDelete,
	confirmReviewFloatTranslateDe
} from "../utils/review-float-confirm";
import {
	addListingCommonSuffix,
	deleteListingCommonSuffix,
	fetchListingCommonSuffixes,
	translateListingSuffixEnToDe,
	updateListingCommonSuffix,
	type CommonSuffixRecord,
	type CommonSuffixApplyPayload,
	type CommonSuffixRevertPayload
} from "../utils/listing-common-suffix-api";

export type { CommonSuffixApplyPayload };

type CommonSuffixRow = CommonSuffixRecord & {
	_clientKey?: string;
	_draft?: boolean;
	_saving?: boolean;
	_translating?: boolean;
	_translatePromptedEn?: string;
	_originScene?: string;
	_originSuffixEn?: string;
	_originSuffixDe?: string;
};

const props = withDefaults(
	defineProps<{
		open: boolean;
		appliedRowKeys?: string[];
	}>(),
	{ appliedRowKeys: () => [] }
);
const emit = defineEmits<{
	"update:open": [open: boolean];
	saved: [list: CommonSuffixRecord[]];
	applyToTitle: [payload: CommonSuffixApplyPayload];
	revertFromTitle: [payload: CommonSuffixRevertPayload];
}>();

function getSuffixRowKey(row: CommonSuffixRow) {
	if (row._clientKey) return row._clientKey;
	if (row.id) return `id:${row.id}`;
	return `draft:${rows.value.indexOf(row)}`;
}

function isRowAppliedToTitle(row: CommonSuffixRow) {
	return props.appliedRowKeys.includes(getSuffixRowKey(row));
}

const { user } = useBase();

const rows = ref<CommonSuffixRow[]>([]);
const loading = ref(false);
const savingAll = ref(false);
const searchKeyword = ref("");

const currentUserId = computed(() => Number(user.info?.id || 0));

const currentSubmitterLabel = computed(() =>
	String(user.info?.name || user.info?.nickName || user.info?.username || "").trim()
);

function isRowOwned(row: CommonSuffixRow) {
	if (row._draft) return true;
	const uid = currentUserId.value;
	if (!uid) return false;
	return Number(row.user_id) === uid;
}

function isRowEditable(row: CommonSuffixRow) {
	return isRowOwned(row) && !Boolean(row._saving) && !savingAll.value;
}

function trimRowFields(row: Pick<CommonSuffixRow, "use_scene" | "suffix_en" | "suffix_de">) {
	return {
		use_scene: String(row.use_scene || "").trim(),
		suffix_en: String(row.suffix_en || "").trim(),
		suffix_de: String(row.suffix_de || "").trim()
	};
}

function applyRowOrigin(row: CommonSuffixRow) {
	const t = trimRowFields(row);
	row._originScene = t.use_scene;
	row._originSuffixEn = t.suffix_en;
	row._originSuffixDe = t.suffix_de;
}

function isRowDirty(row: CommonSuffixRow) {
	const cur = trimRowFields(row);
	if (row._draft) {
		return Boolean(cur.use_scene || cur.suffix_en || cur.suffix_de);
	}
	return (
		cur.use_scene !== String(row._originScene ?? "").trim() ||
		cur.suffix_en !== String(row._originSuffixEn ?? "").trim() ||
		cur.suffix_de !== String(row._originSuffixDe ?? "").trim()
	);
}

const filteredRows = computed(() => {
	const q = searchKeyword.value.trim().toLowerCase();
	if (!q) return rows.value;
	return rows.value.filter(r => {
		const t = trimRowFields(r);
		const hay = [t.use_scene, t.suffix_en, t.suffix_de, r.submitter, r.user_id ? String(r.user_id) : ""]
			.join(" ")
			.toLowerCase();
		return hay.includes(q);
	});
});

const hasPendingChanges = computed(() =>
	rows.value.some(r => isRowOwned(r) && isRowDirty(r))
);

function close() {
	emit("update:open", false);
}

function emitSaved() {
	emit(
		"saved",
		rows.value
			.filter(r => !r._draft && r.id)
			.map(r => ({
				id: r.id,
				user_id: Number(r.user_id || 0),
				...trimRowFields(r),
				submitter: String(r.submitter || "").trim()
			}))
	);
}

async function loadList() {
	loading.value = true;
	try {
		const { list } = await fetchListingCommonSuffixes();
		rows.value = list.map(r => {
			const row: CommonSuffixRow = { ...r, _draft: false, _saving: false };
			applyRowOrigin(row);
			return row;
		});
	} catch (err: any) {
		ElMessage.error(err?.message || "加载常用后缀失败");
	} finally {
		loading.value = false;
	}
}

function startAdd() {
	if (rows.value.some(r => r._draft)) {
		ElMessage.warning("请先完成当前新增");
		return;
	}
	const row: CommonSuffixRow = {
		id: 0,
		user_id: currentUserId.value,
		submitter: currentSubmitterLabel.value,
		_clientKey: `draft-${Date.now()}`,
		use_scene: "",
		suffix_en: "",
		suffix_de: "",
		_draft: true,
		_saving: false,
		_originScene: "",
		_originSuffixEn: "",
		_originSuffixDe: ""
	};
	rows.value.unshift(row);
}

function cancelDraft(row: CommonSuffixRow) {
	const idx = rows.value.indexOf(row);
	if (idx >= 0) rows.value.splice(idx, 1);
}

async function onSuffixEnBlur(row: CommonSuffixRow) {
	if (!isRowOwned(row)) return;
	if (row._translating || row._saving || savingAll.value) return;
	const en = trimRowFields(row).suffix_en;
	if (!en) return;
	if (trimRowFields(row).suffix_de) return;

	const originEn = String(row._originSuffixEn ?? "").trim();
	if (en === originEn) return;

	if (row._translatePromptedEn === en) return;
	row._translatePromptedEn = en;

	const preview = en.length > 48 ? `${en.slice(0, 48)}…` : en;
	try {
		await confirmReviewFloatTranslateDe(
			`是否将英文后缀「${preview}」自动翻译为德文并填入德文列？`
		);
	} catch {
		return;
	}

	row._translating = true;
	try {
		const de = await translateListingSuffixEnToDe(en);
		if (!de) {
			ElMessage.warning("未获得德文翻译结果");
			return;
		}
		row.suffix_de = de;
		ElMessage.success("已填入德文后缀");
	} catch (err: any) {
		ElMessage.error(err?.message || "翻译失败");
	} finally {
		row._translating = false;
	}
}

function validateRowPayload(row: CommonSuffixRow) {
	const t = trimRowFields(row);
	if (!t.use_scene) {
		ElMessage.warning("使用场景不能为空");
		return null;
	}
	if (!t.suffix_en && !t.suffix_de) {
		ElMessage.warning("英文与德文后缀至少填写一项");
		return null;
	}
	return t;
}

async function submitAdd(row: CommonSuffixRow) {
	const payload = validateRowPayload(row);
	if (!payload) return false;
	row._saving = true;
	try {
		const saved = await addListingCommonSuffix(payload);
		const idx = rows.value.indexOf(row);
		if (idx >= 0) {
			const next: CommonSuffixRow = { ...saved, _draft: false, _saving: false };
			applyRowOrigin(next);
			rows.value[idx] = next;
		}
		return true;
	} catch (err: any) {
		ElMessage.error(err?.message || "添加失败");
		return false;
	} finally {
		row._saving = false;
	}
}

async function submitUpdate(row: CommonSuffixRow) {
	const payload = validateRowPayload(row);
	if (!payload || !row.id) return false;
	row._saving = true;
	try {
		const saved = await updateListingCommonSuffix({
			id: row.id,
			...payload
		});
		Object.assign(row, saved, { _draft: false, _saving: false });
		applyRowOrigin(row);
		return true;
	} catch (err: any) {
		ElMessage.error(err?.message || "保存失败");
		return false;
	} finally {
		row._saving = false;
	}
}

function applyToTitle(row: CommonSuffixRow) {
	const t = trimRowFields(row);
	if (!t.suffix_en && !t.suffix_de) {
		ElMessage.warning("请先填写英文或德文后缀");
		return;
	}
	emit("applyToTitle", {
		rowKey: getSuffixRowKey(row),
		suffixEn: t.suffix_en,
		suffixDe: t.suffix_de,
		useScene: t.use_scene
	});
}

function revertFromTitle(row: CommonSuffixRow) {
	emit("revertFromTitle", { rowKey: getSuffixRowKey(row) });
}

async function saveRow(row: CommonSuffixRow) {
	const wasDraft = Boolean(row._draft);
	const ok = wasDraft ? await submitAdd(row) : await submitUpdate(row);
	if (ok) {
		ElMessage.success(wasDraft ? "已添加" : "已保存");
		emitSaved();
	}
}

async function submitDelete(row: CommonSuffixRow) {
	if (!row.id) return;
	const scene = String(row.use_scene || "").trim() || "（未命名场景）";
	try {
		await confirmReviewFloatDelete(
			`确定删除常用后缀「${scene}」？删除后不可恢复。`
		);
	} catch {
		return;
	}
	row._saving = true;
	try {
		await deleteListingCommonSuffix(row.id);
		const idx = rows.value.findIndex(r => r.id === row.id);
		if (idx >= 0) rows.value.splice(idx, 1);
		ElMessage.success("已删除");
		emitSaved();
	} catch (err: any) {
		ElMessage.error(err?.message || "删除失败");
	} finally {
		row._saving = false;
	}
}

async function saveAllPending() {
	const pending = rows.value.filter(r => isRowOwned(r) && isRowDirty(r));
	if (!pending.length) return;
	savingAll.value = true;
	let okCount = 0;
	try {
		for (const row of pending) {
			const ok = row._draft ? await submitAdd(row) : await submitUpdate(row);
			if (ok) okCount += 1;
		}
		if (okCount > 0) {
			ElMessage.success(`已保存 ${okCount} 条`);
			emitSaved();
		}
	} finally {
		savingAll.value = false;
	}
}

watch(
	() => props.open,
	open => {
		if (open) {
			searchKeyword.value = "";
			loadList();
		}
	}
);
</script>

<style scoped lang="scss">
.suffix-panel {
	width: min(600px, calc(100vw - 24px));
	border: 1px solid var(--el-border-color);
	border-radius: 12px;
	background: var(--el-bg-color);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
	overflow: hidden;
}

.suffix-panel-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.suffix-title {
	font-size: 14px;
	font-weight: 600;
}

.suffix-sub {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-top: 2px;
	line-height: 1.4;
}

.suffix-close {
	font-size: 12px;
}

.suffix-panel-body {
	padding: 10px 12px 12px;
}

.suffix-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.suffix-search {
	flex: 1;
	min-width: 0;
}

.suffix-empty {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	padding: 8px 0;
}

.suffix-panel-footer {
	display: flex;
	justify-content: flex-end;
	margin-top: 10px;
	padding-top: 8px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.review-panel-pop-enter-active,
.review-panel-pop-leave-active {
	transition: all 0.2s ease;
}

.review-panel-pop-enter-from,
.review-panel-pop-leave-to {
	opacity: 0;
	transform: translateY(8px);
}
</style>
