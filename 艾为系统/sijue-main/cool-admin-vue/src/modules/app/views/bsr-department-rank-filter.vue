<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />

			<cl-flex1 />

			<cl-filter label="筛选站点">
				<cl-select
					prop="marketplace"
					:width="160"
					:options="
						Object.keys(appConfig.SITE_CODE).map((key) => {
							return {
								value: appConfig.SITE_CODE[key].code,
								label: `（${appConfig.SITE_CODE[key].code}）${appConfig.SITE_CODE[key].zh}`
							};
						})
					"
				/>
			</cl-filter>

			<cl-search-key placeholder="模糊搜索类目" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table"></cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert"></cl-upsert>
	</cl-crud>
</template>

<script lang="ts" name="-app-bsr-department-rank-filter" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import ClCrud from "/~/crud/src/components/crud";
import ClRow from "/~/crud/src/components/row";
import ClUpsert from "/~/crud/src/components/upsert";
import { appConfig } from "../../../../../appConfig";
import { is_admin } from "/$/app/utils";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.bsr_department_rank_filter
	},
	(app) => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "ID*", prop: "id", width: 50, hidden: !is_admin.value },
		{
			label: "站点",
			prop: "marketplace",
			width: 90,
			sortable: "custom",
			dict: Object.keys(appConfig.SITE_CODE).map((key) => {
				return {
					value: appConfig.SITE_CODE[key].code,
					label: `${appConfig.SITE_CODE[key].zh}`
				};
			}),
			dictColor: true
		},
		{ label: "类目名称", prop: "department", minWidth: 200, sortable: "custom" },
		{ label: "类目排名不低于", prop: "rank_limit", width: 150, sortable: "custom" },
		{
			label: "创建时间",
			prop: "createTime",
			width: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{
			label: "更新时间",
			prop: "updateTime",
			width: 170,
			sortable: "desc",
			component: { name: "cl-date-text" }
		},
		{
			type: "op",
			buttons: ["edit", "delete"]
		}
	]
});

const Upsert = useUpsert({
	dialog: {
		width: "650",

		"align-center": true
	},
	props: {
		labelWidth: "auto"
	},
	items: [
		{
			label: "类目名称",
			prop: "department",
			component: {
				name: "el-input",
				props: { clearable: true }
			},
			required: true
		},
		{
			label: "站点",
			prop: "marketplace",
			component: {
				name: "el-select",
				props: {},
				options: Object.keys(appConfig.SITE_CODE).map((key) => {
					return {
						value: appConfig.SITE_CODE[key].code,
						label: `（${appConfig.SITE_CODE[key].code}）${appConfig.SITE_CODE[key].zh}`
					};
				})
			},
			value: "UK",
			span: 12,
			required: true
		},
		{
			label: "类目排名不低于",
			prop: "rank_limit",
			hook: "number",
			component: { name: "el-input-number" },
			span: 12,
			required: true
		}
	]
});
</script>
