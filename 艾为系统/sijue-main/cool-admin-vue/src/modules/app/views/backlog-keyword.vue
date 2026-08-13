<template>
	<cl-crud ref="Crud">
		<cl-row>
			<el-alert type="info" show-icon>
				<ol style="margin-left: 20px">
					<li>对关键词进行「入库」、「归档」或「重新爬虫」操作时，列表不会自动刷新。</li>
					<li>请按需刷新列表。刷新后，本界面只会显示状态为「待入库」的关键词。</li>
					<li>在操作前，可顺便标记为「是否为核心关键词」。</li>
					<li>
						若图片相似度评分和关键词评分均为 <code>-1</code>，
						可能意味着爬虫执行失败，请考虑进行「重新爬虫」操作。需要批量修改时，请选择修改为「待调研」状态。
					</li>
					<li>「已归档」的关键词将不会参与调价/补货算法。</li>
				</ol>
			</el-alert>
		</cl-row>

		<cl-row>
			<cl-refresh-btn />

			<batch-update-keyword-status :Crud="Crud" />

			<cl-flex1 />
			<seller-filter />
			<listing-filter-is-custom />
			<cl-search-key />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-search_page_link="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						:href="
							appConfig.get_amazon_url_keyword_search(
								scope.row.value,
								scope.row.marketplaces
							)
						"
					>
						<el-button size="small">打开</el-button>
					</el-link>
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
						查看 {{ scope.row.spider_res?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-score1="{ scope }">
					<el-space>
						<el-text>{{ scope.row.score1 }}</el-text>
						<template v-if="scope.row.spider_res">
							<el-popover
								placement="right"
								title="爬虫图片参考"
								:width="560"
								trigger="click"
								:persistent="false"
							>
								<template #reference>
									<el-button plain circle size="small">
										<el-icon>
											<picture />
										</el-icon>
									</el-button>
								</template>
								<template #default>
									<el-space direction="horizontal" wrap size="large">
										<template v-for="res in scope.row.spider_res">
											<el-link
												:href="
													appConfig.get_amazon_url_dp(
														res.asin,
														scope.row.marketplace
													)
												"
												target="_blank"
												:disabled="!res.asin"
											>
												<el-image
													:src="convert_image_url(res.imgUrl)"
													style="
														padding: 5px;
														max-width: 50px;
														max-height: 50px;
														border: 1px solid black;
													"
												></el-image>
											</el-link>
										</template>
									</el-space>
									<template v-if="scope.row?.spider_res?.length === 0"
										>暂无</template
									>
								</template>
							</el-popover>
						</template>
					</el-space>
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
						@click="updateStatus(scope.row, appConfig.KEYWORD_STATUS.ARCHIVED.value)"
					>
						归档
					</el-button>
					<el-button
						size="default"
						type="warning"
						text
						bg
						@click="updateStatus(scope.row, appConfig.KEYWORD_STATUS.CREATED.value)"
					>
						重新爬虫
					</el-button>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

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

<script lang="ts" name="app-backlog-keyword" setup>
import { useCrud, useTable } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { appConfig } from "../../../../../appConfig";
import { ElMessage } from "element-plus";
import { DataLine, Picture } from "@element-plus/icons-vue";
import BatchUpdateKeywordStatus from "/$/app/components/batch-update-keyword-status.vue";
import SellerFilter from "/$/app/components/seller-filter.vue";
import { generateKeywordSearchVolumeChartOption, is_admin } from "/$/app/utils";
import { ref } from "vue";
import ClDialog from "/~/crud/src/components/dialog";
import { KeywordSearchVolumeData } from "../../../../../cool-admin-midway/src/modules/app/interface/keyword-search-volume-data";
import ListingFilterIsCustom from "/$/app/components/listing-filter-is-custom.vue";
import { convert_image_url } from "/$/app/utils";

const { service } = useCool();

const Crud = useCrud(
	{
		service: service.app.keyword,

		async onRefresh(params, { next, done, render }) {
			const { list } = await next({
				...params,

				status: appConfig.KEYWORD_STATUS.PENDING.value
			});

			Table.value?.data.forEach((item) => {
				item.small_image_url_display = convert_image_url(item.small_image_url);
			});
		}
	},
	(app) => {
		app.refresh({ size: 10 });
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
		{ label: "sid*", prop: "sid", minWidth: 70, hidden: !is_admin },
		{ label: "店铺名称", prop: "sellerName", minWidth: 150, sortable: "custom" },
		{
			label: "ASIN",
			prop: "asin",
			width: 160,
			sortable: "custom",
			formatter: (row, column, value) => appConfig.get_from_custom_listing_hint(row, "asin")
		},
		{
			label: "MSKU",
			prop: "seller_sku",
			minWidth: 170,
			sortable: "custom",
			formatter: (row, column, value) =>
				appConfig.get_from_custom_listing_hint(row, "seller_sku")
		},
		{
			label: "关联产品标题",
			prop: "item_name",
			sortable: "custom",
			minWidth: 150,
			"show-overflow-tooltip": true
		},
		{
			label: "关联产品品名",
			prop: "local_name",
			sortable: "custom",
			minWidth: 150,
			"show-overflow-tooltip": true
		},

		{
			label: "缩略图",
			prop: "small_image_url_display",
			component: { name: "cl-image", props: { size: 35 } }
		},
		{
			label: "关键词",
			prop: "value",
			minWidth: 300,
			"show-overflow-tooltip": true,
			sortable: "custom"
		},
		{ label: "搜索直达", prop: "search_page_link", width: 90 },
		{ label: "爬虫 *", prop: "spider_res", width: 90, hidden: !is_admin.value },
		{ label: "图片相似度评分", prop: "score1", width: 150, sortable: "custom" },
		{ label: "关键词匹配度评分", prop: "score2", width: 165, sortable: "custom" },
		{
			label: "评分日期",
			prop: "score_time",
			sortable: "custom",
			minWidth: 160,
			component: { name: "cl-date-text" }
		},
		{ label: "月搜索量", prop: "search_volume_monthly", width: 120, sortable: "custom" },
		{
			label: "核心关键词",
			prop: "is_core",
			minWidth: 120,
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
				{ label: "待调研", value: 0, type: "warning" },
				{ label: "调研中", value: 1, color: "purple" },
				{ label: "待入库", value: 2, type: "primary" },
				{ label: "已入库", value: 3, type: "success" },
				{ label: "已归档", value: 4, type: "info" }
			],

			width: 100,
			fixed: "right"
		},

		{
			type: "op",
			width: 330,
			buttons: ["slot-btns", "delete"]
		}
	]
});

const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();

async function updateStatus(keyword, status: number) {
	let oldStatus = keyword?.status;
	try {
		keyword.status = status;
		await Crud.value?.service.update({
			id: keyword.id,
			status
		});
		ElMessage({ message: "更新状态成功", type: "success" });
	} catch (err) {
		keyword.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
	}
}

async function updateStatusLibrary(keyword) {
	let oldStatus = keyword?.status;
	try {
		await Crud.value?.service.batch_update_status_library({ keywords: [keyword] });
		ElMessage({ message: "已成功入库", type: "success" });
		keyword.status = appConfig.KEYWORD_STATUS.LIBRARY.value;
	} catch (err) {
		keyword.status = oldStatus;
		ElMessage({ message: "更新状态失败，请刷新/重试。", type: "error" });
		console.log(err);
	}
}
</script>
