<template>
	<cl-crud ref="Crud">
		<template v-if="false" data-info="listing 关键词管理，此处仅用于方便测试。">
			<cl-row>
				<listing-keyword :listing="curEditingListing"></listing-keyword>
				<el-divider></el-divider>
			</cl-row>
		</template>

		<!--
    作为子组件使用时，如果需要插入一些额外的内容，可使用该插槽.
    这样设计的原因是，<cl-table> 默认开启 auto-height，计算高度时会自动减去 <cl-crud> 内其他元素的高度
    -->
		<slot name="before-function-bar"></slot>

		<cl-row>
			<cl-refresh-btn />
			<cl-multi-delete-btn v-if="editable" />

			<batch-update-competitor-spider-status :Crud="Crud" v-if="editable" />
			<batch-update-keyword-search-volume-status :Crud="Crud" v-if="editable" />
			<batch-update-tactic-inventory-active :Crud="Crud" v-if="editable" />

			<cl-flex1 />

			<el-space direction="horizontal">
				<el-text>仅展示可售</el-text>
				<el-switch
					v-model="showOnlySalable"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-text>仅展示未删除</el-text>
				<el-switch
					v-model="showOnlyUndeleted"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-divider direction="vertical"></el-divider>
			</el-space>
			<seller-filter />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-search ref="Search" />

			<el-input
				v-model="search_asin_list"
				style="width: 300px"
				placeholder="ASIN 列表"
				clearable
				@keydown="search_asin_list_on_keydown"
				@clear="searchKey.search()"
			></el-input>
			<cl-search-key
				ref="searchKey"
				placeholder="模糊搜索"
				:field-list="cl_search_key_field_list"
				:on-search="cl_search_key_on_search"
			/>
		</cl-row>

		<slot name="before-table"></slot>

		<cl-row>
			<cl-table ref="Table" @selection-change="onSelectionChange($event)">
				<template #column-daily_order_quantity_history="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.daily_order_quantity_history"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.daily_order_quantity_history,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.daily_order_quantity_history?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

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
							placement="left"
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

				<template #column-expected_orders_chart="{ scope }">
					<template v-if="scope.row.kw_search_volume_anal_res">
						<el-popover placement="right" title="单量预测" :width="500" trigger="hover">
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
											false,
											true,
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

					<el-tooltip
						content="策略管理"
						placement="top"
						:hide-after="0"
						v-if="scope.row.is_custom_listing !== 1"
					>
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="Upsert?.edit(scope.row)"
						>
							<el-icon>
								<price-tag />
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
			<template #slot-batch-edit-hint>
				<el-space direction="vertical" fill>
					<el-alert type="warning" :closable="false">
						<template #title>批量编辑模式提示</template>
						<template #default>
							<div style="line-height: 1.5em">
								因勾选了一到多个 Listing，当前进入批量编辑模式。<br />
								保存后，相关设置将应用到以下
								Listing，<strong>请谨慎操作</strong>。<br />
								若不需要进行批量编辑，请不要在表格左侧勾选任何 Listing。
							</div>
						</template>
					</el-alert>
					<el-scrollbar max-height="150">
						<el-space
							v-for="(listing, index) in Crud?.selection"
							style="margin-bottom: 5px"
						>
							<el-tag size="small" type="info" effect="light">{{ index + 1 }}</el-tag>
							<el-tag size="small" type="primary" effect="light">{{
								listing.sellerName
							}}</el-tag>
							<el-tag size="small" type="primary" effect="dark">{{
								listing.asin
							}}</el-tag>
							<el-tag size="small" type="primary" effect="plain">{{
								listing.seller_sku
							}}</el-tag>
						</el-space>
					</el-scrollbar>
					<el-alert type="info" :closable="false">
						<template #title>
							当前加载的设置来源于以下 Listing，请在此基础上进行编辑。
						</template>
					</el-alert>
				</el-space>
			</template>

			<template #slot-edit-tags="{ scope }">
				<div>
					<el-alert type="info" :closable="false">
						<template #title> 请勾选要启用的标签。</template>
						<template #default>
							<div style="line-height: 1.5em">
								可按住标签或
								<el-icon>
									<more-filled />
								</el-icon>
								图标拖动排序以决定策略的 <strong>优先级</strong>。<br />
								未启用的标签不会参与补货/调价策略算法。
							</div>
						</template>
					</el-alert>
					<div style="margin-bottom: 10px"></div>
					<draggable
						v-model="scope.tagsRenderList"
						item-key="value"
						handle=".draggable-handle"
					>
						<template #item="{ element: tag, index }">
							<div>
								<el-space size="large">
									<el-icon class="draggable-handle">
										<more-filled />
									</el-icon>
									<el-text>{{ index + 1 }}</el-text>
									<el-switch
										v-model="tag.active"
										inline-prompt
										active-text="启用"
										inactive-text="关闭"
									></el-switch>
									<el-tag
										:type="tag.active ? 'primary' : 'info'"
										effect="plain"
										hit
										round
										class="draggable-handle"
									>
										{{ tag.desc }}｜{{ tag.value }}
									</el-tag>
								</el-space>
							</div>
						</template>
					</draggable>
				</div>
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

<script lang="ts" name="app-listing" setup>
import { useCrud, useTable, useUpsert, useSearch } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, ref, watch } from "vue";
import { appConfig } from "../../../../../appConfig";
import draggable from "vuedraggable";
import { MoreFilled, GoodsFilled, Memo, PriceTag, DataLine, Delete } from "@element-plus/icons-vue";
import ClDialog from "/~/crud/src/components/dialog";
import ListingKeyword from "/$/app/components/listing-keyword.vue";
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
import { convert_image_url } from "/$/app/utils";

const props = defineProps({
	editable: {
		type: Boolean,
		default: true
	}
});

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
			if (showOnlySalable.value) Object.assign(params, { status: 0 });
			if (showOnlyUndeleted.value) Object.assign(params, { is_delete: 0 });
			const { list } = await next({
				...params
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
// watch([showOnlySalable, showOnlyUndeleted], () => void setTimeout(Crud?.value?.refresh, 200));

const isTableSelectionEmpty = computed(() => {
	return Crud.value?.selection.length === 0;
});

const emit = defineEmits(["selection-change"]);

function onSelectionChange(selections: Array<ListingViewModel>) {
	selections = selections.map((listing) => {
		return {
			id: listing.id,
			sid: listing.sid,
			asin: listing.asin,
			seller_sku: listing.seller_sku
		};
	});
	emit("selection-change", selections);
}

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },

		{
			prop: "sellerName",
			label: "店铺名",
			sortable: "custom",
			minWidth: 160,
			"show-overflow-tooltip": true,
			fixed: "left"
		},
		{
			prop: "asin",
			label: "ASIN",
			width: 160,
			sortable: "custom",
			fixed: "left",
			formatter: (row, column, value) => appConfig.get_from_custom_listing_hint(row, "asin")
		},
		{
			prop: "local_name",
			label: "品名",
			sortable: "custom",
			minWidth: 150,
			"show-overflow-tooltip": true,
			fixed: "left"
		},

		{
			prop: "small_image_url_display",
			label: "缩略图",
			component: { name: "cl-image", props: { size: 35 } },
			fixed: "left"
		},
		{
			label: "基本信息",

			children: [
				{ prop: "id", label: "ID *", width: 70, hidden: !is_admin.value },
				{ prop: "sid", label: "sid *", width: 70, hidden: !is_admin.value },
				{
					prop: "seller_sku",
					label: "MSKU",
					minWidth: 170,
					sortable: "custom",
					fixed: "left",
					formatter: (row, column, value) =>
						appConfig.get_from_custom_listing_hint(row, "seller_sku")
				},
				{
					prop: "local_sku",
					label: "本地产品 SKU",
					minWidth: 170,
					sortable: "custom",
					fixed: "left"
				},
				{
					prop: "status",
					label: "状态",
					dict: [
						{ label: "可售", value: 1, type: "success" },
						{ label: "停售", value: 0, type: "danger" }
					],
					width: 80,
					sortable: "custom"
				},
				{
					prop: "is_delete",
					label: "是否删除",
					dict: [
						{ label: "是", value: 1, type: "danger" },
						{ label: "否", value: 0, type: "success" }
					],
					width: 60,
					sortable: "custom"
				},
				{
					prop: "item_name",
					label: "标题",
					sortable: "custom",
					minWidth: 150,
					"show-overflow-tooltip": true
				},
				{ prop: "marketplace", label: "国家", sortable: "custom", width: 80 },
				{
					prop: "open_date_display",
					label: "商品创建时间",
					sortable: "custom",
					minWidth: 160,
					component: { name: "cl-date-text" }
				},

				{ prop: "price", label: "价格", sortable: "custom" },
				{ prop: "landed_price", label: "总价", sortable: "custom" },

				{
					prop: "afn_fulfillable_quantity",
					label: "FBA 可售",
					minWidth: 70,
					sortable: "custom"
				},

				{
					prop: "reserved_fc_processing",
					label: "调仓中",
					minWidth: 70,
					sortable: "custom"
				},

				{
					prop: "afn_inbound_shipped_quantity",
					label: "在途",
					minWidth: 70,
					sortable: "custom"
				},

				{
					prop: "afn_inbound_receiving_quantity",
					label: "入库中",
					minWidth: 70,
					sortable: "custom"
				},

				{
					prop: "inv_age_91_to_180_days",
					label: "3-6 月库龄",
					minWidth: 70,
					sortable: "custom"
				},
				{
					prop: "daily_order_quantity",
					label: "日均单量",
					minWidth: 60,
					sortable: "custom"
				},
				{
					label: "日均单量状态*",
					prop: "daily_order_quantity_status",
					dict: [
						{ label: "待计算", value: 0, type: "info" },
						{ label: "有效", value: 1, type: "success" }
					],
					width: 90,
					sortable: "custom",
					hidden: !is_admin.value
				},
				{
					prop: "daily_order_quantity_history",
					label: "日销量历史*",
					width: 95,
					sortable: "custom",
					hidden: !is_admin.value
				},
				{
					prop: "landed_price_updateTime",
					label: "价格变动日期",
					minWidth: 160,
					sortable: "custom",
					component: { name: "cl-date-text" }
				}
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
				},
				{
					label: "数量历史*",
					prop: "competitor_amount_history",
					width: 95,
					hidden: !is_admin.value
				},
				{ label: "数量走势", prop: "competitor_amount_history_chart", width: 60 },
				{
					label: "数量统计日期*",
					prop: "competitor_amount_history_updateTime",
					sortable: "custom",
					minWidth: 160,
					component: { name: "cl-date-text" },
					hidden: !is_admin.value
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
					label: "单量预测 *",
					prop: "expected_orders_chart",
					width: 100,
					hidden: !is_admin.value
				},
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
			label: "调价策略设置",
			hidden: !props.editable,
			children: [
				{
					label: "新品调价",
					children: [
						{ label: "上架日期", prop: "tactic_new_product_date", width: 160 },
						{
							label: "预期日单量",
							prop: "tactic_new_product_expected_daily_order_quantity"
						},
						{ label: "单量预警阈值", prop: "tactic_new_product_price_alert_threshold" },
						{ label: "调价幅度", prop: "tactic_new_price_modify_range", minWidth: 60 },
						{ label: "调价数值", prop: "tactic_new_price_modify_value", minWidth: 60 }
					]
				},
				{
					label: "竞品调价",
					children: [
						{ label: "涨价触发幅度", prop: "tactic_competitor_price_up_threshold" },
						{ label: "降价触发幅度", prop: "tactic_competitor_price_down_threshold" }
					]
				},
				{
					label: "清仓调价",
					children: [
						{
							label: "调价幅度",
							prop: "tactic_clearance_price_modify_range",
							minWidth: 60
						},
						{
							label: "调价数值",
							prop: "tactic_clearance_price_modify_value",
							minWidth: 60
						},
						{
							label: "调价上限",
							prop: "tactic_clearance_price_modify_upper_limit",
							minWidth: 60
						},
						{
							label: "调价下限",
							prop: "tactic_clearance_price_modify_lower_limit",
							minWidth: 60
						},
						{
							label: "9 时之前的预期最小日单量",
							prop: "tactic_clearance_expected_order_min_before_9"
						},
						{
							label: "9 时之前的预期最大日单量",
							prop: "tactic_clearance_expected_order_max_before_9"
						},
						{
							label: "12 时之前的预期最小日单量",
							prop: "tactic_clearance_expected_order_min_before_12"
						},
						{
							label: "12 时之前的预期最大日单量",
							prop: "tactic_clearance_expected_order_max_before_12"
						},
						{
							label: "15 时之前的预期最小日单量",
							prop: "tactic_clearance_expected_order_min_before_15"
						},
						{
							label: "15 时之前的预期最大日单量",
							prop: "tactic_clearance_expected_order_max_before_15"
						},
						{
							label: "18 时之前的预期最小日单量",
							prop: "tactic_clearance_expected_order_min_before_18"
						},
						{
							label: "18 时之前的预期最大日单量",
							prop: "tactic_clearance_expected_order_max_before_18"
						},
						{
							label: "21 时之前的预期最小日单量",
							prop: "tactic_clearance_expected_order_min_before_21"
						},
						{
							label: "21 时之前的预期最大日单量",
							prop: "tactic_clearance_expected_order_max_before_21"
						},
						{
							label: "24 时之前的预期最小日单量",
							prop: "tactic_clearance_expected_order_min_before_24"
						},
						{
							label: "24 时之前的预期最大日单量",
							prop: "tactic_clearance_expected_order_max_before_24"
						}
					]
				},
				{
					label: "日常调价",
					children: [
						{
							label: "目标库存最小天数",
							prop: "tactic_normal_target_inventory_days_min"
						},
						{
							label: "目标库存最大天数",
							prop: "tactic_normal_target_inventory_days_max"
						},
						{
							label: "目标日均出单",
							prop: "tactic_normal_target_daily_order_quantity"
						},
						{
							label: "目标日均出单预警阈值",
							prop: "tactic_normal_target_daily_order_quantity_alert_threshold"
						},
						{
							label: "搜索量突变预警阈值",
							prop: "tactic_normal_sharp_change_alert_threshold"
						},
						{
							label: "调价幅度",
							prop: "tactic_normal_price_modify_range",
							minWidth: 60
						},
						{
							label: "调价数值",
							prop: "tactic_normal_price_modify_value",
							minWidth: 60
						}
					]
				},
				{
					prop: "tags",
					label: "调价策略",
					minWidth: 90,
					sortable: "custom",
					showOverflowTooltip: true,
					formatter(row, column: any, value: any, index: number) {
						let curTags = value;
						if (curTags && curTags?.length) {
							return appConfig.LISTING_TAGS.filter((TAG) =>
								curTags.includes(TAG.value)
							)

								.sort(
									(TAG_a, TAG_b) =>
										curTags.indexOf(TAG_a.value) - curTags.indexOf(TAG_b.value)
								)

								.map((TAG) => `${TAG.desc_short} ${TAG.value}`)
								.join("、");
						} else {
						}
					}
				}
			]
		},

		{
			label: "补货策略",
			hidden: !props.editable,
			children: [
				{
					label: "开关",
					prop: "tactic_inventory_active",
					minWidth: 85,
					sortable: "custom",
					component: {
						name: "cl-switch",
						props: {
							"active-text": "启用",
							"inactive-text": "关闭",
							"inline-prompt": true
						}
					}
				},
				{ label: "最小可售天数", prop: "tactic_inventory_min_salable_days" }
			]
		},

		{
			label: "下次调价提醒",
			prop: "tactic_price_ignore_until",
			width: 160,
			hidden: !props.editable
		},
		{
			label: "下次补货提醒",
			prop: "tactic_inventory_ignore_until",
			width: 160,
			hidden: !props.editable
		},

		{ prop: "updateTime", label: "更新时间", sortable: "desc", width: 160 },

		{
			type: "op",
			buttons: ["slot-management-buttons"],

			hidden: !props.editable
		}
	],
	contextMenu: []
});

const upsert_short_label_width = "80";
const Upsert = useUpsert({
	dialog: {
		width: "600",
		top: "10vh",
		draggable: true
	},
	props: {
		labelPosition: "right",
		labelWidth: "auto"
	},
	items: [
		{
			type: "tabs",
			props: {
				labels: [
					{ label: "基础信息", value: "base" },
					{ label: "新品调价", value: "new" },
					{ label: "竞品调价", value: "competitor" },
					{ label: "清仓调价", value: "clearance" },
					{ label: "日常调价", value: "normal" }
				]
			}
		},

		{
			prop: "batch-edit-hint",
			label: "批量编辑",
			props: { labelWidth: upsert_short_label_width },
			component: { name: "slot-batch-edit-hint" },
			group: "base",
			hidden: () => isTableSelectionEmpty.value
		},

		{
			prop: "sellerName",
			label: "店铺名",
			props: { labelWidth: upsert_short_label_width },
			component: { name: "el-input", props: { disabled: true } }
		},

		{
			prop: "asin",
			label: "ASIN",
			props: { labelWidth: upsert_short_label_width },
			component: { name: "el-input", props: { disabled: true } },
			group: "base"
		},
		{
			prop: "seller_sku",
			label: "MSKU",
			props: { labelWidth: upsert_short_label_width },
			component: { name: "el-input", props: { disabled: true } },
			group: "base"
		},
		// {
		//   prop: "item_name", label: "标题",
		//   props: {labelWidth: upsert_short_label_width},
		//   component: {name: "el-input", props: {disabled: false}},
		//   group: 'base',
		// },
		// {
		//   prop: "marketplace", label: "国家",
		//   props: {labelWidth: upsert_short_label_width},
		//   component: {name: "el-input", props: {disabled: false}},
		//   group: 'base',
		// },

		{
			prop: "tactic_switch",
			props: { labelWidth: "0px" },
			group: "base",
			component: {
				name: "cl-form-card",
				props: {
					label: "策略启用",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					prop: "tactic_inventory_active",
					label: "补货策略",
					props: { labelWidth: upsert_short_label_width },
					component: {
						name: "cl-switch",
						props: {
							"active-text": "启用",
							"inactive-text": "关闭",
							"inline-prompt": true
						}
					},
					span: 10
				},
				{
					label: "低于该可售天数时触发",
					prop: "tactic_inventory_min_salable_days",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } },
					span: 14
				},
				{
					prop: "tags",
					label: "调价策略",
					props: { labelWidth: upsert_short_label_width },
					component: { name: "slot-edit-tags" }
				}
			]
		},

		{
			prop: "tactic_new",
			props: { labelWidth: "0px" },
			group: "new",
			component: {
				name: "cl-form-card",
				props: {
					label: "新品调价策略",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "新品上架日期",
					prop: "tactic_new_product_date",
					component: {
						name: "el-date-picker",
						props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
					},
					group: "new"
				},
				{
					label: "新品预期日单量",
					prop: "tactic_new_product_expected_daily_order_quantity",
					hook: "number",
					component: { name: "el-input-number" }
				},
				{
					label: "新品单量预警阈值 (%)",
					prop: "tactic_new_product_price_alert_threshold",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0, max: 100 } }
				},
				{
					label: "新品调价幅度 (%)",
					prop: "tactic_new_price_modify_range",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0, max: 200 } },
					required: true
				},
				{
					label: "新品调价数值",
					prop: "tactic_new_price_modify_value",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } }
				}
			]
		},

		{
			prop: "tactic_competitor",
			props: { labelWidth: "0px" },
			group: "competitor",
			component: {
				name: "cl-form-card",
				props: {
					label: "竞品调价策略",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "涨价触发幅度 (%)",
					prop: "tactic_competitor_price_up_threshold",
					hook: "number",
					component: { name: "el-input-number" }
				},
				{
					label: "降价触发幅度 (%)",
					prop: "tactic_competitor_price_down_threshold",
					hook: "number",
					component: { name: "el-input-number" }
				}
			]
		},

		{
			prop: "tactic_clearance-price",
			props: { labelWidth: "0px" },
			group: "clearance",
			component: {
				name: "cl-form-card",
				props: {
					label: "清仓调价策略-价格相关",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "清仓调价幅度 (%)",
					prop: "tactic_clearance_price_modify_range",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0, max: 200 } },
					required: true
				},
				{
					label: "清仓调价数值",
					prop: "tactic_clearance_price_modify_value",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } }
				},
				{
					label: "【清仓价格】上限：",
					prop: "tactic_clearance_price_modify_upper_limit",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "下限：",
					prop: "tactic_clearance_price_modify_lower_limit",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				}
			]
		},
		{
			prop: "tactic_clearance-orders",
			props: { labelWidth: "0px" },
			group: "clearance",
			component: {
				name: "cl-form-card",
				props: {
					label: "清仓调价策略-预期日单量设置",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "【09 时前】最小：",
					prop: "tactic_clearance_expected_order_min_before_9",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "最大：",
					prop: "tactic_clearance_expected_order_max_before_9",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				},
				{
					label: "【12 时前】最小：",
					prop: "tactic_clearance_expected_order_min_before_12",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "最大：",
					prop: "tactic_clearance_expected_order_max_before_12",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				},
				{
					label: "【15 时前】最小：",
					prop: "tactic_clearance_expected_order_min_before_15",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "最大：",
					prop: "tactic_clearance_expected_order_max_before_15",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				},
				{
					label: "【18 时前】最小：",
					prop: "tactic_clearance_expected_order_min_before_18",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "最大：",
					prop: "tactic_clearance_expected_order_max_before_18",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				},
				{
					label: "【21 时前】最小：",
					prop: "tactic_clearance_expected_order_min_before_21",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "最大：",
					prop: "tactic_clearance_expected_order_max_before_21",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				},
				{
					label: "【24 时前】最小：",
					prop: "tactic_clearance_expected_order_min_before_24",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "最大：",
					prop: "tactic_clearance_expected_order_max_before_24",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				}
			]
		},

		{
			prop: "tactic_normal-inventory",
			props: { labelWidth: "0px" },
			group: "normal",
			component: {
				name: "cl-form-card",
				props: {
					label: "日常调价策略 - 以库存天数为目标",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "【触发库存天数】小于：",
					prop: "tactic_normal_target_inventory_days_min",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false
				},
				{
					label: "或大于：",
					prop: "tactic_normal_target_inventory_days_max",
					hook: "number",
					component: { name: "el-input-number" },
					span: 12,
					flex: false,
					props: { labelWidth: "125" }
				}
			]
		},
		{
			prop: "tactic_normal-orders",
			props: { labelWidth: "0px" },
			group: "normal",
			component: {
				name: "cl-form-card",
				props: {
					label: "日常调价策略 - 以日均出单为目标",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "目标日均出单",
					prop: "tactic_normal_target_daily_order_quantity",
					hook: "number",
					component: { name: "el-input-number" }
				},
				{
					label: "日均出单触发阈值 (%)",
					prop: "tactic_normal_target_daily_order_quantity_alert_threshold",
					hook: "number",
					component: { name: "el-input-number" }
				}
			]
		},
		{
			prop: "tactic_normal-searches",
			props: { labelWidth: "0px" },
			group: "normal",
			component: {
				name: "cl-form-card",
				props: {
					label: "日常调价策略 - 搜索量突变预警",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "搜索量突变预警阈值 (%)",
					prop: "tactic_normal_sharp_change_alert_threshold",
					hook: "number",
					component: { name: "el-input-number" }
				}
			]
		},
		{
			prop: "tactic_normal-price",
			props: { labelWidth: "0px" },
			group: "normal",
			component: {
				name: "cl-form-card",
				props: {
					label: "日常调价策略 - 价格相关",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "日常调价幅度 (%)",
					prop: "tactic_normal_price_modify_range",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0, max: 200 } },
					required: true
				},
				{
					label: "日常调价数值",
					prop: "tactic_normal_price_modify_value",
					hook: "number",
					component: { name: "el-input-number", props: { min: 0 } }
				}
			]
		},

		{
			prop: "tactic_ignore_until",
			props: { labelWidth: "0px" },
			group: "base",
			component: {
				name: "cl-form-card",
				props: {
					label: "暂停策略触发",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "不再提醒调价直至",
					prop: "tactic_price_ignore_until",
					component: {
						name: "el-date-picker",
						props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
					}
				},
				{
					label: "不再提醒补货直至",
					prop: "tactic_inventory_ignore_until",
					component: {
						name: "el-date-picker",
						props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
					}
				}
			]
		}
	],
	async onInfo(data, { next, done }) {
		let newData = await next(data);
		let curTags = newData.tags ?? [];
		done({
			...newData,
			sellerName: data.sellerName,
			tagsRenderList: appConfig.LISTING_TAGS.map((TAG) => {
				return { ...TAG, active: curTags.includes(TAG.value) };
			})

				.sort((a, b) => curTags.indexOf(a.value) - curTags.indexOf(b.value))

				.sort((a, b) => (a.active === b.active ? 0 : a.active && !b.active ? -1 : 1))
		});
	},
	async onSubmit(data, { next, done, close }) {
		let submitData: ListingViewModel = {
			...data,
			tags: data.tagsRenderList.filter((o) => o.active).map((o) => o.value)
		};

		if (isTableSelectionEmpty.value) {
			next(submitData);
		} else {
			let listingList: ListingViewModel[] = Crud.value?.selection;

			let {
				tags,
				tactic_inventory_active,
				tactic_inventory_min_salable_days,

				tactic_new_product_date,
				tactic_new_product_expected_daily_order_quantity,
				tactic_new_product_price_alert_threshold,
				tactic_new_price_modify_range,
				tactic_new_price_modify_value,

				tactic_competitor_price_up_threshold,
				tactic_competitor_price_down_threshold,

				tactic_clearance_price_modify_range,
				tactic_clearance_price_modify_value,
				tactic_clearance_price_modify_upper_limit,
				tactic_clearance_price_modify_lower_limit,
				tactic_clearance_expected_order_max_before_9,
				tactic_clearance_expected_order_min_before_9,
				tactic_clearance_expected_order_max_before_12,
				tactic_clearance_expected_order_min_before_12,
				tactic_clearance_expected_order_max_before_15,
				tactic_clearance_expected_order_min_before_15,
				tactic_clearance_expected_order_max_before_18,
				tactic_clearance_expected_order_min_before_18,
				tactic_clearance_expected_order_max_before_21,
				tactic_clearance_expected_order_min_before_21,
				tactic_clearance_expected_order_max_before_24,
				tactic_clearance_expected_order_min_before_24,

				tactic_normal_target_inventory_days_min,
				tactic_normal_target_inventory_days_max,
				tactic_normal_target_daily_order_quantity,
				tactic_normal_target_daily_order_quantity_alert_threshold,
				tactic_normal_sharp_change_alert_threshold,
				tactic_normal_price_modify_range,
				tactic_normal_price_modify_value,

				tactic_price_ignore_until,
				tactic_inventory_ignore_until
			} = submitData;

			listingList.forEach((listing) => {
				Object.assign(listing, {
					tags,
					tactic_inventory_active,
					tactic_inventory_min_salable_days,

					tactic_new_product_date,
					tactic_new_product_expected_daily_order_quantity,
					tactic_new_product_price_alert_threshold,
					tactic_new_price_modify_range,
					tactic_new_price_modify_value,

					tactic_competitor_price_up_threshold,
					tactic_competitor_price_down_threshold,

					tactic_clearance_price_modify_range,
					tactic_clearance_price_modify_value,
					tactic_clearance_price_modify_upper_limit,
					tactic_clearance_price_modify_lower_limit,
					tactic_clearance_expected_order_max_before_9,
					tactic_clearance_expected_order_min_before_9,
					tactic_clearance_expected_order_max_before_12,
					tactic_clearance_expected_order_min_before_12,
					tactic_clearance_expected_order_max_before_15,
					tactic_clearance_expected_order_min_before_15,
					tactic_clearance_expected_order_max_before_18,
					tactic_clearance_expected_order_min_before_18,
					tactic_clearance_expected_order_max_before_21,
					tactic_clearance_expected_order_min_before_21,
					tactic_clearance_expected_order_max_before_24,
					tactic_clearance_expected_order_min_before_24,

					tactic_normal_target_inventory_days_min,
					tactic_normal_target_inventory_days_max,
					tactic_normal_target_daily_order_quantity,
					tactic_normal_target_daily_order_quantity_alert_threshold,
					tactic_normal_sharp_change_alert_threshold,
					tactic_normal_price_modify_range,
					tactic_normal_price_modify_value,

					tactic_price_ignore_until,
					tactic_inventory_ignore_until
				});
			});

			try {
				await Crud.value?.service.update(listingList);
				ElMessage({ message: "更新成功", type: "success" });
				close();
				Crud.value?.refresh();
			} catch (err) {
				console.log(err);
				ElMessage({ message: String(err), type: "error" });
			}
		}
	}
});

const Search = useSearch({
	items: []
});

const cl_search_key_field_list = [];

const searchKey = ref();
const search_asin_list = ref("");

function cl_search_key_on_search(params: any, { next }) {
	const asin_list = search_asin_list.value
		.split(" ")
		.map((asin) => asin.trim())
		.filter((asin) => asin !== "");

	Object.assign(params, {
		asin_list: asin_list.length ? asin_list : null
	});
	next(params);
}

function search_asin_list_on_keydown(evt: KeyboardEvent) {
	if (evt.key === "Enter") {
		searchKey.value.search();
	}
}

const keywordManagementPaneVisible = ref(false);
const competitorManagementPaneVisible = ref(false);
const curEditingListing = ref();

const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();
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
