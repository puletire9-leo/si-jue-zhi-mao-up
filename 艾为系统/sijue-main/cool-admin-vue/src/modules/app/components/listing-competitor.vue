<template>
	<cl-crud ref="Crud">
		<template v-if="listing">
			<el-divider>Listing 信息</el-divider>
			<cl-row>
				<listing-description :listing="listing"></listing-description>
			</cl-row>
		</template>

		<el-divider>竞品列表</el-divider>
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />

			<batch-update-competitor-status :Crud="Crud" />
			<duplicator-for-keyword-or-competitor :Crud="Crud" type="competitor" />

			<cl-flex1 />
			<competitor-filter-status />
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-competitor_page_link="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						:href="
							appConfig.get_amazon_url_dp(
								scope.row.asin_competitor,
								scope.row.marketplace
							)
						"
					>
						<el-button size="small">打开</el-button>
					</el-link>
				</template>

				<template #column-bullet_points="{ scope }">
					<el-popover
						v-if="scope.row.bullet_points"
						placement="right"
						title="五点描述"
						:width="500"
						trigger="hover"
					>
						<template #reference>
							<el-button plain circle size="default">
								<el-icon>
									<list />
								</el-icon>
							</el-button>
						</template>
						<template #default>
							<div v-html="scope.row.bullet_points.replace(/\n/g, '<br><br>')"></div>
						</template>
					</el-popover>
					<div v-else>无</div>
				</template>

				<template #column-bsr_html="{ scope }">
					<div
						v-if="scope.row.bsr_html"
						v-html="scope.row.bsr_html.replace(/\n/g, '<br>')"
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

<script lang="ts" name="app-listing-competitor" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { watch } from "vue";
import ListingDescription from "/$/app/components/listing-description.vue";
import BatchUpdateCompetitorStatus from "/$/app/components/batch-update-competitor-status.vue";
import CompetitorFilterStatus from "/$/app/components/competitor-filter-status.vue";
import DuplicatorForKeywordOrCompetitor from "/$/app/components/duplicator-for-keyword-or-competitor.vue";
import { appConfig } from "../../../../../appConfig";
import { List } from "@element-plus/icons-vue";
import { is_admin } from "/$/app/utils";
import { convert_image_url } from "/$/app/utils";

const { service } = useCool();

const props = defineProps(["listing"]);

const Crud = useCrud(
	{
		service: service.app.competitor,

		async onRefresh(params, { next, done, render }) {
			const { list } = await next({
				...params,

				sid: props.listing?.sid,
				asin_mine: props.listing?.asin,
				seller_sku: props.listing?.seller_sku
			});

			Table.value?.data.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
			});
		}
	},
	(app) => {
		app.refresh({
			size: 50
		});
	}
);

watch(props, () => {
	Crud.value?.refresh();
});

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },

		{ label: "竞品 ASIN", prop: "asin_competitor", minWidth: 130, fixed: "left" },
		{
			label: "竞品标题",
			prop: "item_name",
			minWidth: 150,
			"show-overflow-tooltip": true,
			fixed: "left"
		},

		{
			label: "竞品图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 35 } }
		},
		{ label: "竞品页面", prop: "competitor_page_link", width: 90 },
		{ label: "价格", prop: "price", minWidth: 90, sortable: "custom" },
		{ label: "评论数量", prop: "review_num", minWidth: 110, sortable: "custom" },
		{
			label: "星级",
			prop: "last_star",
			minWidth: 150,
			component: { name: "el-rate", props: { disabled: true, "show-score": true } },
			sortable: "custom"
		},
		{
			label: "配送方*",
			prop: "dispatches_from",
			minWidth: 110,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			label: "售卖方*",
			prop: "sold_by",
			minWidth: 120,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			label: "配送类型",
			prop: "_distribution_type",
			minWidth: 100,
			formatter(row, column, value, index) {
				return appConfig.estimate_distribution_type(row.dispatches_from, row.sold_by);
			}
		},
		{ label: "卖点", prop: "bullet_points", minWidth: 70 },
		{ label: "BSR", prop: "bsr_html", minWidth: 260 },
		{
			label: "BSR 排名",
			prop: "bsr_rank",
			minWidth: 110,
			sortable: "asc",
			formatter(row, column, value, index) {
				return value === 999999999 ? "-" : value;
			}
		},

		{
			label: "核心竞品",
			prop: "is_core",
			minWidth: 110,
			component: {
				name: "cl-switch",
				props: {
					"active-text": "是",
					"inactive-text": "否",
					"inline-prompt": true
				}
			},
			sortable: "custom"
		},
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "待入库", value: 2, type: "primary" },
				{ label: "已入库", value: 3, type: "success" },
				{ label: "已归档", value: 4, type: "info" }
			],

			minWidth: 100,
			sortable: "custom"
		},
		{
			label: "收录时间",
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
		{
			label: "最近爬虫时间",
			prop: "spider_time",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},

		{ type: "op", buttons: ["edit", "delete"] }
	]
});

const Upsert = useUpsert({
	dialog: {
		draggable: true,
		"align-center": true,
		width: "600"
	},
	props: {
		labelWidth: 150
	},
	items: [
		{
			label: "店铺 sid",
			prop: "sid",
			component: { name: "el-input", props: { clearable: true } },
			required: true,
			hidden: true
		},
		{
			label: "关联 Listing 的 ASIN",
			prop: "asin_mine",
			component: { name: "el-input", props: { clearable: true } },
			required: true,
			hidden: true
		},
		{
			label: "竞品 ASIN",
			prop: "asin_competitor",
			component: { name: "el-input", props: { clearable: true, autofocus: true } },
			required: true
		},
		{
			label: "竞品标题",
			prop: "item_name",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "竞品图片链接",
			prop: "image_url",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "价格",
			prop: "price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "评论数量",
			prop: "review_num",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{ label: "星级", prop: "last_star", component: { name: "el-rate" } },
		{
			label: "BSR",
			prop: "bsr_html",
			component: { name: "el-input", props: { clearable: true } }
		},

		{
			label: "最近爬虫时间",
			prop: "spider_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "是否核心竞品",
			prop: "is_core",
			flex: false,
			component: {
				name: "cl-switch",
				props: {
					"active-text": "是",
					"inactive-text": "否",
					"inline-prompt": true
				}
			},
			required: true
		},
		{
			label: "状态",
			prop: "status",
			component: {
				name: "el-radio-group",
				options: [
					{ label: "待入库", value: 2 },
					{ label: "已入库", value: 3 },
					{ label: "已归档", value: 4 }
				]
			},
			value: 2,
			required: true
		}
	],
	async onSubmit(data, { next, done, close }) {
		next({
			...data,

			sid: props.listing.sid,
			asin_mine: props.listing.asin,
			seller_sku: props.listing.seller_sku
		});
	}
});
</script>

<style lang="scss">
table .el-rate .el-rate__icon {
	margin-right: 2px;
}
</style>
