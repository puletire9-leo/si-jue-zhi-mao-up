<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="app-bsr_price_rule" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.bsr_price_rule
	},
	(app) => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "序号", type: "index", width: 60 },
		{ label: "是否为新品", prop: "is_new_product", minWidth: 100 },
		{ label: "库存状态", prop: "inventory_status", minWidth: 100 },
		{ label: "销量标签", prop: "sales_label", minWidth: 100 },
		{ label: "关键词得分", prop: "keyword_score", minWidth: 100 },
		{ label: "竞品价格", prop: "competitor_price", minWidth: 100 },
		{ label: "我与竞品差值", prop: "competitor_price_diff", minWidth: 120 },
		// { label: "ACoS", prop: "acos", minWidth: 100 },
		{ label: "BD推荐", prop: "bd_recommendation", minWidth: 100 },
		{ label: "触发策略", prop: "trigger_strategy", minWidth: 150 },
		{ label: "系统动作", prop: "system_action", minWidth: 150 },
		{ label: "创建时间", prop: "createTime", minWidth: 160, component: { name: "cl-date-text" }, sortable: "custom" },
		{ label: "更新时间", prop: "updateTime", minWidth: 160, component: { name: "cl-date-text" }, sortable: "desc" },
		{ type: "op", buttons: ["edit", "delete"] }
	]
});

const Upsert = useUpsert({
	items: [
		{
			label: "是否为新品",
			prop: "is_new_product",
			component: {
				name: "el-select",
				options: [
					{ label: "是", value: "是" },
					{ label: "否", value: "否" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		{
			label: "库存状态",
			prop: "inventory_status",
			component: {
				name: "el-select",
				options: [
					{ label: "充足", value: "充足" },
					{ label: "微断", value: "微断" },
					{ label: "紧张", value: "紧张" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		{
			label: "销量标签",
			prop: "sales_label",
			component: {
				name: "el-select",
				options: [
					{ label: "新品能出", value: "新品能出" },
					{ label: "新品无单", value: "新品无单" },
					{ label: "上升", value: "上升" },
					{ label: "稳定", value: "稳定" },
					{ label: "下滑", value: "下滑" },
					{ label: "稳定/上升", value: "稳定/上升" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		{
			label: "关键词得分",
			prop: "keyword_score",
			component: {
				name: "el-select",
				options: [
					{ label: "上升", value: "上升" },
					{ label: "稳定", value: "稳定" },
					{ label: "上涨", value: "上涨" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		{
			label: "竞品价格",
			prop: "competitor_price",
			component: {
				name: "el-select",
				options: [
					{ label: "上涨", value: "上涨" },
					{ label: "稳定", value: "稳定" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		{
			label: "我与竞品差值",
			prop: "competitor_price_diff",
			component: {
				name: "el-select",
				options: [
					{ label: "低于", value: "低于" },
					{ label: "持平", value: "持平" },
					{ label: "高于", value: "高于" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		// {
		// 	label: "ACoS",
		// 	prop: "acos",
		// 	component: {
		// 		name: "el-select",
		// 		options: [
		// 			{ label: "健康", value: "健康" },
		// 			{ label: "偏高/失控", value: "偏高/失控" },
		// 			{ label: "任意", value: "任意" }
		// 		]
		// 	},
		// 	required: true
		// },
		{
			label: "BD推荐",
			prop: "bd_recommendation",
			component: {
				name: "el-select",
				options: [
					{ label: "是", value: "是" },
					{ label: "否", value: "否" },
					{ label: "任意", value: "任意" }
				]
			},
			required: true
		},
		{
			label: "触发策略",
			prop: "trigger_strategy",
			component: {
				name: "el-input",
				props: {
					placeholder: "例如：新品快速提价"
				}
			},
			required: true
		},
		{
			label: "系统动作",
			prop: "system_action",
			component: {
				name: "el-input",
				props: {
					placeholder: "例如：自动：5天"
				}
			},
			required: true
		}
	]
});
</script>
