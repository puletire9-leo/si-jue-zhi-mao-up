<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 左侧操作按钮 -->
			<cl-refresh-btn />

			<el-button type="primary" :loading="syncing" @click="handleFullSync">
				<el-icon><refresh /></el-icon>
				{{ syncing ? "同步中..." : "全量同步" }}
			</el-button>

			<el-button type="success" plain :loading="syncingSku" @click="handleSkuSync">
				<el-icon><connection /></el-icon>
				{{ syncingSku ? "同步中..." : "按SKU同步" }}
			</el-button>

			<cl-flex1 />

			<!-- 右侧筛选区 -->
			<div class="filter-area">
				<!-- 查全部还是查关联 -->
				<el-select v-model="filterLinkStatus" style="width: 140px" @change="onFilterChange">
					<el-option label="所有发货单" :value="0" />
					<el-option label="只看关联计划的" :value="1" />
				</el-select>

				<!-- 状态筛选 -->
				<el-select
					v-model="filterStatus"
					placeholder="发货单状态"
					clearable
					style="width: 130px"
					@change="onFilterChange"
				>
					<el-option label="待配货" :value="-1" />
					<el-option label="待发货" :value="0" />
					<el-option label="已发货" :value="1" />
					<el-option label="已完成" :value="2" />
					<el-option label="已作废" :value="3" />
				</el-select>

				<!-- 终态筛选 -->
				<el-select
					v-model="filterFinal"
					placeholder="终态"
					clearable
					style="width: 110px"
					@change="onFilterChange"
				>
					<el-option label="未终态" :value="0" />
					<el-option label="已终态" :value="1" />
				</el-select>

				<!-- 关键字搜索 -->
				<cl-search-key />
			</div>
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="app-bsr_shipment_actual_lingxing" setup>
import { ref } from "vue";
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { Refresh, Connection } from "@element-plus/icons-vue";

const { service } = useCool();

// ========== 筛选状态 ==========
const filterStatus = ref<number | undefined>(undefined);
const filterFinal = ref<number | undefined>(undefined);
const filterLinkStatus = ref<number>(0);
const syncing = ref(false);
const syncingSku = ref(false);

// ========== 操作方法 ==========
async function handleFullSync() {
	try {
		await ElMessageBox.confirm(
			"全量同步会拉取所有发货单数据（按更新时间），可能需要较长时间，确认执行？",
			"全量同步",
			{ confirmButtonText: "开始同步", cancelButtonText: "取消", type: "warning" }
		);
		syncing.value = true;
		const res = await service.app.bsr_shipment_actual_lingxing.fullSync({});
		ElMessage.success(
			`同步完成！拉取 ${res.totalFetched} 条发货单，落库 ${res.totalUpserted} 条明细，共 ${res.pages} 页`
		);
		Crud.value?.refresh();
	} catch (e: any) {
		if (e !== "cancel") ElMessage.error("同步失败: " + (e?.message || e));
	} finally {
		syncing.value = false;
	}
}

async function handleSkuSync() {
	try {
		await ElMessageBox.confirm(
			"按SKU同步：自动从发货计划表获取所有SKU，精准拉取对应发货单数据。",
			"SKU精准同步",
			{ confirmButtonText: "开始同步", cancelButtonText: "取消", type: "info" }
		);
		syncingSku.value = true;
		const res = await service.app.bsr_shipment_actual_lingxing.syncBySkuList({});
		ElMessage.success(`同步完成！${res.totalSkus} 个SKU，落库 ${res.totalUpserted} 条`);
		Crud.value?.refresh();
	} catch (e: any) {
		if (e !== "cancel") ElMessage.error("同步失败: " + (e?.message || e));
	} finally {
		syncingSku.value = false;
	}
}

function onFilterChange() {
	Crud.value?.refresh({
		shipment_status: filterStatus.value,
		is_final: filterFinal.value,
		link_status: filterLinkStatus.value
	});
}

// ========== cl-upsert ==========
const Upsert = useUpsert({
	items: [
		{ label: "发货单号", prop: "shipment_sn", component: { name: "el-input" }, required: true },
		{ label: "批次号", prop: "seq", component: { name: "el-input" }, required: true },
		{ label: "SKU", prop: "sku", component: { name: "el-input" } },
		{ label: "MSKU", prop: "msku", component: { name: "el-input" } },
		{ label: "产品名称", prop: "product_name", component: { name: "el-input" } },
		{
			label: "实际发货数量",
			prop: "shipment_list_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		}
	]
});

// ========== cl-table ==========
const Table = useTable({
	columns: [
		{ label: "#", type: "index", width: 50, fixed: "left" },

		// ===== 产品信息（固定左侧）=====
		{
			label: "产品图片",
			prop: "pic_url",
			width: 70,
			fixed: "left",
			component: { name: "cl-image", props: { size: 50 } }
		},
		{
			label: "SKU",
			prop: "sku",
			minWidth: 120,
			fixed: "left",
			showOverflowTooltip: true
		},

		// ===== 产品详情 =====
		{ label: "MSKU", prop: "msku", minWidth: 160, showOverflowTooltip: true },
		{ label: "产品名称", prop: "product_name", minWidth: 200, showOverflowTooltip: true },
		{ label: "ASIN", prop: "asin", minWidth: 120, showOverflowTooltip: true },

		// ===== 发货单信息 =====
		{ label: "发货单号", prop: "shipment_sn", minWidth: 130, showOverflowTooltip: true },
		{ label: "货件编号", prop: "shipment_id", minWidth: 150, showOverflowTooltip: true },
		{
			label: "发货单状态",
			prop: "shipment_status",
			minWidth: 100,
			dict: [
				{ label: "待配货", value: -1, color: "#909399" },
				{ label: "待发货", value: 0, color: "#E6A23C" },
				{ label: "已发货", value: 1, color: "#409EFF" },
				{ label: "已完成", value: 2, color: "#67C23A" },
				{ label: "已作废", value: 3, color: "#F56C6C" }
			],
			dictColor: true
		},
		{
			label: "MWS货件状态",
			prop: "shipment_status_mws",
			minWidth: 120,
			showOverflowTooltip: true
		},

		// ===== 数量信息 =====
		{
			label: "实际发货量",
			prop: "shipment_list_quantity",
			minWidth: 100,
			sortable: "custom"
		},
		{
			label: "计划发货量",
			prop: "shipment_plan_quantity",
			minWidth: 100,
			sortable: "custom"
		},
		{ label: "货件关联量", prop: "shipment_mws_quantity", minWidth: 100 },
		{ label: "产品发货量", prop: "num", minWidth: 100 },
		{ label: "申请量", prop: "apply_num", minWidth: 80 },

		// ===== 批次和计划 =====
		{ label: "批次号", prop: "seq", minWidth: 130, showOverflowTooltip: true },
		{ label: "计划单号", prop: "shipment_plan_sn", minWidth: 130, showOverflowTooltip: true },

		// ===== 物流信息 =====
		{ label: "运输方式", prop: "method_name", minWidth: 90 },
		{
			label: "物流渠道",
			prop: "logistics_channel_name",
			minWidth: 180,
			showOverflowTooltip: true
		},
		{ label: "发货仓库", prop: "wname", minWidth: 130, showOverflowTooltip: true },

		// ===== 店铺和国家 =====
		{ label: "店铺", prop: "sname", minWidth: 130, showOverflowTooltip: true },
		{ label: "国家", prop: "nation", minWidth: 70 },

		// ===== 时间信息 =====
		{
			label: "发货时间",
			prop: "shipment_time",
			minWidth: 110,
			sortable: "custom",
			showOverflowTooltip: true
		},
		{
			label: "预计到货",
			prop: "expected_arrival_date",
			minWidth: 110,
			sortable: "custom",
			showOverflowTooltip: true
		},
		{ label: "创建人", prop: "create_user", minWidth: 80 },
		{
			label: "创建时间",
			prop: "create_time_remote",
			minWidth: 110,
			sortable: "custom",
			showOverflowTooltip: true
		},

		// ===== 状态标记（固定右侧）=====
		{
			label: "终态",
			prop: "is_final",
			width: 70,
			fixed: "right",
			dict: [
				{ label: "否", value: 0, color: "#909399" },
				{ label: "是", value: 1, color: "#67C23A" }
			],
			dictColor: true
		},
		{
			label: "同步时间",
			prop: "last_sync_time",
			minWidth: 160,
			fixed: "right",
			sortable: "custom",
			component: { name: "cl-date-text" }
		}
	]
});

// ========== cl-crud ==========
const Crud = useCrud(
	{
		service: {
			...service.app.bsr_shipment_actual_lingxing,
			page: service.app.bsr_shipment_actual_lingxing.customPage
		}
	},
	(app) => {
		app.refresh();
	}
);
</script>

<style scoped>
.filter-area {
	display: flex;
	align-items: center;
	gap: 10px;
}
</style>
