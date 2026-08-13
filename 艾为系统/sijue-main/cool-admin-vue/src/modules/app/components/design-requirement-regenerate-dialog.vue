<template>
	<div>
		<el-dialog
			v-model="dialogVisible"
			:width="isFullscreen ? '100%' : '1680px'"
			:close-on-click-modal="false"
			align-center
			:class="['design-requirement-regenerate-dialog-root', { 'is-fullscreen': isFullscreen }]"
			:show-close="false"
		>
			<template #header>
				<div class="regen-dialog-header">
					<div class="regen-dialog-header-left">
						<span class="regen-dialog-title">选图AI生成图需</span>
						<el-button
							v-if="taskAsin && taskMarketplace"
							link
							type="primary"
							@click="openProductPage"
						>
							打开产品页
						</el-button>
					</div>
					<div class="regen-dialog-header-actions">
						<el-button
							text
							:title="isFullscreen ? '退出全屏' : '全屏'"
							@click="toggleFullscreen"
						>
							<el-icon>
								<full-screen v-if="!isFullscreen" />
								<minus v-else />
							</el-icon>
						</el-button>
						<el-button text title="关闭" @click="closeRegenerateDialog">
							<el-icon>
								<close />
							</el-icon>
						</el-button>
					</div>
				</div>
			</template>
			<design-task-other-info
				:variants="detailOtherInfoVariants"
				:factory-links="detailOtherInfoFactoryLinks"
				:purchases="detailOtherInfoPurchases"
				class="regenerate-dialog-other-info"
			/>
			<div class="regen-dialog-split">
				<div class="regen-dialog-split-pane regen-dialog-split-pane--slots">
			<div class="slot-row">
				<div class="slot-header">
					<div class="slot-title">选择图片位</div>
					<div class="slot-header-btns">
						<el-button
							size="small"
							:loading="syncSlotsLoading"
							@click="handleResyncSlots"
						>
							重新同步图片位
						</el-button>
						<div class="sort-mode-switch">
							<span :class="{ active: imageSlotSortMode === 'position' }">按位置</span>
							<el-switch
								:model-value="imageSlotSortMode === 'set'"
								@change="handleImageSlotSortModeSwitchChange"
							/>
							<span :class="{ active: imageSlotSortMode === 'set' }">按套图</span>
						</div>
						<el-button type="primary" size="small" @click="showAddSlotDialog"
							>增加一组图片</el-button
						>
					</div>
				</div>
				<p class="slot-hint">
					提示：点击某个图片位后，可将右侧竞品图拖入，或 Ctrl+V 粘贴图片/链接。
				</p>
				<div class="slot-list">
					<div
						v-for="slot in slots"
						:key="slot.key"
						class="slot-item"
						:class="{ active: slot.key === activeSlotKey }"
						@dragover.prevent
						@drop="handleDrop($event, slot.key)"
					>
						<div class="slot-header-actions">
							<div class="slot-label" @click="setActiveSlot(slot.key)">
								{{ slot.label }}
							</div>
							<div class="slot-actions">
								<el-button
									link
									type="primary"
									size="small"
									@click.stop="showEditSlotDialog(slot)"
								>
									编辑
								</el-button>
								<el-button
									link
									type="danger"
									size="small"
									@click.stop="handleDeleteSlot(slot.key)"
								>
									删除
								</el-button>
							</div>
						</div>
						<div class="slot-thumb" @click="setActiveSlot(slot.key)">
							<image-zoom
								v-if="slot.refImage"
								:src="slot.refImage"
								fit="cover"
								class="slot-image"
							/>
							<div v-else class="slot-placeholder">点击或 Ctrl+V 粘贴图片/链接</div>
							<el-icon
								v-if="slot.refImage"
								class="slot-clear"
								@click.stop="clearSlotImage(slot)"
							>
								<circle-close />
							</el-icon>
							<div
								v-if="pasteUploading && slot.key === activeSlotKey"
								class="slot-paste-loading"
							>
								上传中…
							</div>
						</div>
						<div class="slot-info">
							<!-- 内联 Tag：*-1 只能主图，非 *-1 不能选主图 -->
							<div class="slot-tag-row">
								<template v-if="isSlotLabelMinus1(slot.label)">
									<el-tag type="primary" size="small">主图</el-tag>
								</template>
								<el-select
									v-else
									v-model="slot.tag"
									size="small"
									placeholder="Tag"
									class="slot-tag-select"
									@change="onSlotTagChange(slot)"
								>
									<el-option-group label="自定义">
										<el-option
											v-for="opt in customTagOptions"
											:key="opt"
											:label="opt"
											:value="opt"
										/>
									</el-option-group>
									<el-option-group label="必选">
										<el-option
											v-for="opt in requiredTagOptionsNoMain"
											:key="opt"
											:label="opt"
											:value="opt"
										/>
									</el-option-group>
								</el-select>
							</div>
							<!-- 内联 挂载：主图必选 MSKU；非主图可选变体+账号，未选即挂载全部 -->
							<div v-if="slot.tag === '主图'" class="slot-bind-row">
								<template v-if="slot.bindMsku">
									<span
										class="slot-bind-text"
										:title="getMskuLabel(slot.bindMsku)"
										>{{ getMskuLabel(slot.bindMsku) }}</span
									>
								</template>
								<el-select
									v-else
									v-model="slot.bindMsku"
									size="small"
									placeholder="挂载 MSKU"
									class="slot-bind-select"
									value-key="msku"
								>
									<el-option
										v-for="m in detailMskus"
										:key="m.msku"
										:label="`${m.variant_name || '-'}-${m.account_name || '-'}`"
										:value="m.msku"
									/>
								</el-select>
							</div>
							<div v-else-if="slot.tag" class="slot-bind-row slot-bind-optional">
								<el-select
									v-model="slot.bindVariantId"
									size="small"
									placeholder="全部变体"
									class="slot-bind-select"
								>
									<el-option label="全部变体" :value="''" />
									<el-option
										v-for="v in detailVariants"
										:key="v.variantsid"
										:label="v.name || v.variantsid"
										:value="v.variantsid"
									/>
								</el-select>
								<el-select
									v-model="slot.bindSellerAccountId"
									size="small"
									placeholder="全部账号"
									class="slot-bind-select"
								>
									<el-option label="全部账号" :value="''" />
									<el-option
										v-for="s in detailSellers"
										:key="s.seller_account_id"
										:label="s.account_name || s.seller_account_id"
										:value="s.seller_account_id"
									/>
								</el-select>
								<div class="slot-bind-hint">未选即挂载全部</div>
							</div>
							<el-tooltip
								v-if="slot.description"
								:content="slot.description"
								placement="bottom-start"
								effect="light"
								:show-after="200"
								popper-class="slot-description-tooltip"
							>
								<div class="slot-description">
									{{ slot.description }}
								</div>
							</el-tooltip>
							<div v-else class="slot-description">-</div>
							<div class="slot-remark-block">
								<div class="slot-remark-label">补充说明</div>
								<el-input
									v-model="slot.remarkDoc.text"
									type="textarea"
									:rows="2"
									placeholder="可选：对图需的补充（如参考下方示意图的配件布局）"
									class="slot-remark-text"
								/>
								<div class="remark-images-row">
									<div
										v-for="(ru, ri) in slot.remarkDoc.images"
										:key="ri"
										class="remark-thumb-wrap"
									>
										<image-zoom :src="ru" fit="cover" class="remark-thumb" />
										<el-icon
											class="remark-thumb-del"
											@click.stop="removeRemarkImage(slot, ri)"
										>
											<circle-close />
										</el-icon>
									</div>
									<el-button
										size="small"
										:loading="remarkUploadingKey === slot.key"
										@click.stop="openRemarkFilePicker(slot)"
									>
										上传示意图
									</el-button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
				</div>
				<div class="regen-dialog-split-pane regen-dialog-split-pane--refs">
					<div class="reference-pane-header">
						<span class="reference-pane-title">竞品参考图</span>
						<span class="reference-pane-hint">拖到左侧图片位填入参考图</span>
					</div>
					<div class="reference-pane-body">
						<el-table :data="referenceRows" border class="reference-table">
							<el-table-column prop="asin" label="竞品ASIN" width="140">
								<template #default="{ row }">
									<div class="asin-cell">
										<div>
											<a
												v-if="row.asin && getAmazonDpUrl(row.asin, row.marketplace)"
												:href="getAmazonDpUrl(row.asin, row.marketplace)"
												target="_blank"
												rel="noopener noreferrer"
												class="asin-link"
												>{{ row.asin }}</a
											>
											<span v-else>{{ row.asin || "-" }}</span>
										</div>
										<div class="asin-sales">销量：{{ Number(row.monthlySales || 0) }}</div>
										<el-button
											v-if="row.competitorId != null && refImageCount(row) < 7"
											type="primary"
											link
											size="small"
											:loading="fetchRefLoading === row.competitorId"
											@click="fetchRefImages(row)"
										>
											获取参考图
										</el-button>
									</div>
								</template>
							</el-table-column>
							<el-table-column label="参考图" min-width="200">
								<template #default="{ row }">
									<div class="reference-images">
										<image-zoom
											v-for="(img, index) in row.images"
											v-show="img"
											:key="index"
											:src="img"
											fit="cover"
											:width="110"
											:height="110"
											class="reference-image"
											draggable="true"
											@dragstart="handleDragStart($event, img)"
											@dblclick.stop
										/>
									</div>
								</template>
							</el-table-column>
						</el-table>
					</div>
				</div>
			</div>

			<input
				ref="remarkFileInputRef"
				type="file"
				accept="image/*"
				class="remark-file-input-hidden"
				@change="onRemarkFileSelected"
			/>

			<template #footer>
				<div class="regen-dialog-footer">
					<el-button size="large" @click="closeRegenerateDialog">返回列表</el-button>
					<template v-if="hasGeneratedRequirement">
						<el-button size="large" @click="saveRequirement('all')">全部AI重新生成</el-button>
						<el-button type="primary" size="large" @click="saveRequirement('delta')"
							>差量AI生成图需</el-button
						>
					</template>
					<template v-else>
						<el-button type="primary" size="large" @click="saveRequirement('all')"
							>AI生成图需</el-button
						>
					</template>
				</div>
			</template>
		</el-dialog>

		<el-dialog v-model="addSlotDialogVisible" title="增加一组图片" width="500px" align-center>
			<el-form ref="addSlotFormRef" :model="addSlotForm" label-width="80px">
				<el-form-item
					label="编号"
					prop="label"
					:rules="[{ required: true, message: '请输入编号', trigger: 'blur' }]"
				>
					<el-input
						v-model="addSlotForm.label"
						placeholder="请输入编号，如：4-1"
						@keyup.enter="handleAddSlot"
					/>
				</el-form-item>
				<el-form-item label="Tag" prop="tag">
					<template v-if="isSlotLabelMinus1(addSlotForm.label)">
						<el-tag type="primary">主图</el-tag>
						<span class="form-hint-inline">编号 *-1 仅支持主图</span>
					</template>
					<el-select
						v-else
						v-model="addSlotForm.tag"
						placeholder="请选择Tag（*-1 只能主图）"
						style="width: 100%"
						@change="onAddSlotTagChange"
					>
						<el-option-group label="自定义类型（一般5-7号图）">
							<el-option
								v-for="option in customTagOptions"
								:key="option"
								:label="option"
								:value="option"
							/>
						</el-option-group>
						<el-option-group label="建议必选类型(一般1-4号图)">
							<el-option
								v-for="option in requiredTagOptionsNoMain"
								:key="option"
								:label="option"
								:value="option"
							/>
						</el-option-group>
					</el-select>
				</el-form-item>
				<el-form-item
					v-if="addSlotForm.tag === '主图'"
					label="挂载 MSKU"
					prop="bindMsku"
					:rules="[{ required: true, message: '请选择挂载的 MSKU', trigger: 'change' }]"
				>
					<el-select
						v-model="addSlotForm.bindMsku"
						placeholder="请选择（变体-账号）"
						style="width: 100%"
						value-key="msku"
					>
						<el-option
							v-for="m in detailMskus"
							:key="m.msku"
							:label="`${m.variant_name || '-'}-${m.account_name || '-'}`"
							:value="m.msku"
						/>
					</el-select>
				</el-form-item>
				<el-form-item v-else-if="addSlotForm.tag" label="挂载（可选）">
					<div class="bind-optional-row">
						<el-select
							v-model="addSlotForm.bindVariantId"
							placeholder="全部变体"
							style="width: 100%"
						>
							<el-option label="全部变体" :value="''" />
							<el-option
								v-for="v in detailVariants"
								:key="v.variantsid"
								:label="v.name || v.variantsid"
								:value="v.variantsid"
							/>
						</el-select>
						<el-select
							v-model="addSlotForm.bindSellerAccountId"
							placeholder="全部账号"
							style="width: 100%"
						>
							<el-option label="全部账号" :value="''" />
							<el-option
								v-for="s in detailSellers"
								:key="s.seller_account_id"
								:label="s.account_name || s.seller_account_id"
								:value="s.seller_account_id"
							/>
						</el-select>
						<div class="form-hint">未选即挂载全部</div>
					</div>
				</el-form-item>
				<el-form-item label="描述">
					<el-input
						v-model="addSlotForm.description"
						type="textarea"
						:rows="4"
						placeholder="请输入描述（可选）"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="addSlotDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="handleAddSlot">确定</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="editSlotDialogVisible" title="编辑图片位" width="500px" align-center>
			<el-form ref="editSlotFormRef" :model="editSlotForm" label-width="80px">
				<el-form-item
					label="编号"
					prop="label"
					:rules="[{ required: true, message: '请输入编号', trigger: 'blur' }]"
				>
					<el-input
						v-model="editSlotForm.label"
						placeholder="请输入编号，如：4-1"
						@keyup.enter="handleEditSlot"
					/>
				</el-form-item>
				<el-form-item label="Tag" prop="tag">
					<template v-if="isSlotLabelMinus1(editSlotForm.label)">
						<el-tag type="primary">主图</el-tag>
						<span class="form-hint-inline">编号 *-1 仅支持主图</span>
					</template>
					<el-select
						v-else
						v-model="editSlotForm.tag"
						placeholder="请选择Tag（*-1 只能主图）"
						style="width: 100%"
					>
						<el-option-group label="自定义类型（一般5-7号图）">
							<el-option
								v-for="option in customTagOptions"
								:key="option"
								:label="option"
								:value="option"
							/>
						</el-option-group>
						<el-option-group label="建议必选类型(一般1-4号图)">
							<el-option
								v-for="option in requiredTagOptionsNoMain"
								:key="option"
								:label="option"
								:value="option"
							/>
						</el-option-group>
					</el-select>
				</el-form-item>
				<el-form-item
					v-if="editSlotForm.tag === '主图'"
					label="挂载 MSKU"
					prop="bindMsku"
					:rules="[{ required: true, message: '请选择挂载的 MSKU', trigger: 'change' }]"
				>
					<el-select
						v-model="editSlotForm.bindMsku"
						placeholder="请选择（变体-账号）"
						style="width: 100%"
						:disabled="!!editSlotForm.bindMsku"
					>
						<el-option
							v-for="m in detailMskus"
							:key="m.msku"
							:label="`${m.variant_name || '-'}-${m.account_name || '-'}`"
							:value="m.msku"
						/>
					</el-select>
					<div v-if="editSlotForm.bindMsku" class="form-hint">
						主图已关联 MSKU，不可修改
					</div>
				</el-form-item>
				<el-form-item v-else-if="editSlotForm.tag" label="挂载（可选）">
					<div class="bind-optional-row">
						<el-select
							v-model="editSlotForm.bindVariantId"
							placeholder="全部变体"
							style="width: 100%"
						>
							<el-option label="全部变体" :value="''" />
							<el-option
								v-for="v in detailVariants"
								:key="v.variantsid"
								:label="v.name || v.variantsid"
								:value="v.variantsid"
							/>
						</el-select>
						<el-select
							v-model="editSlotForm.bindSellerAccountId"
							placeholder="全部账号"
							style="width: 100%"
						>
							<el-option label="全部账号" :value="''" />
							<el-option
								v-for="s in detailSellers"
								:key="s.seller_account_id"
								:label="s.account_name || s.seller_account_id"
								:value="s.seller_account_id"
							/>
						</el-select>
						<div class="form-hint">未选即挂载全部</div>
					</div>
				</el-form-item>
				<el-form-item label="描述">
					<el-input
						v-model="editSlotForm.description"
						type="textarea"
						:rows="4"
						placeholder="请输入描述（可选）"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="editSlotDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="handleEditSlot">确定</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

const DRAFT_STORAGE_PREFIX = "design_requirement_draft_";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天过期，localStorage 本身无过期

/** 清理所有过期的草稿 key，避免长期堆积撑爆 localStorage */
function cleanupExpiredDrafts() {
	try {
		const now = Date.now();
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (!key?.startsWith(DRAFT_STORAGE_PREFIX)) continue;
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			try {
				const data = JSON.parse(raw);
				if (data.savedAt && now - data.savedAt > DRAFT_TTL_MS) {
					localStorage.removeItem(key);
				}
			} catch {
				localStorage.removeItem(key);
			}
		}
	} catch {}
}

function getDraft(
	taskId: number
): { slots: any[]; activeSlotKey: string; referenceRows: any[] } | null {
	try {
		const raw = localStorage.getItem(DRAFT_STORAGE_PREFIX + taskId);
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (data.taskId !== taskId) return null;
		if (data.savedAt && Date.now() - data.savedAt > DRAFT_TTL_MS) {
			localStorage.removeItem(DRAFT_STORAGE_PREFIX + taskId);
			return null;
		}
		return {
			slots: Array.isArray(data.slots) ? data.slots : [],
			activeSlotKey: typeof data.activeSlotKey === "string" ? data.activeSlotKey : "1-1",
			referenceRows: Array.isArray(data.referenceRows) ? data.referenceRows : []
		};
	} catch {
		return null;
	}
}

function setDraft(
	taskId: number,
	payload: { slots: any[]; activeSlotKey: string; referenceRows: any[] }
) {
	try {
		localStorage.setItem(
			DRAFT_STORAGE_PREFIX + taskId,
			JSON.stringify({
				taskId,
				savedAt: Date.now(),
				slots: payload.slots,
				activeSlotKey: payload.activeSlotKey,
				referenceRows: payload.referenceRows
			})
		);
	} catch (e) {
		console.warn("草稿写入 localStorage 失败", e);
	}
}

function clearDraft(taskId: number) {
	try {
		localStorage.removeItem(DRAFT_STORAGE_PREFIX + taskId);
	} catch {}
}
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";
import { CircleClose, FullScreen, Minus, Close } from "@element-plus/icons-vue";
import { useUpload } from "/@/plugins/upload/hooks";
import { service } from "/@/cool";
import {
	sortImageSlots,
	getImageSlotSortModeBySku,
	setImageSlotSortModeBySku,
	type ImageSlotSortMode
} from "../utils";
import { appConfig } from "../../../../../appConfig";
import { getMskuDisplayLabel } from "../utils/msku-key";
// @ts-ignore
import DesignTaskOtherInfo from "/$/app/components/design-task-other-info.vue";

const emit = defineEmits<{
	success: [];
	closed: [];
}>();

const dialogVisible = ref(false);
const isFullscreen = ref(false);

function toggleFullscreen() {
	isFullscreen.value = !isFullscreen.value;
}

function closeRegenerateDialog() {
	dialogVisible.value = false;
}
/** Listing 内容工作室等场景：注入 mock 数据、不走图需 task 接口 */
const mockMode = ref(false);
const activeTaskId = ref<number | null>(null);
const candidateId = ref<number | null>(null);
const syncSlotsLoading = ref(false);
const taskAsin = ref("");
const taskMarketplace = ref("");
const taskSku = ref("");
const imageSlotSortMode = ref<ImageSlotSortMode>("position");
const hasGeneratedRequirement = ref(false);
const activeSlotKey = ref("1-1");
const pasteUploading = ref(false);
const { toUpload } = useUpload();

/** 运营补充说明（与后端 remark_doc 对应） */
type RemarkDocState = { text: string; images: string[] };

function emptyRemarkDoc(): RemarkDocState {
	return { text: "", images: [] };
}

function parseRemarkDocFromApi(raw: unknown): RemarkDocState {
	if (raw == null || raw === "") return emptyRemarkDoc();
	let o: any = raw;
	if (typeof raw === "string") {
		try {
			o = JSON.parse(raw);
		} catch {
			return emptyRemarkDoc();
		}
	}
	if (typeof o !== "object" || !o) return emptyRemarkDoc();
	const text = typeof o.text === "string" ? o.text : "";
	const images = Array.isArray(o.images)
		? o.images.filter((x: unknown) => typeof x === "string" && String(x).trim())
		: [];
	return { text, images: [...images] };
}

function remarkDocToPayload(doc: RemarkDocState): { text?: string; images?: string[] } | null {
	const t = (doc.text ?? "").trim();
	const imgs = (doc.images ?? []).map((u) => String(u).trim()).filter(Boolean);
	if (!t && !imgs.length) return null;
	const out: { text?: string; images?: string[] } = {};
	if (t) out.text = t;
	if (imgs.length) out.images = imgs;
	return out;
}

const remarkFileInputRef = ref<HTMLInputElement | null>(null);
const remarkUploadingKey = ref<string | null>(null);
const remarkPickForKey = ref<string | null>(null);

const addSlotDialogVisible = ref(false);
const addSlotFormRef = ref();
const editSlotDialogVisible = ref(false);
const editSlotFormRef = ref();
const fetchRefLoading = ref<number | null>(null);
const referenceRows = ref<
	Array<{
		competitorId?: number;
		asin: string;
		marketplace?: string;
		monthlySales?: number;
		images: string[];
	}>
>([]);
const detailVariants = ref<Array<{ variantsid: string; name: string }>>([]);
const detailSellers = ref<Array<{ seller_account_id: string; account_name: string }>>([]);
const detailOtherInfoVariants = ref<
	Array<{
		variantsid: string;
		name: string;
		imageUrl?: string;
		group_proportions?: Record<string, number>;
		description?: string;
	}>
>([]);
const detailOtherInfoFactoryLinks = ref<
	Array<{
		id: string;
		type: string;
		name: string;
		price: number;
		link: string;
		linkDescription?: string;
	}>
>([]);
const detailOtherInfoPurchases = ref<
	Array<{
		uk: number;
		de: number;
		status: string;
		opinion?: string;
		variantId?: string;
		total: number;
		submitter?: string;
	}>
>([]);
const detailMskus = ref<
	Array<{
		msku: string;
		variant_id: string | null;
		seller_account_id: string;
		variant_name: string;
		account_name: string;
	}>
>([]);
const addSlotForm = reactive({
	label: "",
	tag: "",
	description: "",
	bindMsku: "",
	bindVariantId: "",
	bindSellerAccountId: ""
});
const editSlotForm = reactive({
	key: "",
	label: "",
	tag: "",
	description: "",
	bindMsku: "",
	bindVariantId: "",
	bindSellerAccountId: ""
});

// Tag 选项：自定义类型在前，建议必选类型在后；编号 *-1 只能主图，非 *-1 不能选主图
const customTagOptions = ["多场景图", "对比图", "模特图", "细节图", "多细节图"];
const requiredTagOptions = ["主图", "尺寸图", "配件图", "场景图"];
const requiredTagOptionsNoMain = ["尺寸图", "配件图", "场景图"];

function isSlotLabelMinus1(label: string): boolean {
	return /^\d+-1$/.test(String(label || "").trim());
}

/** 根据竞品 ASIN + 站点（地区码或中文名）生成亚马逊商品页链接，新 tab 打开 */
function getAmazonDpUrl(asin: string, marketplace?: string): string {
	if (!asin || !String(asin).trim()) return "";
	return appConfig.get_amazon_url_dp(String(asin).trim(), marketplace || "US");
}
const slots = reactive<
	Array<{
		pictureId?: number;
		key: string;
		label: string;
		refImage: string;
		tag: string;
		description: string;
		bindMsku?: string;
		bindVariantId?: string;
		bindSellerAccountId?: string;
		remarkDoc: RemarkDocState;
	}>
>([
	{
		pictureId: undefined,
		key: "1-1",
		label: "1-1",
		refImage: "",
		tag: "主图",
		description: "趣味喷水玩具，适合户外使用，可向上多方向喷水，喷射高度随水压变化。",
		remarkDoc: emptyRemarkDoc()
	},
	{
		pictureId: undefined,
		key: "1-2",
		label: "1-2",
		refImage: "",
		tag: "场景图",
		description: "户外喷水神器，适合儿童和家庭在花园、草坪等场景使用。",
		remarkDoc: emptyRemarkDoc()
	},
	{
		pictureId: undefined,
		key: "2-1",
		label: "2-1",
		refImage: "",
		tag: "配件图",
		description: "产品配件包括手柄、底座等，提供完整的使用体验。",
		remarkDoc: emptyRemarkDoc()
	},
	{
		pictureId: undefined,
		key: "2-2",
		label: "2-2",
		refImage: "",
		tag: "细节图",
		description: "高品质材质制作，表面光滑，做工精细，安全可靠。",
		remarkDoc: emptyRemarkDoc()
	},
	{
		pictureId: undefined,
		key: "3-1",
		label: "3-1",
		refImage: "",
		tag: "对比图",
		description: "相比传统喷水工具，本产品具有更好的喷水效果和更丰富的使用体验。",
		remarkDoc: emptyRemarkDoc()
	}
]);
sortSlotsInPlace();

function sortSlotsInPlace() {
	slots.sort((a, b) => sortImageSlots(a, b, imageSlotSortMode.value));
}

function toggleImageSlotSortMode() {
	const next: ImageSlotSortMode = imageSlotSortMode.value === "position" ? "set" : "position";
	imageSlotSortMode.value = next;
	setImageSlotSortModeBySku(taskSku.value, next);
	sortSlotsInPlace();
}

function handleImageSlotSortModeSwitchChange(checked: string | number | boolean) {
	imageSlotSortMode.value = checked ? "set" : "position";
	setImageSlotSortModeBySku(taskSku.value, imageSlotSortMode.value);
	sortSlotsInPlace();
}

function removeRemarkImage(slot: { remarkDoc: RemarkDocState }, index: number) {
	slot.remarkDoc.images.splice(index, 1);
}

function openRemarkFilePicker(slot: { key: string }) {
	remarkPickForKey.value = slot.key;
	remarkFileInputRef.value?.click();
}

async function onRemarkFileSelected(ev: Event) {
	const input = ev.target as HTMLInputElement;
	const file = input.files?.[0];
	const key = remarkPickForKey.value;
	input.value = "";
	remarkPickForKey.value = null;
	if (!file || !key) return;
	if (!file.type.startsWith("image/")) {
		ElMessage.warning("请选择图片文件");
		return;
	}
	const slot = slots.find((s) => s.key === key);
	if (!slot) return;
	remarkUploadingKey.value = key;
	try {
		const { url } = await toUpload(file);
		slot.remarkDoc.images.push(url);
		ElMessage.success("已上传示意图");
	} catch {
		// 错误提示由 useUpload / toUpload 统一处理（含 413）
	} finally {
		remarkUploadingKey.value = null;
	}
}

function clearSlotImage(slot: (typeof slots)[number]) {
	slot.refImage = "";
}

function setActiveSlot(key: string) {
	activeSlotKey.value = key;
}

function handleDragStart(event: DragEvent, img: string) {
	event.dataTransfer?.setData("text/plain", img);
}

function handleDrop(event: DragEvent, key: string) {
	event.preventDefault();
	const img = event.dataTransfer?.getData("text/plain");
	if (!img) return;
	const slot = slots.find((item) => item.key === key);
	if (!slot) return;
	slot.refImage = img;
	activeSlotKey.value = key;
}

async function handlePaste(e: ClipboardEvent) {
	if (!dialogVisible.value || !activeSlotKey.value) return;
	const slot = slots.find((s) => s.key === activeSlotKey.value);
	if (!slot) return;
	const cd = e.clipboardData;
	if (!cd) return;
	if (cd.files && cd.files.length > 0) {
		const file = cd.files[0];
		if (!file.type.startsWith("image/")) {
			ElMessage.warning("仅支持粘贴图片");
			return;
		}
		e.preventDefault();
		if (pasteUploading.value) return;
		pasteUploading.value = true;
		try {
			const { url } = await toUpload(file);
			slot.refImage = url;
			ElMessage.success("已粘贴图片");
		} catch {
			// 错误提示由 useUpload / toUpload 统一处理（含 413）
		} finally {
			pasteUploading.value = false;
		}
		return;
	}
	const text = cd.getData("text/plain");
	if (text) {
		const t = text.trim();
		if (/^https?:\/\//i.test(t)) {
			e.preventDefault();
			slot.refImage = t;
			ElMessage.success("已粘贴链接");
		}
	}
}

watch(dialogVisible, (open, prev) => {
	if (open) document.addEventListener("paste", handlePaste);
	else {
		document.removeEventListener("paste", handlePaste);
		mockMode.value = false;
		isFullscreen.value = false;
	}
	if (prev && !open) emit("closed");
});

function getMskuLabel(msku: string): string {
	return getMskuDisplayLabel(detailMskus.value, msku);
}

function onSlotTagChange(slot: (typeof slots)[number]) {
	slot.bindMsku = "";
	slot.bindVariantId = "";
	slot.bindSellerAccountId = "";
}

function inferTagFromLabel(label: string): string | "" {
	const m = label.trim().match(/^\d+-(\d+)$/);
	if (!m) return "";
	const idx = Number(m[1]);
	if (idx === 1) return "主图";
	if (idx === 2) return "尺寸图";
	if (idx === 3) return "配件图";
	if (idx === 4) return "场景图";
	return "";
}

// 新增图片位：*-1 只能主图，其他编号自动推断 Tag（且不能选主图）
watch(
	() => addSlotForm.label,
	(val) => {
		const v = (val || "").trim();
		if (isSlotLabelMinus1(v)) {
			addSlotForm.tag = "主图";
		} else {
			const tag = inferTagFromLabel(v);
			if (tag && tag !== "主图") addSlotForm.tag = tag;
		}
	}
);

// 编辑图片位：*-1 强制主图，非 *-1 若当前主图则改为场景图
watch(
	() => editSlotForm.label,
	(val) => {
		const v = (val || "").trim();
		if (isSlotLabelMinus1(v)) {
			editSlotForm.tag = "主图";
		} else if (editSlotForm.tag === "主图") {
			editSlotForm.tag = "场景图";
		} else {
			const tag = inferTagFromLabel(v);
			if (tag && tag !== "主图") editSlotForm.tag = tag;
		}
	}
);

// 任意变更防抖写入 localStorage 草稿，提交或强行同步时清空
let draftFlushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDraftPersist() {
	if (!dialogVisible.value || activeTaskId.value == null) return;
	if (draftFlushTimer) clearTimeout(draftFlushTimer);
	draftFlushTimer = setTimeout(() => {
		draftFlushTimer = null;
		// 防止“关闭弹窗/保存完成后”仍在后台把旧 slots 写回 localStorage
		if (!dialogVisible.value || activeTaskId.value == null) return;
		setDraft(activeTaskId.value!, {
			slots: slots.map((s) => ({
				pictureId: s.pictureId,
				key: s.key,
				label: s.label,
				refImage: s.refImage,
				tag: s.tag,
				description: s.description,
				bindMsku: s.bindMsku,
				bindVariantId: s.bindVariantId,
				bindSellerAccountId: s.bindSellerAccountId,
				remarkDoc: { text: s.remarkDoc.text, images: [...s.remarkDoc.images] }
			})),
			activeSlotKey: activeSlotKey.value,
			referenceRows: referenceRows.value.map((r) => ({
				competitorId: r.competitorId,
				asin: r.asin,
				marketplace: r.marketplace,
				monthlySales: Number(r.monthlySales || 0),
				images: [...(r.images || [])]
			}))
		});
	}, 500);
}
watch(slots, scheduleDraftPersist, { deep: true });
watch(activeSlotKey, scheduleDraftPersist);
watch(referenceRows, scheduleDraftPersist, { deep: true });

function refImageCount(row: { images: string[] }): number {
	return (row.images || []).filter((u) => !!u && String(u).trim()).length;
}

function sortReferenceRowsByImageCount() {
	referenceRows.value = [...referenceRows.value].sort(
		(a, b) =>
			Number(b.monthlySales || 0) - Number(a.monthlySales || 0) ||
			refImageCount(b) - refImageCount(a)
	);
}

async function loadReferenceImages(taskId: number) {
	if (!(service as any).app?.design_task?.request) return;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/getReferenceImages",
			method: "GET",
			params: { taskId }
		});
		const data = res?.data ?? res;
		const list = Array.isArray(data?.list) ? data.list : [];
		referenceRows.value = list.map((item: any) => ({
			competitorId: item.competitorId,
			asin: item.asin ?? "",
			marketplace: item.marketplace ?? "",
			monthlySales: Number(item.monthlySales || 0),
			images: Array.isArray(item.images) ? item.images : Array(7).fill("")
		}));
		sortReferenceRowsByImageCount();
	} catch (e) {
		console.error(e);
		referenceRows.value = [];
	}
}

async function fetchRefImages(row: { competitorId?: number; asin: string; images: string[] }) {
	if (mockMode.value) {
		ElMessage.info("[演示] 未请求后端获取参考图");
		return;
	}
	const cid = row.competitorId;
	if (cid == null || !(service as any).app?.design_task?.request) return;
	fetchRefLoading.value = cid;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/fetchCompetitorReferenceImages",
			method: "POST",
			data: { competitorId: cid }
		});
		const data = res?.data ?? res;
		if (data?.images && Array.isArray(data.images)) {
			row.images = data.images.slice(0, 7);
			while (row.images.length < 7) row.images.push("");
			sortReferenceRowsByImageCount();
		}
	} catch (e) {
		console.error(e);
		ElMessage.error("获取参考图失败");
	} finally {
		fetchRefLoading.value = null;
	}
}

async function open(taskId: number) {
	mockMode.value = false;
	activeTaskId.value = taskId;
	if (service.app?.design_task?.detail) {
		try {
			const res = await service.app.design_task.detail({ id: taskId });
			const data = res?.data ?? res;
			candidateId.value = data.candidate?.id ?? null;
			taskSku.value = data.candidate?.sku ?? "";
			imageSlotSortMode.value = getImageSlotSortModeBySku(taskSku.value);
			taskAsin.value = data.candidate?.asin ?? "";
			taskMarketplace.value = data.candidate?.marketplace ?? "";
			detailVariants.value = data.variants ?? [];
			detailOtherInfoVariants.value = data.variants ?? [];
			detailOtherInfoFactoryLinks.value = (data.factoryLinks ?? []).map((f: any) => ({
				id: String(f.id),
				type: f.type ?? "main",
				name: f.name ?? "",
				price: Number(f.price) || 0,
				link: f.link ?? "",
				linkDescription: f.linkDescription ?? ""
			}));
			detailOtherInfoPurchases.value = (data.purchases ?? []).map((p: any) => ({
				uk: Number(p.uk) || 0,
				de: Number(p.de) || 0,
				status: p.status ?? "待决策",
				opinion: p.opinion ?? "",
				variantId: p.variantId ?? undefined,
				total: Number(p.total) || 0,
				submitter: p.submitter ?? ""
			}));
			detailSellers.value = data.sellers ?? [];
			detailMskus.value = data.mskus ?? [];
			const pics = data.pictures ?? [];
			slots.length = 0;
			pics.forEach((p: any) => {
				let tag = (p.type ?? "").trim();
				const label = String(p.label ?? "").trim();
				if (isSlotLabelMinus1(label)) tag = "主图";
				else if (tag === "主图") tag = "场景图";
				slots.push({
					pictureId: p.id,
					key: p.label,
					label: p.label,
					refImage: p.reference_image ?? "",
					tag,
					description: p.variant_desc ?? "",
					bindMsku: p.msku ?? "",
					bindVariantId: p.variant_id ?? "",
					bindSellerAccountId: p.seller_account_id ?? "",
					remarkDoc: parseRemarkDocFromApi(p.remark_doc)
				});
			});
			sortSlotsInPlace();
			if (slots.length) activeSlotKey.value = slots[0].key;
			hasGeneratedRequirement.value = pics.some(
				(p: any) => !!(p.requirements && String(p.requirements).trim())
			);
		} catch (e) {
			console.error(e);
		}
	}
	await loadReferenceImages(taskId);
	cleanupExpiredDrafts();
	const draft = getDraft(taskId);
	if (draft?.slots?.length) {
		const pictureIdByLabel = new Map<string, number>();
		for (const s of slots) {
			const lb = String(s.label ?? s.key ?? "").trim();
			if (lb && s.pictureId != null && Number.isFinite(Number(s.pictureId))) {
				pictureIdByLabel.set(lb, Number(s.pictureId));
			}
		}
		slots.length = 0;
		draft.slots.forEach((s: any) => {
			const label = String(s.label ?? s.key ?? "").trim();
			let pictureId = s.pictureId != null ? Number(s.pictureId) : undefined;
			if (pictureId == null || !Number.isFinite(pictureId)) {
				const fromServer = pictureIdByLabel.get(label);
				if (fromServer != null) pictureId = fromServer;
			}
			slots.push({
				pictureId,
				key: s.key ?? "",
				label: s.label ?? "",
				refImage: s.refImage ?? "",
				tag: s.tag ?? "",
				description: s.description ?? "",
				bindMsku: s.bindMsku ?? "",
				bindVariantId: s.bindVariantId ?? "",
				bindSellerAccountId: s.bindSellerAccountId ?? "",
				remarkDoc: s.remarkDoc
					? {
							text: String(s.remarkDoc.text ?? ""),
							images: Array.isArray(s.remarkDoc.images) ? [...s.remarkDoc.images] : []
						}
					: emptyRemarkDoc()
			});
		});
		sortSlotsInPlace();
		activeSlotKey.value =
			draft.activeSlotKey && slots.some((s) => s.key === draft.activeSlotKey)
				? draft.activeSlotKey
				: (slots[0]?.key ?? "1-1");
		if (draft.referenceRows.length) referenceRows.value = draft.referenceRows;
		ElMessage.info("已恢复未保存的编辑");
	}
	dialogVisible.value = true;
}

/** Listing 内容工作室：用当前 MSKU 上下文灌入与原弹窗相同的数据结构（不接 task 详情接口） */
export interface ListingContentStudioMockPayload {
	msku: string;
	amazonAccount: string;
	variantLabel: string;
	sites: string[];
	asin: string;
	skuTitle?: string;
}

function openListingContentStudioMock(p: ListingContentStudioMockPayload) {
	mockMode.value = true;
	activeTaskId.value = null;
	candidateId.value = null;
	hasGeneratedRequirement.value = false;
	taskAsin.value = String(p.asin || "").trim();
	taskMarketplace.value = (p.sites && p.sites.length ? p.sites[0] : "UK") as string;
	const vid = "lcs-mock-variant";
	const sid = "lcs-mock-seller";
	detailMskus.value = [
		{
			msku: p.msku,
			variant_id: vid,
			seller_account_id: sid,
			variant_name: p.variantLabel,
			account_name: p.amazonAccount
		}
	];
	detailVariants.value = [{ variantsid: vid, name: p.variantLabel }];
	detailSellers.value = [{ seller_account_id: sid, account_name: p.amazonAccount }];
	detailOtherInfoVariants.value = [
		{
			variantsid: vid,
			name: p.variantLabel,
			description: p.skuTitle || "",
			imageUrl: ""
		}
	];
	detailOtherInfoFactoryLinks.value = [];
	detailOtherInfoPurchases.value = [];
	slots.length = 0;
	slots.push(
		{
			pictureId: undefined,
			key: "1-1",
			label: "1-1",
			refImage: "",
			tag: "主图",
			description: (p.skuTitle ? `${p.skuTitle} · ` : "") + "主图：产品正面/核心卖点（演示）",
			bindMsku: p.msku,
			bindVariantId: "",
			bindSellerAccountId: "",
			remarkDoc: emptyRemarkDoc()
		},
		{
			pictureId: undefined,
			key: "1-2",
			label: "1-2",
			refImage: "",
			tag: "场景图",
			description: "使用场景示意（演示）",
			bindMsku: "",
			bindVariantId: "",
			bindSellerAccountId: "",
			remarkDoc: emptyRemarkDoc()
		},
		{
			pictureId: undefined,
			key: "2-1",
			label: "2-1",
			refImage: "",
			tag: "配件图",
			description: "配件 / 尺寸说明（演示）",
			bindMsku: "",
			bindVariantId: "",
			bindSellerAccountId: "",
			remarkDoc: emptyRemarkDoc()
		}
	);
	slots.sort(sortImageSlots);
	activeSlotKey.value = slots[0]?.key ?? "1-1";
	referenceRows.value = [
		{
			competitorId: undefined,
			asin: "B0MOCKUK01",
			marketplace: "UK",
			monthlySales: 1200,
			images: Array(7).fill("")
		},
		{
			competitorId: undefined,
			asin: "B0MOCKDE02",
			marketplace: "DE",
			monthlySales: 860,
			images: Array(7).fill("")
		}
	];
	sortReferenceRowsByImageCount();
	dialogVisible.value = true;
}

function openProductPage() {
	if (!taskAsin.value || !taskMarketplace.value) return;
	const cleanAsin = String(taskAsin.value).replace(/[^A-Z0-9]/g, "");
	if (!cleanAsin) return;
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, taskMarketplace.value);
	window.open(dpUrl);
}

async function handleResyncSlots() {
	if (mockMode.value) {
		ElMessage.info("[演示] 不支持重新同步图片位");
		return;
	}
	const cid = candidateId.value;
	if (!cid) {
		ElMessage.warning("缺少选品信息，无法同步");
		return;
	}
	try {
		await ElMessageBox.confirm(
			"将重置为「待选参考图」并重新同步图片位（按当前采购数据生成），是否继续？",
			"强行同步图片位",
			{ confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
		);
	} catch {
		return;
	}
	syncSlotsLoading.value = true;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/syncForCandidate",
			method: "POST",
			data: { candidateId: cid, force: true }
		});
		const data = res?.data ?? res;
		if (data?.designTaskSyncSkipped) {
			ElMessage.warning("同步未执行");
			return;
		}
		ElMessage.success("图片位同步完成");
		if (activeTaskId.value) {
			clearDraft(activeTaskId.value);
			await open(activeTaskId.value);
		}
	} catch (e) {
		console.error(e);
		ElMessage.error("同步失败");
	} finally {
		syncSlotsLoading.value = false;
	}
}

async function saveRequirement(mode?: "all" | "delta") {
	if (mockMode.value) {
		ElMessage.success(
			`[演示] 已触发 AI 生成图需（${mode === "delta" ? "差量" : "全部"}，无真实请求）`
		);
		dialogVisible.value = false;
		mockMode.value = false;
		return;
	}
	const taskId = activeTaskId.value;
	if (taskId == null || !(service as any).app?.design_task?.request) {
		ElMessage.warning("无法保存");
		return;
	}
	try {
		const invalid = slots.find((slot) => {
			const labelOk = !!slot.label && slot.label.toString().trim().length > 0;
			const tagOk = !!slot.tag && slot.tag.toString().trim().length > 0;
			const refOk = !!slot.refImage && slot.refImage.toString().trim().length > 0;
			return !(labelOk && tagOk && refOk);
		});
		if (invalid) {
			ElMessage.warning("请为所有图片位填写编号、Tag 和参考图后再生成图需");
			return;
		}
		const bindInvalid = slots.find((slot) => {
			const tag = (slot.tag || "").trim();
			if (tag === "主图") return !(slot.bindMsku ?? "").trim();
			return false;
		});
		if (bindInvalid) {
			ElMessage.warning(`图片位 ${bindInvalid.label}（${bindInvalid.tag}）请选择挂载`);
			return;
		}
		const payload = {
			taskId,
			slots: slots.map((slot) => ({
				pictureId: slot.pictureId,
				label: slot.label,
				type: slot.tag || "",
				reference_image: slot.refImage || "",
				description: slot.description || "",
				msku: (slot.bindMsku ?? "").trim() || undefined,
				variant_id: (slot.bindVariantId ?? "").trim() || undefined,
				seller_account_id: (slot.bindSellerAccountId ?? "").trim() || undefined,
				remark_doc: remarkDocToPayload(slot.remarkDoc)
			}))
		};
		await (service as any).app.design_task.request({
			url: "/saveRequirementSlots",
			method: "POST",
			data: payload
		});
		await (service as any).app.design_task.request({
			url: "/markRequirementAiGenerating",
			method: "POST",
			data: { taskId, mode: mode || "all" }
		});
		ElMessage.success("已触发 AI 生成图需");
		clearDraft(taskId);
		dialogVisible.value = false;
		emit("success");
	} catch (e) {
		console.error(e);
		const apiMsg =
			(e as any)?.response?.data?.message ||
			(e as any)?.response?.data?.msg ||
			(e as any)?.response?.data?.error ||
			(e as any)?.message ||
			"保存失败";
		ElMessage.error(`保存失败：${apiMsg}`);
	}
}

function onAddSlotTagChange() {
	addSlotForm.bindMsku = "";
	addSlotForm.bindVariantId = "";
	addSlotForm.bindSellerAccountId = "";
}

function showAddSlotDialog() {
	addSlotForm.label = "";
	addSlotForm.tag = "";
	addSlotForm.description = "";
	addSlotForm.bindMsku = "";
	addSlotForm.bindVariantId = "";
	addSlotForm.bindSellerAccountId = "";
	addSlotFormRef.value?.resetFields();
	addSlotDialogVisible.value = true;
}

function handleAddSlot() {
	addSlotFormRef.value?.validate((valid: boolean) => {
		if (!valid) return false;
		const label = addSlotForm.label.trim();
		if (!/^\d+-\d+$/.test(label)) {
			ElMessage.warning("编号格式不正确，请输入如：4-1 的格式");
			return;
		}
		const exists = slots.some((slot) => slot.key === label);
		if (exists) {
			ElMessage.warning(`编号 ${label} 已存在`);
			return;
		}
		let tag = (addSlotForm.tag ?? "").trim();
		if (isSlotLabelMinus1(label)) tag = "主图";
		else if (tag === "主图") tag = "场景图";
		else if (!tag) {
			ElMessage.warning("请选择Tag");
			return;
		}
		if (tag === "主图" && !(addSlotForm.bindMsku ?? "").trim()) {
			ElMessage.warning("主图请选择挂载的 MSKU");
			return;
		}
		slots.push({
			pictureId: undefined,
			key: label,
			label,
			refImage: "",
			tag,
			description: addSlotForm.description?.trim() || "",
			bindMsku: addSlotForm.bindMsku?.trim() || "",
			bindVariantId: addSlotForm.bindVariantId?.trim() || "",
			bindSellerAccountId: addSlotForm.bindSellerAccountId?.trim() || "",
			remarkDoc: emptyRemarkDoc()
		});
		sortSlotsInPlace();
		ElMessage.success(`已添加图片位 ${label}`);
		addSlotDialogVisible.value = false;
		activeSlotKey.value = label;
	});
}

function showEditSlotDialog(slot: any) {
	editSlotForm.key = slot.key;
	editSlotForm.label = slot.label;
	editSlotForm.tag = isSlotLabelMinus1(slot.label) ? "主图" : slot.tag || "";
	editSlotForm.description = slot.description || "";
	editSlotForm.bindMsku = slot.bindMsku ?? "";
	editSlotForm.bindVariantId = slot.bindVariantId ?? "";
	editSlotForm.bindSellerAccountId = slot.bindSellerAccountId ?? "";
	nextTick(() => editSlotFormRef.value?.clearValidate());
	editSlotDialogVisible.value = true;
}

function handleEditSlot() {
	editSlotFormRef.value?.validate((valid: boolean) => {
		if (!valid) return false;
		const label = editSlotForm.label.trim();
		const oldKey = editSlotForm.key;
		if (!/^\d+-\d+$/.test(label)) {
			ElMessage.warning("编号格式不正确，请输入如：4-1 的格式");
			return;
		}
		let tag = (editSlotForm.tag ?? "").trim();
		if (isSlotLabelMinus1(label)) tag = "主图";
		else if (tag === "主图") tag = "场景图";
		else if (!tag) {
			ElMessage.warning("请选择Tag");
			return;
		}
		if (tag === "主图" && !(editSlotForm.bindMsku ?? "").trim()) {
			ElMessage.warning("主图请选择挂载的 MSKU");
			return;
		}
		const slot = slots.find((s) => s.key === oldKey);
		if (!slot) return;
		if (label !== oldKey) {
			const exists = slots.some((s) => s.key === label && s.key !== oldKey);
			if (exists) {
				ElMessage.warning(`编号 ${label} 已存在`);
				return;
			}
			slot.key = label;
			slot.label = label;
			if (activeSlotKey.value === oldKey) activeSlotKey.value = label;
			sortSlotsInPlace();
		}
		slot.tag = tag;
		slot.description = editSlotForm.description?.trim() || "";
		slot.bindMsku = editSlotForm.bindMsku?.trim() || "";
		slot.bindVariantId = editSlotForm.bindVariantId?.trim() || "";
		slot.bindSellerAccountId = editSlotForm.bindSellerAccountId?.trim() || "";
		ElMessage.success("已更新图片位信息");
		editSlotDialogVisible.value = false;
	});
}

function handleDeleteSlot(key: string) {
	ElMessageBox.confirm(`确定要删除图片位 ${key} 吗？`, "提示", {
		confirmButtonText: "确定",
		cancelButtonText: "取消",
		type: "warning"
	})
		.then(() => {
			const index = slots.findIndex((slot) => slot.key === key);
			if (index === -1) return;
			if (activeSlotKey.value === key) {
				if (slots.length > 1) {
					activeSlotKey.value = index > 0 ? slots[index - 1].key : slots[index + 1].key;
				} else {
					activeSlotKey.value = "";
				}
			}
			slots.splice(index, 1);
			ElMessage.success(`已删除图片位 ${key}`);
		})
		.catch(() => {});
}

defineExpose({ open, openListingContentStudioMock });
</script>

<style scoped lang="scss">
.regen-dialog-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
}

.regen-dialog-header-left {
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 0;
}

.regen-dialog-title {
	font-size: 18px;
	font-weight: 600;
	flex-shrink: 0;
}

.regen-dialog-header-actions {
	display: flex;
	align-items: center;
	gap: 8px;

	.el-button {
		padding: 0 !important;
		width: 32px !important;
		height: 32px !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		border: none !important;

		.el-icon {
			font-size: 16px;
			line-height: 1;
		}
	}
}

.design-requirement-regenerate-dialog-root {
	:deep(.el-dialog) {
		display: flex !important;
		flex-direction: column !important;
		height: 90vh !important;
		max-height: 90vh !important;
		margin-top: 5vh !important;
		margin-bottom: 5vh !important;
		position: relative !important;
		transition: all 0.3s ease;
	}

	&.is-fullscreen {
		:deep(.el-dialog) {
			width: 100% !important;
			height: 100vh !important;
			max-height: 100vh !important;
			margin: 0 !important;
			border-radius: 0 !important;
		}
	}

	:deep(.el-dialog__header) {
		flex-shrink: 0 !important;
		padding: 20px 20px 10px !important;
		border-bottom: 1px solid #ebeef5;
		position: relative !important;
		display: flex !important;
		align-items: center !important;
	}

	:deep(.el-dialog__body) {
		flex: 1 1 auto !important;
		display: flex !important;
		flex-direction: column !important;
		overflow: hidden !important;
		padding: 16px 20px 20px !important;
		min-height: 0 !important;
		max-height: none !important;
		position: relative !important;
	}

	:deep(.el-dialog__footer) {
		flex-shrink: 0 !important;
		padding: 15px 20px !important;
		border-top: 1px solid #ebeef5;
		margin-top: 0 !important;
		position: relative !important;
	}
}

.regen-dialog-footer {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
}

.regenerate-dialog-other-info {
	margin-bottom: 12px;
	flex-shrink: 0;
}

.regen-dialog-split {
	display: flex;
	flex: 0 0 auto;
	height: calc(90vh - 230px);
	max-height: calc(90vh - 230px);
	min-height: 0;
	gap: 0;
	border: 1px solid #e4e7ed;
	border-radius: 8px;
	overflow: hidden;
	background: #fff;
}

.regen-dialog-split-pane {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}

.regen-dialog-split-pane--slots {
	flex: 1 1 52%;
	height: 100%;
	border-right: 1px solid #e4e7ed;
	background: #eef0f3;
	overflow: hidden;
}

.regen-dialog-split-pane--refs {
	flex: 1 1 48%;
	height: 100%;
	background: #fff;
	overflow: hidden;
}

.design-requirement-regenerate-dialog-root.is-fullscreen .regen-dialog-split {
	height: calc(100vh - 170px);
	max-height: calc(100vh - 170px);
}

.reference-pane-header {
	flex-shrink: 0;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	padding: 10px 12px;
	border-bottom: 1px solid #ebeef5;
	background: #f5f7fa;
}

.reference-pane-title {
	font-weight: 600;
	font-size: 14px;
	color: #303133;
}

.reference-pane-hint {
	font-size: 12px;
	color: #909399;
}

.reference-pane-body {
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 8px;
}

.slot-row {
	display: flex;
	flex-direction: column;
	gap: 12px;
	flex: 1 1 auto;
	min-height: 0;
	padding: 10px 12px 12px;
	overflow: hidden;
}

.slot-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.slot-title {
	font-weight: 600;
	color: #303133;
}

.slot-header-btns {
	display: flex;
	gap: 8px;
}

.sort-mode-switch {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.sort-mode-switch > span.active {
	color: var(--el-color-primary);
	font-weight: 600;
}

.slot-header,
.slot-hint {
	flex-shrink: 0;
}

.slot-list {
	display: flex;
	flex-wrap: wrap;
	align-content: flex-start;
	column-gap: 20px;
	row-gap: 20px;
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	padding: 12px 16px 16px;
	box-sizing: border-box;
}

.slot-item {
	flex: 0 0 calc((100% - 40px) / 3);
	max-width: calc((100% - 40px) / 3);
	min-width: 0;
	box-sizing: border-box;
	border: 1px solid #dcdfe6;
	border-radius: 8px;
	padding: 10px;
	background: #fff;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	display: flex;
	flex-direction: column;
	gap: 8px;
	position: relative;
}

.slot-item.active {
	border-color: #409eff;
	box-shadow:
		0 0 0 1px #409eff inset,
		0 2px 8px rgba(64, 158, 255, 0.15);
}

.slot-header-actions {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 4px;
}

.slot-label {
	font-size: 13px;
	color: #606266;
	cursor: pointer;
	flex: 1;
}

.slot-actions {
	display: flex;
	gap: 4px;
	opacity: 0;
	transition: opacity 0.2s;
}

.slot-item:hover .slot-actions {
	opacity: 1;
}

.slot-thumb {
	height: 72px;
	border-radius: 4px;
	overflow: hidden;
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	position: relative;
}

.slot-placeholder {
	font-size: 12px;
	color: #c0c4cc;
	text-align: center;
	padding: 0 6px;
}

.slot-hint {
	font-size: 12px;
	color: #909399;
	margin: 0 0 8px 0;
}

.slot-clear {
	position: absolute;
	top: 4px;
	right: 4px;
	font-size: 18px;
	color: #fff;
	background: rgba(0, 0, 0, 0.5);
	border-radius: 50%;
	cursor: pointer;
}

.slot-clear:hover {
	background: rgba(0, 0, 0, 0.7);
}

.slot-paste-loading {
	position: absolute;
	inset: 0;
	background: rgba(255, 255, 255, 0.85);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 12px;
	color: #409eff;
}

.reference-table {
	width: 100%;

	:deep(.el-table__body-wrapper) {
		max-height: none;
		overflow-y: visible;
	}
}

.asin-cell {
	font-weight: 600;
	color: #303133;
}
.asin-link {
	color: var(--el-color-primary);
	text-decoration: none;
}
.asin-link:hover {
	text-decoration: underline;
}

.asin-sales {
	font-size: 12px;
	font-weight: 400;
	color: #909399;
	margin-top: 2px;
}

.reference-images {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	align-items: flex-start;
	min-width: 0;
}

.reference-image {
	flex: 0 0 110px;
	width: 110px;
	height: 110px;
	min-width: 110px;
	border-radius: 6px;
	border: 1px solid #ebeef5;
	cursor: pointer;
	overflow: hidden;
}

.reference-image :deep(.el-image),
.reference-image :deep(img) {
	width: 100% !important;
	height: 100% !important;
	object-fit: cover;
}

.reference-image:hover {
	border-color: #409eff;
}

.slot-image {
	width: 100%;
	height: 100%;
}

.slot-info {
	margin-top: 4px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-height: 40px;
}

.slot-tag-row {
	min-height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.slot-tag-select {
	width: 100%;
}

.slot-bind-row {
	display: flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
}

.slot-bind-row.slot-bind-optional {
	flex-direction: column;
	gap: 6px;
}

.slot-bind-row.slot-bind-optional .slot-bind-select {
	width: 100%;
}

.slot-bind-hint {
	font-size: 11px;
	color: #909399;
	width: 100%;
}

.slot-bind-select {
	width: 100%;
	font-size: 12px;
}

.slot-bind-text {
	font-size: 11px;
	color: #606266;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	display: block;
	max-width: 100%;
}

.slot-tag {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 24px;
}

.slot-empty-text {
	font-size: 12px;
	color: #c0c4cc;
}

.slot-description {
	font-size: 12px;
	color: #606266;
	line-height: 1.5;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
	word-break: break-all;
	cursor: default;
	min-height: 18px;
}

.bind-optional-row {
	display: flex;
	flex-direction: column;
	gap: 10px;
	width: 100%;
}

.bind-optional-row .el-select {
	width: 100%;
}

.form-hint {
	font-size: 12px;
	color: #909399;
	margin-top: 4px;
}

.form-hint-inline {
	font-size: 12px;
	color: #909399;
	margin-left: 8px;
}

.slot-remark-block {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px dashed #e4e7ed;
}

.slot-remark-label {
	font-size: 11px;
	color: #909399;
	margin-bottom: 4px;
}

.slot-remark-text :deep(textarea) {
	font-size: 11px;
}

.remark-images-row {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	align-items: center;
	margin-top: 6px;
}

.remark-thumb-wrap {
	position: relative;
	width: 44px;
	height: 44px;
	flex: 0 0 44px;
	border-radius: 4px;
	overflow: hidden;
	border: 1px solid #ebeef5;
}

.remark-thumb {
	width: 44px;
	height: 44px;
}

.remark-thumb-del {
	position: absolute;
	top: 0;
	right: 0;
	cursor: pointer;
	color: #f56c6c;
	background: rgba(255, 255, 255, 0.85);
	font-size: 14px;
}

.remark-file-input-hidden {
	display: none;
}
</style>

<style lang="scss">
/* teleported to body */
.slot-description-tooltip {
	max-width: min(360px, 90vw) !important;
	white-space: pre-wrap !important;
	word-break: break-word !important;
	line-height: 1.5 !important;
}
</style>
