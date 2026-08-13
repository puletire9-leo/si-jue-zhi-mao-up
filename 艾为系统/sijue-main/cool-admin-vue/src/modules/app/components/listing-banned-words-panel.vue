<template>
	<transition name="review-panel-pop">
		<div v-if="open" class="banned-panel">
			<div class="banned-panel-head">
				<div>
					<div class="banned-title">违禁词库</div>
					<div class="banned-sub">
						展示全员违禁词；检测时合并全员词库。仅可编辑本人提交的词
					</div>
				</div>
				<el-button link class="banned-close" @click="close">收起</el-button>
			</div>
			<div v-loading="loading" class="banned-panel-body">
				<div class="banned-toolbar">
					<el-input
						v-model="searchKeyword"
						size="small"
						clearable
						placeholder="搜索违禁词或原因"
						class="banned-search"
					/>
					<el-button size="small" type="primary" @click="startAdd">新增</el-button>
				</div>
				<el-table
					:data="filteredRows"
					border
					size="small"
					max-height="300"
					class="banned-table"
				>
					<el-table-column label="违禁词" min-width="120">
						<template #default="{ row }">
							<el-input
								v-model="row.word"
								size="small"
								placeholder="必填"
								maxlength="255"
								:disabled="!isRowEditable(row)"
							/>
						</template>
					</el-table-column>
					<el-table-column label="原因" min-width="130">
						<template #default="{ row }">
							<el-input
								v-model="row.reason"
								size="small"
								placeholder="选填"
								maxlength="500"
								:disabled="!isRowEditable(row)"
							/>
						</template>
					</el-table-column>
					<el-table-column
						prop="submitter"
						label="提交人"
						width="88"
						show-overflow-tooltip
					/>
					<el-table-column label="操作" width="108" align="center" fixed="right">
						<template #default="{ row }">
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
							<span v-else class="banned-op-muted">—</span>
						</template>
					</el-table-column>
				</el-table>
				<div v-if="!filteredRows.length && !loading" class="banned-empty">
					{{ searchKeyword.trim() ? "无匹配违禁词" : "暂无违禁词，点击「新增」添加" }}
				</div>
				<div class="banned-panel-footer">
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
import { confirmReviewFloatDelete } from "../utils/review-float-confirm";
import {
	addListingBannedWord,
	deleteListingBannedWord,
	fetchListingBannedWords,
	updateListingBannedWord,
	type BannedWordRecord
} from "../utils/listing-banned-word-api";

export type BannedWordRow = BannedWordRecord & {
	_draft?: boolean;
	_saving?: boolean;
	_originWord?: string;
	_originReason?: string;
};

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
	"update:open": [open: boolean];
	saved: [list: BannedWordRecord[]];
}>();

const { user } = useBase();

const rows = ref<BannedWordRow[]>([]);
const loading = ref(false);
const savingAll = ref(false);
const searchKeyword = ref("");

const currentUserId = computed(() => Number(user.info?.id || 0));

const currentSubmitterLabel = computed(() =>
	String(user.info?.name || user.info?.nickName || user.info?.username || "").trim()
);

function isRowOwned(row: BannedWordRow) {
	if (row._draft) return true;
	const uid = currentUserId.value;
	if (!uid) return false;
	return Number(row.user_id) === uid;
}

function isRowEditable(row: BannedWordRow) {
	return isRowOwned(row) && !Boolean(row._saving) && !savingAll.value;
}

function trimRowFields(row: Pick<BannedWordRow, "word" | "reason">) {
	return {
		word: String(row.word || "").trim(),
		reason: String(row.reason || "").trim()
	};
}

function applyRowOrigin(row: BannedWordRow) {
	const { word, reason } = trimRowFields(row);
	row._originWord = word;
	row._originReason = reason;
}

function isRowDirty(row: BannedWordRow) {
	if (row._draft) {
		return Boolean(trimRowFields(row).word);
	}
	const cur = trimRowFields(row);
	const originWord = String(row._originWord ?? "").trim();
	const originReason = String(row._originReason ?? "").trim();
	return cur.word !== originWord || cur.reason !== originReason;
}

const filteredRows = computed(() => {
	const q = searchKeyword.value.trim().toLowerCase();
	if (!q) return rows.value;
	return rows.value.filter(r => {
		const hay = [
			r.word,
			r.reason,
			r.submitter,
			r.user_id ? String(r.user_id) : ""
		]
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
				word: String(r.word || "").trim(),
				reason: String(r.reason || "").trim(),
				submitter: String(r.submitter || "").trim()
			}))
	);
}

function mapLoadedRow(r: BannedWordRecord): BannedWordRow {
	const row: BannedWordRow = { ...r, _draft: false, _saving: false };
	applyRowOrigin(row);
	return row;
}

async function loadList() {
	loading.value = true;
	try {
		const { list } = await fetchListingBannedWords();
		rows.value = list.map(mapLoadedRow);
	} catch (err: any) {
		ElMessage.error(err?.message || "加载违禁词库失败");
	} finally {
		loading.value = false;
	}
}

function startAdd() {
	if (rows.value.some(r => r._draft)) {
		ElMessage.warning("请先完成当前新增");
		return;
	}
	const row: BannedWordRow = {
		id: 0,
		user_id: currentUserId.value,
		word: "",
		reason: "",
		submitter: currentSubmitterLabel.value,
		_draft: true,
		_saving: false,
		_originWord: "",
		_originReason: ""
	};
	rows.value.unshift(row);
}

function cancelDraft(row: BannedWordRow) {
	const idx = rows.value.indexOf(row);
	if (idx >= 0) rows.value.splice(idx, 1);
}

async function submitAdd(row: BannedWordRow) {
	const { word, reason } = trimRowFields(row);
	if (!word) {
		ElMessage.warning("违禁词不能为空");
		return false;
	}
	row._saving = true;
	try {
		const saved = await addListingBannedWord({ word, reason });
		const idx = rows.value.indexOf(row);
		if (idx >= 0) {
			const next: BannedWordRow = { ...saved, _draft: false, _saving: false };
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

async function submitUpdate(row: BannedWordRow) {
	const { word, reason } = trimRowFields(row);
	if (!word) {
		ElMessage.warning("违禁词不能为空");
		return false;
	}
	if (!row.id) return false;
	row._saving = true;
	try {
		const saved = await updateListingBannedWord({
			id: row.id,
			word,
			reason
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

async function saveRow(row: BannedWordRow) {
	const wasDraft = Boolean(row._draft);
	const ok = wasDraft ? await submitAdd(row) : await submitUpdate(row);
	if (ok) {
		ElMessage.success(wasDraft ? "已添加" : "已保存");
		emitSaved();
	}
}

async function submitDelete(row: BannedWordRow) {
	if (!row.id) return;
	const word = String(row.word || "").trim() || "（未命名）";
	try {
		await confirmReviewFloatDelete(
			`确定从个人违禁词库删除「${word}」？删除后不可恢复。`
		);
	} catch {
		return;
	}
	row._saving = true;
	try {
		await deleteListingBannedWord(row.id);
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
.banned-op-muted {
	color: var(--el-text-color-placeholder);
	font-size: 12px;
}

.banned-panel {
	width: min(560px, calc(100vw - 24px));
	border: 1px solid var(--el-border-color);
	border-radius: 12px;
	background: var(--el-bg-color);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
	overflow: hidden;
}

.banned-panel-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.banned-title {
	font-size: 14px;
	font-weight: 600;
}

.banned-sub {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-top: 2px;
}

.banned-close {
	font-size: 12px;
}

.banned-panel-body {
	padding: 10px 12px 12px;
}

.banned-toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
}

.banned-search {
	flex: 1;
	min-width: 0;
}

.banned-empty {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	padding: 8px 0;
}

.banned-panel-footer {
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
