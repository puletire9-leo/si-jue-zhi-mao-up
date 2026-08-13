<template>
	<div class="pricing-table">
		<!-- 工具栏 -->
		<div class="toolbar">
			<el-button type="primary" @click="openAdd">新增</el-button>
			<el-button :disabled="selectedRows.length === 0" @click="batchDelete">批量删除</el-button>
			<el-input v-model="keyword" placeholder="搜索" clearable style="width: 200px; margin-left: auto" @input="onSearch" />
		</div>

		<!-- 表格 -->
		<el-table :data="pageData" v-loading="loading" stripe border @selection-change="onSelectionChange" style="margin-top: 10px">
			<el-table-column type="selection" width="50" />
			<el-table-column type="index" label="#" width="50" />
			<el-table-column v-for="col in columns" :key="col.prop" :label="col.label" :prop="col.prop" :min-width="col.minWidth || 120" :width="col.width" :sortable="col.sortable" :show-overflow-tooltip="col.showOverflowTooltip">
				<template v-if="col.dict" #default="{ row }">
					<el-tag v-for="d in col.dict" v-if="row[col.prop] === d.value" :key="d.value" :type="d.color || 'info'" size="small">{{ d.label }}</el-tag>
				</template>
				<template v-else-if="col.prop === 'is_active'" #default="{ row }">
					<el-switch :model-value="row.is_active === 1" disabled size="small" />
				</template>
				<template v-else-if="isDateCol(col.prop)" #default="{ row }">
					<span>{{ row[col.prop] ? fmtDate(row[col.prop]) : '-' }}</span>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="120" fixed="right">
				<template #default="{ row }">
					<el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
					<el-button link type="danger" size="small" @click="doDelete(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<!-- 分页 -->
		<div style="margin-top: 15px; display: flex; justify-content: flex-end">
			<el-pagination v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10, 20, 50, 100]" layout="total, sizes, prev, pager, next" @current-change="applyFilter" @size-change="applyFilter" background />
		</div>

		<!-- 新增/编辑弹窗 -->
		<el-dialog v-model="dialogVisible" :title="isEdit ? '编辑' : '新增'" width="700px" :close-on-click-modal="false" @closed="resetForm">
			<el-form ref="FormRef" :model="form" label-width="110px">
				<el-row :gutter="16">
					<el-col v-for="item in formItems" :key="item.prop" :span="item.span || 24">
						<el-form-item :label="item.label" :required="item.required">
							<el-input v-if="item.component === 'input'" v-model="form[item.prop]" :placeholder="item.placeholder" />
							<el-input-number v-else-if="item.component === 'number'" v-model="form[item.prop]" :min="item.min ?? 0" :precision="item.precision ?? 0" :step="item.step ?? 1" controls-position="right" style="width: 100%" />
							<el-select v-else-if="item.component === 'select'" v-model="form[item.prop]" :placeholder="item.placeholder" clearable>
								<el-option v-for="opt in item.options" :key="opt.value" :label="opt.label" :value="opt.value" />
							</el-select>
							<el-switch v-else-if="item.component === 'switch'" v-model="form[item.prop]" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
							<el-date-picker v-else-if="item.component === 'datetime'" v-model="form[item.prop]" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
							<el-input v-else-if="item.component === 'textarea'" v-model="form[item.prop]" type="textarea" :rows="item.rows || 3" />
						</el-form-item>
					</el-col>
				</el-row>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible = false">取消</el-button>
				<el-button type="primary" :loading="saving" @click="doSave">保存</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

interface ColumnConfig {
	label: string;
	prop: string;
	width?: number;
	minWidth?: number;
	sortable?: string;
	showOverflowTooltip?: boolean;
	dict?: Array<{ label: string; value: any; color?: string }>;
}

interface FormItemConfig {
	label: string;
	prop: string;
	component: string;
	required?: boolean;
	span?: number;
	placeholder?: string;
	min?: number;
	precision?: number;
	step?: number;
	rows?: number;
	options?: Array<{ label: string; value: any }>;
}

const props = defineProps<{
	data: any[];
	columns: ColumnConfig[];
	formItems: FormItemConfig[];
	loading: boolean;
	service: any;
}>();

const emit = defineEmits(["refresh"]);

// 搜索/分页 (前端)
const keyword = ref("");
const page = ref(1);
const size = ref(20);
const total = ref(0);
const filteredData = ref<any[]>([]);
const pageData = ref<any[]>([]);

const dateCols = new Set(["createTime", "updateTime", "start_date", "end_date", "last_execution_time", "next_execution_time", "first_order_date", "seasonal_inflection_date", "last_update_time"]);
function isDateCol(prop: string) { return dateCols.has(prop); }
function fmtDate(v: any) { return typeof v === "string" ? v.substring(0, 19) : v; }

function onSearch() {
	page.value = 1;
	applyFilter();
}

function applyFilter() {
	let data = props.data;
	if (keyword.value) {
		const kw = keyword.value.toLowerCase();
		data = data.filter(row =>
			props.columns.some(col => String(row[col.prop] ?? "").toLowerCase().includes(kw))
		);
	}
	filteredData.value = data;
	total.value = data.length;
	pageData.value = data.slice((page.value - 1) * size.value, page.value * size.value);
}

watch(() => props.data, () => { page.value = 1; applyFilter(); }, { immediate: true });
// 切换 tab 时重置搜索和选中，关闭弹窗
watch(() => props.columns, () => { keyword.value = ''; selectedRows.value = []; dialogVisible.value = false; });

// 选中行
const selectedRows = ref<any[]>([]);
function onSelectionChange(rows: any[]) { selectedRows.value = rows; }

// 新增/编辑
const dialogVisible = ref(false);
const isEdit = ref(false);
const saving = ref(false);
const form = ref<Record<string, any>>({});
const FormRef = ref();

function resetForm() { form.value = {}; }

function openAdd() {
	isEdit.value = false;
	form.value = {};
	dialogVisible.value = true;
}

function openEdit(row: any) {
	isEdit.value = true;
	form.value = { ...row };
	dialogVisible.value = true;
}

async function doSave() {
	saving.value = true;
	try {
		if (isEdit.value) {
			await props.service.update(form.value);
			ElMessage.success("更新成功");
		} else {
			await props.service.add(form.value);
			ElMessage.success("新增成功");
		}
		dialogVisible.value = false;
		emit("refresh");
	} catch (e: any) {
		ElMessage.error(e?.message || "保存失败");
	} finally {
		saving.value = false;
	}
}

async function doDelete(row: any) {
	try {
		await ElMessageBox.confirm("确定删除？", "确认", { type: "warning" });
		await props.service.delete({ ids: [row.id] });
		ElMessage.success("删除成功");
		emit("refresh");
	} catch { /* cancelled */ }
}

async function batchDelete() {
	try {
		await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条数据？`, "确认", { type: "warning" });
		await props.service.delete({ ids: selectedRows.value.map(r => r.id) });
		ElMessage.success("批量删除成功");
		emit("refresh");
	} catch { /* cancelled */ }
}
</script>

<style scoped lang="scss">
.pricing-table {
	.toolbar { display: flex; align-items: center; gap: 8px; }
}
</style>
