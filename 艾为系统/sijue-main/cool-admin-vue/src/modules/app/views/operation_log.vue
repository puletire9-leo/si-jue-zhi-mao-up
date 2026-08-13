<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-multi-delete-btn />
			<cl-flex1 />
			<cl-filter label="类型筛选">
				<cl-select
					prop="type"
					:width="100"
					:options="[
						{ label: ' 调价', value: 0 },
						{ label: '补货', value: 1 }
					]"
				/>
			</cl-filter>
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-description="{ scope }">
					<div
						v-if="scope.row.description"
						v-html="scope.row.description.replace(/\n/g, '<br>')"
					></div>
					<div v-else>无</div>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="app-operation_log" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";

const { service } = useCool();

const Upsert = useUpsert({
	items: [
		{
			label: "操作人",
			prop: "via",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "类型",
			prop: "type",
			component: {
				name: "el-radio-group",
				options: [
					{ label: "调价", value: 0 },
					{ label: "补货", value: 1 }
				]
			},
			value: 0
		},
		{
			label: "描述",
			prop: "description",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		}
	]
});

const Table = useTable({
	columns: [
		{ type: "selection" },
		{
			label: "操作人",
			prop: "via",
			width: 140,
			formatter: (row, column, value) => value || "系统"
		},
		{
			label: "类型",
			prop: "type",
			dict: [
				{ label: "调价", value: 0, color: "#d79032" },
				{ label: "补货", value: 1, color: "#86c56a" }
			],
			dictColor: true,
			width: 100
		},
		{
			label: "描述",
			prop: "description",
			minWidth: 200
		},
		{
			label: "时间",
			prop: "createTime",
			width: 160,
			component: { name: "cl-date-text" }
		},

		{
			type: "op",
			buttons: ["edit", "delete"]
		}
	]
});

const Crud = useCrud(
	{
		service: service.app.operation_log
	},
	(app) => {
		app.refresh();
	}
);
</script>
