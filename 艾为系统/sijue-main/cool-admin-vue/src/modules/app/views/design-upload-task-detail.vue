<template>
	<el-dialog
		v-model="dialogVisible"
		width="1200px"
		:close-on-click-modal="false"
		:close-on-press-escape="false"
		class="design-upload-task-detail-dialog"
	>
		<template #header>
			<div class="dialog-header">
				<span class="dialog-title">上传任务详情</span>
			</div>
		</template>

		<div class="design-upload-task-detail">
			<el-card class="basic-card" shadow="never">
				<div class="basic-info-wrapper">
					<el-form label-width="120px" label-position="left" class="basic-form">
						<el-form-item label="产品名称">
							<span class="text-value">{{ detail.productName }}</span>
						</el-form-item>
						<el-form-item label="父SKU">
							<span class="text-value">{{ detail.sku }}</span>
						</el-form-item>
						<el-form-item label="任务状态">
							<el-tag :type="statusTagType(detail.status)">{{
								detail.status
							}}</el-tag>
						</el-form-item>
						<el-form-item label="摄影上传路径">
							<span class="text-value">{{ detail.photographerUploadPath }}</span>
						</el-form-item>
						<el-form-item label="美工上传路径">
							<span class="text-value">{{ detail.designerUploadPath }}</span>
						</el-form-item>
						<el-form-item label="提交人">
							<el-tag type="info">{{ detail.submitter }}</el-tag>
						</el-form-item>
						<el-form-item label="变体">
							<span class="text-value">{{ detail.variantName }}</span>
						</el-form-item>
						<el-form-item label="MSKU">
							<el-input v-model="detail.msku" placeholder="MSKU" disabled />
						</el-form-item>
						<el-form-item label="店铺账号">
							<el-select
								v-model="detail.shop"
								placeholder="店铺账号"
								style="width: 220px"
								disabled
							>
								<el-option
									v-for="shop in shopOptions"
									:key="shop.value"
									:label="shop.label"
									:value="shop.value"
								/>
							</el-select>
						</el-form-item>
						<el-form-item label="最终上传店铺账号">
							<div style="display: flex; flex-direction: column; gap: 4px">
								<el-select
									v-model="detail.finalAccount"
									placeholder="请选择最终上传店铺账号"
									clearable
									style="width: 220px"
								>
									<el-option
										v-for="shop in shopOptions"
										:key="shop.value"
										:label="shop.label"
										:value="shop.value"
									/>
								</el-select>
								<div class="form-hint">
									如果需要调整最终上传店铺账号请在这里记录
								</div>
							</div>
						</el-form-item>
					</el-form>
					<div class="main-image-wrapper">
						<image-zoom
							:src="detail.mainImage"
							fit="cover"
							:width="180"
							:height="130"
						/>
					</div>
				</div>
			</el-card>

			<el-card class="checklist-card" shadow="never">
				<div class="section-header">
					<div>
						<div class="section-title">上传检查表</div>
						<div class="section-tip">
							提示：文案区支持双击/右键标记行，点列名✓可整列标记，Ctrl/Cmd + 单击可复制单元格
						</div>
					</div>
					<div class="section-actions">
						<div class="sort-mode-switch">
							<span :class="{ active: imageSlotSortMode === 'position' }">按位置</span>
							<el-switch
								:model-value="imageSlotSortMode === 'set'"
								@change="handleImageSlotSortModeSwitchChange"
							/>
							<span :class="{ active: imageSlotSortMode === 'set' }">按套图</span>
						</div>
						<el-button size="small" type="primary" link @click="handleMarkAllCompleted">
							全部标记完成
						</el-button>
					</div>
				</div>
				<el-table :data="uploadChecklist" border style="width: 100%">
					<el-table-column prop="code" label="图片编号" width="100" />
					<el-table-column label="参考图" width="120" align="center">
						<template #default="{ row }">
							<image-zoom
								v-if="row.referenceImage"
								:src="row.referenceImage"
								fit="cover"
								:width="80"
								:height="80"
							/>
							<span v-else class="text-value">-</span>
						</template>
					</el-table-column>
					<el-table-column prop="type" label="Tag" width="120" align="center">
						<template #default="{ row }">
							<el-tag v-if="row.type" type="primary" size="small">{{
								row.type
							}}</el-tag>
							<span v-else class="text-value">-</span>
						</template>
					</el-table-column>
					<el-table-column
						prop="requirements"
						label="图需"
						min-width="260"
						show-overflow-tooltip
					>
						<template #default="{ row }">
							<div class="requirements-text">
								{{ row.requirements }}
							</div>
						</template>
					</el-table-column>
					<el-table-column label="操作" width="160" align="center">
						<template #default="{ row }">
							<el-checkbox v-model="row.completed">已完成</el-checkbox>
						</template>
					</el-table-column>
				</el-table>
			</el-card>
		</div>

		<template #footer>
			<div class="dialog-footer">
				<el-button @click="handleClose">关闭</el-button>
				<el-button type="primary" :loading="loading" @click="handleSave">保存</el-button>
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts" name="app-design-upload-task-detail">
import { reactive, ref, computed, watch } from "vue";
// @ts-ignore
import ImageZoom from "/$/app/components/image-zoom.vue";
import { service } from "/@/cool";
import { ElMessage } from "element-plus";
import {
	sortImageSlots,
	getImageSlotSortModeBySku,
	setImageSlotSortModeBySku,
	product_main_image_display_url,
	type ImageSlotSortMode
} from "../utils";

interface Props {
	modelValue: boolean;
	taskId?: string | number;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: false,
	taskId: undefined
});

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
	closed: [];
}>();

const dialogVisible = computed({
	get: () => props.modelValue,
	set: (value) => emit("update:modelValue", value)
});

const shopOptions = ref<Array<{ label: string; value: string }>>([]);

const detail = reactive({
	productName: "",
	sku: "",
	variantName: "",
	msku: "",
	shop: "",
	finalAccount: "",
	submitter: "",
	status: "",
	photographerUploadPath: "",
	designerUploadPath: "",
	mainImage: ""
});

interface UploadCheckItem {
	pictureId: number;
	code: string;
	completed: boolean;
	referenceImage: string;
	type: string;
	requirements: string;
}

const uploadChecklist = ref<UploadCheckItem[]>([]);
const loading = ref(false);
const imageSlotSortMode = ref<ImageSlotSortMode>("position");

function statusTagType(status: string) {
	if (status.includes("待")) return "warning";
	if (status.includes("中")) return "primary";
	if (status.includes("完成") || status.includes("已")) return "success";
	return "info";
}

function handleClose() {
	dialogVisible.value = false;
}

async function fetchDetail() {
	const id = props.taskId;
	if (!id || !(service as any).app?.design_task?.request) return;
	loading.value = true;
	try {
		const res = await (service as any).app.design_task.request({
			url: "/uploadTaskDetail",
			method: "GET",
			params: { id }
		});
		const data = res?.data ?? res;
		const basic = data?.basic ?? {};
		detail.productName = basic.productName || "";
		detail.sku = basic.sku || "";
		imageSlotSortMode.value = getImageSlotSortModeBySku(detail.sku);
		detail.variantName = basic.variantName || "";
		detail.msku = basic.msku || "";
		detail.shop = basic.shop || "";
		detail.finalAccount = basic.finalAccount || basic.shop || "";
		detail.submitter = basic.submitter || "";
		detail.status = basic.status || "";
		detail.photographerUploadPath = basic.photographerUploadPath || "";
		detail.designerUploadPath = basic.designerUploadPath || "";
		detail.mainImage = product_main_image_display_url(basic.mainImage);

		const list: UploadCheckItem[] = Array.isArray(data?.checklist)
			? data.checklist.map((x: any) => ({
					pictureId: Number(x.pictureId) || 0,
					code: x.code || "",
					completed: !!x.completed,
					referenceImage: x.referenceImage || "",
					type: x.type || "",
					requirements: x.requirements || ""
				}))
			: [];
		// 按图片位编号使用统一规则排序（与选图页保持一致）
		list.sort((a, b) => sortImageSlots({ label: a.code }, { label: b.code }, imageSlotSortMode.value));
		uploadChecklist.value = list;

		// 构造店铺下拉选项：所有店铺列表
		const shopList: Array<{ id: string; name: string }> = Array.isArray(data?.shops)
			? data.shops
			: [];
		if (shopList.length) {
			shopOptions.value = shopList.map((s) => ({
				label: s.name || s.id,
				value: s.id
			}));
		}
	} catch (e) {
		console.error(e);
		uploadChecklist.value = [];
	} finally {
		loading.value = false;
	}
}

function sortUploadChecklistInPlace() {
	uploadChecklist.value = [...uploadChecklist.value].sort((a, b) =>
		sortImageSlots({ label: a.code }, { label: b.code }, imageSlotSortMode.value)
	);
}

function toggleImageSlotSortMode() {
	const next: ImageSlotSortMode = imageSlotSortMode.value === "position" ? "set" : "position";
	imageSlotSortMode.value = next;
	setImageSlotSortModeBySku(detail.sku, next);
	sortUploadChecklistInPlace();
}

function handleImageSlotSortModeSwitchChange(checked: string | number | boolean) {
	imageSlotSortMode.value = checked ? "set" : "position";
	setImageSlotSortModeBySku(detail.sku, imageSlotSortMode.value);
	sortUploadChecklistInPlace();
}

watch(
	() => dialogVisible.value,
	(val) => {
		if (val) {
			fetchDetail();
		}
	}
);

async function handleSave() {
	const id = props.taskId;
	if (!id || !(service as any).app?.design_task?.request) return;
	loading.value = true;
	try {
		const payload = {
			id,
			finalAccount: detail.finalAccount,
			items: uploadChecklist.value.map((item) => ({
				pictureId: item.pictureId,
				code: item.code,
				completed: item.completed
			}))
		};
		await (service as any).app.design_task.request({
			url: "/saveUploadTaskDetail",
			method: "POST",
			data: payload
		});
		ElMessage.success("已保存");
		dialogVisible.value = false;
		emit("closed");
	} catch (e) {
		console.error(e);
		ElMessage.error("保存失败");
	} finally {
		loading.value = false;
	}
}

function handleMarkAllCompleted() {
	if (!uploadChecklist.value.length) return;
	uploadChecklist.value.forEach((item) => {
		item.completed = true;
	});
	handleSave();
}
</script>

<style scoped lang="scss">
.design-upload-task-detail {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.basic-card,
.checklist-card {
	border-radius: 6px;
}

.basic-info-wrapper {
	display: flex;
	justify-content: space-between;
	gap: 24px;
}

.basic-form {
	flex: 1;
}

.text-value {
	font-size: 14px;
	color: #303133;
}

.requirements-text {
	font-size: 14px;
	color: #303133;
	white-space: pre-wrap;
	line-height: 1.5;
}

.form-hint {
	font-size: 12px;
	color: #909399;
}

.main-image-wrapper {
	display: flex;
	align-items: flex-start;
	justify-content: center;
}

.dialog-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.dialog-title {
	font-size: 16px;
	font-weight: 600;
}

.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
}

.section-title {
	font-size: 15px;
	font-weight: 600;
}

.section-tip {
	margin-top: 4px;
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.section-actions {
	display: flex;
	align-items: center;
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

.dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
}
</style>
