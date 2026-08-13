<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />

			<batch-update-bsr-task-spider-status :Crud="Crud" />

			<el-popconfirm
				title="本操作会把系统中所有 BSR 任务状态置为「待调研」，确认操作吗？"
				:width="280"
				@confirm="
					Crud?.service.set_all_status_pending().then(() => {
						Crud?.refresh();
					})
				"
			>
				<template #reference>
					<el-button>重新执行所有 BSR 任务</el-button>
				</template>
			</el-popconfirm>

			<el-popconfirm
				title="此操作将删除当前查询结果的所有数据，确认删除吗？"
				:width="280"
				@confirm="deleteQueryData"
			>
				<template #reference>
					<el-button type="danger">删除当前查询结果</el-button>
				</template>
			</el-popconfirm>

			<cl-flex1 />
			<!-- <cl-filter label="国家" >
        <cl-select prop="marketplace" :width="150" :options="[
          {label: userStore.info?.socketId, value: userStore.info?.socketId},
          {label: userStore.info?.socketId, value: userStore.info?.socketId},
          {label: userStore.info?.socketId, value: userStore.info?.socketId},
        ]"/>
      </cl-filter>     -->

			<bsr-task-filter-status />

			<cl-search-key placeholder="模糊搜索" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-bsr_link="{ scope }">
					<cl-table-column-bsr-link :bsr_link="scope.row.bsr_link" />
				</template>

				<template #column-spider_res="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.spider_res"
						@click="
							jsonViewerContent = JSON.stringify(scope.row.spider_res, null, 2);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.spider_res?.products_info?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-filter-hints>
				<el-space direction="vertical" alignment="stretch">
					<el-alert type="warning" show-icon>
						<template #title>
							注意：请谨慎设置如下参数，若过滤条件太宽松/严格，可能会导致收录到太多/少的的选品。</template
						>
					</el-alert>
				</el-space>
			</template>

			<template #slot-select-delivery-type="{ scope }">
				<el-select
					v-model="scope.delivery_type"
					multiple
					clearable
					:empty-values="[[]]"
					:value-on-clear="[]"
				>
					<el-option
						v-for="(type, index) in appConfig.DELIVERY_TYPE"
						:key="index"
						:label="type.desc"
						:value="type.value"
					/>
				</el-select>
			</template>

			<template #slot-select-seller-countries="{ scope }">
				<el-select
					v-model="scope.seller_countries"
					multiple
					clearable
					:empty-values="[[]]"
					:value-on-clear="[]"
				>
					<el-option
						v-for="(site, index) in [
							{ value: 'CN', label: '中国' },
							{ value: 'HK', label: '中国香港' },
							{ value: 'US', label: '美国' },
							{ value: 'CA', label: '加拿大' },
							{ value: 'MX', label: '墨西哥' },
							{ value: 'BR', label: '巴西' },
							{ value: 'GB', label: '英国' },
							{ value: 'DE', label: '德国' },
							{ value: 'FR', label: '法国' },
							{ value: 'ES', label: '西班牙' },
							{ value: 'IT', label: '意大利' },
							{ value: 'NL', label: '荷兰' },
							{ value: 'SE', label: '瑞典' },
							{ value: 'PL', label: '波兰' },
							{ value: 'BE', label: '比利时' },
							{ value: 'TR', label: '土耳其' },
							{ value: 'JP', label: '日本' },
							{ value: 'AU', label: '澳大利亚' }
						]"
						:key="index"
						:label="`（${site.value}）${site.label}`"
						:value="site.value"
					/>
				</el-select>
			</template>
		</cl-upsert>

		<cl-dialog v-model="jsonViewerDialogVisible" align-center>
			<cl-editor-monaco
				v-model="jsonViewerContent"
				language="json"
				:height="800"
				disabled
			></cl-editor-monaco>
			<template #footer>
				<el-button size="large" @click="jsonViewerDialogVisible = false">OK</el-button>
			</template>
		</cl-dialog>
	</cl-crud>
</template>

<script lang="ts" name="app-bsr-task" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, reactive, ref } from "vue";
import { appConfig } from "../../../../../appConfig";
import ClDialog from "/~/crud/src/components/dialog";
import { is_admin } from "/$/app/utils";
import BatchUpdateBsrTaskSpiderStatus from "/$/app/components/batch-update-bsr-task-spider-status.vue";
import ClCrud from "/~/crud/src/components/crud";
import ClRow from "/~/crud/src/components/row";
import BsrTaskFilterStatus from "/$/app/components/bsr-task-filter-status.vue";
import dayjs from "dayjs";
import ClUpsert from "/~/crud/src/components/upsert";
import ClTableColumnBsrLink from "/$/app/components/cl-table-column-bsr-link.vue";
import { useUserStore } from "/$/base/store/user";

const { service } = useCool();
const userStore = useUserStore();
console.log("1111111111111111", userStore.info?.socketId);

const Crud = useCrud(
	{
		service: service.app.bsr_task

		// async onRefresh(params, {next, done, render}) {
		//   if (US.value) Object.assign(params, {marketplace1: '英国'});
		//   // if (UK.value) Object.assign(params, {marketplace: 0});
		//   if (DE.value) Object.assign(params, {marketplace2: '德国'});
		//   const {list} = await next({
		//     ...params,
		//   });
		// }
	},
	(app) => {
		app.refresh();
	}
);

// const US = ref(true);
// const UK = ref(true);
// const DE = ref(true);
// const showOnlyUndeleted = ref(true);

const Table = useTable({
	columns: [
		{ type: "selection" },
		{
			label: "BSR 链接",
			prop: "bsr_link",
			minWidth: 260,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{
			label: "任务状态",
			prop: "status",
			dict: [
				{ label: "待调研", value: 0, type: "info" },
				{ label: "爬虫中", value: 102, type: "warning" },
				{ label: "调研中", value: 1, color: "purple" },
				{ label: "已调研", value: 2, type: "success" }
			],
			minWidth: 90,
			fixed: "left"
		},
		{
			label: "国家*",
			prop: "marketplace",
			minWidth: 90,
			fixed: "left",
			hidden: !is_admin.value
		},
		{
			label: "爬虫数据*",
			prop: "spider_res",
			width: 95,
			hidden: !is_admin.value,
			fixed: "left"
		},
		{ prop: "id", label: "ID *", width: 70, hidden: !is_admin.value, fixed: "left" },
		{ label: "备注", prop: "remark", showOverflowTooltip: true, minWidth: 200 },
		{
			label: "选品筛选条件",
			children: [
				{
					label: "价格（最小）",
					prop: "price_min",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "价格（最大）",
					prop: "price_max",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "评论（最小）",
					prop: "review_min",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "评论（最大）",
					prop: "review_max",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "星级（最小）",
					prop: "last_star_min",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "上架时间（不早于）",
					prop: "date_first_available",
					minWidth: 130,
					sortable: "custom",
					formatter: (row, column, value) => {
						return value ? dayjs(value).format("YYYY-MM-DD") : "不限";
					}
				},
				{
					label: "榜单排名（不低于）",
					prop: "bsr_rank_max",
					minWidth: 100,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "配送方式",
					prop: "delivery_type",
					dict: [
						{ value: 0, label: "自营", type: "warning" },
						{ value: 1, label: "FBA", color: "purple" },
						{ value: 2, label: "FBM" }
					],
					width: 170
				},
				{
					label: "卖家所属国家",
					prop: "seller_countries",
					minWidth: 120,
					formatter: (row, column, value) => {
						if (Array.isArray(value))
							return value?.length === 0 ? "不限" : value.join(", ");
						else return value;
					},
					showOverflowTooltip: true
				},
				{
					label: "变体数（最大）",
					prop: "variants_max",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "变体数（最小）",
					prop: "variants_min",
					width: 110,
					sortable: "custom",
					formatter: (row, column, value) => value || "不限"
				},
				{
					label: "排除关键词",
					prop: "exclude_key",
					minWidth: 260,
					showOverflowTooltip: true,
					fixed: "left"
				},
				{
					label: "排除包裹类型",
					prop: "exclude_package",
					minWidth: 260,
					showOverflowTooltip: true,
					fixed: "left"
				}
			]
		},
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 170,
			sortable: "desc",
			component: { name: "cl-date-text" }
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{
			type: "op",
			buttons: ["edit", "delete"]
		}
	]
});

const upsert_short_label_width = "auto";
const is_upsert_in_update_mode = computed(() => {
	return !is_admin.value && Upsert?.value?.mode === "update";
});
const Upsert = useUpsert({
	dialog: {
		width: "700",
		"align-center": true
	},
	props: {
		labelWidth: "auto"
	},
	items: [
		{
			label: "BSR 链接",
			prop: "bsr_link",
			component: {
				name: "el-input",
				props: {
					type: "textarea",
					autosize: { minRows: 1, maxRows: 12 },
					resize: "none",
					placeholder: "可填写多个榜单链接，一行一个",
					disabled: is_upsert_in_update_mode
				}
			},
			props: { labelWidth: upsert_short_label_width },
			required: true
		},

		{
			label: "备注",
			prop: "remark",
			component: {
				name: "el-input",
				props: {
					type: "textarea",
					autosize: { minRows: 1, maxRows: 6 },
					placeholder: "建议填写备注，便于查找分批添加的任务"
				}
			},
			props: { labelWidth: upsert_short_label_width }
		},

		{
			prop: "filter_options",
			props: { labelWidth: "0px" },
			component: {
				name: "cl-form-card",
				props: {
					label: "筛选条件",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "",
					prop: "",
					props: { labelWidth: "0px" },
					component: { name: "slot-filter-hints" }
				},
				{
					label: "【价格】大于",
					prop: "price_min",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12,
					value: 0
				},
				{
					label: "小于",
					prop: "price_max",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "【评论数】大于",
					prop: "review_min",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "小于",
					prop: "review_max",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "【重量】大于",
					prop: "weight_min",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "小于",
					prop: "weight_max",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "【变体数】大于",
					prop: "variants_min",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "小于",
					prop: "variants_max",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "【评价星级】大于",
					prop: "last_star_min",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "【榜单排名】不低于",
					prop: "bsr_rank_max",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 12
				},
				{
					label: "【上架时间】不早于",
					prop: "date_first_available",
					component: {
						name: "el-date-picker",
						props: { type: "date", valueFormat: "YYYY-MM-DD" }
					},
					span: 12
				},
				{
					label: "排除关键词",
					prop: "exclude_key",
					component: { name: "el-input" },
					span: 12
				},
				{
					label: "排除包裹类型",
					prop: "exclude_package",
					component: { name: "el-input" },
					span: 12
				},

				{
					label: "配送方式",
					prop: "delivery_type",
					component: { name: "slot-select-delivery-type" },

					value: [
						appConfig.DELIVERY_TYPE.SELF_OPERATED.value,
						appConfig.DELIVERY_TYPE.FBA.value,
						appConfig.DELIVERY_TYPE.FBM.value
					]
				},
				{
					label: "卖家所属国家",
					prop: "seller_countries",
					component: { name: "slot-select-seller-countries" }
				}
			]
		}
	],
	async onSubmit(data, { next, done, close }) {
		next({
			...data,

			delivery_type: data.delivery_type.sort(),
			seller_countries: data.seller_countries.sort()
		});
	}
});

function bsr_link_input_change_handler(link_value) {
	for (const site in appConfig.AMAZON_I18N.MAIN) {
		if (link_value.indexOf(appConfig.AMAZON_I18N.MAIN[site]) >= 0) {
			Upsert.value.form.marketplace = appConfig.SITE_CODE[site]?.zh;
			return true;
		}
	}

	return false;
}

const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();

const loading = ref(false); // 用于显示加载状态

// 删除当前查询结果
const deleteQueryData = async () => {
	try {
		loading.value = true;

		// 获取当前表格中的所有行数据
		const rows = Table.value?.data || [];
		const ids = rows.map((item: any) => item.id);

		if (ids.length === 0) {
			return;
		}

		// 调用后端删除接口
		await service.app.bsr_task.deleteByIds({ ids });

		Crud.value?.refresh(); // 刷新表格
	} catch (e) {
		console.error(e);
	} finally {
		loading.value = false;
	}
};
</script>
