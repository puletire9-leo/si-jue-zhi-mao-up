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

<script lang="ts" name="app-cookie" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { is_admin } from "/$/app/utils";
import { ref } from "vue";
import { appConfig } from "../../../../../appConfig";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.cookie
	},
	(app) => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "ID*", prop: "id", minWidth: 80, hidden: !is_admin },
		{ label: "站点", prop: "site", minWidth: 80, sortable: "custom" },
		{
			label: "内容",
			prop: "content",
			minWidth: 120,
			component: { name: "cl-editor-preview", props: { name: "monaco", language: "json" } }
		},
		{
			label: "是否生效",
			prop: "isValid",
			minWidth: 130,
			component: { name: "cl-switch" },
			sortable: "custom"
		},
		{ label: "成功次数", prop: "successCount", minWidth: 140, sortable: "custom" },
		{ label: "失败次数", prop: "failCount", minWidth: 140, sortable: "custom" },
		{
			label: "成功率",
			prop: "successRate",
			minWidth: 100,
			formatter(row, column, value, index) {
				if (!(row.successCount === 0 && row.failCount === 0)) {
					return (
						Math.round((row.successCount / (row.successCount + row.failCount)) * 100) +
						"%"
					);
				} else {
					return "-";
				}
			}
		},
		{ label: "备注", prop: "remark", showOverflowTooltip: true, minWidth: 200 },
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "desc"
		},
		{ type: "op", buttons: ["edit", "delete"] }
	]
});

const Upsert = useUpsert({
	items: [
		{
			label: "站点",
			prop: "site",
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
			required: true
		},
		{
			label: "内容",
			prop: "content",
			component: { name: "cl-editor-monaco", props: { language: "json" } },
			rules: [
				{ required: true, message: "cookie 内容不可为空。" },
				{
					validator(rule, value, callback) {
						try {
							JSON.parse(value.trim());
							callback();
						} catch (err) {
							callback(new Error("不是有效的 JSON 格式。"));
						}
					}
				}
			]
		},
		{
			label: "是否生效",
			prop: "isValid",
			component: { name: "cl-switch" },
			value: 1,
			flex: false,
			required: true
		},
		{
			label: "成功次数*",
			prop: "successCount",
			hook: "number",
			component: { name: "el-input-number" },
			hidden: !is_admin
		},
		{
			label: "失败次数*",
			prop: "failCount",
			hook: "number",
			component: { name: "el-input-number" },
			hidden: !is_admin
		},
		{
			label: "备注",
			prop: "remark",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		}
	]
});
</script>
