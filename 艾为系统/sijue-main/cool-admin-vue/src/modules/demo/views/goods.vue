<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />
			<cl-flex1 />
			<!-- 关键字搜索 -->
			<cl-search-key />
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

<script lang="ts" name="demo-goods" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";

const { service } = useCool();

// cl-upsert
const Upsert = useUpsert({
	items: [
		{
			prop: "title",
			label: "标题",
			required: true,
			component: { name: "el-input" }
		},
		{
			prop: "price",
			label: "价格",
			hook: { bind: ["number"] },
			component: { name: "el-input-number", props: { min: 0 } },
			required: true
		},
		{
			prop: "description",
			label: "描述",
			component: { name: "el-input" }
		},
		{
			prop: "mainImage",
			label: "主图",
			component: { name: "cl-upload" }
		},
		{
			prop: "exampleImages",
			label: "示例图",
			component: { name: "cl-upload", props: { multiple: true } }
		},
		{
			prop: "stock",
			label: "库存",
			hook: { bind: ["number"] },
			component: { name: "el-input-number", props: { min: 0 } },
			required: true
		}
	]
});

// cl-table
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ prop: "id", label: "ID" },
		{ prop: "title", label: "标题" },
		{ prop: "price", label: "价格" },
		{ prop: "description", label: "描述" },
		{
			prop: "mainImage",
			label: "主图",
			component: { name: "cl-image", props: { size: 60 } }
		},
		{
			prop: "exampleImages",
			label: "示例图",
			component: { name: "cl-image", props: { size: 60 } }
		},
		{ prop: "stock", label: "库存" },
		{
			prop: "createTime",
			label: "创建时间",
			sortable: "desc",
			width: 160
		},
		{
			prop: "updateTime",
			label: "更新时间",
			sortable: "custom",
			width: 160
		},
		{ type: "op", buttons: ["edit", "delete"] }
	]
});

// cl-crud
const Crud = useCrud(
	{
		service: service.demo.goods
	},
	(app) => {
		app.refresh();
	}
);
</script>
