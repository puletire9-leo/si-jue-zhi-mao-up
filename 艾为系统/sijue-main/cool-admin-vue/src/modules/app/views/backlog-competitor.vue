<template>
	<cl-crud ref="Crud">
		<cl-row>
			<el-alert type="info" show-icon>
				<ol style="margin-left: 20px">
					<li>对竞品进行【入库】或【归档】操作时，列表不会自动刷新。</li>
					<li>请按需刷新列表。刷新后，只会显示状态为【待入库】的竞品。</li>
					<li>在操作入库/归档前，可顺便标记为【是否为核心竞品】。</li>
					<li>【已归档】的竞品将不会参与调价/补货算法。</li>
				</ol>
			</el-alert>
		</cl-row>

		<cl-row>
			<cl-refresh-btn />

			<batch-update-competitor-status :Crud="Crud" />

			<cl-flex1 />
			<seller-filter />
			<listing-filter-is-custom />
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

				<template #slot-btns="{ scope }">
					<el-button
						size="default"
						type="success"
						text
						bg
						@click="updateStatusLibrary(scope.row)"
					>
						入库
					</el-button>
					<el-button
						size="default"
						type="info"
						text
						bg
						@click="updateStatus(scope.row, appConfig.COMPETITOR_STATUS.ARCHIVED.value)"
					>
						归档
					</el-button>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>
	</cl-crud>
</template>

<script lang="ts" name="app-backlog-competitor" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { appConfig } from "../../../../../appConfig";
import { ElMessage } from "element-plus";
import BatchUpdateCompetitorStatus from "/$/app/components/batch-update-competitor-status.vue";
import SellerFilter from "/$/app/components/seller-filter.vue";
import ListingFilterIsCustom from "/$/app/components/listing-filter-is-custom.vue";
import { is_admin } from "/$/app/utils";
import { List } from "@element-plus/icons-vue";
import { convert_image_url } from "/$/app/utils";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.competitor,

		async onRefresh(params, { next, done, render }) {
			const { list } = await next({
				...params,

				status: appConfig.COMPETITOR_STATUS.PENDING.value
			});

			Table.value?.data.forEach((item) => {
				item.small_image_url_mine_display = convert_image_url(item.small_image_url_mine);
				item.image_url_display = convert_image_url(item.image_url);
			});
		}
	},
	(app) => {
		app.refresh();
	}
);

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },
		{
			label: "产品来源",
			prop: "is_custom_listing",
			dict: [
				{ label: "领星", value: 0, type: "primary" },
				{ label: "自定义", value: 1, type: "success" }
			],
			width: 110
		},

		{
			label: "关联产品信息",
			children: [
				{ label: "sid*", prop: "sid", minWidth: 70, hidden: !is_admin.value },
				{ label: "店铺名称", prop: "sellerName", minWidth: 150, sortable: "custom" },
				{
					label: "MSKU*",
					prop: "seller_sku",
					minWidth: 170,
					sortable: "custom",
					formatter: (row, column, value) =>
						appConfig.get_from_custom_listing_hint(row, "seller_sku"),
					hidden: !is_admin.value
				},
				{
					label: "ASIN",
					prop: "asin_mine",
					minWidth: 160,
					sortable: "custom",
					formatter: (row, column, value) =>
						appConfig.get_from_custom_listing_hint(row, "asin_mine")
				},
				{
					label: "品名",
					prop: "local_name_mine",
					minWidth: 130,
					"show-overflow-tooltip": true
				},

				{
					label: "主图",
					prop: "small_image_url_mine_display",
					component: { name: "cl-image", props: { size: 35 } }
				}
			]
		},

		{
			label: "竞品信息",
			children: [
				{ label: "竞品 ASIN", prop: "asin_competitor", minWidth: 130 },
				{
					label: "竞品标题",
					prop: "item_name",
					minWidth: 250,
					"show-overflow-tooltip": true
				},

				{
					label: "竞品图",
					prop: "image_url_display",
					component: { name: "cl-image", props: { size: 35 } }
				},
				{ label: "竞品页面", prop: "competitor_page_link", width: 90 },
				{ label: "价格", prop: "price", minWidth: 90, sortable: "custom" },
				{ label: "评论数量", prop: "review_num", minWidth: 115, sortable: "custom" },
				{
					label: "星级",
					prop: "last_star",
					minWidth: 150,
					sortable: "custom",
					component: { name: "el-rate", props: { disabled: true, "show-score": true } }
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
						return appConfig.estimate_distribution_type(
							row.dispatches_from,
							row.sold_by
						);
					}
				},
				{ label: "卖点", prop: "bullet_points", minWidth: 70 },
				{ label: "BSR", prop: "bsr_html", minWidth: 260 },

				{
					label: "收录时间",
					prop: "createTime",
					minWidth: 160,
					component: { name: "cl-date-text" },
					sortable: "custom"
				}
			]
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
			sortable: "custom",
			fixed: "right"
		},
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "待入库", value: 2, type: "primary" },
				{ label: "已入库", value: 3, type: "success" },
				{ label: "已归档", value: 4, type: "info" }
			],

			width: 100,
			fixed: "right"
		},

		{
			type: "op",
			width: 230,
			buttons: ["slot-btns", "delete"]
		}
	]
});

async function updateStatus(competitor, status: number) {
	let oldStatus = competitor?.status;
	try {
		competitor.status = status;
		await Crud.value?.service.update({
			id: competitor.id,
			status
		});
		ElMessage({ message: "更新状态成功", type: "success" });
	} catch (err) {
		competitor.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
	}
}

async function updateStatusLibrary(competitor) {
	let oldStatus = competitor?.status;
	try {
		await Crud.value?.service.batch_update_status_library({ competitors: [competitor] });
		ElMessage({ message: "已成功入库", type: "success" });
		competitor.status = appConfig.COMPETITOR_STATUS.LIBRARY.value;
	} catch (err) {
		competitor.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
	}
}
</script>

<style lang="scss">
table .el-rate .el-rate__icon {
	margin-right: 2px;
}
</style>
