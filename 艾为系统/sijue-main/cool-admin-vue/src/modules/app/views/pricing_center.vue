<template>
	<div class="pricing-center">
		<el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
			<el-tab-pane label="触发规则" name="trigger" />
			<el-tab-pane label="调价策略" name="strategy" />
			<el-tab-pane label="任务管理" name="task" />
			<el-tab-pane label="实时监控" name="realtime" />
		</el-tabs>

		<PricingTable
			:data="currentData"
			:columns="currentColumns"
			:form-items="currentFormItems"
			:loading="loading"
			:service="currentService"
			@refresh="loadData"
		/>
	</div>
</template>

<script lang="ts" name="app-pricing-center" setup>
import { ref, computed, onMounted } from "vue";
import { useCool } from "/@/cool";
import PricingTable from "/$/app/components/pricing_table.vue";

const { service } = useCool();
const app: any = service.app;

const activeTab = ref("trigger");
const loading = ref(false);

// 各表数据
const triggerData = ref<any[]>([]);
const strategyData = ref<any[]>([]);
const taskData = ref<any[]>([]);
const realtimeData = ref<any[]>([]);

// ====== 触发规则 列 & 表单 ======
const triggerColumns = [
	{ label: "规则名称", prop: "rule_name", minWidth: 160 },
	{ label: "国家/站点", prop: "marketplace", width: 100 },
	{ label: "优先级", prop: "priority", width: 80 },
	{ label: "匹配策略", prop: "matched_strategy", minWidth: 150,
		dict: [
			{ label: "10天涨价", value: "AUTO_10_DAY_PRICE_UP", color: "primary" },
			{ label: "5天涨价", value: "AUTO_5_DAY_PRICE_UP", color: "success" },
			{ label: "5天降价", value: "AUTO_5_DAY_PRICE_DOWN", color: "warning" },
			{ label: "清货目标", value: "AUTO_CLEARANCE_TARGET", color: "danger" },
			{ label: "库存控制", value: "AUTO_INVENTORY_CONTROL", color: "info" }
		] },
	{ label: "是否启用", prop: "is_active", width: 80 },
	{ label: "目标单量取值", prop: "target_order_source", minWidth: 130 },
	{ label: "规则描述", prop: "description", minWidth: 200, showOverflowTooltip: true },
	{ label: "创建时间", prop: "createTime", minWidth: 150 },
	{ label: "更新时间", prop: "updateTime", minWidth: 150 }
];

const triggerFormItems: any[] = [
	{ label: "规则名称", prop: "rule_name", component: "input", required: true, span: 12 },
	{ label: "国家/站点", prop: "marketplace", component: "select", span: 12,
		options: [{ label: "全部", value: "" }, { label: "英国", value: "英国" }, { label: "德国", value: "德国" }] },
	{ label: "优先级", prop: "priority", component: "number", span: 12, min: 0 },
	{ label: "是否启用", prop: "is_active", component: "switch", span: 12 },
	{ label: "匹配策略", prop: "matched_strategy", component: "select", required: true, span: 24,
		options: [
			{ label: "自动：10天涨价测试", value: "AUTO_10_DAY_PRICE_UP" },
			{ label: "自动：5天涨价测试", value: "AUTO_5_DAY_PRICE_UP" },
			{ label: "自动：5天降价测试", value: "AUTO_5_DAY_PRICE_DOWN" },
			{ label: "降价测试（清货目标）", value: "AUTO_CLEARANCE_TARGET" },
			{ label: "降价测试（库存控制）", value: "AUTO_INVENTORY_CONTROL" }
		] },
	{ label: "目标单量取值", prop: "target_order_source", component: "select", span: 12,
		options: [
			{ label: "触发时3日均", value: "TRIGGER_TIME_3DAY_AVG" },
			{ label: "手动", value: "MANUAL" },
			{ label: "不使用", value: "-" }
		] },
	{ label: "规则描述", prop: "description", component: "textarea", span: 24, rows: 3 },
	{ label: "备注", prop: "remark", component: "textarea", span: 24, rows: 2 }
];

// ====== 调价策略 列 & 表单 ======
const strategyColumns = [
	{ label: "策略名称", prop: "strategy_name", minWidth: 180 },
	{ label: "策略类型", prop: "strategy_type", minWidth: 150,
		dict: [
			{ label: "10天涨价", value: "AUTO_10_DAY_PRICE_UP", color: "primary" },
			{ label: "5天涨价", value: "AUTO_5_DAY_PRICE_UP", color: "success" },
			{ label: "5天降价", value: "AUTO_5_DAY_PRICE_DOWN", color: "warning" },
			{ label: "清货目标", value: "AUTO_CLEARANCE_TARGET", color: "danger" },
			{ label: "库存控制", value: "AUTO_INVENTORY_CONTROL", color: "info" }
		] },
	{ label: "执行天数", prop: "total_days", width: 80 },
	{ label: "是否启用", prop: "is_active", width: 80 },
	{ label: "策略描述", prop: "description", minWidth: 200, showOverflowTooltip: true },
	{ label: "创建时间", prop: "createTime", minWidth: 150 },
	{ label: "更新时间", prop: "updateTime", minWidth: 150 }
];

const strategyFormItems: any[] = [
	{ label: "策略名称", prop: "strategy_name", component: "input", required: true, span: 12 },
	{ label: "策略类型", prop: "strategy_type", component: "select", required: true, span: 12,
		options: [
			{ label: "10天涨价测试", value: "AUTO_10_DAY_PRICE_UP" },
			{ label: "5天涨价测试", value: "AUTO_5_DAY_PRICE_UP" },
			{ label: "5天降价测试", value: "AUTO_5_DAY_PRICE_DOWN" },
			{ label: "降价测试（清货目标）", value: "AUTO_CLEARANCE_TARGET" },
			{ label: "降价测试（库存控制）", value: "AUTO_INVENTORY_CONTROL" }
		] },
	{ label: "执行天数", prop: "total_days", component: "number", required: true, span: 12, min: 1 },
	{ label: "是否启用", prop: "is_active", component: "switch", span: 12 },
	{ label: "策略描述", prop: "description", component: "textarea", span: 24, rows: 3 },
	{ label: "备注", prop: "remark", component: "textarea", span: 24, rows: 2 }
];

// ====== 任务管理 列 & 表单 ======
const taskColumns = [
	{ label: "任务名称", prop: "task_name", minWidth: 150 },
	{ label: "ASIN", prop: "asin", width: 100 },
	{ label: "MSKU", prop: "msku", width: 100 },
	{ label: "店铺", prop: "seller_name", minWidth: 120 },
	{ label: "站点", prop: "marketplace", width: 80 },
	{ label: "策略类型", prop: "strategy_type", minWidth: 140,
		dict: [
			{ label: "10天涨价", value: "AUTO_10_DAY_PRICE_UP", color: "primary" },
			{ label: "5天涨价", value: "AUTO_5_DAY_PRICE_UP", color: "success" },
			{ label: "5天降价", value: "AUTO_5_DAY_PRICE_DOWN", color: "warning" },
			{ label: "清货目标", value: "AUTO_CLEARANCE_TARGET", color: "danger" },
			{ label: "库存控制", value: "AUTO_INVENTORY_CONTROL", color: "info" }
		] },
	{ label: "状态", prop: "status", width: 90,
		dict: [
			{ label: "待执行", value: "PENDING", color: "info" },
			{ label: "运行中", value: "RUNNING", color: "success" },
			{ label: "已暂停", value: "PAUSED", color: "warning" },
			{ label: "已完成", value: "COMPLETED", color: "primary" },
			{ label: "已取消", value: "CANCELLED", color: "danger" }
		] },
	{ label: "进度", prop: "current_day", width: 60 },
	{ label: "当前价格", prop: "current_price", width: 90 },
	{ label: "产品类型", prop: "product_type", width: 90,
		dict: [
			{ label: "常季品", value: "REGULAR" },
			{ label: "季节品", value: "SEASONAL", color: "warning" },
			{ label: "节日品", value: "HOLIDAY", color: "danger" },
			{ label: "新市场品", value: "NEWMARKET", color: "success" }
		] },
	{ label: "触发规则", prop: "trigger_rule_name", minWidth: 120 },
	{ label: "创建时间", prop: "createTime", minWidth: 150 }
];

const taskFormItems: any[] = [
	{ label: "任务名称", prop: "task_name", component: "input", required: true, span: 12 },
	{ label: "ASIN", prop: "asin", component: "input", required: true, span: 12 },
	{ label: "MSKU", prop: "msku", component: "input", required: true, span: 12 },
	{ label: "站点", prop: "marketplace", component: "input", required: true, span: 12 },
	{ label: "店铺", prop: "seller_name", component: "input", required: true, span: 12 },
	{ label: "策略类型", prop: "strategy_type", component: "select", required: true, span: 12,
		options: [
			{ label: "10天涨价测试", value: "AUTO_10_DAY_PRICE_UP" },
			{ label: "5天涨价测试", value: "AUTO_5_DAY_PRICE_UP" },
			{ label: "5天降价测试", value: "AUTO_5_DAY_PRICE_DOWN" },
			{ label: "降价测试（清货目标）", value: "AUTO_CLEARANCE_TARGET" },
			{ label: "降价测试（库存控制）", value: "AUTO_INVENTORY_CONTROL" }
		] },
	{ label: "状态", prop: "status", component: "select", span: 12,
		options: [
			{ label: "待执行", value: "PENDING" }, { label: "运行中", value: "RUNNING" },
			{ label: "已暂停", value: "PAUSED" }, { label: "已完成", value: "COMPLETED" },
			{ label: "已取消", value: "CANCELLED" }
		] },
	{ label: "产品类型", prop: "product_type", component: "select", span: 12,
		options: [
			{ label: "常季品", value: "REGULAR" }, { label: "季节品", value: "SEASONAL" },
			{ label: "节日品", value: "HOLIDAY" }, { label: "新市场品", value: "NEWMARKET" }
		] },
	{ label: "触发规则ID", prop: "trigger_rule_id", component: "number", span: 12, min: 0 },
	{ label: "触发规则名称", prop: "trigger_rule_name", component: "input", span: 12 },
	{ label: "当前天数", prop: "current_day", component: "number", span: 8, min: 0 },
	{ label: "总天数", prop: "total_days", component: "number", span: 8, min: 0 },
	{ label: "当前价格", prop: "current_price", component: "number", span: 8, precision: 2, step: 0.01 },
	{ label: "初始价格", prop: "initial_price", component: "number", span: 8, precision: 2, step: 0.01 },
	{ label: "BD价", prop: "bd_price", component: "number", span: 8, precision: 2, step: 0.01 },
	{ label: "平本价", prop: "break_even_price", component: "number", span: 8, precision: 2, step: 0.01 },
	{ label: "清仓价", prop: "clearance_price", component: "number", span: 8, precision: 2, step: 0.01 },
	{ label: "开始日期", prop: "start_date", component: "datetime", span: 12 },
	{ label: "结束日期", prop: "end_date", component: "datetime", span: 12 },
	{ label: "备注", prop: "remark", component: "textarea", span: 24, rows: 2 }
];

// ====== 实时监控 列 & 表单 ======
const realtimeColumns = [
	{ label: "规则名称", prop: "rule_name", minWidth: 160 },
	{ label: "触发时间", prop: "trigger_time", width: 90 },
	{ label: "国家", prop: "marketplace", width: 80 },
	{ label: "阈值(倍)", prop: "threshold_value", width: 90 },
	{ label: "调价方向", prop: "price_action", width: 100,
		dict: [
			{ label: "涨价", value: "PRICE_UP", color: "danger" },
			{ label: "降价", value: "PRICE_DOWN", color: "success" }
		] },
	{ label: "金额", prop: "price_value", width: 80 },
	{ label: "优先级", prop: "priority", width: 70 },
	{ label: "是否启用", prop: "is_active", width: 80 },
	{ label: "创建时间", prop: "createTime", minWidth: 150 }
];

const realtimeFormItems: any[] = [
	{ label: "规则名称", prop: "rule_name", component: "input", required: true, span: 12,
		placeholder: "如：英国-中午涨价" },
	{ label: "触发时间", prop: "trigger_time", component: "input", required: true, span: 12,
		placeholder: "12:00 或 18:00" },
	{ label: "国家/站点", prop: "marketplace", component: "select", required: true, span: 8,
		options: [{ label: "英国", value: "英国" }, { label: "德国", value: "德国" }] },
	{ label: "阈值倍数", prop: "threshold_value", component: "number", required: true, span: 8,
		min: 0.1, precision: 1, step: 0.1 },
	{ label: "调价金额", prop: "price_value", component: "number", required: true, span: 8,
		min: 0.01, precision: 2, step: 0.01 },
	{ label: "调价方向", prop: "price_action", component: "select", required: true, span: 8,
		options: [{ label: "涨价", value: "PRICE_UP" }, { label: "降价", value: "PRICE_DOWN" }] },
	{ label: "优先级", prop: "priority", component: "number", span: 8, min: 0 },
	{ label: "是否启用", prop: "is_active", component: "switch", span: 8 },
	{ label: "规则描述", prop: "description", component: "textarea", span: 24, rows: 2 },
	{ label: "备注", prop: "remark", component: "textarea", span: 24, rows: 2 }
];

// ====== tab 配置映射 ======
const tabConfig: Record<string, any> = {
	trigger: {
		columns: triggerColumns,
		formItems: triggerFormItems,
		service: app.pricing_trigger_rule,
		dataRef: triggerData
	},
	strategy: {
		columns: strategyColumns,
		formItems: strategyFormItems,
		service: app.pricing_strategy,
		dataRef: strategyData
	},
	task: {
		columns: taskColumns,
		formItems: taskFormItems,
		service: app.pricing_task,
		dataRef: taskData
	},
	realtime: {
		columns: realtimeColumns,
		formItems: realtimeFormItems,
		service: app.pricing_realtime_rule,
		dataRef: realtimeData
	}
};

// ====== computed 当前 tab 配置 ======
const currentData = computed(() => tabConfig[activeTab.value]?.dataRef.value ?? []);
const currentColumns = computed(() => tabConfig[activeTab.value]?.columns ?? []);
const currentFormItems = computed(() => tabConfig[activeTab.value]?.formItems ?? []);
const currentService = computed(() => tabConfig[activeTab.value]?.service);

// 各 tab 对应的后端 service 名称
const svcNameMap: Record<string, string> = {
	trigger: "pricing_trigger_rule",
	strategy: "pricing_strategy",
	task: "pricing_task",
	realtime: "pricing_realtime_rule"
};

// ====== 数据加载 ======
async function loadData() {
	loading.value = true;
	try {
		const svcName = svcNameMap[activeTab.value];
		const res = await app[svcName].page({ page: 1, size: 9999 });
		const cfg = tabConfig[activeTab.value];
		if (cfg) cfg.dataRef.value = res.list || [];
	} catch (e) {
		console.error("加载数据失败", e);
	} finally {
		loading.value = false;
	}
}

function onTabChange() {
	const cfg = tabConfig[activeTab.value];
	if (cfg && cfg.dataRef.value.length === 0) {
		loadData();
	}
}

onMounted(() => loadData());
</script>

<style lang="scss" scoped>
.pricing-center { padding: 10px; }
</style>
