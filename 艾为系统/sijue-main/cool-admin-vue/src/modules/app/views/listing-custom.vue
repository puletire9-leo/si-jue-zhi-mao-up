<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />

			<batch-update-competitor-spider-status :Crud="Crud" />
			<batch-update-keyword-search-volume-status :Crud="Crud" />

			<cl-flex1 />

			<listing-filter-is-suspended />

			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-competitor_spider_res="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.competitor_spider_res"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.competitor_spider_res,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.competitor_spider_res?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-competitor_amount_history="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.competitor_amount_history"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.competitor_amount_history,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.competitor_amount_history?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-competitor_amount_history_chart="{ scope }">
					<template v-if="scope.row.competitor_amount_history">
						<el-popover
							placement="right"
							title="竞品数量走势"
							:width="400"
							trigger="hover"
						>
							<template #reference>
								<el-button plain circle size="default">
									<el-icon>
										<data-line />
									</el-icon>
								</el-button>
							</template>
							<template #default>
								<v-chart
									style="height: 200px"
									autoresize
									:option="
										generateCompetitorHistoryChartOption(
											scope.row.competitor_amount_history
										)
									"
								></v-chart>
							</template>
						</el-popover>
					</template>
					<template v-else>暂无</template>
				</template>

				<template #column-kw_search_volume_anal_res="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.kw_search_volume_anal_res"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.kw_search_volume_anal_res,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.kw_search_volume_anal_res?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-kw_search_volume_chart="{ scope }">
					<template v-if="scope.row.kw_search_volume_anal_res">
						<el-popover
							placement="right"
							title="关键词加权平均搜索量走势"
							:width="500"
							trigger="hover"
						>
							<template #reference>
								<el-button plain circle size="default">
									<el-icon>
										<data-line />
									</el-icon>
								</el-button>
							</template>
							<template #default>
								<v-chart
									style="height: 200px"
									autoresize
									:option="
										generateKeywordSearchVolumeChartOption(
											scope.row.kw_search_volume_anal_res,
											true,
											false,
											appConfig.cal_listing_logical_inventory(scope.row)
										)
									"
								></v-chart>
							</template>
						</el-popover>
					</template>
					<template v-else>暂无</template>
				</template>

				<template #slot-management-buttons="{ scope }">
					<el-tooltip content="关键词管理" placement="top" :hide-after="0">
						<el-button
							type="success"
							size="default"
							plain
							circle
							@click="
								curEditingListing = scope.row;
								keywordManagementPaneVisible = true;
							"
						>
							<el-icon>
								<memo />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="竞品管理" placement="top" :hide-after="0">
						<el-button
							type="warning"
							size="default"
							plain
							circle
							@click="
								curEditingListing = scope.row;
								competitorManagementPaneVisible = true;
							"
						>
							<el-icon>
								<goods-filled />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="编辑" placement="top" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="Upsert?.edit(scope.row)"
						>
							<el-icon>
								<edit-pen />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="写Listing" placement="top" :hide-after="0">
						<el-button
							type="success"
							size="default"
							plain
							circle
							@click="
								curEditingListing = scope.row;
								ListingkeywordManagementPaneVisible = true;
							"
						>
							<el-icon>
								<edit-pen />
							</el-icon>
						</el-button>
					</el-tooltip>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-query_local_product_info="{ scope }">
				<el-button
					:loading="query_local_product_info_button_loading"
					@click="retrieve_local_product_info()"
				>
					查询本地产品信息
				</el-button>
			</template>
		</cl-upsert>

		<el-drawer
			v-model="keywordManagementPaneVisible"
			destroy-on-close
			title="关键词管理"
			size="80%"
			direction="ltr"
		>
			<template #default>
				<listing-keyword :listing="curEditingListing"></listing-keyword>
			</template>
		</el-drawer>

		<el-drawer
			v-model="competitorManagementPaneVisible"
			destroy-on-close
			title="竞品管理"
			size="80%"
			direction="ltr"
		>
			<template #default>
				<listing-competitor :listing="curEditingListing"></listing-competitor>
			</template>
		</el-drawer>

		<el-drawer
			v-model="ListingkeywordManagementPaneVisible"
			destroy-on-close
			title="写Listing"
			size="80%"
			direction="ltr"
		>
			<template #default>
				<ai-listing-keyword :listing="curEditingListing"></ai-listing-keyword>
			</template>
		</el-drawer>

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

<script lang="ts" name="app-listing-custom" setup>
import { useCrud, useTable, useUpsert, useSearch } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, ref, watch } from "vue";
import { appConfig } from "../../../../../appConfig";
import draggable from "vuedraggable";
import {
	MoreFilled,
	GoodsFilled,
	Memo,
	PriceTag,
	DataLine,
	Delete,
	EditPen
} from "@element-plus/icons-vue";
import ClDialog from "/~/crud/src/components/dialog";
import ListingKeyword from "/$/app/components/listing-keyword.vue";
import AiListingKeyword from "/$/app/components/ai-listing-keyword.vue";
import ListingCompetitor from "/$/app/components/listing-competitor.vue";
import BatchUpdateCompetitorSpiderStatus from "/$/app/components/batch-update-competitor-spider-status.vue";
import BatchUpdateKeywordSearchVolumeStatus from "/$/app/components/batch-update-keyword-search-volume-status.vue";
import BatchUpdateTacticInventoryActive from "/$/app/components/batch-update-tactic-inventory-active.vue";
import {
	generateCompetitorHistoryChartOption,
	generateKeywordSearchVolumeChartOption,
	is_admin
} from "/$/app/utils";
import { ElMessage } from "element-plus";
import SellerFilter from "/$/app/components/seller-filter.vue";
import { ListingViewModel } from "/$/app/interface/listingViewModel";
import ListingFilterIsSuspended from "/$/app/components/listing-filter-is-suspended.vue";
import { convert_image_url } from "/$/app/utils";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.listing,
		dict: {
			label: {
				op: "管理"
			}
		},

		async onRefresh(params, { next, done, render }) {
			const { list } = await next({
				...params,
				is_custom_listing: 1
			});

			Table.value?.data.forEach((item) => {
				item.small_image_url_display = convert_image_url(item.small_image_url);
			});
		}
	},
	(app) => {
		app.refresh();
	}
);

const showOnlySalable = ref(true);
const showOnlyUndeleted = ref(true);
watch([showOnlySalable, showOnlyUndeleted], () => void setTimeout(Crud?.value?.refresh, 200));

const isTableSelectionEmpty = computed(() => {
	return Crud.value?.selection.length === 0;
});

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },

		{
			prop: "asin",
			label: "ASIN *",
			width: 170,
			sortable: "custom",
			fixed: "left",
			hidden: !is_admin.value
		},
		{
			prop: "seller_sku",
			label: "MSKU *",
			width: 170,
			sortable: "custom",
			fixed: "left",
			hidden: !is_admin.value
		},
		{
			prop: "local_sku",
			label: "本地产品 SKU",
			minWidth: 170,
			sortable: "custom",
			fixed: "left"
		},
		{
			prop: "is_custom_listing",
			label: "自定义*",
			minWidth: 80,
			fixed: "left",
			dict: [
				{ label: "是", value: 1, type: "success" },
				{ label: "否", value: 0, type: "primary" }
			],
			hidden: !is_admin.value
		},

		{
			label: "基本信息",

			children: [
				{ prop: "id", label: "ID *", width: 70, hidden: !is_admin.value },

				{
					prop: "small_image_url_display",
					label: "缩略图",
					component: { name: "cl-image", props: { size: 35 } }
				},
				{
					prop: "item_name",
					label: "标题",
					sortable: "custom",
					minWidth: 250,
					"show-overflow-tooltip": true
				},
				{
					prop: "local_name",
					label: "品名",
					sortable: "custom",
					minWidth: 250,
					"show-overflow-tooltip": true
				},
				{ prop: "marketplace", label: "国家", sortable: "custom", width: 80 },
				{ prop: "landed_price", label: "价格", sortable: "custom" }
			]
		},

		{
			label: "竞品",

			children: [
				{
					label: "状态",
					prop: "competitor_spider_status",
					dict: [
						{ label: "待调研", value: 0, type: "info" },
						{ label: "调研中", value: 1, color: "purple" },
						{ label: "已调研", value: 2, type: "success" }
					],

					width: 90,
					sortable: "custom"
				},
				{
					label: "爬虫数据*",
					prop: "competitor_spider_res",
					width: 95,
					hidden: !is_admin.value
				},
				{
					label: "调研日期",
					prop: "competitor_spider_time",
					sortable: "custom",
					minWidth: 160,
					component: { name: "cl-date-text" }
				}
			]
		},

		{
			label: "关键词搜索量",

			children: [
				{
					label: "状态",
					prop: "kw_search_volume_status",
					dict: [
						{ label: "未查询", value: 0, type: "info" },
						{ label: "待分析", value: 1, color: "purple" },
						{ label: "已分析", value: 2, type: "success" }
					],

					width: 90,
					sortable: "custom"
				},
				{
					label: "分析结果 *",
					prop: "kw_search_volume_anal_res",
					width: 120,
					sortable: "custom",
					hidden: !is_admin.value
				},
				{ label: "走势图", prop: "kw_search_volume_chart", width: 70 },
				{
					label: "查询日期",
					prop: "kw_search_volume_update_time",
					sortable: "custom",
					minWidth: 160,
					component: { name: "cl-date-text" }
				}
			]
		},

		{
			label: "是否停用",
			prop: "is_suspended",
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

		{ prop: "createTime", label: "创建时间", sortable: "custom", width: 160 },
		{ prop: "updateTime", label: "更新时间", sortable: "desc", width: 160 },

		{
			type: "op",
			buttons: ["slot-management-buttons"]
		}
	],
	contextMenu: []
});

const Upsert = useUpsert({
	dialog: {
		width: "600",
		top: "10vh",
		draggable: true,
		"align-center": true
	},
	props: {
		labelPosition: "right",
		labelWidth: "auto"
	},
	items: [
		{
			prop: "marketplace",
			label: "国家",
			component: {
				name: "el-select",
				props: {},
				options: Object.keys(appConfig.SITE_CODE).map((key) => {
					return {
						value: appConfig.SITE_CODE[key].zh,
						label: `（${appConfig.SITE_CODE[key].code}）${appConfig.SITE_CODE[key].zh}`
					};
				})
			},
			value: "英国",
			required: true
		},

		{ prop: "asin", label: "ASIN *", component: { name: "el-input" }, hidden: !is_admin.value },
		{
			prop: "seller_sku",
			label: "MSKU *",
			component: { name: "el-input" },
			hidden: !is_admin.value
		},
		{ prop: "local_sku", label: "本地产品 SKU", component: { name: "el-input" } },
		{
			prop: "query_local_product_info_btn",
			label: "",
			component: { name: "slot-query_local_product_info" }
		},
		{
			prop: "small_image_url",
			label: "商品缩略图地址",
			component: { name: "el-input" },
			required: true
		},
		{ prop: "item_name", label: "标题", component: { name: "el-input" } },
		{ prop: "local_name", label: "品名", component: { name: "el-input" } },
		{
			prop: "landed_price",
			label: "价格",
			hook: { bind: ["number"] },
			component: { name: "el-input-number", props: { min: 0 } },
			required: true
		},
		{
			prop: "is_suspended",
			label: "使用停用",
			component: {
				name: "cl-switch",
				props: {
					"active-text": "是",
					"inactive-text": "否",
					"inline-prompt": true
				}
			}
		}
	],

	async onSubmit(data, { next, done, close }) {
		let submitData: ListingViewModel = {
			...data,

			is_custom_listing: 1,
			sid: 80386
		};

		if (Upsert.value?.mode == "add") {
			let { asin, msku } = appConfig.generate_custom_listing_asin_msku();
			Object.assign(submitData, {
				asin: asin,
				seller_sku: msku
			});
		}

		next(submitData);
	}
});

const keywordManagementPaneVisible = ref(false);
const ListingkeywordManagementPaneVisible = ref(false);
const competitorManagementPaneVisible = ref(false);
const curEditingListing = ref();

const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();

const query_local_product_info_button_loading = ref(false);

async function retrieve_local_product_info() {
	try {
		query_local_product_info_button_loading.value = true;

		let local_sku = Upsert.value?.form.local_sku;

		if (local_sku.trim() === "") {
			ElMessage({ message: "已先填写本地产品 SKU 再进行查询", type: "warning" });
			return;
		}

		let res = await Crud.value?.service.query_local_product_info({
			sku_list: [local_sku]
		});

		if (Array.isArray(res) && res.length !== 0) {
			Upsert.value.form.local_name = res[0]?.product_name;
			Upsert.value.form.small_image_url = res[0]?.pic_url;
			Upsert.value.form.landed_price = parseFloat(res[0]?.cg_price || 0);
			ElMessage({ message: "已自动填写部分产品信息", type: "success" });
		} else {
			ElMessage({
				message: "查无此本地 sku 的产品信息，请手动填写品名等相关属性",
				type: "warning"
			});
		}
	} catch (err) {
		console.log(err);
	} finally {
		query_local_product_info_button_loading.value = false;
	}
}

async function syncFX() {
	try {
		let result = await service.app.search_threads.createThreads();
		console.log(result);

		if (result === "ok") {
			ElMessage({
				message: "同步成功",
				type: "success"
			});
			Crud?.value?.refresh();
		} else {
			ElMessage({
				message: "同步有误，请稍后重试。",
				type: "error"
			});
		}
	} catch (err: any) {
		console.log(err);
		ElMessage({
			message: err,
			type: "error"
		});
	}
}
</script>

<style lang="scss">
.draggable-handle {
	cursor: ns-resize;
}

.cl-dialog__default {
	padding-bottom: 0 !important;
}

.el-scrollbar__view {
	line-height: normal !important;
}
</style>
