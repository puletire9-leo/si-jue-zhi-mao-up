<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />

			<el-space direction="horizontal">
				<el-text>仅展示待办</el-text>
				<el-switch
					v-model="showOnlyStatusLibrary"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-divider direction="vertical"></el-divider>
			</el-space>

			<batch-update-keyword-status2 :Crud="Crud" />

			<cl-flex1 />
			<!-- 关键字搜索 -->
			<cl-search-key />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table">
				<template #column-asin_candidate="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						:href="getAmazonDpUrl(scope.row.asin_candidate, scope.row.marketplace)"
					>
						{{ scope.row.asin_candidate }}
					</el-link>
				</template>
				<template #column-asin_competitor="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						:href="getAmazonDpUrl(scope.row.asin_competitor, scope.row.marketplace)"
					>
						{{ scope.row.asin_competitor }}
					</el-link>
				</template>
				<template #column-candidate_bullet_points="{ scope }">
					<cl-table-column-bullet-points
						:candidate_bullet_points="scope.row.candidate_bullet_points"
					/>
				</template>
				<template #column-image_url_display="{ scope }">
					<el-popover placement="left" trigger="hover" :width="300">
						<template #reference>
							<el-image
								:src="scope.row.image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
							/>
						</template>
						<template #default>
							<el-image
								:src="scope.row.image_url_display"
								style="width: 100%; height: auto; max-width: 300px"
								fit="contain"
							/>
						</template>
					</el-popover>
				</template>
				<template #column-candidate_image_url_display="{ scope }">
					<el-popover placement="right" trigger="hover" :width="300">
						<template #reference>
							<el-image
								:src="scope.row.candidate_image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
							/>
						</template>
						<template #default>
							<el-image
								:src="scope.row.candidate_image_url_display"
								style="width: 100%; height: auto; max-width: 300px"
								fit="contain"
							/>
						</template>
					</el-popover>
				</template>

				<template #slot-btns="{ scope }">
					<el-button
						size="default"
						type="success"
						text
						bg
						@click="updateStatus(scope.row, 2)"
					>
						竞品入库
					</el-button>
					<el-button
						size="default"
						type="success"
						text
						bg
						@click="updateStatus(scope.row, 1)"
					>
						关键词入库
					</el-button>
				</template>
			</cl-table>
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

<script lang="ts" name="app-bsr_candidate_competitor" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { appConfig } from "../../../../../appConfig";
import { ref, watch, reactive } from "vue";
import { convert_image_url } from "/$/app/utils";
import { ElMessage } from "element-plus";
import BatchUpdateKeywordStatus2 from "/$/app/components/batch-update-competitor-status2.vue";

const { service } = useCool();

// cl-upsert
const Upsert = useUpsert({
	items: [
		{
			label: "竞品",
			prop: "asin_competitor",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "竞品标题",
			prop: "item_name",
			component: { name: "el-input", props: { clearable: true }, showOverflowTooltip: true }
		},
		{ label: "竞品主图地址", prop: "image_url", component: { name: "cl-upload" } },
		{
			label: "国家",
			prop: "marketplace",
			component: { name: "el-input", props: { clearable: true } }
		},
		{ label: "价格", prop: "price", hook: "number", component: { name: "el-input-number" } },
		{
			label: "评论数量",
			prop: "review_num",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{ label: "星级评分", prop: "last_star", component: { name: "el-rate" } },
		{
			label: "BSR",
			prop: "bsr_html",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{ label: "BSR", prop: "bsr_rank", hook: "number", component: { name: "el-input-number" } },
		{
			label: "配送方",
			prop: "dispatches_from",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "售卖方",
			prop: "sold_by",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "卖家ID",
			prop: "sold_byID",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "配送方式",
			prop: "dispatches_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "五点描述",
			prop: "bullet_points",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "状态",
			prop: "status",
			component: {
				name: "el-radio-group",
				options: [
					{
						label: "待入库",
						value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.PENDING.value
					},
					{
						label: "已入库",
						value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.LIBRARY.value
					},
					{
						label: "已归档",
						value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.ARCHIVED.value
					},
					{
						label: "非同款竞品",
						value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.NON_SAME.value
					}
				]
			},
			value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.PENDING.value,
			required: true
		},
		{
			label: "产品信息爬虫的最近一次执行时间",
			prop: "spider_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "日均单量",
			prop: "daily_order_items",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "预估销量",
			prop: "expected_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "上架时间",
			prop: "date_first_available",
			component: {
				name: "el-date-picker",
				props: { type: "date", valueFormat: "YYYY-MM-DD" }
			}
		},
		{
			label: "父体月销",
			prop: "Main_monthly_sales",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "子体月销",
			prop: "Main_monthly_sales_sub",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "库存数量",
			prop: "stock_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "FBA配送费",
			prop: "FBA_price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "尺寸",
			prop: "dimensions",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "重量",
			prop: "weight",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "变体数量",
			prop: "variants",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{ label: "月销量", prop: "sales_volume_data", component: { name: "cl-editor-monaco" } },
		{ label: "竞品图地址1", prop: "img1", component: { name: "cl-upload" } },
		{ label: "竞品图地址2", prop: "img2", component: { name: "cl-upload" } },
		{ label: "竞品图地址3", prop: "img3", component: { name: "cl-upload" } },
		{ label: "竞品图地址4", prop: "img4", component: { name: "cl-upload" } },
		{ label: "竞品图地址5", prop: "img5", component: { name: "cl-upload" } },
		{ label: "竞品图地址6", prop: "img6", component: { name: "cl-upload" } },
		{ label: "相关性得分", prop: "similarity_score", component: { name: "el-rate" } }
	]
});

// cl-table
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "源选品asin", prop: "asin_candidate", minWidth: 140 },
		{ label: "asin", prop: "asin_competitor", minWidth: 140 },
		{ label: "竞品标题", prop: "item_name", minWidth: 140, showOverflowTooltip: true },
		{
			label: "竞品主图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain" } }
		},
		{
			label: "源选品图主图",
			prop: "candidate_image_url_display",
			minWidth: 100,
			component: { name: "cl-image", props: { size: 60 } }
		},
		{
			label: "源竞品标题",
			prop: "candidate_item_name",
			minWidth: 140,
			showOverflowTooltip: true
		},
		{ label: "卖点", prop: "candidate_bullet_points", minWidth: 70 },
		{ label: "国家", prop: "marketplace", minWidth: 140 },
		{ label: "图片对比分数", prop: "similarity_score", minWidth: 140 },
		{ label: "标题对比分数", prop: "title_hit_score", minWidth: 140 },
		{ label: "价格", prop: "price", minWidth: 140 },
		{ label: "评论数量", prop: "review_num", minWidth: 140 },
		{
			label: "星级评分",
			prop: "last_star",
			minWidth: 150,
			component: { name: "el-rate", props: { disabled: true } }
		},
		{ label: "BSR", prop: "bsr_html", showOverflowTooltip: true, minWidth: 200 },
		// { label: "BSR", prop: "bsr_category", minWidth: 140 },
		{ label: "BSR", prop: "bsr_rank", minWidth: 140 },
		{ label: "配送方", prop: "dispatches_from", minWidth: 140 },
		{ label: "售卖方", prop: "sold_by", minWidth: 140 },
		{ label: "卖家ID", prop: "sold_byID", minWidth: 140 },
		{ label: "配送方式", prop: "dispatches_type", minWidth: 140 },
		{ label: "五点描述", prop: "bullet_points", showOverflowTooltip: true, minWidth: 200 },
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "待入库", value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.PENDING.value },
				{ label: "已入库", value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.LIBRARY.value },
				{
					label: "已归档",
					value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.ARCHIVED.value
				},
				{
					label: "非同款竞品",
					value: appConfig.BSR_CANDIDATE_COMPETITOR_STATUS.NON_SAME.value
				}
			],
			dictColor: true,
			minWidth: 120
		},
		{
			label: "产品信息爬虫的最近一次执行时间",
			prop: "spider_time",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{ label: "日均单量", prop: "daily_order_items", minWidth: 140 },
		{ label: "预估销量", prop: "expected_volume", minWidth: 140 },
		{
			label: "上架时间",
			prop: "date_first_available",
			minWidth: 140,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{ label: "父体月销", prop: "Main_monthly_sales", minWidth: 140 },
		{ label: "子体月销", prop: "Main_monthly_sales_sub", minWidth: 140 },
		{ label: "库存数量", prop: "stock_quantity", minWidth: 140 },
		{ label: "FBA配送费", prop: "FBA_price", minWidth: 140 },
		{ label: "尺寸", prop: "dimensions", minWidth: 140 },
		{ label: "重量", prop: "weight", minWidth: 140 },
		{ label: "变体数量", prop: "variants", minWidth: 140 },
		{
			label: "月销量",
			prop: "sales_volume_data",
			minWidth: 120,
			component: { name: "cl-editor-preview", props: { name: "monaco" } }
		},
		{
			label: "相关性得分",
			prop: "similarity_score",
			minWidth: 150,
			component: { name: "el-rate", props: { disabled: true } }
		},
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{ type: "op", buttons: ["edit", "delete", "slot-btns"] }
	]
});

const showOnlyStatusLibrary = ref(true);
const BSR_COMPETITOR_STATUS = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS;
watch([showOnlyStatusLibrary], () => void setTimeout(Crud?.value?.refresh(), 200));

const getAmazonDpUrl = (asin: string, marketplace: string) => {
	if (!asin || !marketplace) return "#";
	const cleanAsin = String(asin)
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	if (!cleanAsin) return "#";
	return appConfig.get_amazon_url_dp(cleanAsin, marketplace);
};

// cl-crud
const Crud = useCrud(
	{
		service: service.app.bsr_candidate_competitor,
		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value) {
				Object.assign(params, {
					status: [
						BSR_COMPETITOR_STATUS.PENDING.value,
						BSR_COMPETITOR_STATUS.LIBRARY.value,
						BSR_COMPETITOR_STATUS.NON_SAME.value
					]
				});
			}
			const { list } = await next({
				...params
			});
			Table.value?.data.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				item.candidate_image_url_display = convert_image_url(item.candidate_image_url);
			});
		}
	},
	(app) => {
		app.refresh();
	}
);

async function updateStatus(candidate, status: number) {
	try {
		candidate.status = status;
		let inventory_status = "0";
		if (
			status === BSR_COMPETITOR_STATUS.PENDING.value ||
			status === BSR_COMPETITOR_STATUS.NON_SAME.value
		) {
			inventory_status = "1";
		}
		//
		await Crud.value?.service.update({
			id: candidate.id,
			status,
			inventory_status
		});
		Crud.value?.refresh();
		ElMessage({ message: "更新状态成功", type: "success" });
	} catch (err) {
		candidate.status = 0;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
	}
}
</script>
