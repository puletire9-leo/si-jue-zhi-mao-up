<template>
	<cl-crud ref="Crud" v-loading="isLoading">
		<cl-row>
			<cl-refresh-btn />

			<el-space>
				<el-button
					type="warning"
					plain
					:disabled="isTableSelectionEmpty"
					@click="confirmModifyPrice(Crud?.selection)"
					v-if="['both', 'price'].includes(props.tacticType)"
				>
					批量调整价格
					<el-icon class="el-icon--right">
						<money />
					</el-icon>
				</el-button>

				<el-dropdown trigger="click" v-if="['both', 'price'].includes(props.tacticType)">
					<el-button plain :disabled="isTableSelectionEmpty">
						批量设置不再提醒调价至
						<el-icon class="el-icon--right">
							<arrow-down />
						</el-icon>
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 1)"
								>1 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 7)"
								>7 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 14)"
								>14 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 30)"
								>30 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 60)"
								>60 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 90)"
								>90 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'price', 9999)"
								>不再提醒</el-dropdown-item
							>
						</el-dropdown-menu>
					</template>
				</el-dropdown>

				<el-divider direction="vertical" v-if="props.tacticType === 'both'"></el-divider>

				<el-button
					type="success"
					plain
					:disabled="isTableSelectionEmpty"
					@click="confirmCreatePurchasePlan(Crud?.selection)"
					v-if="['both', 'inventory'].includes(props.tacticType)"
				>
					批量创建采购计划
					<el-icon class="el-icon--right">
						<box />
					</el-icon>
				</el-button>

				<el-dropdown
					trigger="click"
					v-if="['both', 'inventory'].includes(props.tacticType)"
				>
					<el-button plain :disabled="isTableSelectionEmpty">
						批量设置不再提醒补货至
						<el-icon class="el-icon--right">
							<arrow-down />
						</el-icon>
					</el-button>
					<template #dropdown>
						<el-dropdown-menu>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 1)"
								>1 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 7)"
								>7 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 14)"
								>14 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 30)"
								>30 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 60)"
								>60 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 90)"
								>90 天后</el-dropdown-item
							>
							<el-dropdown-item
								@click="ignoreTacticLater(Crud?.selection, 'inventory', 9999)"
								>不再提醒
							</el-dropdown-item>
						</el-dropdown-menu>
					</template>
				</el-dropdown>
			</el-space>

			<cl-flex1 />

			<el-space direction="horizontal" v-if="is_admin">
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
			<cl-search ref="Search" />
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-competitor_amount_history_chart="{ scope }">
					<template v-if="scope.row.competitor_amount_history">
						<div style="margin: 0 auto; display: inline-block">
							<v-chart
								style="height: 180px; width: 380px; margin: 0 -12px"
								autoresize
								:option="
									generateCompetitorHistoryChartOption(
										scope.row.competitor_amount_history
									)
								"
							></v-chart>
						</div>
					</template>
					<template v-else>暂无</template>
				</template>

				<template #column-kw_search_volume_chart="{ scope }">
					<template v-if="scope.row.kw_search_volume_anal_res">
						<div style="margin: 0 auto; display: inline-block">
							<v-chart
								style="height: 180px; width: 480px; margin: 0 -12px"
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
						</div>
					</template>
					<template v-else>暂无</template>
				</template>
				<template #column-__kw_search_volume_anal_res_clone="{ scope }">
					<template
						v-if="
							scope.row.__kw_search_volume_anal_res_clone &&
							scope.row.__expectedOrdersFixingInput
						"
					>
						<div style="margin: 0 auto; display: inline-block">
							<v-chart
								style="height: 180px; width: 480px; margin: 0 -12px"
								autoresize
								:option="
									generateKeywordSearchVolumeChartOption(
										scope.row.__kw_search_volume_anal_res_clone,
										false,
										true,
										appConfig.cal_listing_logical_inventory(scope.row)
									)
								"
							></v-chart>
						</div>
					</template>
					<template v-else>暂无</template>
				</template>

				<template #slot-management-buttons="{ scope }">
					<el-tooltip
						content="调整价格"
						placement="top"
						:hide-after="0"
						v-if="['both', 'price'].includes(props.tacticType)"
					>
						<el-button
							type="warning"
							circle
							size="large"
							@click="openModifyPriceDialog(scope.row)"
						>
							<el-icon>
								<money />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip
						content="调整库存"
						placement="top"
						:hide-after="0"
						v-if="['both', 'inventory'].includes(props.tacticType)"
					>
						<el-button
							type="success"
							circle
							size="large"
							@click="openModifyInventoryDialog(scope.row)"
						>
							<el-icon>
								<box />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-divider
						direction="vertical"
						v-if="props.tacticType === 'both'"
					></el-divider>

					<el-tooltip
						content=""
						placement="top"
						:hide-after="200"
						v-if="['both', 'price'].includes(props.tacticType)"
					>
						<template #content>不再提醒 <strong>调价</strong> 至</template>
						<el-dropdown>
							<el-button type="warning" size="large" plain circle>
								<el-icon>
									<clock />
								</el-icon>
							</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 1)"
										>1 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 7)"
										>7 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 14)"
										>14 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 30)"
										>30 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 60)"
										>60 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 90)"
										>90 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'price', 9999)"
										>不再提醒</el-dropdown-item
									>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
					</el-tooltip>

					<el-tooltip
						content=""
						placement="top"
						:hide-after="200"
						v-if="['both', 'inventory'].includes(props.tacticType)"
					>
						<template #content>不再提醒 <strong>补货</strong> 至</template>
						<el-dropdown>
							<el-button type="success" size="large" plain circle>
								<el-icon>
									<clock />
								</el-icon>
							</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 1)"
										>1 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 7)"
										>7 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 14)"
										>14 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 30)"
										>30 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 60)"
										>60 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 90)"
										>90 天后</el-dropdown-item
									>
									<el-dropdown-item
										@click="ignoreTacticLater([scope.row], 'inventory', 9999)"
										>不再提醒
									</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
					</el-tooltip>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert"> </cl-upsert>

		<el-dialog
			title="修改价格"
			width="400"
			center
			align-center
			v-model="modifyPriceDialogVisible"
			@closed="curEditingListing = undefined"
			v-if="curEditingListing"
		>
			<el-space>
				<div>请填写新的价格（当前 {{ curEditingListing?.landed_price }}）</div>
				<el-input-number :step="0.1" v-model="curEditingNewPrice"></el-input-number>
			</el-space>
			<template #footer>
				<el-button type="success" plain @click="updateModifyingPriceLocally()"
					>暂存</el-button
				>
				<el-button type="primary" @click="confirmModifyPrice([curEditingListing])"
					>提交</el-button
				>
			</template>
		</el-dialog>

		<el-dialog
			title="计划采购数量"
			width="800"
			center
			align-center
			v-model="modifyInventoryDialogVisible"
			@closed="curEditingListing = undefined"
			v-if="curEditingListing"
		>
			<el-space direction="vertical" size="large" style="width: 100%">
				<template v-if="curEditingListing?.__kw_search_volume_anal_res_clone">
					<div>预测销量走势图</div>
					<v-chart
						style="height: 300px; width: 760px"
						autoresize
						:option="
							generateKeywordSearchVolumeChartOption(
								curEditingListing?.__kw_search_volume_anal_res_clone,
								false,
								true,
								appConfig.cal_listing_logical_inventory(curEditingListing),
								true
							)
						"
						@brushSelected="brushSelectedHandler($event)"
					></v-chart>
					<el-space>
						<el-text>预期单量修正</el-text>
						<el-select
							style="width: 200px"
							clearable
							v-model="curSelectedExpectedOrdersIndex"
						>
							<el-option
								v-for="(
									data, index
								) in curEditingListing?.kw_search_volume_anal_res"
								:value="index"
								:label="data.date + '｜' + data.expected_orders"
								@click="onExpectedOrdersSelectedChange(data)"
							>
								<el-text style="float: left">{{ data.date }}</el-text>
								<el-text style="float: right" type="info">{{
									data.expected_orders
								}}</el-text>
							</el-option>
						</el-select>
						<template
							v-if="
								typeof curEditingListing?.__selectedExpectedOrdersIndex !==
									'undefined' &&
								curEditingListing?.__selectedExpectedOrdersIndex !== ''
							"
						>
							<el-text>请填写修正数值</el-text>
							<el-input-number
								:min="0"
								:step="50"
								v-model="curEditingListing.__expectedOrdersFixingInput"
								@change="expectedOrdersFixerHandler()"
							></el-input-number>
							<el-button @click="resetKeywordSearchVolumeDataClone()">重置</el-button>
						</template>
					</el-space>
				</template>
				<el-space>
					<div>
						请填写计划采购数量（当前库存
						{{ appConfig.cal_listing_logical_inventory(curEditingListing) }}）
					</div>
					<el-input-number
						:step="10"
						:min="0"
						v-model="curEditingNewInventory"
					></el-input-number>
				</el-space>
			</el-space>
			<template #footer>
				<el-button type="success" plain @click="updateNewInventoryLocally()"
					>暂存</el-button
				>
				<el-button type="primary" @click="confirmCreatePurchasePlan([curEditingListing])"
					>提交</el-button
				>
			</template>
		</el-dialog>
	</cl-crud>
</template>

<script lang="ts" name="app-backlog-tactic" setup>
import { useCrud, useTable, useUpsert, useSearch } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, ref, watch } from "vue";
import dayjs from "dayjs";
import { cloneDeep } from "lodash-es";
import { ElMessage, ElMessageBox } from "element-plus";
import { Clock, Money, Box, ArrowDown } from "@element-plus/icons-vue";
import {
	generateCompetitorHistoryChartOption,
	generateKeywordSearchVolumeChartOption,
	is_admin
} from "/$/app/utils";
import SellerFilter from "/$/app/components/seller-filter.vue";
import { ListingViewModel } from "/$/app/interface/listingViewModel";
import { KeywordSearchVolumeData } from "../../../../../cool-admin-midway/src/modules/app/interface/keyword-search-volume-data";
import { appConfig } from "../../../../../appConfig";
import { convert_image_url } from "/$/app/utils";

const props = defineProps({
	tacticType: {
		type: String,
		default: "both",
		validator(value: string) {
			return ["both", "price", "inventory"].includes(value);
		}
	}
});

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.listing,

		async onRefresh(params, { next, done, render }) {
			let request_data = {
				...params,
				tactic_type: props.tacticType
			};

			if (showOnlySalable.value) Object.assign(request_data, { status: 1 });
			if (showOnlyUndeleted.value) Object.assign(request_data, { is_delete: 0 });

			let { list } = await next(request_data);

			list = list.map((listing: ListingViewModel) => {
				listing.__kw_search_volume_anal_res_clone = cloneDeep(
					listing.kw_search_volume_anal_res
				);
				listing.__selectedExpectedOrdersIndex = undefined;
				listing.__expectedOrdersFixingInput = undefined;
				return listing;
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
			prop: "sellerName",
			label: "店铺名",
			sortable: "custom",
			minWidth: 120,
			"show-overflow-tooltip": true,
			fixed: "left"
		},
		{ prop: "asin", label: "ASIN", width: 130, sortable: "custom", fixed: "left" },
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
		{ prop: "id", label: "ID *", width: 70, hidden: !is_admin.value },
		{ prop: "sid", label: "sid *", width: 60, hidden: !is_admin.value },
		{ prop: "seller_sku", label: "MSKU", minWidth: 170, sortable: "custom", fixed: "left" },
		{
			prop: "local_sku",
			label: "本地产品 SKU",
			minWidth: 170,
			sortable: "custom",
			fixed: "left"
		},
		{
			prop: "status",
			label: "状态 *",
			dict: [
				{ label: "可售", value: 1, type: "success" },
				{ label: "停售", value: 0, type: "danger" }
			],
			width: 90,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			prop: "is_delete",
			label: "是否删除 *",
			dict: [
				{ label: "是", value: 1, type: "danger" },
				{ label: "否", value: 0, type: "success" }
			],
			width: 100,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			prop: "item_name",
			label: "标题",
			sortable: "custom",
			minWidth: 150,
			"show-overflow-tooltip": true
		},
		{ label: "产品名称", prop: "product_name", minWidth: 140, fixed: "left" },
		{ prop: "marketplace", label: "国家", sortable: "custom", width: 80 },

		{ prop: "price", label: "价格", sortable: "custom" },
		{ prop: "landed_price", label: "总价", sortable: "custom" },
		{ prop: "afn_fulfillable_quantity", label: "FBA 可售", minWidth: 70, sortable: "custom" },
		{ prop: "reserved_fc_processing", label: "调仓中", minWidth: 70, sortable: "custom" },
		{ prop: "afn_inbound_shipped_quantity", label: "在途", minWidth: 70, sortable: "custom" },
		{
			prop: "afn_inbound_receiving_quantity",
			label: "入库中",
			minWidth: 70,
			sortable: "custom"
		},
		{ prop: "daily_order_quantity", label: "日均单量", minWidth: 60, sortable: "custom" },
		{ prop: "inv_age_91_to_180_days", label: "3-6 月库龄", minWidth: 70, sortable: "custom" },

		{
			label: "预计可售天数",
			prop: "days_to_sale_up",
			minWidth: 70,
			formatter(row, column, value, index) {
				return row.daily_order_quantity
					? Math.round(
							appConfig.cal_listing_logical_inventory(row) / row.daily_order_quantity
						)
					: "-";
			}
		},
		{ label: "竞品数量走势", prop: "competitor_amount_history_chart", width: 400 },
		{ label: "预期单量走势", prop: "kw_search_volume_chart", minWidth: 500 },
		{
			label: "预期单量走势（手动修正）",
			prop: "__kw_search_volume_anal_res_clone",
			minWidth: 500,
			hidden: !["both", "inventory"].includes(props.tacticType)
		},

		{
			prop: "tactic_hint_price",
			label: "调价建议",
			minWidth: 400,
			"show-overflow-tooltip": true,
			formatter(row, column, value, index) {
				return value || "暂无";
			},
			hidden: !["both", "price"].includes(props.tacticType)
		},
		{
			prop: "tactic_hint_inventory",
			label: "补货建议",
			minWidth: 330,
			"show-overflow-tooltip": true,
			formatter(row, column, value, index) {
				return value || "暂无";
			},
			hidden: !["both", "inventory"].includes(props.tacticType)
		},

		{
			prop: "tactic_price_suggested_new_price",
			label: "新价格",
			hidden: !["both", "price"].includes(props.tacticType)
		},
		{
			prop: "tactic_inventory_new_quantity_plan",
			label: "计划采购",
			width: 100,
			hidden: !["both", "inventory"].includes(props.tacticType)
		},

		{
			type: "op",
			buttons: ["slot-management-buttons"],
			width: props.tacticType === "both" ? 240 : 130
		}
	],
	contextMenu: []
});

const Upsert = useUpsert({
	items: []
});

const Search = useSearch({
	items: []
});

const isLoading = ref(false);

const modifyPriceDialogVisible = ref(false);
const curEditingNewPrice = ref<number | null>();
const curEditingListing = ref<ListingViewModel>();

function openModifyPriceDialog(listing: ListingViewModel) {
	modifyPriceDialogVisible.value = true;
	curEditingListing.value = listing;
	curEditingNewPrice.value = listing.tactic_price_suggested_new_price;
}

function updateModifyingPriceLocally(): boolean {
	let listing = curEditingListing.value;
	if (!listing) {
		console.info("因当前 Listing 为空，未执行新价格暂存。");
		return true;
	} else {
		if (null === curEditingNewPrice.value) {
			ElMessage({
				message: "请输入有效数值",
				type: "error",
				grouping: true
			});
			return false;
		}

		modifyPriceDialogVisible.value = false;
		listing.tactic_price_suggested_new_price = curEditingNewPrice.value;

		ElMessage({
			message: "要调整的新价格已成功暂存。",
			type: "success",
			grouping: true
		});
		return true;
	}
}

async function confirmModifyPrice(listingList: ListingViewModel[] | object[] | any) {
	if (!updateModifyingPriceLocally()) {
		return false;
	}

	if (
		listingList.some(
			(listing: ListingViewModel) =>
				"number" !== typeof listing.tactic_price_suggested_new_price
		)
	) {
		ElMessage({
			type: "error",
			message: `有 Listing 未正确填写新价格，请检查后重试。`
		});
		return false;
	}

	ElMessageBox.confirm("点击确认将向领星提交 Listing 的新价格修改。", "再次确认", {
		confirmButtonText: "确认",
		cancelButtonText: "取消",
		type: "warning"
	})
		.then(() => {
			isLoading.value = true;
			Crud.value?.service
				.modify_price({ listingList })
				.then((res) => {
					ElMessage({
						type: "success",
						message: `修改价格成功`
					});
				})
				.then(async () => {
					await Crud.value?.service.update(
						listingList.map((listing: ListingViewModel) => {
							return {
								id: listing.id,
								tactic_hint_price: "",
								tactic_price_suggested_new_price: null
							};
						})
					);
					Crud.value?.refresh();
				})
				.catch((res) => {
					ElMessage({
						type: "error",
						message: res?.message || "修改失败，请稍后重试"
					});
				});
		})
		.catch(() => {})
		.finally(() => {
			isLoading.value = false;
			modifyPriceDialogVisible.value = false;
		});
}

const modifyInventoryDialogVisible = ref(false);
const curEditingNewInventory = ref<number | null>();
const curSelectedExpectedOrdersIndex = ref<number | string>();

function openModifyInventoryDialog(listing: ListingViewModel) {
	modifyInventoryDialogVisible.value = true;
	curEditingListing.value = listing;
	curEditingNewInventory.value = listing.tactic_inventory_new_quantity_plan;
	curSelectedExpectedOrdersIndex.value = listing.__selectedExpectedOrdersIndex;
}

function brushSelectedHandler(params: any) {
	let selectedIndexes: [] = params?.batch[0]?.selected[0]?.dataIndex;

	let total = 0;
	for (const index of selectedIndexes) {
		total +=
			curEditingListing.value?.__kw_search_volume_anal_res_clone[index]?.expected_orders || 0;
	}

	if (total !== 0) {
		curEditingNewInventory.value = total;
	}
}

function onExpectedOrdersSelectedChange(data: KeywordSearchVolumeData) {
	let listing = curEditingListing.value;
	if (!listing) return false;
	listing.__expectedOrdersFixingInput = data.expected_orders;
	listing.__selectedExpectedOrdersIndex = curSelectedExpectedOrdersIndex.value;
}

function resetKeywordSearchVolumeDataClone() {
	let listing = curEditingListing.value;
	if (!listing) return false;
	listing.__kw_search_volume_anal_res_clone = cloneDeep(listing.kw_search_volume_anal_res);
	listing.__selectedExpectedOrdersIndex = undefined;
	listing.__expectedOrdersFixingInput = undefined;
	curSelectedExpectedOrdersIndex.value = undefined;
}

function expectedOrdersFixerHandler() {
	let listing = curEditingListing.value;
	if (!listing) return false;

	let index = listing.__selectedExpectedOrdersIndex;
	let newValue = listing.__expectedOrdersFixingInput;

	if (typeof index === "undefined" || typeof newValue === "undefined") {
		return;
	}

	let originDataList = listing.kw_search_volume_anal_res;
	let origin_expected_orders_selected = originDataList[index].expected_orders;
	if (
		typeof origin_expected_orders_selected === "undefined" ||
		origin_expected_orders_selected <= 0
	)
		origin_expected_orders_selected = 1;
	let ratio = newValue / origin_expected_orders_selected;

	for (let i = Number(index); i < originDataList?.length; i++) {
		let origin_expected_orders = originDataList[i].expected_orders;

		if (typeof origin_expected_orders === "undefined" || origin_expected_orders <= 0)
			origin_expected_orders = 1;
		listing.__kw_search_volume_anal_res_clone[i].expected_orders = Math.round(
			origin_expected_orders * ratio
		);
	}
}

function updateNewInventoryLocally(): boolean {
	let listing = curEditingListing.value;
	if (!listing) {
		console.info("因当前 Listing 为空，未执行采购数量暂存。");
		return true;
	} else {
		if (null === curEditingNewPrice.value) {
			ElMessage({
				message: "请输入有效数值",
				type: "error",
				grouping: true
			});
			return false;
		}

		modifyInventoryDialogVisible.value = false;
		listing.tactic_inventory_new_quantity_plan = curEditingNewInventory.value;

		ElMessage({
			message: "计划采购数量已成功暂存。",
			type: "success",
			grouping: true
		});
		return true;
	}
}

async function confirmCreatePurchasePlan(listingList: ListingViewModel[] | object[] | any) {
	if (!updateNewInventoryLocally()) {
		return false;
	}

	if (
		listingList.some(
			(listing: ListingViewModel) =>
				"number" !== typeof listing.tactic_inventory_new_quantity_plan
		)
	) {
		ElMessage({
			type: "error",
			message: `有 Listing 未正确计划采购价格，请检查后重试。`
		});
		return false;
	}

	ElMessageBox.confirm("点击确认将向领星提交创建采购计划。", "再次确认", {
		confirmButtonText: "确认",
		cancelButtonText: "取消",
		type: "warning"
	})
		.then(() => {
			isLoading.value = true;
			Crud.value?.service
				.create_purchase_plan({
					listingList
				})
				.then((res) => {
					ElMessage({
						type: "success",
						message: `创建采购计划成功`
					});
				})
				.then(async () => {
					await Crud.value?.service.update(
						listingList.map((listing: ListingViewModel) => {
							return {
								id: listing.id,
								tactic_hint_inventory: ""
							};
						})
					);
					Crud.value?.refresh();
				})
				.catch((res) => {
					ElMessage({
						type: "error",
						message: res?.message || "创建采购计划失败，请稍后重试"
					});
				});
		})
		.catch(() => {})
		.finally(() => {
			isLoading.value = false;
			modifyInventoryDialogVisible.value = false;
		});
}

async function ignoreTacticLater(
	listings: ListingViewModel[],
	tactic_type: "price" | "inventory" = "price",
	days: number = 0
) {
	ElMessageBox.confirm(
		`确认要忽略所选 listing 的【${"price" === tactic_type ? "调价" : "补货"}】策略提醒至 ${days} 天后吗？`,
		"请确认",
		{
			type: "info",
			draggable: true
		}
	)
		.then(async () => {
			isLoading.value = true;
			try {
				let updateParams = listings.map((listing) => {
					return { id: listing.id };
				});

				if (tactic_type === "price") {
					updateParams.forEach((params) => {
						Object.assign(params, {
							tactic_hint_price: "",
							tactic_price_ignore_until: dayjs().add(days, "days").toDate()
						});
					});
				}

				if (tactic_type === "inventory") {
					updateParams.forEach((params) => {
						Object.assign(params, {
							tactic_hint_inventory: "",
							tactic_inventory_ignore_until: dayjs().add(days, "days").toDate()
						});
					});
				}

				await Crud?.value?.service.update(updateParams);

				ElMessage({
					message: "设置成功",
					type: "success"
				});
				Crud?.value?.refresh();
			} catch (err: any) {
				console.log(err);
				ElMessage({
					message: err,
					type: "error"
				});
			} finally {
				isLoading.value = false;
			}
		})
		.catch(() => {});
}
</script>

<style lang="scss">
.cl-table__op {
	.el-button + .el-dropdown,
	.el-dropdown + .el-dropdown,
	.el-dropdown + .el-button {
		margin-left: 12px;
	}
}

.cl-dialog__default {
	padding-bottom: 0 !important;
}
</style>
