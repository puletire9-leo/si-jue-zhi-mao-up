<template>
	<div class="exception-tracking-page">
		<!-- 统计卡片 -->
		<div class="stats-cards">
			<div
				class="stat-card"
				:class="{ active: statusFilter === null }"
				@click="setStatusFilter(null)"
			>
				<div class="stat-number">{{ stats.total }}</div>
				<div class="stat-label">全部</div>
			</div>
			<div
				class="stat-card danger"
				:class="{ active: statusFilter === 0 }"
				@click="setStatusFilter(0)"
			>
				<div class="stat-number">{{ stats.pending }}</div>
				<div class="stat-label">待处理</div>
			</div>
			<div
				class="stat-card warning"
				:class="{ active: statusFilter === 1 }"
				@click="setStatusFilter(1)"
			>
				<div class="stat-number">{{ stats.processing }}</div>
				<div class="stat-label">处理中</div>
			</div>
			<div
				class="stat-card success"
				:class="{ active: statusFilter === 2 }"
				@click="setStatusFilter(2)"
			>
				<div class="stat-number">{{ stats.resolved }}</div>
				<div class="stat-label">已解决</div>
			</div>
			<div
				class="stat-card info"
				:class="{ active: statusFilter === 3 }"
				@click="setStatusFilter(3)"
			>
				<div class="stat-number">{{ stats.closed }}</div>
				<div class="stat-label">已关闭</div>
			</div>
		</div>

		<cl-crud ref="Crud">
			<!-- 顶部操作栏 -->
			<cl-row>
				<cl-refresh-btn />
				<cl-multi-delete-btn />

				<cl-flex1 />

				<!-- 店铺筛选 -->
				<el-select
					v-model="storeFilter"
					placeholder="全部店铺"
					clearable
					size="default"
					style="width: 150px; margin-right: 8px"
					@change="onFilterChange"
				>
					<el-option
						v-for="s in processedStoreOptions"
						:key="s.value"
						:label="s.label"
						:value="s.value"
					/>
				</el-select>

				<!-- 异常类型筛选 -->
				<el-select
					v-model="typeFilter"
					placeholder="异常类型"
					clearable
					size="default"
					style="width: 110px; margin-right: 8px"
					@change="onFilterChange"
				>
					<el-option label="数据错误" value="数据错误" />
					<el-option label="价格异常" value="价格异常" />
					<el-option label="库存异常" value="库存异常" />
					<el-option label="物流异常" value="物流异常" />
					<el-option label="其他" value="其他" />
				</el-select>

				<!-- 精确搜索 -->
				<el-input
					v-model="searchKey"
					placeholder="单号 / MSKU / ASIN"
					clearable
					size="default"
					style="width: 180px"
					@keyup.enter="onSearchExact"
					@clear="onSearchClear"
				>
					<template #append>
						<el-button :icon="Search" @click="onSearchExact" />
					</template>
				</el-input>
			</cl-row>

			<cl-row>
				<cl-table ref="Table" bind="Table" :row-class-name="getRowClassName">
					<template #column-status="{ scope }">
						<el-tag
							size="small"
							:type="statusTagType(scope.row.status)"
							effect="dark"
							disable-transitions
						>
							{{ statusText(scope.row.status) }}
						</el-tag>
					</template>

					<template #column-exception_type="{ scope }">
						<el-tag
							size="small"
							:color="typeColorMap[scope.row.exception_type]"
							effect="dark"
							style="color: #fff; border: none"
							disable-transitions
						>
							{{ scope.row.exception_type }}
						</el-tag>
					</template>

					<template #column-plan_pic_url="{ scope }">
						<el-image
							v-if="scope.row.plan_pic_url"
							:src="scope.row.plan_pic_url"
							style="width: 36px; height: 36px; border-radius: 4px"
							fit="cover"
							:preview-src-list="[scope.row.plan_pic_url]"
							preview-teleported
						/>
						<span v-else style="color: #ccc; font-size: 12px">无图</span>
					</template>

					<template #column-createTime="{ scope }">
						{{ formatTime(scope.row.createTime) }}
					</template>

					<template #slot-btn="{ scope }">
						<el-button
							text
							bg
							type="primary"
							size="small"
							@click="openDetail(scope.row)"
							>详情</el-button
						>
						<el-button
							v-if="scope.row.status === 0 || scope.row.status === 1"
							text
							bg
							type="success"
							size="small"
							@click="openResolveDialog(scope.row)"
							>处理</el-button
						>
					</template>
				</cl-table>
			</cl-row>

			<cl-row>
				<cl-flex1 />
				<cl-pagination />
			</cl-row>

			<cl-upsert ref="Upsert" />
		</cl-crud>

		<!-- 处理异常弹窗 -->
		<el-dialog
			v-model="resolveDialog.visible"
			title="处理异常"
			width="480px"
			:close-on-click-modal="false"
		>
			<div v-if="resolveDialog.record" class="resolve-info">
				<el-descriptions :column="1" border size="small">
					<el-descriptions-item label="采购单号">{{
						resolveDialog.record.order_sn || "-"
					}}</el-descriptions-item>
					<el-descriptions-item label="异常类型">
						<el-tag
							size="small"
							:color="typeColorMap[resolveDialog.record.exception_type]"
							effect="dark"
							style="color: #fff"
							>{{ resolveDialog.record.exception_type }}</el-tag
						>
					</el-descriptions-item>
					<el-descriptions-item label="异常原因">{{
						resolveDialog.record.reason || "-"
					}}</el-descriptions-item>
					<el-descriptions-item label="提交人">{{
						resolveDialog.record.submit_nickname ||
						resolveDialog.record.submit_user ||
						"-"
					}}</el-descriptions-item>
				</el-descriptions>
			</div>

			<el-form label-width="80px" style="margin-top: 16px">
				<el-form-item label="处理状态">
					<el-radio-group v-model="resolveDialog.status">
						<el-radio :label="1">处理中</el-radio>
						<el-radio :label="2">已解决</el-radio>
						<el-radio :label="3">已关闭</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item label="处理备注">
					<el-input
						v-model="resolveDialog.remark"
						type="textarea"
						:rows="3"
						placeholder="请填写处理说明..."
					/>
				</el-form-item>
			</el-form>

			<template #footer>
				<el-button @click="resolveDialog.visible = false">取消</el-button>
				<el-button type="primary" :loading="resolveDialog.loading" @click="handleResolve"
					>确认</el-button
				>
			</template>
		</el-dialog>

		<!-- 详情抽屉 -->
		<el-drawer
			v-model="detailDrawer.visible"
			title="异常详情"
			size="600px"
			:destroy-on-close="true"
		>
			<div v-if="detailDrawer.loading" style="text-align: center; padding: 40px">
				<el-icon class="is-loading" :size="32"><loading /></el-icon>
				<div style="margin-top: 8px; color: #999">加载中...</div>
			</div>

			<div v-else-if="detailDrawer.data" class="detail-content">
				<!-- 异常信息 -->
				<div class="detail-section">
					<div class="section-title">异常信息</div>
					<el-descriptions :column="2" border size="small">
						<el-descriptions-item label="状态">
							<el-tag :type="statusTagType(detailDrawer.data.status)" size="small">{{
								statusText(detailDrawer.data.status)
							}}</el-tag>
						</el-descriptions-item>
						<el-descriptions-item label="异常类型">
							<el-tag
								size="small"
								:color="typeColorMap[detailDrawer.data.exception_type]"
								effect="dark"
								style="color: #fff"
								>{{ detailDrawer.data.exception_type }}</el-tag
							>
						</el-descriptions-item>
						<el-descriptions-item label="店铺">{{
							detailDrawer.data.store_name ||
							`未知店铺 (SID: ${detailDrawer.data.sid})`
						}}</el-descriptions-item>
						<el-descriptions-item label="提交人" :span="1">{{
							detailDrawer.data.submit_nickname ||
							detailDrawer.data.submit_user ||
							"-"
						}}</el-descriptions-item>
						<el-descriptions-item label="提交时间" :span="1">{{
							formatTime(detailDrawer.data.createTime)
						}}</el-descriptions-item>
						<el-descriptions-item label="异常原因" :span="2">{{
							detailDrawer.data.reason || "-"
						}}</el-descriptions-item>
					</el-descriptions>
				</div>

				<!-- 处理信息（如果已处理） -->
				<div
					class="detail-section"
					v-if="detailDrawer.data.status > 0 && detailDrawer.data.resolve_user"
				>
					<div class="section-title">处理信息</div>
					<el-descriptions :column="2" border size="small">
						<el-descriptions-item label="处理人">{{
							detailDrawer.data.resolve_nickname || detailDrawer.data.resolve_user
						}}</el-descriptions-item>
						<el-descriptions-item label="处理时间">{{
							formatTime(detailDrawer.data.resolve_time)
						}}</el-descriptions-item>
						<el-descriptions-item label="处理备注" :span="2">{{
							detailDrawer.data.resolve_remark || "-"
						}}</el-descriptions-item>
					</el-descriptions>
				</div>

				<!-- 关联采购单 -->
				<div class="detail-section" v-if="detailDrawer.data.order">
					<div class="section-title">
						关联采购单 ({{ detailDrawer.data.order.order_sn }})
					</div>
					<el-descriptions :column="2" border size="small">
						<el-descriptions-item label="采购单号">{{
							detailDrawer.data.order.order_sn
						}}</el-descriptions-item>
						<el-descriptions-item label="状态">{{
							detailDrawer.data.order.status_text
						}}</el-descriptions-item>
						<el-descriptions-item label="供应商">{{
							detailDrawer.data.order.supplier_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="仓库">{{
							detailDrawer.data.order.ware_house_name || "-"
						}}</el-descriptions-item>
						<el-descriptions-item label="总金额"
							>¥{{ detailDrawer.data.order.amount_total || 0 }}</el-descriptions-item
						>
						<el-descriptions-item label="采购总量">{{
							detailDrawer.data.order.quantity_total || 0
						}}</el-descriptions-item>
						<el-descriptions-item label="下单时间">{{
							formatTime(detailDrawer.data.order.order_time)
						}}</el-descriptions-item>
						<el-descriptions-item label="操作人">{{
							detailDrawer.data.order.opt_realname || "-"
						}}</el-descriptions-item>
					</el-descriptions>
				</div>

				<!-- 采购单子项列表 -->
				<div
					class="detail-section"
					v-if="detailDrawer.data.orderItems && detailDrawer.data.orderItems.length > 0"
				>
					<div class="section-title">
						产品明细 ({{ detailDrawer.data.orderItems.length }} 个产品)
					</div>
					<el-table
						:data="detailDrawer.data.orderItems"
						size="small"
						border
						stripe
						style="width: 100%"
						max-height="300"
					>
						<el-table-column label="图片" width="60">
							<template #default="{ row }">
								<el-image
									v-if="row.plan_pic_url"
									:src="row.plan_pic_url"
									style="width: 40px; height: 40px; border-radius: 4px"
									fit="cover"
									:preview-src-list="[row.plan_pic_url]"
								/>
								<span v-else style="color: #ccc">无</span>
							</template>
						</el-table-column>
						<el-table-column
							label="产品名称"
							prop="product_name"
							min-width="150"
							show-overflow-tooltip
						/>
						<el-table-column label="SKU" prop="sku" width="120" show-overflow-tooltip />
						<el-table-column label="MSKU" width="120" show-overflow-tooltip>
							<template #default="{ row }">
								{{
									Array.isArray(row.msku) ? row.msku.join(", ") : row.msku || "-"
								}}
							</template>
						</el-table-column>
						<el-table-column label="单价" prop="price" width="80" align="right">
							<template #default="{ row }"> ¥{{ row.price || "-" }} </template>
						</el-table-column>
						<el-table-column
							label="计划量"
							prop="quantity_plan"
							width="70"
							align="center"
						/>
						<el-table-column
							label="实际量"
							prop="quantity_real"
							width="70"
							align="center"
						/>
						<el-table-column
							label="入库量"
							prop="quantity_entry"
							width="70"
							align="center"
						/>
					</el-table>
				</div>

				<!-- 没有关联采购单数据的提示 -->
				<div
					class="detail-section"
					v-if="!detailDrawer.data.order && detailDrawer.data.order_sn"
				>
					<el-alert type="warning" :closable="false" show-icon>
						采购单 {{ detailDrawer.data.order_sn }} 在系统中未找到关联数据
					</el-alert>
				</div>
			</div>
		</el-drawer>
	</div>
</template>

<script lang="ts" name="app-bsr_exception_tracking" setup>
import { reactive, ref, onMounted, computed } from "vue";
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage } from "element-plus";
import { Search, Loading } from "@element-plus/icons-vue";

const { service } = useCool();

// ========== 筛选状态 ==========
const statusFilter = ref<number | null>(null);
const typeFilter = ref<string>("");
const storeFilter = ref<number | string | null>(null);
const searchKey = ref<string>("");
const storeOptions = ref<Array<{ sid: number; store_name: string }>>([]);
const stats = reactive({ total: 0, pending: 0, processing: 0, resolved: 0, closed: 0 });

// 计算优化后的下拉选项
const processedStoreOptions = computed(() => {
	const validStores = storeOptions.value.filter((s) => s.store_name);
	const hasUnknown = storeOptions.value.some((s) => !s.store_name);

	const options: Array<{ label: string; value: number | string }> = validStores.map((s) => ({
		label: s.store_name,
		value: s.sid
	}));

	if (hasUnknown) {
		options.unshift({
			label: "未知店铺",
			value: "unknown"
		});
	}

	return options;
});

// ========== 处理弹窗 ==========
const resolveDialog = reactive({
	visible: false,
	loading: false,
	record: null as any,
	status: 2,
	remark: ""
});

// ========== 详情抽屉 ==========
const detailDrawer = reactive({
	visible: false,
	loading: false,
	data: null as any
});

// 配色映射
const typeColorMap: Record<string, string> = {
	数据错误: "#f56c6c",
	价格异常: "#e6a23c",
	库存异常: "#409eff",
	物流异常: "#9b59b6",
	其他: "#909399"
};

// 辅助函数
const statusText = (s: number) =>
	({ 0: "待处理", 1: "处理中", 2: "已解决", 3: "已关闭" })[s] || "未知";
const statusTagType = (s: number): any =>
	({ 0: "danger", 1: "warning", 2: "success", 3: "info" })[s] || "info";

const formatTime = (val: string) => {
	if (!val) return "-";
	const d = new Date(val);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// 行样式：根据状态着色
const getRowClassName = ({ row }: any) => {
	if (row.status === 0) return "row-pending";
	if (row.status === 1) return "row-processing";
	return "";
};

// 状态卡片点击
const setStatusFilter = (val: number | null) => {
	statusFilter.value = val;
	onFilterChange();
};

// 精确搜索
const onSearchExact = () => {
	const key = searchKey.value.trim();
	if (!key) {
		onFilterChange();
		return;
	}
	// 尝试精确匹配多个字段
	const params: any = {};
	if (statusFilter.value !== null) params.status = statusFilter.value;
	if (typeFilter.value) params.exception_type = typeFilter.value;

	if (storeFilter.value === "unknown") {
		const unknownSids = storeOptions.value.filter((s) => !s.store_name).map((s) => s.sid);
		params.sid = unknownSids.length > 0 ? unknownSids : -1;
	} else if (storeFilter.value !== null && storeFilter.value !== "") {
		params.sid = storeFilter.value;
	}

	// 判断搜索词类型并精确匹配
	if (key.startsWith("PO") || key.startsWith("PP")) {
		params.order_sn = key;
	} else if (/^B0[A-Z0-9]{8}$/.test(key)) {
		params.asin = key;
	} else {
		// 通用：用关键词模糊搜索（product_name/reason/store_name）
		params.keyWord = key;
	}

	Crud.value?.refresh(params);
};

const onSearchClear = () => {
	onFilterChange();
};

// 筛选变更
const onFilterChange = () => {
	const params: any = {};
	if (statusFilter.value !== null) params.status = statusFilter.value;
	if (typeFilter.value) params.exception_type = typeFilter.value;

	if (storeFilter.value === "unknown") {
		const unknownSids = storeOptions.value.filter((s) => !s.store_name).map((s) => s.sid);
		params.sid = unknownSids.length > 0 ? unknownSids : -1;
	} else if (storeFilter.value !== null && storeFilter.value !== "") {
		params.sid = storeFilter.value;
	}
	if (searchKey.value.trim()) {
		const key = searchKey.value.trim();
		if (key.startsWith("PO") || key.startsWith("PP")) {
			params.order_sn = key;
		} else if (/^B0[A-Z0-9]{8}$/.test(key)) {
			params.asin = key;
		} else {
			params.keyWord = key;
		}
	}
	Crud.value?.refresh(params);
};

// 打开处理弹窗
const openResolveDialog = (row: any) => {
	resolveDialog.record = row;
	resolveDialog.status = row.status === 0 ? 2 : row.status;
	resolveDialog.remark = row.resolve_remark || "";
	resolveDialog.visible = true;
};

// 确认处理
const handleResolve = async () => {
	resolveDialog.loading = true;
	try {
		await service.app.bsr_exception_tracking.updateStatus({
			id: resolveDialog.record.id,
			status: resolveDialog.status,
			resolve_remark: resolveDialog.remark
		});
		ElMessage.success("处理成功");
		resolveDialog.visible = false;
		Crud.value?.refresh();
		loadStats();
	} catch (err) {
		ElMessage.error("处理失败");
	} finally {
		resolveDialog.loading = false;
	}
};

// 打开详情抽屉
const openDetail = async (row: any) => {
	detailDrawer.visible = true;
	detailDrawer.loading = true;
	detailDrawer.data = null;
	try {
		const res = await service.app.bsr_exception_tracking.detail({ id: row.id });
		detailDrawer.data = res;
	} catch (err) {
		ElMessage.error("加载详情失败");
	} finally {
		detailDrawer.loading = false;
	}
};

// 加载统计
const loadStats = async () => {
	try {
		const res = await service.app.bsr_exception_tracking.stats();
		Object.assign(stats, res);
	} catch (err) {
		console.error("加载统计失败:", err);
	}
};

// 加载店铺选项
const loadStoreOptions = async () => {
	try {
		const res = await service.app.bsr_exception_tracking.storeOptions();
		storeOptions.value = res || [];
	} catch (err) {
		console.error("加载店铺选项失败:", err);
	}
};

// cl-upsert (编辑弹窗)
const Upsert = useUpsert({
	items: [
		{
			label: "异常类型",
			prop: "exception_type",
			component: {
				name: "el-select",
				options: [
					{ label: "数据错误", value: "数据错误" },
					{ label: "价格异常", value: "价格异常" },
					{ label: "库存异常", value: "库存异常" },
					{ label: "物流异常", value: "物流异常" },
					{ label: "其他", value: "其他" }
				]
			},
			required: true
		},
		{
			label: "异常原因",
			prop: "reason",
			component: { name: "el-input", props: { type: "textarea", rows: 3 } }
		},
		{ label: "店铺名称", prop: "store_name", component: { name: "el-input" } },
		{ label: "采购单号", prop: "order_sn", component: { name: "el-input" } },
		{ label: "产品名称", prop: "product_name", component: { name: "el-input" } },
		{ label: "SKU", prop: "sku", component: { name: "el-input" } },
		{ label: "MSKU", prop: "msku", component: { name: "el-input" } },
		{ label: "ASIN", prop: "asin", component: { name: "el-input" } },
		{ label: "计划号", prop: "plan_sn", component: { name: "el-input" } },
		{
			label: "单价",
			prop: "price",
			hook: "number",
			component: { name: "el-input-number", props: { precision: 2 } }
		},
		{
			label: "数量",
			prop: "quantity_plan",
			hook: "number",
			component: { name: "el-input-number" }
		}
	]
});

// cl-table
const Table = useTable({
	columns: [
		{ type: "selection", width: 40 },
		{ label: "状态", prop: "status", width: 85, fixed: "left" },
		{ label: "异常类型", prop: "exception_type", width: 90 },
		{
			label: "店铺",
			prop: "store_name",
			width: 160,
			showOverflowTooltip: true,
			formatter: (row) => row.store_name || `未知店铺 (SID: ${row.sid})`
		},
		{ label: "采购单号", prop: "order_sn", width: 130 },
		{ label: "单据状态", prop: "order_status_text", width: 100 },
		{
			label: "产品图片",
			prop: "plan_pic_url",
			width: 60
		},
		{ label: "产品名称", prop: "product_name", minWidth: 150, showOverflowTooltip: true },
		{ label: "MSKU", prop: "msku", width: 120, showOverflowTooltip: true },
		{ label: "ASIN", prop: "asin", width: 110 },
		{ label: "单价", prop: "price", width: 70, align: "right" },
		{ label: "数量", prop: "quantity_plan", width: 60, align: "center" },
		{ label: "异常原因", prop: "reason", minWidth: 150, showOverflowTooltip: true },
		{ label: "提交人", prop: "submit_nickname", width: 80 },
		{
			label: "提交时间",
			prop: "createTime",
			width: 140,
			sortable: "custom"
		},
		{
			type: "op",
			width: 200,
			fixed: "right",
			buttons: ["slot-btn", "edit", "delete"]
		}
	]
});

// cl-crud
const Crud = useCrud(
	{
		service: service.app.bsr_exception_tracking
	},
	(app) => {
		app.refresh();
		loadStats();
		loadStoreOptions();
	}
);
</script>

<style lang="scss" scoped>
.exception-tracking-page {
	padding: 12px;
	height: 100%;
	background-color: #f6f8f9;
}

/* 统计卡片高级样式 */
.stats-cards {
	display: flex;
	gap: 16px;
	margin-bottom: 20px;
}

.stat-card {
	flex: 1;
	background: #ffffff;
	border-radius: 12px;
	padding: 20px;
	cursor: pointer;
	border: 1px solid #ebeef5;
	transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
	position: relative;
	overflow: hidden;

	/* 拟态高光特效 */
	&::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.4) 0%,
			rgba(255, 255, 255, 0) 100%
		);
		opacity: 0;
		transition: opacity 0.3s;
	}

	&:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);

		&::after {
			opacity: 1;
		}
	}

	&.active {
		border-color: #409eff;
		box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
	}

	/* 不同状态卡的渐变背景及颜色 */
	&.danger {
		.stat-number {
			color: #f56c6c;
		}
		&.active {
			background: linear-gradient(135deg, #fef0f0 0%, #fff 100%);
			border-color: #f56c6c;
			box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2);
		}
	}

	&.warning {
		.stat-number {
			color: #e6a23c;
		}
		&.active {
			background: linear-gradient(135deg, #fdf6ec 0%, #fff 100%);
			border-color: #e6a23c;
			box-shadow: 0 0 0 2px rgba(230, 162, 60, 0.2);
		}
	}

	&.success {
		.stat-number {
			color: #67c23a;
		}
		&.active {
			background: linear-gradient(135deg, #f0f9eb 0%, #fff 100%);
			border-color: #67c23a;
			box-shadow: 0 0 0 2px rgba(103, 194, 58, 0.2);
		}
	}

	&.info {
		.stat-number {
			color: #909399;
		}
		&.active {
			background: linear-gradient(135deg, #f4f4f5 0%, #fff 100%);
			border-color: #909399;
			box-shadow: 0 0 0 2px rgba(144, 147, 153, 0.2);
		}
	}

	.stat-number {
		font-size: 32px;
		font-weight: 800;
		color: #303133;
		line-height: 1.2;
		font-family:
			-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	}

	.stat-label {
		font-size: 13px;
		color: #606266;
		margin-top: 4px;
		font-weight: 500;
	}
}

/* 高级表格行状态标识 */
:deep(.row-pending) {
	td {
		background-color: #fff9f9 !important;
	}
}

:deep(.row-processing) {
	td {
		background-color: #fffcf7 !important;
	}
}

/* 详情抽屉卡片优化 */
.detail-content {
	padding: 12px;
}

.detail-section {
	margin-bottom: 24px;
	background: #fff;
	border-radius: 8px;
	padding: 16px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

	.section-title {
		font-size: 15px;
		font-weight: 600;
		color: #303133;
		margin-bottom: 16px;
		padding-left: 10px;
		border-left: 4px solid #409eff;
		display: flex;
		align-items: center;
	}
}

.resolve-info {
	margin-bottom: 16px;
}
</style>
