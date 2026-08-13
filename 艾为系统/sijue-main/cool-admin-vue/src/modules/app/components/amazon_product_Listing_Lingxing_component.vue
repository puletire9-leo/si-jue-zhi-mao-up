<template>
	<div class="normal-scroll-container">
		<cl-crud ref="Crud">
			<!-- 领星数据 + 分析数据区块 -->
			<div class="data-section">
				<cl-row>
					<div style="display: flex; align-items: center; flex-wrap: wrap; gap: 10px">
						<!-- 刷新按钮 -->
						<cl-refresh-btn />
						<!-- 新增按钮 -->
						<cl-add-btn />
						<!-- 删除按钮 -->
						<cl-multi-delete-btn />

						<!-- 更新市场分析数据按钮 -->
						<el-button
							type="warning"
							:loading="processStatisticsLoading"
							@click="updateCompetitorStatisticsDataFromProcess"
						>
							更新分析数据
						</el-button>

						<!-- 图片和标题展示区域 -->
						<div
							v-if="processTableData.length > 0"
							style="display: flex; align-items: center; gap: 10px"
						>
							<!-- 图片展示（带预览） -->
							<!-- 2026-02-11: Changed placement to bottom to prevent popover being cut off at the top -->
							<el-popover placement="bottom" trigger="hover" :width="300">
								<!-- 2026-04-24 修改：使用格式化后的图片地址，优先取 image_url_display -->
								<!-- <img :src="processTableData[0].image_url" style="max-width: 280px; max-height: 280px" /> -->
								<img
									:src="processTableData[0].image_url_display || processTableData[0].image_url"
									style="max-width: 280px; max-height: 280px"
								/>
								<template #reference>
									<!-- 2026-04-24 修改：使用格式化后的图片地址 -->
									<!-- <img :src="processTableData[0].image_url" -->
									<img
										:src="processTableData[0].image_url_display || processTableData[0].image_url"
										style="
											width: 40px;
											height: 40px;
											cursor: pointer;
											object-fit: cover;
											border: 1px solid #e4e7ed;
											border-radius: 4px;
										"
										@click="handlePreviewCurrentImageAndTitle"
									/>
								</template>
							</el-popover>

							<!-- 标题展示 -->
							<!-- 2026-02-11: Added tooltip and increased max-width to fix text truncation issue -->
							<el-tooltip
								effect="dark"
								:content="processTableData[0].item_name"
								placement="top"
								:disabled="!processTableData[0].item_name"
							>
								<span
									style="
										color: #303133;
										font-size: 14px;
										max-width: 600px;
										overflow: hidden;
										text-overflow: ellipsis;
										white-space: nowrap;
										cursor: pointer;
									"
									@click="handlePreviewCurrentImageAndTitle"
								>
									{{ processTableData[0].item_name }}
								</span>
							</el-tooltip>
						</div>

						<!-- 无数据时的提示 -->
						<div
							v-else
							style="
								color: #909399;
								font-size: 14px;
								display: flex;
								align-items: center;
							"
						>
							暂无识图/标题数据（点击表格图片/标题可新增）
						</div>
					</div>

					<cl-flex1 />
					<!-- 关键字搜索 -->
					<cl-search-key placeholder="asin,品名,备注,msku模糊搜索" />
				</cl-row>

				<!-- 添加编号行：仅在没有 product_code 时显示 -->
				<cl-row v-if="props.lingxing && !props.lingxing.product_code" style="margin-bottom: 10px">
					<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
						<span style="font-size: 14px; color: #303133; font-weight: 500">添加编号：</span>
						<el-input
							v-model="productCodeInput"
							placeholder="例如 0015"
							size="default"
							style="width: 140px"
							clearable
							@blur="padProductCodeInput"
							@focus="!missingProductCodeHint ? fetchProductCodeGaps() : undefined"
						/>
						<el-button type="success" size="default" @click="saveProductCode" :loading="savingProductCode">保存编号</el-button>
						<div v-if="missingProductCodeHint" style="font-size: 12px; color: #909399; white-space: nowrap">
							{{ missingProductCodeHint }}
						</div>
					</div>
				</cl-row>

				<div style="margin-bottom: 10px">
					<!-- 数据表格 -->
					<cl-table
						ref="Table"
						:auto-height="false"
						max-height="400"
						@selection-change="handleMarketAnalysisSelectionChange"
						:row-class-name="tableRowClassName"
					>
						<!-- 原图片列模板修改，添加点击事件 -->
						<template #column-image_url_display="{ scope }">
							<el-popover placement="right" trigger="hover" :width="1300">
								<template #reference>
									<!-- 新增点击事件，绑定处理图片设为识图图片的方法 -->
									<el-image
										:src="scope.row.image_url_display"
										style="width: 50px; height: 50px; cursor: pointer"
										fit="contain"
										@click="handleSetImageForSearch(scope.row)"
									/>
								</template>
								<template #default>
									<div
										style="
											display: flex;
											overflow-x: auto;
											gap: 10px;
											padding: 10px 0;
										"
									>
										<template v-for="i in 6" :key="i">
											<el-image
												v-if="scope.row[`image_url${i === 1 ? '' : i}`]"
												:src="
													convert_image_url(
														scope.row[`image_url${i === 1 ? '' : i}`]
													)
												"
												style="
													width: 200px;
													height: 200px;
													flex-shrink: 0;
													cursor: pointer;
												"
												fit="contain"
												@click="handleSetImageForSearch(scope.row, i)"
											/>
										</template>
									</div>
								</template>
							</el-popover>
						</template>

						<!-- ASIN超链接模板 -->
						<template #column-asin="{ scope }">
							<el-link
								target="_blank"
								:underline="false"
								:href="getAmazonDpUrl(scope.row.asin, scope.row.marketplace)"
							>
								{{ scope.row.asin }}
							</el-link>
							<el-tag
								v-if="isSourceRow(scope.row)"
								type="warning"
								size="small"
								effect="dark"
								style="margin-left: 5px"
								>源</el-tag
							>
						</template>

						<template #column-item_name="{ scope }">
							<span
								style="cursor: pointer; color: var(--el-color-primary)"
								@click="handleSetTitleForSearch(scope.row)"
							>
								{{ scope.row.item_name }}
							</span>
						</template>

						<template #column-market_analysis>
							<span>-</span>
						</template>
					</cl-table>
				</div>

				<cl-row>
					<cl-flex1 />
					<!-- 分页控件 -->
					<cl-pagination />
				</cl-row>
				<cl-row> </cl-row>

				<cl-row style="margin: 10px 0">
					<div style="display: flex; align-items: center; gap: 12px; font-weight: 600">
						<span>市场分析数据</span>
						<span
							v-if="marketAnalysisRow"
							style="font-weight: normal; color: #909399; font-size: 12px"
						>
							{{ marketAnalysisRow.asin }} / {{ marketAnalysisRow.marketplace }}
						</span>
					</div>
				</cl-row>
				<cl-row>
					<div style="width: 100%">
						<div v-if="!marketAnalysisRow" style="color: #909399; padding: 8px 0">
							请选择一条商品查看市场分析数据
						</div>
						<div v-else>
							<div v-if="competitorDataLoading" class="loading-state">
								<el-icon class="is-loading">
									<loading />
								</el-icon>
								<span>正在加载...</span>
							</div>
							<div v-else-if="competitorDataError" class="error-state">
								<el-icon>
									<warning />
								</el-icon>
								<span>加载失败: {{ competitorDataError }}</span>
							</div>
							<div v-else-if="!marketAnalysisTableData.length" class="empty-state">
								<el-icon>
									<info-filled />
								</el-icon>
								<span>暂无市场分析数据</span>
							</div>
							<div v-else class="data-container">
								<el-table
									:data="marketAnalysisTableData"
									size="small"
									max-height="400"
									border
									stripe
									style="width: 100%"
									:default-sort="{
										prop: 'crawler_time',
										order: 'descending'
									}"
								>
									<el-table-column
										prop="crawler_time"
										label="更新时间"
										width="135"
										align="center"
									/>
									<el-table-column
										prop="units_top_15"
										label="统计销量前15"
										width="200"
										align="center"
									/>
									<el-table-column
										prop="stars_top_10"
										label="统计评分前15"
										width="200"
										align="center"
									/> 
									<el-table-column
										label="统计价格前15"
										width="200"
										align="center"
									>
										<template #default="scope">
											{{
												formatMarketAnalysisPriceTop15(
													scope.row.price_top_10
												)
											}}
										</template>
									</el-table-column>
									<el-table-column label="前15平均价" width="120" align="center">
										<template #default="scope">
											{{ getMarketAnalysisAvgPrice(scope.row.price_top_10) }}
										</template>
									</el-table-column>
									<el-table-column
										prop="price_lowest"
										label="市场最低价"
										width="120"
										align="center"
									/>
									<el-table-column
										prop="seller_count_fba"
										label="FBA卖家数"
										width="150"
										align="center"
									/>
									<el-table-column
										label="FBA近30天销量|库存|库销比"
										width="200"
										align="center"
									>
										<template #default="scope">
											{{
												getFbaInventoryDisplay(
													marketAnalysisRow.marketplace,
													scope.row
												)
											}}
										</template>
									</el-table-column>
									<el-table-column
										label="公司近30天销量|库存|库销比"
										width="210"
										align="center"
									>
										<template #default="scope">
											{{ getCompanyInventoryDisplay(scope.row) }}
										</template>
									</el-table-column>
									<el-table-column
										prop="units_30_sum_amz"
										label="AMZ近30天销量"
										width="150"
										align="center"
									/>
									<el-table-column
										prop="units_30_sum_other"
										label="other近30天销量"
										width="150"
										align="center"
									/>
								</el-table>
							</div>
						</div>
					</div>
				</cl-row>
			</div>

			<!-- 竞品数据区块 -->
			<div class="data-section">
				<cl-row style="margin: 10px 0">
					<!-- 状态标签页 -->
					<div style="display: flex; align-items: center; margin-right: 15px">
						<el-radio-group
							v-model="activeTab"
							style="margin-right: 15px"
							@change="handleTabChange"
						>
							<el-radio-button label="on_sale">在售</el-radio-button>
							<el-radio-button label="history">往期</el-radio-button>
							<el-radio-button label="pending">待定</el-radio-button>
							<el-radio-button label="recycle">回收站</el-radio-button>
						</el-radio-group>

						<!-- 往期规则控制 -->
						<!-- 往期规则控制 (包含获取竞品数据按钮) -->
						<div
							style="
								display: flex;
								align-items: center;
								gap: 10px;
								border: 1px solid #dcdfe6;
								padding: 5px 15px;
								border-radius: 4px;
								margin-left: 10px;
							"
						>
							<el-button
								v-if="processTableData.length > 0"
								type="primary"
								:loading="manualProcessLoading"
								@click="handleManualProcess(processTableData[0].id)"
							>
								获取竞品数据
							</el-button>

							<div
								style="
									width: 1px;
									height: 20px;
									background-color: #dcdfe6;
									margin: 0 5px;
								"
								v-if="processTableData.length > 0"
							></div>

							<span style="font-size: 14px; color: #606266">往期规则:</span>
							<el-select
								v-model="ruleNearly30Days"
								placeholder="待选择"
								clearable
								style="width: 140px"
							>
								<el-option label="近30天无销量" value="nearly" />
							</el-select>

							<el-date-picker
								v-model="ruleHistoryMonth"
								type="month"
								placeholder="选择历史月份"
								value-format="YYYY-MM"
								style="width: 140px"
								clearable
							/>

							<el-button type="primary" size="default" @click="saveHistoryRules"
								>保存</el-button
							>
							<el-button
								type="success"
								size="default"
								:loading="executingHistoryRules"
								@click="executeHistoryRules"
								>立即获取竞品详情</el-button
							>
						</div>
						<div style="display: flex; gap: 10px;">
						<el-button
								type="warning"
								size="default"
								:disabled="!selectedCompetitors.length"
								@click="handleBatchKeyword"
								>批量获取关键词</el-button
							>
						<el-button
								type="success"
								size="default"
								:loading="checkingPastPeriod"
								@click="handlePastPeriodCheck"
								>往期检测</el-button
							>
						<!-- <el-button
								type="info"
								size="default"
								:loading="checkingGlobalPastPeriod"
								@click="handleGlobalPastPeriodCheck"
								>全局往期检测</el-button
							> -->
							</div>
					</div>
				</cl-row>

				<!-- 批量操作按钮 -->
				<div style="margin-bottom: 10px; display: flex; gap: 10px">
					<el-button
						type="danger"
						size="small"
						:disabled="!selectedCompetitors.length"
						@click="bulkAction('delete')"
						>批量删除</el-button
					>
					<el-button
						type="primary"
						size="small"
						:disabled="!selectedCompetitors.length"
						@click="bulkAction('on_sale')"
						>移入在售</el-button
					>
					<el-button
						type="warning"
						size="small"
						:disabled="!selectedCompetitors.length"
						@click="bulkAction('history')"
						>移入往期</el-button
					>
				</div>

				<!-- 竞品数据表格 -->
				<div style="margin-bottom: 10px">
					<el-table
						ref="competitorTableRef"
						v-loading="competitorTableLoading"
						:data="paginatedCompetitorData"
						border
						stripe
						style="width: 100%"
						max-height="800"
						:row-key="getCompetitorRowKey"
						:row-class-name="competitorRowClassName"
						@selection-change="handleCompetitorSelectionChange"
					>
						<el-table-column
							type="selection"
							width="55"
							align="center"
							:reserve-selection="true"
							:selectable="isCompetitorSelectable"
						/>
						<el-table-column label="竞品ASIN" min-width="180">
							<template #default="{ row }">
								<span
									v-if="row._isParentAggregate"
									style="
										display: inline-flex;
										align-items: center;
										cursor: pointer;
										margin-right: 6px;
									"
									@click="toggleParentExpand(row)"
								>
									<el-icon>
										<component
											:is="isParentExpanded(row) ? CaretBottom : CaretRight"
										/>
									</el-icon>
								</span>
								<span
									v-else-if="row._isChildRow"
									style="display: inline-block; width: 18px"
								/>
								<el-tag
									v-if="row._isParentAggregate"
									type="success"
									size="small"
									effect="plain"
									style="margin-right: 6px"
									>父体</el-tag
								>
								<el-tag
									v-else-if="row._isChildRow"
									type="info"
									size="small"
									effect="plain"
									style="margin-right: 6px"
									>子体</el-tag
								>
								<el-link
									target="_blank"
									:underline="false"
									:href="getAmazonDpUrl(row.asin_competitor, row.marketplace)"
									:style="row._isChildRow ? { marginLeft: '2px' } : {}"
								>
									{{ row.asin_competitor }}
								</el-link>
							</template>
						</el-table-column>
						<el-table-column
							prop="item_name"
							label="竞品标题"
							min-width="120"
							showOverflowTooltip
						/>
						<el-table-column
							prop="marketplace"
							label="国家"
							min-width="120"
							showOverflowTooltip
						/>
						<el-table-column label="价格" min-width="100">
							<template #default="{ row }">
								{{ getCompetitorPriceDisplay(row) }}
							</template>
						</el-table-column>
						<el-table-column label="图片" width="100">
							<template #default="{ row }">
								<el-popover placement="right" trigger="hover" :width="300">
									<!-- 大图预览 -->
									<img
										:src="row.image_url"
										style="max-width: 280px; max-height: 280px"
									/>

									<!-- 小图展示 -->
									<template #reference>
										<img
											:src="row.image_url"
											style="
												width: 50px;
												height: 50px;
												cursor: pointer;
												object-fit: cover;
											"
										/>
									</template>
								</el-popover>
							</template>
						</el-table-column>
						<el-table-column label="月销量走势" width="100" align="center">
							<template #default="{ row }">
								<template v-if="row.sales_volume_data">
									<div style="height: 40px; width: 100%">
										<v-chart
											:option="
												generateMonthlySalesChartOption(
													row.sales_volume_data,
													getCompetitorChartPrice(row),
													row.marketplace
												)
											"
											style="width: 100%; height: 100%"
											autoresize
										></v-chart>
									</div>
								</template>
								<template v-else>暂无</template>
							</template>
						</el-table-column>
						<el-table-column
							prop="Main_monthly_sales"
							label="父体销量"
							min-width="100"
						/>
						<el-table-column
							prop="Main_monthly_sales_sub"
							label="子体销量"
							min-width="100"
						/>
						<el-table-column
							v-if="activeTab === 'recycle'"
							prop="similarity_score"
							label="图片比对得分"
							min-width="100"
						/>
						<el-table-column
							v-if="activeTab === 'recycle'"
							label="操作"
							min-width="130"
						>
							<template #default="{ row }">
								<el-button
									type="success"
									size="small"
									icon=""
									@click="restoreCompetitor(row)"
									>恢复为在售
								</el-button>
							</template>
						</el-table-column>
						<el-table-column label="库存数量" min-width="120">
							<template #default="{ row }">
								<span>{{ getCompetitorStockDisplay(row) }}</span>
								<span
									v-if="getCompetitorInventoryTypeDisplay(row)"
									:style="{
										color: getInventoryTypeColor(row.inventory_type),
										marginLeft: '6px'
									}"
								>
									{{ getCompetitorInventoryTypeDisplay(row) }}
								</span>
							</template>
						</el-table-column>
						<el-table-column prop="revenue" label="销售额" min-width="100" />
						<el-table-column prop="amz_sales" label="子体销售额" min-width="100" />
						<el-table-column prop="variants" label="变体数量" min-width="100" />
						<el-table-column prop="ratings_cv" label="评分数月新增" min-width="100" />
						<el-table-column prop="ratings_rate" label="评分留评率" min-width="100" />
						<el-table-column prop="lqs" label="LQS" min-width="100" />
						<el-table-column
							prop="date_first_available"
							label="上架时间"
							min-width="200"
						/>
						<!-- 配送类型适配 -->
						<el-table-column label="配送类型" min-width="100">
							<template #default="{ row }">
								<span>
									{{ formatDeliveryType(row.dispatches_type) }}
								</span>
							</template>
						</el-table-column>
						<el-table-column
							prop="bsr_html"
							label="BSR"
							min-width="100"
							showOverflowTooltip
						/>
						<el-table-column prop="dispatches_from" label="配送方" min-width="100" />
						<el-table-column prop="sold_by" label="售卖方" min-width="100" />
						<el-table-column prop="updateTime" label="更新时间" min-width="100" />
						<el-table-column prop="createTime" label="创建时间" min-width="100" />
						<!-- 操作按钮列 -->
						<el-table-column v-if="activeTab !== 'recycle'" label="操作" min-width="80">
							<template #default="{ row }">
								<el-button
									v-if="!row._isParentAggregate"
									type="danger"
									size="small"
									icon="Delete"
									@click="deleteCompetitor(row)"
								>
									归档
								</el-button>
							</template>
						</el-table-column>
					</el-table>
					<div style="display: flex; justify-content: flex-end; margin-top: 10px">
						<el-pagination
							v-model:current-page="competitorCurrentPage"
							v-model:page-size="competitorPageSize"
							:page-sizes="[5, 10, 20, 50]"
							layout="total, sizes, prev, pager, next, jumper"
							:total="groupedCompetitorDisplayData.length"
						/>
					</div>
				</div>

				<!-- 新增、编辑 -->
				<cl-upsert ref="Upsert" />



				<!-- 关键词查询结果面板 -->
				<batch-keyword-result
					v-model:visible="batchKeywordResultVisible"
					:asin="props.lingxing?.asin || ''"
					:product-code="props.lingxing?.product_code || ''"
					:marketplaces="props.lingxing?.marketplace || ''"
					:competitor-asins="batchKeywordAsinList.map(item => item.asin)"
				/>



				<el-drawer
					v-model="lingxingComponentManagementPaneVisible"
					size="90%"
					direction="ltr"
					:with-header="false"
				>
					<lingxing-component :listing="curEditingLingxingComponent"></lingxing-component>
				</el-drawer>
			</div>
		</cl-crud>

		<!-- 图表数据分析区块 -->
		<div class="data-section chart-section-wrapper">
			<listing-analysis-charts
				:listing="props.lingxing"
				@temp-stored-saved="(payload) => emit('temp-stored-saved', payload)"
			/>
		</div>
	</div>
</template>

<script lang="ts" name="app-amazon_product_Listing_Lingxing" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { convert_image_url, is_admin, generateKeywordSearchVolumeChartOption } from "/$/app/utils";
import { computed, ref, watch, nextTick } from "vue";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent } from "echarts/components";

use([CanvasRenderer, LineChart, TooltipComponent, GridComponent]);

import ListingAnalysisCharts from "./ListingAnalysisCharts.vue";
import BatchKeywordResult from "./BatchKeywordResult.vue";
import LingxingComponent from "/$/app/components/amazon_product_Listing_Lingxing_component.vue";
import { ElLoading, ElMessage, ElMessageBox, ElIcon } from "element-plus";
import {
	Loading,
	Warning,
	InfoFilled,
	Delete,
	DataLine,
	CaretRight,
	CaretBottom
} from "@element-plus/icons-vue";
import { appConfig } from "../../../../../appConfig";
import { status } from "nprogress";
const { service } = useCool();
const LINGXING_COMPETITOR_STATUS = appConfig.LINGXING_COMPETITOR_STATUS;

const lingxingComponentManagementPaneVisible = ref(false);
const curEditingLingxingComponent = ref();

const props = defineProps(["lingxing"]);
const emit = defineEmits(["temp-stored-saved"]);

const isSourceRow = (row: any) => {
	if (!props.lingxing) return false;
	const isSameAsin = row.asin === props.lingxing.asin;
	const isSameMarketplace = row.marketplace === props.lingxing.marketplace;
	const sourceShop = props.lingxing.seller_name;
	const isSameShop = sourceShop ? row.seller_name === sourceShop : true;
	return isSameAsin && isSameMarketplace && isSameShop;
};

const tableRowClassName = ({ row }: { row: any }) => {
	if (isSourceRow(row)) {
		return "warning-row";
	}
	return "";
};



// cl-table
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "asin", prop: "asin", minWidth: 80, showOverflowTooltip: true },
		{ label: "国家", prop: "marketplace", minWidth: 80, showOverflowTooltip: true },
		{
			label: "图片",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain" } },
			fixed: "left"
		},
		{ label: "品名", prop: "local_name", minWidth: 80, showOverflowTooltip: true },
		{
			label: "标题",
			prop: "item_name",
			minWidth: 80,
			showOverflowTooltip: true
		},
		{ label: "站点", prop: "marketplace", minWidth: 80 },
		{ label: "店铺", prop: "seller_name", minWidth: 80, showOverflowTooltip: true },
		{ label: "msku", prop: "msku", minWidth: 70, showOverflowTooltip: true },
		{
			label: "可售状态",
			prop: "status",
			minWidth: 100,
			dict: [
				{ label: "在售", value: 1, type: "success" },
				{ label: "停售", value: 0, type: "danger" },
				{ label: "断货", value: 2, type: "danger" }
			]
		},
		{ label: "日均销量", prop: "dailyAvgSales", minWidth: 100 },
		{ label: "是否识图", prop: "image_state", minWidth: 80 },
		{ label: "可售量", prop: "afn_fulfillable_quantity", minWidth: 80 },
		{ label: "待调仓", prop: "reserved_fc_transfers", minWidth: 80 },
		{ label: "调仓中", prop: "reserved_fc_processing", minWidth: 80 },
		{ label: "在途", prop: "afn_inbound_shipped_quantity", minWidth: 80 },
		{
			label: "总库存",
			minWidth: 80,
			component: {
				name: "cl-text",
				props: {
					render: (h: any, scope: any) => {
						const row = scope.row;
						const 可售量 = Number(row.afn_fulfillable_quantity) || 0;
						const 待调仓 = Number(row.reserved_fc_transfers) || 0;
						const 调仓中 = Number(row.reserved_fc_processing) || 0;
						const 在途 = Number(row.afn_inbound_shipped_quantity) || 0;
						// 计算总和
						const 总库存 = 可售量 + 待调仓 + 调仓中 + 在途;
						return h("span", 总库存);
					}
				}
			}
		},
		{ label: "市场分析数据", prop: "market_analysis", minWidth: 100, hidden: true },
		{ label: "7日销量", prop: "total_volume", minWidth: 80 },
		{ label: "14日销量", prop: "fourteen_volume", minWidth: 80 },
		{ label: "30日销量", prop: "thirty_volume", minWidth: 80 },
		{
			label: "销量分析",
			prop: "volume_analyze_result",
			dict: [
				{ label: "无数据", value: 0, type: "warning" },
				{ label: "正常补货", value: 3, type: "warning" },
				{ label: "库存过多", value: 4, type: "warning" },
				{ label: "未定义", value: 6, type: "warning" },
				{ label: "到货超过7天无销量，运营处理", value: 7, type: "warning" },
				{ label: "老品到货无销量", value: 8, type: "warning" },
				{ label: "新品到货无销量", value: 9, type: "warning" },
				{ label: "流量有问题且库存过多", value: 10, type: "warning" },
				{ label: "流量货价格有问题,BSR<500，销量未进前五", value: 11, type: "warning" },
				{ label: "库存过多,BSR<500，销量进前五", value: 12, type: "warning" },
				{ label: "流量有问题，BSR>500", value: 13, type: "warning" },
				{ label: "流量有问题，BSR>3000", value: 14, type: "warning" },
				{ label: "新品在途", value: 15, type: "warning" },
				{ label: "到货超过14天无销量", value: 16, type: "warning" },
				{ label: "到货超过30天无销量", value: 17, type: "warning" }
			],
			minWidth: 120
		},
		{
			label: "评分",
			prop: "stars",
			minWidth: 80,
			formatter: (row) => (Array.isArray(row.stars) ? row.stars[0] : row.stars)
		},
		{
			label: "价格分析",
			prop: "price_analyze_result",
			dict: [
				{ label: "未定义", value: -1, type: "warning" },
				{ label: "市场最低", value: 0, type: "success" },
				{ label: "前十最低", value: 1, type: "success" },
				{ label: "价格第二低", value: 2, type: "warning" },
				{ label: "价格第三低", value: 3, type: "warning" },
				{ label: "价格第四低", value: 4, type: "warning" },
				{ label: "价格第五低", value: 5, type: "danger" },
				{ label: "价格第六低", value: 6, type: "danger" },
				{ label: "价格第七低", value: 7, type: "danger" },
				{ label: "价格第八低", value: 8, type: "danger" },
				{ label: "价格第九低", value: 9, type: "danger" },
				{ label: "价格第十低", value: 10, type: "danger" },
				{ label: "价格高于前十", value: 11, type: "danger" }
			],
			minWidth: 120
		},
		{ label: "优惠价", prop: "listingPrice", minWidth: 80 },
		{ label: "价格", prop: "price", minWidth: 80 },
		{ label: "综合价格", prop: "price_target", minWidth: 100 },
		{ label: "跟踪人", prop: "userIdComplete", minWidth: 80 },
		{ label: "备注", prop: "remark", showOverflowTooltip: true, minWidth: 80 },
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 80,
			sortable: "custom",
			component: { name: "cl-date-text" },
			showOverflowTooltip: true
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 80,
			sortable: "custom",
			component: { name: "cl-date-text" },
			showOverflowTooltip: true
		}
	]
});

// cl-crud
const Crud = useCrud(
	{
		service: service.app.bsr_product_Listing_Lingxing,
		async onRefresh(params, { next, done, render }) {
			// 获取目标ASIN（从点击来源传递的参数，这里假设通过props.lingxing.asin获取）
			const targetAsin = props.lingxing?.asin;

			// 修复SQL空IN错误：过滤空的筛选条件
			const productCode = props.lingxing.product_code;
			const asin = props.lingxing.asin;
			const filterData: any = {
				...params,
				marketplace: props.lingxing.marketplace,
			};
			if (productCode) {
				filterData.product_code = productCode;
			} else if (asin) {
				filterData.asin = asin;
			}
			const cleanParams = Object.entries(filterData).reduce(
				(acc, [key, val]) => {
					if (
						val !== undefined &&
						val !== null &&
						(Array.isArray(val) ? val.length > 0 : true)
					) {
						acc[key] = val;
					}
					return acc;
				},
				{} as Record<string, any>
			);

			const { list } = await next(cleanParams);

			// 核心逻辑：将目标ASIN置顶
			if (targetAsin && list.length > 0) {
				// 找到目标ASIN对应的项
				const targetIndex = list.findIndex((item) => {
					const isSameAsin = item.asin === targetAsin;
					const isSameMarketplace = item.marketplace === props.lingxing.marketplace;
					const sourceShop = props.lingxing.shop || props.lingxing.seller_name;
					const isSameShop = sourceShop ? item.seller_name === sourceShop : true;
					return isSameAsin && isSameMarketplace && isSameShop;
				});
				if (targetIndex >= 0) {
					// 如果存在且不在第一位
					// 移除目标项并插入到数组开头
					const targetItem = list.splice(targetIndex, 1)[0];
					list.unshift(targetItem);
				}
			}

			// 处理图片显示
			Table.value?.data.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
			});

			loadCompetitorTableData(); // 竞品表格数据
			loadProcessTableData(); // 加载图片/标题数据（用于按钮旁展示）
			const firstRow = Table.value?.data?.[0];
			marketAnalysisRow.value = firstRow || null;
			if (firstRow) {
				loadCompetitorData(firstRow);
			}
		}
	},
	(app) => {
		app.refresh({ size: 5 });
	}
);

watch(
	() => props.lingxing,
	() => {
		Crud.value?.refresh();
	}
);

// 格式化配送类型
const formatDeliveryType = (type: number | string) => {
	const typeNum = Number(type);
	switch (typeNum) {
		case 1:
			return "FBA";
		case 2:
			return "FBM";
		case 3:
			return "自营";
		default:
			return "其他";
	}
};

const formatStockQuantity = (value: number, inventoryType: any) => {
	if (inventoryType === "999+") return "999+";
	return value === -1 ? "无" : value;
};

const normalizePriceNumber = (price: string | number | null | undefined): number | null => {
	if (price === null || price === undefined) return null;
	if (typeof price === "number") {
		return Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : null;
	}
	const matched = String(price).match(/\{([^}]*)\}/);
	const rawValue = matched ? matched[1] : String(price);
	let text = rawValue.trim();
	if (!text) return null;
	if (text.includes("-")) {
		const rangeValues = text
			.split("-")
			.map((item) => normalizePriceNumber(item))
			.filter((item): item is number => item !== null);
		if (!rangeValues.length) return null;
		return Number(
			(rangeValues.reduce((sum, item) => sum + item, 0) / rangeValues.length).toFixed(2)
		);
	}
	text = text.replace(/[^\d.,]/g, "");
	if (!text) return null;
	if (text.includes(",") && !text.includes(".")) {
		text = text.replace(",", ".");
	} else if (text.includes(",") && text.includes(".")) {
		if (text.indexOf(",") < text.indexOf(".")) {
			text = text.replace(/,/g, "");
		} else {
			text = text.replace(/\./g, "").replace(/,/g, ".");
		}
	}
	const result = Number(text);
	return Number.isFinite(result) && result > 0 ? Number(result.toFixed(2)) : null;
};

const formatPriceNumber = (price: number) =>
	price
		.toFixed(2)
		.replace(/\.00$/, "")
		.replace(/(\.\d)0$/, "$1");

const getPriceSegmentDisplay = (segment: string) => segment.replace(/\{[^}]*\}/g, "").trim();

const getPriceSegmentAverage = (segment: string): number | null => {
	const matched = segment.match(/\{([^}]*)\}/);
	const source = matched ? matched[1] : segment;
	const values = source
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => normalizePriceNumber(item))
		.filter((item): item is number => item !== null);
	if (values.length) {
		return Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(2));
	}
	return normalizePriceNumber(segment);
};

const formatMarketAnalysisPriceTop15 = (value: string) =>
	String(value || "")
		.split("|")
		.map((item) => getPriceSegmentDisplay(item))
		.filter(Boolean)
		.join("|");

const getMarketAnalysisAvgPrice = (value: string) => {
	const averages = String(value || "")
		.split("|")
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => getPriceSegmentAverage(item))
		.filter((item): item is number => item !== null);
	if (!averages.length) return "";
	return formatPriceNumber(
		Number((averages.reduce((sum, item) => sum + item, 0) / averages.length).toFixed(2))
	);
};

const getChildMonthlySales = (row: any) => {
	const parentAsin = (row?.parent_asin || "").trim();
	const asinCompetitor = (row?.asin_competitor || "").trim();
	if (parentAsin && parentAsin !== asinCompetitor) {
		return Number(row?.Main_monthly_sales_sub) || 0;
	}
	return Number(row?.Main_monthly_sales) || Number(row?.Main_monthly_sales_sub) || 0;
};

const getAdjustedChildStockQuantity = (row: any) => {
	const inventoryType = String(row?.inventory_type || "")
		.trim()
		.toUpperCase();
	const stockQuantity = Number(row?.stock_quantity) || 0;
	const childMonthlySales = getChildMonthlySales(row);
	if (inventoryType === "XIAN" || inventoryType === "LIMIT") {
		return Number(Math.max(childMonthlySales, stockQuantity * 1.5).toFixed(2));
	}
	if (inventoryType === "999+") {
		return Number(Math.max(childMonthlySales, 999 * 1.5).toFixed(2));
	}
	return stockQuantity;
};

const getCompetitorPriceDisplay = (row: any) => {
	if (row?._isParentAggregate && row?._displayPrice) return row._displayPrice;
	return getPriceSegmentDisplay(String(row?.price || ""));
};

const getCompetitorChartPrice = (row: any) => {
	if (row?._isParentAggregate) {
		return row?._chartPrice ?? getCompetitorPriceDisplay(row);
	}
	return row?.price;
};

const getCompetitorStockDisplay = (row: any) => {
	if (row?._isParentAggregate) {
		const stockQuantity = Number(row?._displayStockQuantity);
		if (!Number.isFinite(stockQuantity)) return "";
		return formatPriceNumber(stockQuantity);
	}
	return formatStockQuantity(row?.stock_quantity, row?.inventory_type);
};

const getCompetitorInventoryTypeDisplay = (row: any) => {
	if (row?._isParentAggregate) return "";
	return formatInventoryType(row?.inventory_type);
};

const formatInventoryType = (value: any) => {
	if (value === "XIAN") return "限";
	if (value === "SHANCHU") return "删除";
	if (value === "NORMAL") return "正常";
	if (value === "BODONG") return "加载失败";
	if (value === "DUANHUO") return "断货";
	if (value === -1) return "无";
	if (typeof value === "number" && value >= 999) return "999+";
	return value || "";
};

const getInventoryTypeColor = (value: any) => {
	if (value === "NORMAL") return "#67C23A";
	if (value === "XIAN") return "#E6A23C";
	return "#F56C6C";
};

// 生成Amazon商品链接
const getAmazonDpUrl = (asin: string, marketplace: string) => {
	if (!asin || !marketplace) return "#";

	// 映射国家到对应的域名后缀
	const domainMap: Record<string, string> = {
		英国: "co.uk",
		德国: "de",
		法国: "fr",
		西班牙: "es",
		意大利: "it"
	};

	const domain = domainMap[marketplace] || "com"; // 默认使用.com
	return `https://www.amazon.${domain}/dp/${asin}`;
};

// 删除竞品
const deleteCompetitor = async (row: any) => {
	try {
		// 显示确认对话框
		await ElMessageBox.confirm("确定要归档这条竞品数据吗？", "确认归档", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning"
		});

		await service.app.bsr_candidate_competitor.update({
			id: row.id,
			status: LINGXING_COMPETITOR_STATUS.RECYCLE.value
		});

		// 刷新竞品表格数据
		loadCompetitorTableData();

		ElMessage.success("归档成功");
	} catch (error: any) {
		// 如果是用户取消，则不显示错误信息
		if (error !== "cancel") {
			console.error("归档竞品失败:", error);
			ElMessage.error("归档失败，请稍后重试");
		}
	}
};

// 恢复竞品为在售
const restoreCompetitor = async (row: any) => {
	try {
		// 显示确认对话框
		await ElMessageBox.confirm("确定要将这条竞品数据恢复为在售状态吗？", "确认恢复", {
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning"
		});

		await service.app.bsr_candidate_competitor.update({
			id: row.id,
			status: LINGXING_COMPETITOR_STATUS.ON_SALE.value
		});

		// 刷新竞品表格数据
		loadCompetitorTableData();

		ElMessage.success("恢复成功");
	} catch (error: any) {
		// 如果是用户取消，则不显示错误信息
		if (error !== "cancel") {
			console.error("恢复竞品失败:", error);
			ElMessage.error("恢复失败，请稍后重试");
		}
	}
};

watch(props, () => {
	Crud.value?.refresh();
});

const competitorTableData = ref<any[]>([]); // 第二个表格的数据
const selectedCompetitors = ref<any[]>([]);
const competitorTableRef = ref();
const expandedParentKeys = ref<Set<string>>(new Set());

const getMonthlySales = (row: any) => Number(row?.Main_monthly_sales) || 0;

const getCompetitorRowKey = (row: any) => {
	if (row?._isParentAggregate) return row._rowKey;
	return row?.id ?? `${row?.asin_competitor || ""}_${row?.marketplace || ""}`;
};

const isCompetitorSelectable = (row: any) => !row?._isParentAggregate;

const isParentExpanded = (row: any) => expandedParentKeys.value.has(row._groupKey);

const competitorRowClassName = ({ row }: { row: any }) => {
	if (row?._isParentAggregate) {
		return isParentExpanded(row)
			? "competitor-parent-row competitor-parent-expanded-row"
			: "competitor-parent-row";
	}
	if (row?._isChildRow) return "competitor-child-row";
	return "";
};

const toggleParentExpand = (row: any) => {
	if (!row?._isParentAggregate) return;
	if (expandedParentKeys.value.has(row._groupKey)) {
		expandedParentKeys.value.delete(row._groupKey);
	} else {
		expandedParentKeys.value.add(row._groupKey);
	}
};

const groupedCompetitorDisplayData = computed(() => {
	const source = competitorTableData.value || [];
	const grouped = new Map<string, any[]>();
	const singleRows: any[] = [];
	for (const row of source) {
		const parentAsin = (row?.parent_asin || "").trim();
		if (!parentAsin) {
			singleRows.push({ ...row, _isParentAggregate: false, _isChildRow: false });
			continue;
		}
		const key = parentAsin;
		const list = grouped.get(key) || [];
		list.push(row);
		grouped.set(key, list);
	}

	const result: any[] = [...singleRows];
	for (const [key, children] of grouped.entries()) {
		if (children.length <= 1) {
			const onlyChild = children[0];
			result.push({ ...onlyChild, _isParentAggregate: false, _isChildRow: false });
			continue;
		}
		const sortedChildren = [...children].sort(
			(a, b) => getMonthlySales(b) - getMonthlySales(a)
		);
		const topChild = sortedChildren[0];
		const priceValues = Array.from(
			new Set(
				sortedChildren
					.map((child) => normalizePriceNumber(child?.price))
					.filter((price): price is number => price !== null)
			)
		).sort((a, b) => a - b);
		const displayPrice =
			priceValues.length <= 1
				? getPriceSegmentDisplay(String(topChild?.price || ""))
				: `${formatPriceNumber(priceValues[0])}-${formatPriceNumber(
						priceValues[priceValues.length - 1]
					)}`;
		const displayStockQuantity = Number(
			sortedChildren
				.reduce((sum, child) => sum + getAdjustedChildStockQuantity(child), 0)
				.toFixed(2)
		);
		const chartPrice =
			priceValues.length > 0
				? Number(
						(
							priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length
						).toFixed(2)
					)
				: normalizePriceNumber(topChild?.price) || 0;
		const parentRow = {
			...topChild,
			asin_competitor: topChild.parent_asin,
			price: displayPrice,
			stock_quantity: displayStockQuantity,
			_groupKey: key,
			_rowKey: `parent_${key}`,
			_isParentAggregate: true,
			_isChildRow: false,
			_displayPrice: displayPrice,
			_displayStockQuantity: displayStockQuantity,
			_chartPrice: chartPrice
		};
		result.push(parentRow);
		if (expandedParentKeys.value.has(key)) {
			sortedChildren.forEach((child, index) => {
				result.push({
					...child,
					_groupKey: key,
					_rowKey: `child_${key}_${child.id}_${index}`,
					_isParentAggregate: false,
					_isChildRow: true
				});
			});
		}
	}

	return result.sort((a, b) => getMonthlySales(b) - getMonthlySales(a));
});

const handleCompetitorSelectionChange = (val: any[]) => {
	selectedCompetitors.value = val.filter((item) => !item?._isParentAggregate);
};

const bulkAction = async (action: string) => {
	if (!selectedCompetitors.value.length) return;

	let actionText = "";
	let targetStatus = 0;
	if (action === "delete") {
		actionText = "批量删除";
		targetStatus = "8";
	} else if (action === "on_sale") {
		actionText = "移入在售";
		targetStatus = "6";
	} else if (action === "history") {
		actionText = "移入往期";
		targetStatus = "7";
	}

	try {
		await ElMessageBox.confirm(
			`确定要执行【${actionText}】操作吗？（共选了 ${selectedCompetitors.value.length} 条数据）`,
			"确认操作",
			{
				confirmButtonText: "确定",
				cancelButtonText: "取消",
				type: "warning"
			}
		);

		const ids = selectedCompetitors.value.map((item) => item.id);

		// 使用 Promise.all 并发更新状态
		await Promise.all(
			ids.map((id) =>
				service.app.bsr_candidate_competitor.update({
					id: id,
					status: targetStatus
				})
			)
		);

		ElMessage.success(`${actionText}成功`);
		// 清空选择并刷新表格
		selectedCompetitors.value = [];
		if (competitorTableRef.value) {
			competitorTableRef.value.clearSelection();
		}
		loadCompetitorTableData();
	} catch (error: any) {
		if (error !== "cancel") {
			console.error(`${actionText}失败:`, error);
			ElMessage.error(`${actionText}失败，请稍后重试`);
		}
	}
};

const competitorCurrentPage = ref(1);
const competitorPageSize = ref(5);
const paginatedCompetitorData = computed(() => {
	const start = (competitorCurrentPage.value - 1) * competitorPageSize.value;
	const end = start + competitorPageSize.value;
	return groupedCompetitorDisplayData.value.slice(start, end);
});
const competitorTableLoading = ref(false); // 第二个表格的加载状态

const sellerspriteCompetitorLookupLoading = ref(false);
const processStatisticsLoading = ref(false);
const checkingPastPeriod = ref(false);
	const checkingGlobalPastPeriod = ref(false);

const ruleNearly30Days = ref(props.lingxing?.rule_nearly_30_days || null);
const ruleHistoryMonth = ref(props.lingxing?.rule_history_month || null);
const executingHistoryRules = ref(false);

const productCodeInput = ref('');
const savingProductCode = ref(false);

const pad4 = (s: string) => {
	const n = parseInt(s, 10);
	if (isNaN(n)) return s;
	return String(n).padStart(4, '0');
};
const padProductCodeInput = () => {
	const val = productCodeInput.value.trim();
	if (val && /^\d+$/.test(val)) {
		productCodeInput.value = pad4(val);
	}
};
const saveProductCode = async () => {
	padProductCodeInput();
	const val = productCodeInput.value.trim();
	if (!val) {
		ElMessage.warning('请输入编号');
		return;
	}
	if (!/^\d+$/.test(val)) {
		ElMessage.warning('编号必须为纯数字');
		return;
	}
	if (Number(val) < 1 || Number(val) > 9999) {
		ElMessage.warning('编号范围须在 0001~9999 之间');
		return;
	}
	const paddedVal = pad4(val);
	savingProductCode.value = true;
	try {
		const assignRes = await service.app.bsr_product_Listing_Lingxing.assignProductCode({
			id: props.lingxing.id,
			product_code: paddedVal
		});
		props.lingxing.product_code = paddedVal;
		if (assignRes?.local_name) {
			props.lingxing.local_name = assignRes.local_name;
		}
		productCodeInput.value = '';
		ElMessage.success(`编号保存成功，品名已更新为 ${assignRes?.local_name || paddedVal}`);
		fetchProductCodeGaps();
	} catch (error: any) {
		ElMessage.error(error?.message || '保存失败');
	} finally {
		savingProductCode.value = false;
	}
};

const missingProductCodeHint = ref('');
	const fetchProductCodeGaps = async () => {
		try {
			const res = await service.app.bsr_product_Listing_Lingxing.getProductCodes();
			const usedSet = new Set<number>();
			(res || []).forEach((code: string) => {
				const n = Number(code);
				if (n >= 1 && n <= 9999) usedSet.add(n);
			});
			const gaps: string[] = [];
			let gapStart = 0;
			const maxGapRanges = 12;
			for (let i = 1; i <= 9999; i++) {
				if (!usedSet.has(i)) {
					if (gapStart === 0) gapStart = i;
				} else {
					if (gapStart > 0 && gaps.length < maxGapRanges) {
						gaps.push(gapStart === i - 1
							? pad4(String(gapStart))
							: `${pad4(String(gapStart))}-${pad4(String(i - 1))}`);
					}
					gapStart = 0;
				}
				if (gaps.length >= maxGapRanges && gapStart === 0) break;
			}
			if (gapStart > 0 && gaps.length < maxGapRanges) {
				gaps.push(gapStart === 9999
					? pad4(String(gapStart))
					: `${pad4(String(gapStart))}-9999`);
			}
			if (gaps.length > 0) {
				missingProductCodeHint.value = `系统暂无编号：${gaps.join('，')}`;
			} else {
				missingProductCodeHint.value = '';
			}
		} catch (e) {
			missingProductCodeHint.value = '';
		}
	};

	// 当 listing 挂载且无 product_code 时，自动拉取未使用编号提示
	watch(() => props.lingxing, (val) => {
		if (val && !val.product_code) {
			fetchProductCodeGaps();
		}
	}, { immediate: true });

	const saveHistoryRules = async () => {
	try {
		await service.app.bsr_product_Listing_Lingxing.saveHistoryRule({
			product_code: props.lingxing?.product_code,
			rule_nearly_30_days: ruleNearly30Days.value,
			rule_history_month: ruleHistoryMonth.value
		});
		ElMessage.success("保存成功");
	} catch (error: any) {
		ElMessage.error(error?.message || "保存失败");
	}
};

const executeHistoryRules = async () => {
	if (executingHistoryRules.value) return;
	executingHistoryRules.value = true;
	try {
		await service.app.bsr_product_Listing_Lingxing.executeHistoryRule({
			product_code: props.lingxing?.product_code,
			rule_nearly_30_days: ruleNearly30Days.value,
			rule_history_month: ruleHistoryMonth.value
		});
		ElMessage.success("执行成功，正在刷新数据");
		loadCompetitorTableData();
	} catch (error: any) {
		ElMessage.error(error?.message || "执行失败");
	} finally {
		executingHistoryRules.value = false;
	}
};

// ========== 批量获取关键词 ==========
const batchKeywordAsinList = ref<any[]>([]);

const handleBatchKeyword = async () => {
	if (!selectedCompetitors.value.length) {
		ElMessage.warning('请先在竞品列表中勾选ASIN');
		return;
	}

	const seen = new Set<string>();
	batchKeywordAsinList.value = selectedCompetitors.value
		.filter((item) => {
			const asin = (item.asin_competitor || '').trim();
			if (!asin || seen.has(asin)) return false;
			seen.add(asin);
			return true;
		})
		.map((item) => ({
			asin: item.asin_competitor,
			marketplace: item.marketplace || props.lingxing?.marketplace || '-',
			item_name: item.item_name || '-'
		}));

	// ASIN数量不足3个时提示用户
	if (batchKeywordAsinList.value.length < 3) {
		try {
			await ElMessageBox.confirm(
				`当前仅选择了 ${batchKeywordAsinList.value.length} 个竞品ASIN，建议至少选择3个以获得更准确的流量得分。是否继续？`,
				'竞品ASIN数量不足',
				{ type: 'warning', confirmButtonText: '继续', cancelButtonText: '返回选择' }
			);
		} catch {
			return; // 用户点取消
		}
	}

	// 打开结果面板
	batchKeywordResultVisible.value = true;
};
	// 往期检测：检测往期(status=7)竞品中当前月份有销量的，移入在售(status=6)
	const handlePastPeriodCheck = async () => {
		if (checkingPastPeriod.value) return;
		checkingPastPeriod.value = true;
		try {
			const productCode = props.lingxing?.product_code;
			const asin = props.lingxing?.asin;
			const marketplace = props.lingxing?.marketplace;
			if (!marketplace) {
				ElMessage.warning('未获取到国家信息');
				return;
			}
			const now = new Date();
			const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
			const allAsinsQuery: any = { marketplace, size: 1000 };
			if (productCode) {
				allAsinsQuery.product_code = productCode;
			} else {
				allAsinsQuery.asin = asin;
			}
			const allAsinsRes = await service.app.bsr_product_Listing_Lingxing.page(allAsinsQuery);
			const currentAsins = allAsinsRes.list
				.filter((item: any) => item.asin)
				.map((item: any) => item.asin);
			if (!currentAsins.length) {
				ElMessage.warning('没有关联的ASIN');
				return;
			}
			const historyRes = await service.app.bsr_candidate_competitor.page({
				asin_candidate: currentAsins,
				marketplace,
				status: [LINGXING_COMPETITOR_STATUS.HISTORY.value],
				size: 1000
			});
			const historyList = historyRes.list || [];
			if (!historyList.length) {
				ElMessage.info('没有往期竞品数据');
				return;
			}
			const toMove: any[] = [];
			historyList.forEach((item: any) => {
				const salesData = item.sales_volume_data;
				if (salesData && Array.isArray(salesData)) {
					const currentMonthData = salesData.find((d: any) => {
						const dateStr = String(d.date || '');
						return dateStr.startsWith(currentMonth);
					});
					if (currentMonthData && Number(currentMonthData.searches) > 0) {
						toMove.push(item);
					}
				}
			});
			if (!toMove.length) {
				ElMessage.info(`往期竞品中，当前月份（${currentMonth}）均无销量数据`);
				return;
			}
			await ElMessageBox.confirm(
				`检测到 ${toMove.length} 个往期竞品在当前月份（${currentMonth}）有销量数据，是否移入在售？`,
				'往期检测结果',
				{ confirmButtonText: '确定移入在售', cancelButtonText: '取消', type: 'warning' }
			);
			await Promise.all(
				toMove.map((item: any) =>
					service.app.bsr_candidate_competitor.update({
						id: item.id,
						status: LINGXING_COMPETITOR_STATUS.ON_SALE.value
					})
				)
			);
			ElMessage.success(`成功将 ${toMove.length} 个竞品移入在售`);
			loadCompetitorTableData();
		} catch (error: any) {
			if (error !== 'cancel') {
				console.error('往期检测失败:', error);
				ElMessage.error(error?.message || '往期检测失败');
			}
		} finally {
			checkingPastPeriod.value = false;
		}
	};
	// 全局往期检测：对所有往期(status=7)竞品执行检测，有当月销量的移入在售(status=6)
	const handleGlobalPastPeriodCheck = async () => {
		if (checkingGlobalPastPeriod.value) return;
		try {
			await ElMessageBox.confirm(
				'将对所有往期竞品进行检测，当前月份有销量数据的将移入在售。是否继续？',
				'全局往期检测',
				{ confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
			);
		} catch {
			return;
		}
		checkingGlobalPastPeriod.value = true;
		try {
			const res = await service.app.bsr_candidate_competitor.checkPastPeriodAndMove();
			ElMessage.success(res.message || `成功将 ${res.count} 个竞品移入在售`);
			loadCompetitorTableData();
		} catch (error: any) {
			console.error('全局往期检测失败:', error);
			ElMessage.error(error?.message || '全局往期检测失败');
		} finally {
			checkingGlobalPastPeriod.value = false;
		}
	};


const batchKeywordResultVisible = ref(false);



const sellerspriteAsins = computed(() => {
	const raw = competitorTableData.value
		.map((row) => (row?.asin_competitor || "").trim())
		.filter(Boolean);
	return Array.from(new Set(raw));
});

const sellerspriteAsinsCount = computed(() => sellerspriteAsins.value.slice(0, 40).length);

const sellerspriteCompetitorLookup = async () => {
	if (sellerspriteCompetitorLookupLoading.value) return;

	const asinsAll = sellerspriteAsins.value;
	if (asinsAll.length === 0) {
		ElMessage.warning("暂无竞品ASIN，无法获取卖家精灵数据");
		return;
	}

	const marketplace = props.lingxing?.marketplace || competitorTableData.value?.[0]?.marketplace;
	if (!marketplace) {
		ElMessage.warning("未获取到国家信息，无法获取卖家精灵数据");
		return;
	}

	const asins = asinsAll.slice(0, 40);
	if (asinsAll.length > 40) {
		ElMessage.warning(`ASIN最多支持40个，已自动截取前40个（当前${asinsAll.length}个）`);
	}

	sellerspriteCompetitorLookupLoading.value = true;
	try {
		await service.app.amazon_product_Listing_Lingxing.sellerspriteCompetitorLookup({
			marketplace,
			asins
		});
		ElMessage.success("已请求后台打印卖家精灵竞品数据");

		// 刷新表格数据
		loadCompetitorTableData();
	} catch (error: any) {
		console.error("卖家精灵竞品数据获取失败:", error);
		ElMessage.error(error?.message || "卖家精灵竞品数据获取失败");
	} finally {
		sellerspriteCompetitorLookupLoading.value = false;
	}
};

const loadCompetitorTableData = async () => {
	competitorTableLoading.value = true;
	try {
		// 清空已选中的项
		selectedCompetitors.value = [];
		expandedParentKeys.value = new Set();
		competitorCurrentPage.value = 1;
		if (competitorTableRef.value) {
			competitorTableRef.value.clearSelection();
		}

		// 1. 获取点击进来的ASIN（来源：props传递的点击参数）
		const targetAsin = props.lingxing?.asin;
		if (!targetAsin) {
			competitorTableData.value = [];
			ElMessage.warning("未获取到目标ASIN，无法查询竞品");
			return;
		}

		const productCode = props.lingxing?.product_code;
		const allAsinsQuery: any = {
			marketplace: props.lingxing?.marketplace,
			size: 1000
		};
		if (productCode) {
			allAsinsQuery.product_code = productCode;
		} else {
			allAsinsQuery.asin = targetAsin;
		}
		const allAsinsRes = await service.app.bsr_product_Listing_Lingxing.page(allAsinsQuery);

		// 提取所有有效的ASIN
		const currentAsins = allAsinsRes.list
			.filter((item) => item.asin) // 过滤无效ASIN
			.map((item) => item.asin); // 组成ASIN数组

		if (currentAsins.length === 0) {
			competitorTableData.value = [];
			ElMessage.info(`编号【${productCode || targetAsin}】下没有关联的ASIN`);
			return;
		}

		// 4. 用所有关联的ASIN查询竞品数据
		// 根据当前选中的Tab决定查询的状态
		let statusList = [
			LINGXING_COMPETITOR_STATUS.ON_SALE.value,
			LINGXING_COMPETITOR_STATUS.CANDIDATE_COMPETITOR.value
		];
		if (activeTab.value === "on_sale") {
			statusList = [
				LINGXING_COMPETITOR_STATUS.ON_SALE.value,
				LINGXING_COMPETITOR_STATUS.CANDIDATE_COMPETITOR.value
			];
		} else if (activeTab.value === "history") {
			statusList = [LINGXING_COMPETITOR_STATUS.HISTORY.value];
		} else if (activeTab.value === "pending") {
			statusList = [LINGXING_COMPETITOR_STATUS.PENDING.value];
		} else if (activeTab.value === "recycle") {
			statusList = [LINGXING_COMPETITOR_STATUS.RECYCLE.value];
		}

		const competitorRes = await service.app.bsr_candidate_competitor.page({
			asin_candidate: currentAsins,
			marketplace: props.lingxing?.marketplace,
			status: statusList, // 6:在售  7:往期数据  5：待定 2:选品的竞品
			size: 1000
		});

		// 2025-02-18: Sort by Main_monthly_sales descending
		const list = competitorRes.list || [];
		list.sort((a: any, b: any) => {
			const salesA = Number(a.Main_monthly_sales) || 0;
			const salesB = Number(b.Main_monthly_sales) || 0;
			return salesB - salesA;
		});

		// 2026-03-19: Deduplicate by asin_competitor + marketplace (Show only 1 entry)
		const uniqueListMap = new Map();
		list.forEach((item: any) => {
			const key = `${item.asin_competitor}_${item.marketplace}`;
			if (!uniqueListMap.has(key)) {
				uniqueListMap.set(key, item);
			}
		});
		const uniqueList = Array.from(uniqueListMap.values());

		competitorTableData.value = uniqueList;
	} catch (error) {
		console.error("获取竞品数据失败:", error);
		competitorTableData.value = [];
		ElMessage.error("获取竞品数据失败，请稍后重试");
	} finally {
		competitorTableLoading.value = false;
	}
};

const activeTab = ref("on_sale");

const handleTabChange = () => {
	expandedParentKeys.value = new Set();
	competitorCurrentPage.value = 1;
	loadCompetitorTableData();
};

const filters = ref({
	status: [],
	marketplace: [],
	sale_analyze: [],
	volume_analyze_result: [],
	price_analyze_result: [],
	arrival_analyze_result: []
});
const statusOptions = [
	{ label: "停售", value: "0" },
	{ label: "在售", value: "1" },
	{ label: "已删除", value: "2" }
];

const saleAnalyzeOptions = [{ label: "异常停售", value: "1" }];

const marketplaceOptions = [
	{ label: "英国", value: "英国" },
	{ label: "德国", value: "德国" },
	{ label: "法国", value: "法国" },
	{ label: "西班牙", value: "西班牙" },
	{ label: "意大利", value: "意大利" }
];

const volumeAnalyzeOptions = [
	{ label: "无数据", value: "0" },
	{ label: "正常补货", value: "3" },
	{ label: "库存过多", value: "4" },
	{ label: "未定义", value: "6" },
	{ label: "到货超过7天无销量，运营处理", value: "7" },
	{ label: "老品到货无销量", value: "8" },
	{ label: "新品到货无销量", value: "9" },
	{ label: "流量有问题且库存过多", value: "10" },
	{ label: "流量货价格有问题,BSR<500，销量未进前五", value: "11" },
	{ label: "库存过多,BSR<500，销量进前五", value: "12" },
	{ label: "流量有问题，BSR>500", value: "13" },
	{ label: "流量有问题，BSR>3000", value: "14" },
	{ label: "新品在途", value: "15" },
	{ label: "到货超过14天无销量", value: "16" },
	{ label: "到货超过30天无销量", value: "17" }
];

const priceAnalyzeOptions = [
	{ label: "未定义", value: "-1" },
	{ label: "市场最低", value: "0" },
	{ label: "前十最低", value: "1" },
	{ label: "价格第二低", value: "2" },
	{ label: "价格第三低", value: "3" },
	{ label: "价格第四低", value: "4" },
	{ label: "价格第五低", value: "5" },
	{ label: "价格第六低", value: "6" },
	{ label: "价格第七低", value: "7" },
	{ label: "价格第八低", value: "8" },
	{ label: "价格第九低", value: "9" },
	{ label: "价格第十低", value: "10" },
	{ label: "价格高于前十", value: "11" }
];

const arrivalanalyzeOptions = [
	{ label: "新品在途", value: "0" },
	{ label: "新品到货1天", value: "1" },
	{ label: "新品到货2天", value: "2" },
	{ label: "新品到货3天", value: "3" },
	{ label: "新品到货4天", value: "4" },
	{ label: "新品到货5天", value: "5" },
	{ label: "新品到货6天", value: "6" },
	{ label: "新品到货7天", value: "7" },
	{ label: "新品到货超过7天", value: "8" },
	{ label: "老品到货1天", value: "11" },
	{ label: "老品到货2天", value: "12" },
	{ label: "老品到货3天", value: "13" },
	{ label: "老品到货4天", value: "14" },
	{ label: "老品到货5天", value: "15" },
	{ label: "老品到货6天", value: "16" },
	{ label: "老品到货7天", value: "17" },
	{ label: "新品在售", value: "28" },
	{ label: "老品在售", value: "38" },
	{ label: "新品到货1234567天", value: "-1" },
	{ label: "老品到货1234567天", value: "-2" },
	{ label: "新品断货到货1234567天", value: "-3" },
	{ label: "老品断货到货1234567天", value: "-4" }
];

// 修复筛选条件传递空IN的问题
const handleFilterChange = (filterType: string, value: string[]) => {
	// 更新筛选条件：空数组设为undefined
	filters.value[filterType as keyof typeof filters.value] = value.length > 0 ? value : undefined;

	// 构建清理后的请求参数（过滤空值）
	const requestParams = Object.entries(filters.value).reduce(
		(acc, [key, val]) => {
			if (val !== undefined && val !== null && (Array.isArray(val) ? val.length > 0 : true)) {
				acc[key] = val;
			}
			return acc;
		},
		{} as Record<string, any>
	);

	// 触发刷新
	Crud.value?.refresh(requestParams);
};

// Helper to parse price
const parsePrice = (priceStr: string | number): number => {
	if (typeof priceStr === "number") return priceStr;
	if (!priceStr) return 0;
	let s = String(priceStr).replace(/[^\d.,]/g, ""); // Remove currency symbols and spaces
	// Check for comma decimal separator (e.g. "19,99" or "1.234,56")
	if (s.includes(",") && !s.includes(".")) {
		s = s.replace(",", ".");
	} else if (s.includes(",") && s.includes(".")) {
		// "1,234.56" -> remove comma
		if (s.indexOf(",") < s.indexOf(".")) {
			s = s.replace(/,/g, "");
		} else {
			// "1.234,56" -> remove dot, replace comma
			s = s.replace(/\./g, "").replace(",", ".");
		}
	}
	return parseFloat(s) || 0;
};

// Helper to get currency symbol
const getCurrencySymbol = (marketplace: string) => {
	if (!marketplace) return "€"; // Default to Euro as per image
	const mp = marketplace.toLowerCase();
	if (mp.includes("英") || mp.includes("uk")) return "£";
	if (mp.includes("us") || mp.includes("com")) return "$";
	// Add more if needed, default to € for EU
	return "€";
};

const generateMonthlySalesChartOption = (
	salesData: any[],
	price: string | number,
	marketplace: string
) => {
	if (!salesData || !Array.isArray(salesData)) return {};

	// Sort by date just in case
	const data = [...salesData].sort((a, b) => String(a.date).localeCompare(String(b.date)));

	const currency = getCurrencySymbol(marketplace);
	const priceNum = parsePrice(price);

	const xData = data.map((item) => {
		const d = String(item.date);
		// Format YYYYMM or YYYYMMDD to YYYY年MM月
		if (d.length >= 6) {
			return `${d.substring(0, 4)}年${d.substring(4, 6)}月`;
		}
		return d;
	});

	const yData = data.map((item) => Number(item.searches || 0)); // Assuming searches is sales volume

	return {
		tooltip: {
			trigger: "axis",
			// confine: true, // Removed to avoid tooltip being pushed back onto the chart
			appendToBody: true,
			position: function (point: any) {
				// Display to the right and above to avoid obscuring the chart line
				// point is [x, y] of the mouse
				return [point[0] + 50, point[1] - 100];
			},
			backgroundColor: "rgba(50, 50, 50, 0.9)", // Dark background like image
			borderColor: "#333",
			textStyle: {
				color: "#fff"
			},
			formatter: (params: any) => {
				const p = params[0];
				if (!p) return "";
				const index = p.dataIndex;
				const item = data[index];
				const volume = Number(item.searches || 0);
				const amount = (volume * priceNum).toLocaleString("en-US", {
					maximumFractionDigits: 0
				});
				const dateStr = p.axisValue;

				return `
					<div style="font-size: 12px; line-height: 1.5;">
						<div style="margin-bottom: 4px;">${dateStr}</div>
						<div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
							<div>
								<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:#ff9900;margin-right:4px;"></span>
								当月销量
							</div>
							<div style="font-weight: bold;">${volume}</div>
						</div>
						<div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
							<div>
								<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:#409EFF;margin-right:4px;"></span>
								月销售额
							</div>
							<div style="font-weight: bold;">${currency}${amount}</div>
						</div>
					</div>
				`;
			}
		},
		grid: {
			left: 0,
			right: 0,
			top: 5,
			bottom: 0,
			containLabel: false
		},
		xAxis: {
			type: "category",
			data: xData,
			show: false, // Hide axis
			boundaryGap: false
		},
		yAxis: {
			type: "value",
			show: false, // Hide axis
			min: 0
		},
		series: [
			{
				data: yData,
				type: "line",
				smooth: true,
				showSymbol: false,
				lineStyle: {
					width: 1,
					color: "#ff9900" // Orange line
				},
				areaStyle: {
					color: {
						type: "linear",
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{
								offset: 0,
								color: "rgba(255, 153, 0, 0.3)" // Orange gradient
							},
							{
								offset: 1,
								color: "rgba(255, 153, 0, 0.05)"
							}
						]
					}
				},
				itemStyle: {
					color: "#ff9900"
				}
			}
		]
	};
};

const competitorData = ref<Record<string, any[]>>({});
const competitorDataLoading = ref(false);
const competitorDataError = ref("");
const marketAnalysisRow = ref<any>(null);

const marketAnalysisTableData = computed(() => {
	if (!marketAnalysisRow.value) return [];
	return competitorData.value[marketAnalysisRow.value.id] || [];
});

const loadCompetitorData = async (row: any) => {
	// 如果已加载过，不再重复加载
	// if (competitorData.value[row.id]) return;

	competitorDataLoading.value = true;
	competitorDataError.value = "";

	try {
		// 调用服务获取竞争数据
		// 2025-01-28: Modified to fetch by product_code (unify same product data) or fallback to asin
		const queryParams: any = {
			marketplace: row.marketplace,
			size: 200
		};

		if (row.product_code) {
			queryParams.product_code = row.product_code;
		} else {
			queryParams.asin_candidate = row.asin;
		}

		const response = await service.app.amazon_product_competitor_statistics.page(queryParams);

		// 2025-01-28: Deduplicate by crawler_time to avoid duplicate rows for same product_code
		// Prioritize records with data (non-empty units_top_15) if duplicates exist
		const rawList = response.list || [];
		const uniqueMap = new Map();

		rawList.forEach((item: any) => {
			const time = item.crawler_time;
			const isItemValid = item.units_top_15 || item.price_lowest; // Simple validation

			if (!uniqueMap.has(time)) {
				uniqueMap.set(time, item);
			} else {
				const existing = uniqueMap.get(time);
				const isExistingValid = existing.units_top_15 || existing.price_lowest;
				// If existing is "blank" and new item is valid, replace it
				if (!isExistingValid && isItemValid) {
					uniqueMap.set(time, item);
				}
			}
		});

		// Convert back to array and sort by time descending
		competitorData.value[row.id] = Array.from(uniqueMap.values()).sort((a: any, b: any) => {
			return (b.crawler_time || "").localeCompare(a.crawler_time || "");
		});
	} catch (error: any) {
		console.error("加载竞争数据失败:", error);
		competitorDataError.value = error.message || "未知错误";
	} finally {
		competitorDataLoading.value = false;
	}
};

const handleMarketAnalysisSelectionChange = (rows: any[]) => {
	const lastRow = rows?.[rows.length - 1];
	marketAnalysisRow.value = lastRow || null;
	if (lastRow) {
		loadCompetitorData(lastRow);
	}
};

// 2026-03-02
const getFbaInventoryDisplay = (marketplace: string, row: any) => {
	if (!marketplace) return "";

	let display = "";
	switch (marketplace.toUpperCase()) {
		case "英国":
			display = `${row.units_30_sum_fba_uk || "0|0"}`;
			break;
		case "德国":
			display = `${row.units_30_sum_fba_de || "0|0"}`;
			break;
		case "法国":
			display = `${row.units_30_sum_fba_fr || "0|0"}`;
			break;
		case "意大利":
			display = `${row.units_30_sum_fba_it || "0|0"}`;
			break;
		case "西班牙":
			display = `${row.units_30_sum_fba_es || "0|0"}`;
			break;
		default:
			display = "";
	}

	if (!display) return "";
	const [salesStr, stockStr] = display.split("|");
	const ratio = getInventorySalesRatio(Number(salesStr) || 0, Number(stockStr) || 0);
	return `${display}|${ratio}`;
};

// 2026-03-02
const getFbaInventoryStats = (marketplace: string, row: any) => {
	const display = getFbaInventoryDisplay(marketplace, row);
	const [salesStr, stockStr] = display.split("|");
	return {
		sales: Number(salesStr) || 0,
		stock: Number(stockStr) || 0
	};
};

const getCompanyInventoryStats = (row: any) => {
	return {
		sales: Number(row.company_units_30_sum) || 0,
		stock: Number(row.company_inventory_sum) || 0
	};
};

const getCompanyInventoryDisplay = (row: any) => {
	const stats = getCompanyInventoryStats(row);
	return `${stats.sales}|${stats.stock}|${getInventorySalesRatio(stats.sales, stats.stock)}`;
};

const getInventorySalesRatio = (sales: number, stock: number) => {
	if (!sales || sales <= 0) return "-";
	return (stock / sales).toFixed(2);
};

const updateCompetitorStatisticsData = async () => {
	// 获取表格中的所有数据
	const tableData = Table.value?.data || [];
	if (tableData.length === 0) {
		ElMessage.warning("没有可更新的数据");
		return;
	}

	// 过滤出有必要字段的数据（避免无效数据）
	const validItems = tableData.filter((item) => item.asin && item.marketplace);

	if (validItems.length === 0) {
		ElMessage.warning("所选数据中缺少有效的ASIN或站点信息");
		return;
	}

	// 显示确认对话框
	const confirmResult = await ElMessageBox.confirm(
		`即将更新 ${validItems.length} 条数据的市场分析信息，是否继续？`,
		"确认更新",
		{
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning"
		}
	).catch(() => false);

	if (confirmResult !== "confirm") {
		return; // 用户取消操作
	}

	// 显示加载动画
	const loading = ElLoading.service({
		lock: true,
		text: "正在批量更新市场分析数据...",
		background: "rgba(0, 0, 0, 0.7)"
	});

	try {
		// 只调用一次接口，传递所有有效的ASIN和marketplace
		const result =
			await service.app.amazon_product_competitor_statistics.updateCompetitorStatisticsData({
				items: validItems.map((item) => ({
					asin_candidate: item.asin,
					marketplace: item.marketplace
				}))
			});

		// 显示结果提示
		if (result.success) {
			ElMessage.success(`更新成功：${result.message}`);
		} else {
			ElMessage.error(`更新失败：${result.message}`);
		}

		// 刷新表格和竞品数据
		Crud.value?.refresh();
		loadCompetitorTableData();
	} catch (error: any) {
		ElMessage.error(`更新出错：${error.message || "未知错误"}`);
		console.error("批量更新市场分析数据失败：", error);
	} finally {
		// 关闭加载动画
		loading.close();
	}
};

const manualProcessLoading = ref(false);

const handleManualProcess = async (id: number) => {
	if (manualProcessLoading.value) return;

	try {
		await ElMessageBox.confirm(
			"确定要手动获取该编号的八爪鱼识图数据吗？这可能需要几分钟时间。",
			"确认操作",
			{
				confirmButtonText: "确定",
				cancelButtonText: "取消",
				type: "warning"
			}
		);

		manualProcessLoading.value = true;
		const loadingInstance = ElLoading.service({
			lock: true,
			text: "正在获取八爪鱼数据，请稍候...",
			background: "rgba(0, 0, 0, 0.7)"
		});

		try {
			// @ts-ignore
			const res = await service.app.amazon_product_Listing_Lingxing.manualProcessSingleItem({
				id
			});
			ElMessage.success(res.message || "获取成功");

			// 刷新相关数据
			loadProcessTableData();
			loadCompetitorTableData();
			Crud.value?.refresh();
		} catch (err: any) {
			console.error(err);
			ElMessage.error(err.message || "操作失败");
		} finally {
			loadingInstance.close();
		}
	} catch (e) {
		// 取消操作
	} finally {
		manualProcessLoading.value = false;
	}
};

const updateCompetitorStatisticsDataFromProcess = async () => {
	if (processStatisticsLoading.value) return;

	const productCode = props.lingxing?.product_code;
	const targetAsin = props.lingxing?.asin;
	const marketplace = props.lingxing?.marketplace;
	const effectiveCode = productCode || targetAsin;

	if (!effectiveCode || !marketplace) {
		ElMessage.warning("未获取到编号或ASIN或站点信息，无法执行");
		return;
	}

	const confirmResult = await ElMessageBox.confirm(
		`即将按编号【${effectiveCode}】更新市场分析数据，是否继续？`,
		"确认更新",
		{
			confirmButtonText: "确定",
			cancelButtonText: "取消",
			type: "warning"
		}
	).catch(() => false);

	if (confirmResult !== "confirm") {
		return;
	}

	processStatisticsLoading.value = true;
	const loading = ElLoading.service({
		lock: true,
		text: "正在按编号更新市场分析数据...",
		background: "rgba(0, 0, 0, 0.7)"
	});

	try {
		const result =
			await service.app.amazon_product_competitor_statistics.updateCompetitorStatisticsDataFromProcess(
				{
					product_codes: [effectiveCode],
					marketplace
				}
			);

		if (result.success) {
			ElMessage.success(`更新成功：${result.message}`);
		} else {
			ElMessage.error(`更新失败：${result.message}`);
		}

		Crud.value?.refresh();
		if (marketAnalysisRow.value) {
			loadCompetitorData(marketAnalysisRow.value);
		}
	} catch (error: any) {
		ElMessage.error(`更新出错：${error.message || "未知错误"}`);
		console.error("按编号更新市场分析数据失败：", error);
	} finally {
		loading.close();
		processStatisticsLoading.value = false;
	}
};

// 保留图片/标题数据（用于按钮旁展示，删除了loading相关）
const processTableData = ref<any[]>([]);
// 加载图片/标题数据（移除了processTableLoading相关逻辑）
const loadProcessTableData = async () => {
	try {
		// 1. 获取点击进来的ASIN/product_code
		const targetAsin = props.lingxing?.asin;
		const product_code = props.lingxing?.product_code;
		const marketplace = props.lingxing?.marketplace;

		if (!product_code && !targetAsin) {
			processTableData.value = [];
			ElMessage.warning("未获取到编号或ASIN，无法查询图片/标题数据");
			return;
		}

		// 2. 获取主表关联的所有ASIN
		const listingQuery: any = {
			marketplace,
			size: 1000
		};
		if (product_code) {
			listingQuery.product_code = product_code;
		} else {
			listingQuery.asin = targetAsin;
		}
		const allAsinsRes = await service.app.bsr_product_Listing_Lingxing.page(listingQuery);

		// 提取所有有效的ASIN
		const currentAsins = allAsinsRes.list.filter((item) => item.asin).map((item) => item.asin);

		if (currentAsins.length === 0) {
			processTableData.value = [];
			ElMessage.info(`编号【${product_code || targetAsin}】下没有关联的ASIN`);
			return;
		}

		// 3. 调用接口查询图片/标题数据
		const processQuery: any = { size: 1 };
		if (product_code) {
			processQuery.product_code = product_code;
		} else {
			processQuery.asin = targetAsin;
		}
		const processRes = await service.app.bsr_product_Listing_Lingxing_process.page(processQuery);

		processTableData.value = processRes.list || [];

		// 格式化图片地址
		processTableData.value.forEach((item) => {
			item.image_url_display = convert_image_url(item.image_url);
		});

		// 4. 关联数据到主表格行
		if (Table.value?.data) {
			const processMap = new Map();
			processRes.list.forEach((item) => {
				processMap.set(`${item.asin}_${item.marketplace}`, item);
			});

			Table.value.data.forEach((row) => {
				row.processData = processMap.get(`${row.asin}_${row.marketplace}`) || null;
			});
		}
	} catch (error) {
		console.error("获取图片/标题数据失败:", error);
		processTableData.value = [];
		// ElMessage.error("获取图片/标题数据失败，请稍后重试");
	}
};

// 预览当前展示的图片和标题
const handlePreviewCurrentImageAndTitle = () => {
	if (processTableData.value.length === 0) {
		ElMessage.warning("暂无图片/标题数据可预览");
		return;
	}
	// 可自定义预览逻辑（如弹窗放大展示）
	ElMessage.info(`当前标题：${processTableData.value[0].item_name}`);
};

// 处理设置识图图片（无数据全复制新增，有数据仅更新图片字段）
const handleSetImageForSearch = async (row: any, imgIndex = 1) => {
	try {
		// 获取对应图片地址
		const imgKey = `image_url${imgIndex === 1 ? "" : imgIndex}`;
		const targetImageUrl = row[imgKey];
		if (!targetImageUrl) {
			ElMessage.warning("该图片地址为空，无法设置为识图图片");
			return;
		}

		// 弹出确认框
		const confirmResult = await ElMessageBox.confirm(
			`是否将该图片设置为以图识图对比图片？`,
			"确认设置识图图片",
			{
				confirmButtonText: "确定",
				cancelButtonText: "取消",
				type: "warning"
			}
		).catch(() => false);

		if (confirmResult !== "confirm") return;

		// 查询是否已有对应记录
		// 2026-04-24 修改：只根据 product_code 查询，确保一个 product_code 只有一条记录被更新，避免产生多条数据
		const processRes = await service.app.bsr_product_Listing_Lingxing_process.page({
			// asin: row.asin,
			// marketplace: row.marketplace,
			...(row.product_code ? { product_code: row.product_code } : { asin: row.asin }),
			size: 1
		});

		const processData = processRes.list?.[0];

		// 场景1：无数据 - 复制整行所有字段新增
		if (!processData) {
			const fullRecordData = {
				asin: row.asin,
				marketplace: row.marketplace,
				product_code: row.product_code,
				image_url: targetImageUrl,
				item_name: row.item_name,
				price: row.price,
				total_volume: row.total_volume,
				image_state: 1,
				isUpload: 0,
				cont_sign: "",
				rank: [], // 默认空数组，避免rank字段缺失报错
				small_rank: [], // 默认空数组，避免small_rank字段缺失报错
				updateTime: new Date(),
				createTime: new Date()
				// 其他所有需要复制的字段，沿用原行数据
			};
			await service.app.bsr_product_Listing_Lingxing_process.add(fullRecordData);
			ElMessage.success("识图图片新增成功（已复制整行数据）");
		}
		// 场景2：有数据 - 仅更新图片字段，其他字段保持不变
		else {
			await service.app.bsr_product_Listing_Lingxing_process.update({
				id: processData.id,
				image_url: targetImageUrl, // 仅更新图片
				image_state: 1, // 重置状态，触发重新对比
				updateTime: new Date() // 仅更新时间
				// 不修改其他任何字段，沿用原有值
			});
			ElMessage.success("识图图片更新成功（仅修改图片字段）");
		}

		// 刷新图片/标题数据
		loadProcessTableData();
	} catch (error: any) {
		console.error("设置识图图片失败:", error);
		ElMessage.error(`设置失败：${error.message || "未知错误"}`);
	}
};

// 处理设置搜索页对比标题（无数据全复制新增，有数据仅更新标题字段）
const handleSetTitleForSearch = async (row: any) => {
	try {
		const targetTitle = row.item_name;
		if (!targetTitle) {
			ElMessage.warning("该品名为空，无法设置为对比标题");
			return;
		}

		// 弹出确认框
		const confirmResult = await ElMessageBox.confirm(
			`是否将该标题设置为搜索页标题对比关键字？`,
			"确认设置对比标题",
			{
				confirmButtonText: "确定",
				cancelButtonText: "取消",
				type: "warning"
			}
		).catch(() => false);

		if (confirmResult !== "confirm") return;

		// 查询是否已有对应记录
		// 2026-05-08 修改：优先 product_code，无则用 asin
		const processQuery2: any = { size: 1 };
		if (row.product_code) {
			processQuery2.product_code = row.product_code;
		} else {
			processQuery2.asin = row.asin;
		}
		const processRes = await service.app.bsr_product_Listing_Lingxing_process.page(processQuery2);

		const processData = processRes.list?.[0];

		// 场景1：无数据 - 复制整行所有字段新增
		if (!processData) {
			const fullRecordData = {
				asin: row.asin,
				marketplace: row.marketplace,
				product_code: row.product_code,
				image_url: row.image_url || "",
				item_name: targetTitle,
				price: row.price,
				total_volume: row.total_volume,
				image_state: 1,
				isUpload: 0,
				cont_sign: "",
				rank: [], // 默认空数组，避免rank字段缺失报错
				small_rank: [], // 默认空数组，避免small_rank字段缺失报错
				updateTime: new Date(),
				createTime: new Date()
				// 其他所有需要复制的字段，沿用原行数据
			};
			await service.app.bsr_product_Listing_Lingxing_process.add(fullRecordData);
			ElMessage.success("对比标题新增成功（已复制整行数据）");
		}
		// 场景2：有数据 - 仅更新标题字段，其他字段保持不变
		else {
			await service.app.bsr_product_Listing_Lingxing_process.update({
				id: processData.id,
				item_name: targetTitle, // 仅更新标题
				image_state: 1, // 重置状态，触发重新对比
				updateTime: new Date() // 仅更新时间
				// 不修改其他任何字段，沿用原有值
			});
			ElMessage.success("对比标题更新成功（仅修改标题字段）");
		}

		// 刷新图片/标题数据
		loadProcessTableData();
	} catch (error: any) {
		console.error("设置对比标题失败:", error);
		ElMessage.error(`设置失败：${error.message || "未知错误"}`);
	}
};
</script>
<style scoped>
.normal-scroll-container {
	height: 100vh;
	width: 100%;
	overflow-y: auto;
	scroll-behavior: smooth;
}

.data-section {
	width: 100%;
	display: flex;
	flex-direction: column;
	padding: 10px;
	box-sizing: border-box;
}

.chart-section-wrapper {
	height: 100vh;
	margin-top: 10px;
}

:deep(.cl-crud) {
	padding: 0 !important;
	height: auto !important;
	display: block !important;
	overflow: visible !important; /* Allow internal scrolling if needed, but normally cl-crud manages it */
}

/* 强制隐藏抽屉溢出，使滚动条完全贴边 */
:deep(.el-drawer) {
	--el-drawer-padding-primary: 0 !important;
}
:deep(.el-drawer__body) {
	padding: 0 !important;
	margin: 0 !important;
	overflow: hidden !important;
}
:deep(.el-drawer__header) {
	display: none !important;
	padding: 0 !important;
	margin: 0 !important;
}

:deep(.el-table .el-table__row) {
	height: 15px !important;
}

:deep(.el-table .el-table__cell) {
	padding: 4px 12px !important;
}

:deep(.el-table .el-table__cell .cl-image) {
	width: 15px !important;
	height: 15px !important;
}

:deep(.el-table--border.stripe .el-table__row) {
	height: 15px !important;
}

:deep(.market-analysis-popover .el-table .el-table__row) {
	height: 32px !important;
}

:deep(.market-analysis-popover .el-table .el-table__cell) {
	padding: 2px 8px !important;
}

:deep(.el-popover .el-popover__content) {
	padding: 5px !important;
}

:deep(.el-table .warning-row) {
	--el-table-tr-bg-color: var(--el-color-warning-light-9);
}

:deep(.el-table .competitor-parent-row > td) {
	background-color: #ecf5ff !important;
	font-weight: 600;
}

:deep(.el-table .competitor-parent-expanded-row > td) {
	border-bottom: 1px solid #b3d8ff;
}

:deep(.el-table .competitor-child-row > td) {
	background-color: #f8f9fb !important;
}
</style>
