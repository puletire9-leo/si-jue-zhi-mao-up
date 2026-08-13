<template>
	<cl-crud ref="Crud">
		<cl-row>
			<cl-refresh-btn />
			<cl-multi-delete-btn />

			<batch-update-bsr-candidate-status :Crud="Crud" />

			<batch-open-dp-link :Crud="Crud" />

			<cl-flex1 />

			<el-space direction="horizontal">
				<el-text>仅展示待精选</el-text>
				<el-switch
					v-model="showOnlyStatusLibrary"
					active-text="是"
					inactive-text="否"
					inline-prompt
				></el-switch>
				<el-divider direction="vertical"></el-divider>
			</el-space>

			<bsr-candidate-filter-status />

			<cl-search-key placeholder="模糊搜索" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-variantName="{ scope }">
					<div class="marketplace-needs">
						<span
							v-for="(variant, index) in getVariantDisplay(scope.row)"
							:key="index"
							class="country-flag"
						>
							{{ variant.name }}
							<span :class="variant.has ? 'success' : 'error'">{{
								variant.has ? "✅" : "❌"
							}}</span>
						</span>
					</div>
				</template>

				<template #column-marketplaceNeeds="{ scope }">
					<div class="marketplace-needs">
						<span
							v-for="(flag, country) in parseMarketplaceNeeds(
								scope.row.marketplaceNeeds
							)"
							:key="country"
							:class="['country-flag', { active: flag === '1' }]"
						>
							{{ country }}:{{ flag === "1" ? "✅" : "❌" }}
						</span>
					</div>
				</template>

				<template #column-asin="{ scope }">
					<div class="date-cell">
						<div class="asin-value">{{ scope.row.asin }}</div>
						<!-- 状态标签 -->
						<br />
						<div v-if="scope.row.source === 1" class="status-tag status-tag--close">
							数
						</div>
						<div
							v-else-if="scope.row.source === 2"
							class="status-tag status-tag--compete"
						>
							1688
						</div>
						<div
							v-else-if="scope.row.source === 3"
							class="status-tag status-tag--compete"
						>
							变
						</div>
						<div
							v-else-if="scope.row.source === 4"
							class="status-tag status-tag--success"
						>
							季
						</div>
					</div>
				</template>

				<template #column-bsr_link="{ scope }">
					<cl-table-column-bsr-link :bsr_link="scope.row.bsr_link" />
				</template>

				<template #column-dp_url="{ scope }">
					<el-link
						target="_blank"
						:underline="false"
						@click.prevent="openProductLinks2(scope.row)"
						><br /><br />
						<el-button size="small">打开详情</el-button>
					</el-link>
					<el-link
						target="_blank"
						:underline="false"
						@click.prevent="openProductLinks(scope.row)"
					>
						<el-button size="small">批量打开</el-button>
					</el-link>
				</template>

				<template #column-bullet_points="{ scope }">
					<cl-table-column-bullet-points :bullet_points="scope.row.bullet_points" />
				</template>

				<template #column-bsr_html="{ scope }">
					<cl-table-column-bsr-html :bsr_html="scope.row.bsr_html" />
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

				<!-- <template #column-factory_links="{scope}">
			<cl-table-column-popover-content :content="scope.row.factory_links?.map(item=>item.user_input).join('\n')"
											 title="工厂链接" :width="550"
											 :replace-return-to-br="true"
											 :replacing-br-quantity="1"/>
		  </template> -->

				<template #slot-management-buttons="{ scope }">
					<el-tooltip content="编辑" placement="left" :hide-after="0">
						<el-button
							type="primary"
							size="default"
							plain
							circle
							@click="handleEdit(scope.row)"
						>
							<el-icon>
								<edit-pen />
							</el-icon>
						</el-button>
					</el-tooltip>

					<el-tooltip content="竞品管理" placement="left" :hide-after="0">
						<el-button
							type="warning"
							size="default"
							plain
							circle
							@click="
								curEditingBsrCandidate = scope.row;
								competitorManagementPaneVisible = true;
							"
						>
							<el-icon>
								<goods-filled />
							</el-icon>
						</el-button>
					</el-tooltip>

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

				<template #column-image_url_display="{ scope }">
					<el-popover placement="right" trigger="hover" :width="1300">
						<template #reference>
							<el-image
								:src="scope.row.image_url_display"
								style="width: 50px; height: 50px; cursor: pointer"
								fit="contain"
							/>
						</template>
						<template #default>
							<div
								style="display: flex; overflow-x: auto; gap: 10px; padding: 10px 0"
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
										@click="
											swapMainImage(scope.row, `image_url${i === 1 ? '' : i}`)
										"
									/>
								</template>
							</div>
						</template>
					</el-popover>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-calculate="{ scope }">
				<cl-flex1 />
				<el-row>
					<el-button @click="calculate()">计算</el-button>
				</el-row>
			</template>

			<template #slot-describe="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.describe" :key="index">
						<el-dropdown trigger="click">
							<el-button>
								选择描述类型
								<el-icon class="el-icon--right">
									<arrow-down />
								</el-icon>
							</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item @click="selectType('color', index)"
										>颜色</el-dropdown-item
									>
									<el-dropdown-item @click="selectType('quantity', index)"
										>数量</el-dropdown-item
									>
									<el-dropdown-item @click="selectType('style', index)"
										>风格</el-dropdown-item
									>
									<el-dropdown-item @click="selectType('capacity', index)"
										>容量</el-dropdown-item
									>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
						<el-input v-model="item.describe1" :placeholder="`请填写描述 ${index + 1}`">
							<template #append>
								<el-button @click="DeleteRowDescribe(index)">
									<el-icon>
										<delete />
									</el-icon>
								</el-button>
							</template>
						</el-input>
					</el-form-item>
					<el-row>
						<el-button @click="addRowDescribe()">添加描述</el-button>
					</el-row>
				</div>
			</template>

			<!-- 其他字段配置保持不变 -->
			<template #slot-factory_links="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.factory_links" :key="index">
						<el-input
							v-model="item.user_input"
							:placeholder="`请填写工厂链接 ${index + 1}`"
						>
							<template #append>
								<el-button @click="DeleteRowFactoryLink(index)">
									<el-icon>
										<delete />
									</el-icon>
								</el-button>
							</template>
						</el-input>
					</el-form-item>
					<el-row>
						<el-button @click="addRowFactoryLink()">添加链接</el-button>
					</el-row>
				</div>
			</template>

			<template #slot-btns="{ scope }">
				<el-button
					type="success"
					:loading="isFileUploading"
					:disabled="isFileUploading"
					@click="Upsert?.submit(scope)"
				>
					保存
				</el-button>
			</template>

			<template #slot-purchaserNum="{ scope }">
				<div class="purchase-section">
					<el-table
						:data="scope.purchasers"
						border
						style="width: 100%"
						empty-text="暂无采购计划"
					>
						<!-- 国家列 -->
						<el-table-column
							v-for="country in countries2"
							:key="country.code"
							:label="country.name"
							:prop="country.code"
							width="80"
						>
							<template #default="{ row }">
								<el-input
									v-model.number="row.purchaserNum[country.code]"
									:min="0"
									placeholder="数量"
									controls-position="right"
									style="width: 50px"
								/>
							</template>
						</el-table-column>

						<el-table-column label="状态" width="120" align="center">
							<template #default="{ row }">
								<el-tag
									:type="
										row.is_generate === 2
											? 'success'
											: row.is_generate === 0
												? 'danger'
												: 'info'
									"
									effect="plain"
								>
									{{
										row.is_generate === 2
											? "✅ 已确认"
											: row.is_generate === 0
												? "❌ 已取消"
												: row.is_generate === 3
													? "⏳ 待决策(满)"
													: row.is_generate === 4
														? "❌ 分配不可做"
														: "⏳ 待决策"
									}}
								</el-tag>
							</template>
						</el-table-column>

						<el-table-column label="采购意见" width="180" align="center">
							<template #default="{ row }">
								<!-- 输入框组件 -->
								<div class="procurement-opinion-container">
									<el-popover
										placement="left"
										:width="300"
										trigger="hover"
										v-model:visible="row.showTooltip"
									>
										<template #reference>
											<el-input
												v-model="row.procurement"
												placeholder="输入意见..."
												size="small"
												class="procurement-input"
											/>
										</template>
										<div class="procurement-tooltip-content">
											{{ row.procurement || "无意见" }}
										</div>
									</el-popover>
								</div>
							</template>
						</el-table-column>

						<!-- 合计列 -->
						<el-table-column label="合计" width="100" align="center">
							<template #default="{ row }">
								{{ calculateTotal(row) }}
							</template>
						</el-table-column>

						<!-- 提交人列 -->
						<el-table-column label="提交人" width="80" align="center">
							<template #default="{ row }">
								<el-tag type="info">{{ row.purchaser }}</el-tag>
							</template>
						</el-table-column>

						<!-- 操作列 -->
						<el-table-column label="操作" width="150" align="center">
							<template #default="{ $index }">
								<el-button
									size="mini"
									type="danger"
									@click="DeleteRowPurchaserNum($index)"
								>
									删除
								</el-button>
							</template>
						</el-table-column>
					</el-table>
					<div class="purchase-actions"></div>
				</div>
			</template>

			<template #slot-purchaser="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.purchaser" :key="index">
						<el-input
							v-model="item.purchaser1"
							:placeholder="`采购人 ${index + 1}`"
							disabled
						>
							<template #append> </template>
						</el-input>
					</el-form-item>
				</div>
			</template>

			<template #slot-purchaserid="{ scope }">
				<div>
					<el-form-item v-for="(item, index) in scope.purchasersid" :key="index">
						<el-input
							v-model="item.purchaserid"
							:placeholder="`采购人id ${index + 1}`"
							hidden
						>
							<template #append> </template>
						</el-input>
					</el-form-item>
				</div>
			</template>
			<template #slot-competitor_apply>
				<el-card shadow="never" class="competitor-apply">
					<div class="header">
						<el-text type="primary" size="large">竞品参数应用</el-text>
						<el-select
							v-model="competitorFilterCountry"
							placeholder="选择国家"
							size="small"
							style="width: 120px; margin-left: 20px"
							@change="handleCompetitorCountryChange"
						>
							<el-option label="全部" value="" />
							<el-option
								v-for="country in countryOptions"
								:key="country.value"
								:label="country.label"
								:value="country.value"
							/>
						</el-select>
					</div>
					<el-table
						:data="filteredCompetitors"
						height="300px"
						border
						highlight-current-row
					>
						<el-table-column prop="asin_competitor" label="ASIN" width="130" />

						<el-table-column label="图片" width="130">
							<template #default="{ row }">
								<el-popover
									placement="right"
									trigger="hover"
									:width="row.image_url_display ? 300 : 0"
								>
									<template #reference>
										<el-image
											:src="row.image_url_display"
											style="width: 70px; height: 70px"
											fit="contain"
											:preview-src-list="[row.image_url_display]"
											hide-on-click-modal
										>
										</el-image>
									</template>
									<img
										:src="row.image_url_display"
										style="max-width: 280px; height: auto; border-radius: 4px"
									/>
								</el-popover>
							</template>
						</el-table-column>

						<!-- <<el-table-column prop="image_url_display"  label="图片" width="130"/> -->
						<el-table-column prop="dispatches_type" label="配送类型" width="100">
							<template #default="{ row }">
								<el-tag
									:type="dispatchTypeDict[row.dispatches_type]?.type"
									effect="plain"
								>
									{{ dispatchTypeDict[row.dispatches_type]?.label || "未知" }}
								</el-tag>
							</template>
						</el-table-column>

						<!-- <el-table-column prop="dispatches_type" label="配送类型" width="100"/> -->

						<el-table-column prop="Main_monthly_sales" label="父体销量" width="100" />
						<el-table-column prop="marketplace" label="国家" width="80" />
						<el-table-column label="尺寸（cm）" width="150">
							<template #default="{ row }">
								{{ parseDimensions(row.dimensions)?.join(" × ") || "-" }}
							</template>
						</el-table-column>
						<el-table-column label="重量（kg）" width="100">
							<template #default="{ row }">
								{{ row.weight ? (parseFloat(row.weight) / 1000).toFixed(3) : "-" }}
							</template>
						</el-table-column>
						<el-table-column label="本地售价" width="100">
							<template #default="{ row }">
								{{ row.price }}
							</template>
						</el-table-column>
						<el-table-column label="配送费" width="100">
							<template #default="{ row }">
								{{ row.FBA_price || "-" }}
							</template>
						</el-table-column>
						<el-table-column label="操作" width="120" fixed="right">
							<template #default="{ row }">
								<el-button
									type="primary"
									size="small"
									@click="applyDimensionsAndWeight(row)"
								>
									应用尺寸重量
								</el-button>
								<br />
								<el-button
									type="success"
									size="small"
									@click="applyPriceAndDelivery(row)"
								>
									应用售价运费
								</el-button>
								<el-button type="info" size="small" @click="openProductLinks3(row)">
									打开详情
								</el-button>
							</template>
						</el-table-column>
					</el-table>
				</el-card>
			</template>

			<template #slot-primary3="{ scope }">
				<el-card class="profit-calculator" shadow="never">
					<div class="common-params">
						<el-row :gutter="20">
							<el-col :span="16">
								<el-form-item label="成本价 (¥)" label-width="100px">
									<el-input-number
										v-model="common.cost"
										:precision="2"
										controls-position="right"
									/>
								</el-form-item>
							</el-col>
						</el-row>

						<el-row :gutter="20">
							<el-col :span="12">
								<el-form-item label="尺寸 (cm)" label-width="100px">
									<el-space :size="8">
										<el-input-number
											v-model="common.length"
											:precision="1"
											placeholder="长"
										/>
										<el-input-number
											v-model="common.width"
											:precision="1"
											placeholder="宽"
										/>
										<el-input-number
											v-model="common.height"
											:precision="1"
											placeholder="高"
										/>
									</el-space>
								</el-form-item>
							</el-col>

							<el-col :span="6">
								<el-form-item label="重量 (kg)">
									<el-space>
										<el-input-number
											v-model="common.actualWeight"
											:precision="2"
											:min="0"
										/>
										<el-tag type="info"
											>抛重：{{ volumetricWeight.toFixed(2) }}kg</el-tag
										>
										<el-tag
											>有效重量：{{ effectiveWeight.toFixed(2) }}kg</el-tag
										>
									</el-space>
								</el-form-item>
							</el-col>
						</el-row>
						<!-- 在保存按钮处绑定点击事件 -->
						<el-button type="primary" @click="handleSubmit" :loading="isSubmitting">
							保存利润数据
						</el-button>
						<el-button
							type="primary"
							@click="autoAdaptLocalPrice"
							:loading="isAdaptingPrice"
						>
							适配本地售价
						</el-button>
						<el-button
							type="primary"
							@click="calculateDeliveryFee"
							:loading="isCalculatingFees"
						>
							计算配送费
						</el-button>
					</div>

					<!-- 国家参数表格 -->
					<el-table :data="markets" border>
						<el-table-column label="国家" prop="country" fixed width="100" />

						<el-table-column label="本地售价" width="180" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.localPrice"
									:precision="2"
									:controls="false"
									:prefix="row.currencySymbol"
								/>
							</template>
						</el-table-column>

						<el-table-column label="头程运费" width="100">
							<template #default="{ row }">
								<el-input
									v-model="row.shipping"
									:precision="2"
									:min="0"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="配送费" width="180">
							<template #default="{ row }">
								<el-input
									v-model="row.deliveryFee"
									:precision="2"
									:min="0"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="汇率" width="140" align="center">
							<template #default="{ row }">
								<el-input
									v-model="row.exchangeRate"
									:precision="2"
									:min="0"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="税率 (%)" width="150">
							<template #default="{ row }">
								<el-input
									v-model="row.taxRate"
									:precision="2"
									:min="0"
									:max="100"
									controls-position="right"
								/>
							</template>
						</el-table-column>

						<el-table-column label="利润 (¥)" width="150">
							<template #default="{ row }">
								<el-tag :type="row.profit > 0 ? 'success' : 'danger'">
									{{ row.profit }}
								</el-tag>
							</template>
						</el-table-column>

						<el-table-column label="利润率 (%)" width="150">
							<template #default="{ row }">
								<el-tag :type="row.profitRate > 0 ? 'success' : 'danger'">
									{{ row.profitRate }}%
								</el-tag>
							</template>
						</el-table-column>
					</el-table>
				</el-card>
			</template>
		</cl-upsert>

		<el-drawer v-model="competitorManagementPaneVisible" size="90%" direction="ltr">
			<bsr-candidate-competitor-component :candidate="curEditingBsrCandidate" />
		</el-drawer>

		<el-drawer
			v-model="ListingkeywordManagementPaneVisible"
			destroy-on-close
			title="写Listing"
			size="90%"
			direction="ltr"
		>
			<template #default>
				<ai-listing-keyword :listing="curEditingListing"></ai-listing-keyword>
			</template>
		</el-drawer>

		<el-drawer v-model="keywordManagementPaneVisible" size="90%" direction="ltr">
			<listing-keyword :listing="curEditingListing"></listing-keyword>
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

<script lang="ts" name="app-bsr-candidate" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { convert_image_url, is_admin } from "/$/app/utils";
import { Delete, EditPen, GoodsFilled, Memo } from "@element-plus/icons-vue";
import { ref, watch, reactive } from "vue";
import { ElMessage } from "element-plus";
import { appConfig } from "../../../../../appConfig";
import ClCrud from "/~/crud/src/components/crud";
import ClRow from "/~/crud/src/components/row";
import ClDialog from "/~/crud/src/components/dialog";
import ClTableColumnBsrHtml from "/$/app/components/cl-table-column-bsr-html.vue";
import ClTableColumnBsrLink from "/$/app/components/cl-table-column-bsr-link.vue";
import ClTableColumnBulletPoints from "/$/app/components/cl-table-column-bullet-points.vue";
import BatchUpdateBsrCandidateStatus from "/$/app/components/batch-update-bsr-candidate-status.vue";
import BsrCandidateCompetitorComponent from "/$/app/components/bsr-candidate-competitor-component.vue";
import BatchUpdateCompetitorSpiderStatus from "/$/app/components/batch-update-competitor-spider-status.vue";
import BsrCandidateFilterStatus from "/$/app/components/bsr-candidate-filter-status.vue";
import ClTableColumnPopoverContent from "/$/app/components/cl-table-column-popover-content.vue";
import BatchOpenDpLink from "/$/app/components/batch-open-dp-link.vue";
import { computed, nextTick } from "vue";
import { onMounted, onUnmounted } from "vue";
import axios from "axios";
import ListingKeyword from "/$/app/components/listing-keyword.vue";
import * as echarts from "echarts";
import dayjs from "dayjs";
import AiListingKeyword from "/$/app/components/ai-listing-keyword.vue";

const keywordManagementPaneVisible = ref(false);
const curEditingListing = ref();

const { service } = useCool();

import { useUserStore } from "/$/base/store/user";
import upsert from "/~/crud/src/components/upsert";
const ListingkeywordManagementPaneVisible = ref(false);

const userStore = useUserStore();
const departmentId = userStore.info?.departmentId;

const Crud = useCrud(
	{
		service: service.app.ai_listing_write,
		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value) {
				Object.assign(params, {
					status: appConfig.BSR_CANDIDATE_STATUS.LIBRARY2.value
				});
			}
			const { list } = await next({
				...params
			});

			Table.value?.data.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				if (item.delivery_volumes) {
					item.fba_max_price = item.delivery_volumes.FBA?.max_price || 0;
					item.fba_min_price = item.delivery_volumes.FBA?.min_price || 0;
					item.fbm_max_price = item.delivery_volumes.FBM?.max_price || 0;
					item.fbm_min_price = item.delivery_volumes.FBM?.min_price || 0;
				}
			});
			await loadVariantMapping(list);
		}
	},
	(app) => {
		app.refresh();
	}
);
const showOnlyStatusLibrary = ref(true);
watch([showOnlyStatusLibrary], () => {
	setTimeout(() => {
		Crud.value?.refresh();
	}, 200);
});

const Table = useTable({
	columns: [
		{ type: "selection" },
		//   { label: 'ASIN', prop: 'asin', minWidth: 60, fixed	: 'left', showOverflowTooltip: true },
		{
			label: "产品名称",
			prop: "produce_name",
			showOverflowTooltip: true,
			minWidth: 50,
			fixed: "left"
		},
		{
			label: "图片",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain" } },
			fixed: "left"
		},
		{ label: "基础sku", prop: "sku", minWidth: 80, showOverflowTooltip: true, fixed: "left" },
		{ label: "基础Msku", prop: "msku", minWidth: 80, showOverflowTooltip: true, fixed: "left" },
		{
			label: "需求国家",
			prop: "marketplaceNeeds",
			minWidth: 300,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{
			label: "变体",
			prop: "variantName",
			minWidth: 280,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{
			label: "补充信息",
			children: [
				{
					label: "专利情况",
					prop: "patent_memo",
					showOverflowTooltip: true,
					minWidth: 100
				},
				{
					label: "开发意见",
					prop: "opinion_dev",
					showOverflowTooltip: true,
					minWidth: 100
				},
				{
					label: "运营意见",
					prop: "opinion_operator",
					showOverflowTooltip: true,
					minWidth: 100
				},
				{
					label: "采购意见",
					prop: "opinion_procurement",
					showOverflowTooltip: true,
					minWidth: 100
				},
				{
					label: "专利查询截图",
					prop: "keyword_screenshots",
					component: { name: "cl-image", props: { size: 50, fit: "contain" } }
				}
			]
		},

		{
			label: "收录时间",
			prop: "createTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "desc"
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 160,
			component: { name: "cl-date-text" },
			sortable: "custom"
		},

		{
			type: "op",
			buttons: ["slot-management-buttons"],
			width: 120
		}
	],
	contextMenu: []
});

let isHidden1 = false;
let isHidden2 = false;
// if(departmentId === 2){
//   isHidden1 = true;
// }
// if(departmentId === 3){
//   isHidden2 = true;
// }

const isFileUploading = ref(false);

const Upsert = useUpsert({
	dialog: {
		width: "1200",
		top: "10vh"
	},
	async onInfo(data, { next, done }) {
		let newData = await next(data);
		// 新增：获取配送类型销量数据
		const deliveryVolumes = isEditMode.value
			? await calculateDeliveryVolumes(newData.asinid)
			: null;
		console.log("Delivery Volumes:", deliveryVolumes); // 添加日志

		done({
			...newData,
			delivery_volumes: deliveryVolumes,
			factory_links: newData.factory_links || [{ user_input: "" }],
			describe: newData.describe || [{ describe1: "" }],
			image_url_display: convert_image_url(newData.image_url)
		});
	},
	items: [
		{
			prop: "basic_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "选品信息",
					expand: computed(() => !isEditMode.value),
					isExpand: true
				}
			},
			children: [
				{
					label: "ASIN",
					prop: "asin",
					component: {
						name: "el-input",
						props: {
							disabled: computed(() => isEditMode.value) // 编辑时禁用
						}
					},
					span: 12
				},
				{
					label: "国家",
					prop: "marketplace",
					component: {
						name: "el-input",
						props: {
							disabled: computed(() => isEditMode.value) // 编辑时禁用
						}
					},
					span: 12
				},
				{
					label: "来源",
					prop: "source",
					component: {
						name: "el-select",
						options: [
							{ label: "数据选品", value: 1 },
							{ label: "1688选品", value: 2 },
							{ label: "新增变体", value: 3 },
							{ label: "季节性产品", value: 4 }
						]
					},
					span: 12 // 根据布局需要设置
				},
				{
					label: "备注",
					prop: "remark",
					component: {
						name: "el-input",
						props: {
							disabled: computed(() => isEditMode.value) // 编辑时禁用
						}
					},
					span: 12
				},
				{
					label: "主图",
					prop: "image_url",
					component: {
						name: "el-input",
						props: {
							// 核心配置
							modelValue: "", // 双向绑定值
							placeholder: "请输入图片URL地址",
							clearable: true,

							// 动态控制
							disabled: computed(() => isEditMode.value),

							// 输入验证
							type: "url",
							pattern: "https?://.*"
						},
						// 值更新处理器
						on: {
							"update:modelValue": (val) => {
								Upsert.value.form.image_url = val;
							}
						}
					},
					span: 12
				},
				{
					label: "产品标题",
					prop: "item_name",
					component: {
						name: "el-input",
						props: {
							type: "textarea",
							autosize: { minRows: 1, maxRows: 6 },
							resize: "none",
							disabled: computed(() => isEditMode.value)
						}
					}
				},
				{
					label: "评论数",
					prop: "review_num",
					component: {
						name: "el-input-number",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "评价星级",
					prop: "last_star",
					component: {
						name: "el-rate",
						props: { "show-score": true, disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "价格",
					prop: "price",
					component: {
						name: "el-input-number",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "BSR排名",
					prop: "bsr_rank",
					component: {
						name: "el-input-number",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "尺寸",
					prop: "dimensions",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "重量",
					prop: "weight",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "卖家国家",
					prop: "seller_country",
					component: {
						name: "el-input",
						props: { disabled: computed(() => isEditMode.value) }
					},
					span: 12
				},
				{
					label: "上架时间",
					prop: "date_first_available",
					component: {
						name: "el-date-picker",
						props: {
							type: "date",
							valueFormat: "YYYY-MM-DD",
							disabled: computed(() => isEditMode.value)
						}
					},
					span: 12
				}
			]
		},
		{ label: "产品名称", prop: "produce_name", component: { name: "el-input" }, span: 12 },
		{ label: "sku", prop: "sku", component: { name: "el-input" }, span: 12 },
		{
			label: "主图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 250, fit: "contain" } },
			fixed: "left"
		},

		{
			prop: "jingpin_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "竞品参数应用",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-competitor_apply" }
				}
			]
		},

		{
			prop: "jisuan_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "利润、利润率计算",
					expand: false,
					isExpand: true
				}
			},
			children: [
				{
					component: { name: "slot-primary3" }
				}
			]
		},

		{
			prop: "additional_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "补充信息",
					expand: true,
					isExpand: true
				}
			},
			children: [
				{
					label: "专利情况",
					prop: "patent_memo",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					}
				},
				{
					label: "开发意见",
					prop: "opinion_dev",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					},
					hidden: isHidden2
				},
				{
					label: "运营意见",
					prop: "opinion_operator",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					},
					hidden: isHidden1
				},
				{
					label: "采购意见",
					prop: "opinion_procurement",
					component: {
						name: "el-input",
						props: { type: "textarea", autosize: { minRows: 2, maxRows: 6 } }
					},
					hidden: true
				},

				{
					label: "材料",
					prop: "material",
					component: {
						name: "el-select",
						options: [
							{ label: "", value: "" }, // 空值选项
							{ label: "Nylon", value: "Nylon" },
							{ label: "Stoneware", value: "Stoneware" },
							{ label: "Brass", value: "Brass" },
							{ label: "Rattan", value: "Rattan" },
							{ label: "Glass", value: "Glass" },
							{ label: "Iron", value: "Iron" },
							{ label: "Plastic", value: "Plastic" },
							{ label: "Metal", value: "Metal" },
							{ label: "Stone", value: "Stone" },
							{ label: "Porcelain", value: "Porcelain" },
							{ label: "Stainless Steel", value: "Stainless Steel" },
							{ label: "Resin", value: "Resin" },
							{ label: "Copper", value: "Copper" },
							{ label: "Rubber", value: "Rubber" },
							{ label: "Wood", value: "Wood" },
							{ label: "Melamine", value: "Melamine" },
							{ label: "Silicone", value: "Silicone" },
							{ label: "Aluminium", value: "Aluminium" },
							{ label: "Marble", value: "Marble" },
							{ label: "Earthenware", value: "Earthenware" },
							{ label: "Ceramic", value: "Ceramic" },
							{ label: "Acrylic", value: "Acrylic" }
						]
					},
					span: 4
				},
				{
					label: "颜色",
					prop: "color",
					component: {
						name: "el-select",
						options: [
							{ label: "", value: "" }, // 空值选项
							{ label: "White", value: "White" },
							{ label: "Black", value: "Black" },
							{ label: "Gray", value: "Gray" },
							{ label: "Green", value: "Green" },
							{ label: "Pink", value: "Pink" },
							{ label: "Blue", value: "Blue" },
							{ label: "Red", value: "Red" },
							{ label: "Orange", value: "Orange" },
							{ label: "Yellow", value: "Yellow" },
							{ label: "Purple", value: "Purple" },
							{ label: "Brown", value: "Brown" },
							{ label: "Beige", value: "Beige" },
							{ label: "Multicolour", value: "Multicolour" }
						]
					},
					span: 4
				},
				{
					label: "尺码",
					prop: "size",
					component: {
						name: "el-select",
						options: [
							{ label: "", value: "" }, // 空值选项
							{ label: "XXS", value: "XXS" },
							{ label: "XS", value: "XS" },
							{ label: "S", value: "S" },
							{ label: "M", value: "M" },
							{ label: "L", value: "L" },
							{ label: "XL", value: "XL" },
							{ label: "XXL", value: "XXL" },
							{ label: "One Size", value: "One Size" }
						]
					},
					span: 4
				},
				{
					label: "单位计数",
					prop: "unit_count",
					component: {
						name: "el-input-number"
					},
					span: 5
				},
				{
					label: "产品数量",
					prop: "product_quantity",
					component: {
						name: "el-input-number"
					},
					span: 5
				},
				{
					label: "描述",
					prop: "describe",
					value: [_getAnEmptyDescribeItem()],
					component: { name: "slot-describe" }
				},

				{
					label: "工厂链接",
					prop: "factory_links",
					value: [_getAnEmptyFactoryLinkItem()],
					component: { name: "slot-factory_links" },
					hidden: isHidden2
				},
				{
					label: "最大采购量",
					prop: "max_purchase",
					component: { name: "el-input" },
					span: 20
				},
				{
					label: "采购数量",
					prop: "purchaserNum",
					value: [_getAnEmptyPurchaserNumItem()],
					component: { name: "slot-purchaserNum" },
					span: 100,
					hidden: isHidden2
				},

				{
					label: "专利查询截图",
					prop: "keyword_screenshots",
					component: {
						name: "cl-upload",
						props: {
							text: "选择图片",
							draggable: true,
							multiple: true,
							limitSize: 2,
							onUpload: function (file) {
								isFileUploading.value = true;
							},
							onProgress: function (file) {},
							onSuccess: function (file) {
								setTimeout(function () {
									isFileUploading.value = false;
								}, 3500);
							},
							onError: function (file) {
								setTimeout(function () {
									isFileUploading.value = false;
								}, 3500);
							}
						}
					}
				}
			]
		}
	],

	async onSubmit(data, { next, done }) {
		try {
			data.factory_links = data.factory_links
				.map((item) => {
					item.user_input = item.user_input.trim();
					return item;
				})
				.filter((item) => item.user_input);
			data.describe = data.describe
				.map((item) => {
					item.describe1 = item.describe1.trim();
					return item;
				})
				.filter((item) => item.describe1);
			data.purchaserNum = data.purchaserNum.map((item) => ({
				candidate_id: data.asinid,
				purchaser: userStore.info?.name,
				purchaserNum: {
					// 保持与表结构一致
					uk: item.uk,
					de: item.de,
					fr: item.fr,
					es: item.es,
					it: item.it
				},
				is_generate: 1
			}));
			// 执行自动调整
			adjustQuantities(data.purchaserNum || []);
			// 检查是否还有剩余量
			const hasAdjusted = adjustQuantities(data.purchaserNum || []);
		} catch (err) {
			console.log(err);
		}
		await next(data);
	},
	op: {
		buttons: ["close", "slot-btns"]
	}
});

// 修改调整方法，返回是否触发调整
const adjustQuantities = (list: any[]): boolean => {
	const max = Upsert.value?.form.max_purchase || 0;
	const total = list.reduce((sum, item) => sum + (item.purchaser2 || 0), 0);

	if (total > max) {
		list.forEach((item, index) => {
			item.purchaser2 = Math.round((item.purchaser2 / total) * max);
		});

		// 二次校验
		let adjustedTotal = list.reduce((sum, item) => sum + item.purchaser2, 0);
		if (adjustedTotal > max) {
			list[list.length - 1].purchaser2 -= adjustedTotal - max;
		}

		ElMessage.warning({
			message: `采购总量已自动调整为${max}，请确认后重新提交`,
			duration: 5000
		});
		return true; // 返回调整标记
	}
	return false;
};

function _getAnEmptyFactoryLinkItem() {
	return { user_input: "" };
}

function _getAnEmptyPurchaserNumItem() {
	return { purchaser2: 0 };
}

function _getAnEmptyPurchaserItem() {
	return { purchaser1: userStore.info?.username };
}

function _getAnEmptyDescribeItem() {
	return { describe1: "" };
}

function addRowDescribe() {
	if (!Upsert.value?.form.describe) {
		Upsert.value.form.describe = [];
	}
	Upsert.value?.form.describe.push(_getAnEmptyDescribeItem());
}

function addRowFactoryLink() {
	if (!Upsert.value?.form.factory_links) {
		Upsert.value.form.factory_links = [];
	}
	Upsert.value?.form.factory_links.push(_getAnEmptyFactoryLinkItem());
}

function DeleteRowDescribe(index: number) {
	Upsert.value?.form.describe.splice(index, 1);
}

function DeleteRowFactoryLink(index: number) {
	Upsert.value?.form.factory_links.splice(index, 1);
}
// 新增合计计算方法
const calculateTotal = (row: Record<string, number>) => {
	return countries2.reduce((sum, c) => sum + (row.purchaserNum[c.code] || 0), 0);
};
const DeleteRowPurchaserNum = (index: number) => {
	Upsert.value?.form.purchaserNum.splice(index, 1);
};

// 处理国家筛选变化
const handleCompetitorCountryChange = () => {
	// 可以添加额外的逻辑，比如记录筛选行为等
};

const competitorFilterCountry = ref("");
const countryOptions = [
	{ label: "英国", value: "UK" },
	{ label: "德国", value: "DE" },
	{ label: "法国", value: "FR" },
	{ label: "西班牙", value: "ES" },
	{ label: "意大利", value: "IT" }
];

// 计算过滤后的竞品数据
const filteredCompetitors = computed(() => {
	if (!competitorFilterCountry.value) return competitorData.value;
	return competitorData.value.filter(
		(item) =>
			item.marketplace ===
			countryOptions.find((c) => c.value === competitorFilterCountry.value)?.label
	);
});
async function calculate() {
	// 输入验证
	if (
		!Upsert.value?.form.cost_price ||
		!Upsert.value?.form.length ||
		!Upsert.value?.form.width ||
		!Upsert.value?.form.height ||
		!Upsert.value?.form.actual_weight
	) {
		ElMessage.warning("请填写成本价、长、宽、高和重量");
		return;
	}
	const defaultMarket = {
		sellingPrice: 0,
		type: "FBM" as const
	};

	const marketPrices = {
		UK: { sellingPrice: 0, type: "FBM" as const },
		DE: { sellingPrice: 0, type: "FBM" as const },
		FR: { sellingPrice: 0, type: "FBM" as const },
		ES: { sellingPrice: 0, type: "FBM" as const },
		IT: { sellingPrice: 0, type: "FBM" as const }
	};

	// 市场映射关系
	const marketConfig = {
		UK: {
			headFreightKey: "first_leg_freight_UK",
			fbaFreightKey: "fba_freight_UK"
		},
		DE: {
			headFreightKey: "first_leg_freight_DE",
			fbaFreightKey: "fba_freight_DE",
			covers: ["DE", "FR", "ES", "IT"] // 德法西意共用德国头程
		}
	};

	try {
		// 获取竞品数据
		const candidateId = Upsert.value?.form.asinid;
		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000
		});

		// 处理竞品数据
		const marketPrices = processCompetitors(response.list || []);

		// 计算重量相关参数
		const dimensionalWeight = Math.ceil(
			(Upsert.value.form.length * Upsert.value.form.width * Upsert.value.form.height) / 6000
		);
		const weight = Math.max(dimensionalWeight, Upsert.value.form.actual_weight);

		// 基础参数
		const costPrice = Upsert.value.form.cost_price;
		const exchangeRate = Upsert.value.form.exchange_rate || 1;
		const taxRate = (Upsert.value.form.tax_rate || 0) / 100;

		// 计算各国利润
		const results: Record<
			string,
			{
				grossProfit: number;
				grossProfitRate: number;
			}
		> = {};

		Object.entries(marketConfig).forEach(([market, config]) => {
			const headFreight = Upsert.value.form[config.headFreightKey];
			const coveredMarkets = config.covers || [market];

			coveredMarkets.forEach((targetMarket) => {
				// 添加市场数据检查
				const priceInfo = marketPrices[targetMarket] || defaultMarket;
				if (!priceInfo) return;

				const fbaFreight =
					Upsert.value.form[
						marketConfig[targetMarket]?.fbaFreightKey || config.fbaFreightKey
					];

				// 添加有效性检查（关键修复）
				if (headFreight > 0 && fbaFreight > 0 && priceInfo.sellingPrice > 0) {
					const profit = calculateProfit(
						priceInfo.sellingPrice,
						fbaFreight,
						taxRate,
						exchangeRate,
						costPrice,
						weight,
						headFreight
					);

					results[targetMarket] = {
						grossProfit: profit,
						grossProfitRate: profit / (exchangeRate * priceInfo.sellingPrice)
					};
				}
			});
		});

		// 更新表单数据
		Object.entries(results).forEach(([market, result]) => {
			Upsert.value.form[`gross_profit_${market}`] = result.grossProfit;
			Upsert.value.form[`gross_profit_rate_${market}`] = result.grossProfitRate;
		});

		// 更新抛重字段
		Upsert.value.form.dimensional_weight = dimensionalWeight;
	} catch (error) {
		console.error("计算失败:", error);
		ElMessage.error("计算过程中发生错误");
	}
}

function processCompetitors(competitors: any[]) {
	const marketPrices: Record<
		string,
		{
			sellingPrice: number;
			type: "FBA" | "FBM";
		}
	> = {};

	const marketMapping: Record<string, string> = {
		英国: "UK",
		德国: "DE",
		法国: "FR",
		西班牙: "ES",
		意大利: "IT"
	};

	competitors.forEach((item) => {
		const market = marketMapping[item.marketplace] || item.marketplace;
		const price = Number(item.price) || 0;
		const type = appConfig.estimate_distribution_type(item.dispatches_from, item.sold_by);

		if (!marketPrices[market]) {
			marketPrices[market] = { sellingPrice: 0, type: "FBM" };
		}

		// 优先取最低FBA价格
		if (type === "FBA") {
			if (price < marketPrices[market].sellingPrice || marketPrices[market].type === "FBM") {
				marketPrices[market] = { sellingPrice: price, type };
			}
		}
		// 没有FBA时取最高FBM价格
		else if (type === "FBM" && marketPrices[market].type === "FBM") {
			if (price > marketPrices[market].sellingPrice) {
				marketPrices[market].sellingPrice = price;
			}
		}
	});

	return marketPrices;
}

function calculateProfit(
	sellingPrice: number,
	fbaFreight: number,
	taxRate: number,
	exchangeRate: number,
	costPrice: number,
	weight: number,
	headFreight: number
): number {
	return (
		(sellingPrice * 0.84 - // 平台费
			fbaFreight - // FBA配送费
			sellingPrice * taxRate) * // 税率
			exchangeRate -
		costPrice - // 成本价
		weight * headFreight // 头程运费
	);
}

const jsonViewerContent = ref();
const jsonViewerDialogVisible = ref(false);

const competitorManagementPaneVisible = ref(false);
const curEditingBsrCandidate = ref();

async function selectType(type: string, index: number) {
	Upsert.value.form.describe[index].describe1 =
		`${type}: ${Upsert.value.form.describe[index].describe1 || ""}`;
}

// 在 setup 中添加状态控制
const isEditMode = ref(false);

// 监听编辑/新增操作
watch(
	() => Upsert.value?.mode,
	(mode) => {
		isEditMode.value = mode === "update";
	}
);

const marketNameMapping: Record<string, string> = {
	英国: "UK",
	德国: "DE",
	法国: "FR",
	西班牙: "ES",
	意大利: "IT"
};
const competitorData = ref<any[]>([]);

const countries2 = [
	{ name: "英国", code: "uk" },
	{ name: "德国", code: "de" },
	{ name: "法国", code: "fr" },
	{ name: "西班牙", code: "es" },
	{ name: "意大利", code: "it" }
];

async function calculateDeliveryVolumes(candidateId: number): Promise<Record<string, any> | null> {
	if (!candidateId) return null;
	try {
		const volumesByMarketplace: Record<string, any> = {
			UK: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			DE: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			FR: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			ES: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			},
			IT: {
				FBA: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0,
					avgReview: 0,
					maxReview: 0,
					minReviewWithSales: Infinity,
					totalReview: 0,
					totalMainMonthlySales: 0,
					inventorySalesRatio: 0,
					avgDailySalesExcludeMax: 0,
					avgDailySalesPerAsin: 0
				},
				FBM: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					sellerCount: 0,
					stockTotal: 0
				},
				Other: {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				},
				marketAvg: 0,
				earliestDate: "",
				avgDays: 0,
				avgDaysWithVolume: 0,
				totalProducts: 0,
				productsWithVolume: 0,
				volumePercentage: 0,
				nodeStats: [],
				newProductCount: 0,
				fbaNewAsinCount: 0,
				fbmNewAsinCount: 0,
				newProductWithVolumeCount: 0,
				newProductVolumePercentage: 0
			}
		};

		const sellerCountMap: Record<string, Set<string>> = {
			UK: new Set(),
			DE: new Set(),
			FR: new Set(),
			ES: new Set(),
			IT: new Set()
		};

		const sellerCountMap2: Record<string, Set<string>> = {
			UK: new Set(),
			DE: new Set(),
			FR: new Set(),
			ES: new Set(),
			IT: new Set()
		};

		const stockDataByMarketType: Record<
			string,
			Record<string, (number | null | undefined)[]>
		> = {
			UK: { FBA: [], FBM: [], Other: [] },
			DE: { FBA: [], FBM: [], Other: [] },
			FR: { FBA: [], FBM: [], Other: [] },
			ES: { FBA: [], FBM: [], Other: [] },
			IT: { FBA: [], FBM: [], Other: [] }
		};

		const currentDate = new Date();
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth() + 1;
		const daysInMonth = new Date(year, month, 0).getDate();

		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000,
			status: 2
		});
		const response2 = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000
		});

		const filteredList = response.list || [];
		const filteredList2 = (response2.list || []).filter((item) => [1, 2].includes(item.status));

		competitorData.value = response.list || [];
		competitorData.value.forEach((item) => {
			item.image_url_display = convert_image_url(item.image_url);
		});

		const nodeStatsByMarket: Record<
			string,
			Record<
				string,
				{
					name: string;
					count: number;
					totalVolume: number;
				}
			>
		> = {
			UK: {},
			DE: {},
			FR: {},
			ES: {},
			IT: {}
		};

		filteredList2.forEach((item) => {
			const marketplaceZh = item.marketplace || "";
			const marketplaceEn = marketNameMapping[marketplaceZh] || marketplaceZh;
			if (item.bsr_node) {
				const nodeName = item.bsr_node;
				if (!nodeStatsByMarket[marketplaceEn][nodeName]) {
					nodeStatsByMarket[marketplaceEn][nodeName] = {
						name: nodeName,
						count: 0,
						totalVolume: 0
					};
				}
				const volume = Number(item.expected_volume) || 0;
				nodeStatsByMarket[marketplaceEn][nodeName].count++;
				nodeStatsByMarket[marketplaceEn][nodeName].totalVolume += volume;
			}
		});

		const ninetyDaysAgo = new Date();
		ninetyDaysAgo.setDate(currentDate.getDate() - 90);

		filteredList.forEach((item) => {
			const dispatchesFrom = item.dispatches_from || "";
			const soldBy = item.sold_by || "";
			const marketplaceZh = item.marketplace || "";
			const marketplaceEn = marketNameMapping[marketplaceZh] || marketplaceZh;

			const daysInMonth = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth() + 1,
				0
			).getDate();
			volumesByMarketplace[marketplaceEn].daysInMonth = daysInMonth;
			const euMarkets = ["DE", "FR", "ES", "IT"];

			let type = "";
			if (item.dispatches_type == "1") {
				type = "FBA";
			} else if (item.dispatches_type == "2") {
				type = "FBM";
			} else {
				type = "Other";
			}
			const volume = parseFloat(Number(item.expected_volume).toFixed(2));

			if (type === "FBA" && item.sold_by) {
				sellerCountMap[marketplaceEn]?.add(item.sold_by.trim().toLowerCase());
			}
			if (type === "FBM" && item.sold_by) {
				sellerCountMap2[marketplaceEn]?.add(item.sold_by.trim().toLowerCase());
			}

			let rawStockQuantity: number | null | undefined;
			if (
				item.stock_quantity === undefined ||
				item.stock_quantity === null ||
				item.stock_quantity === ""
			) {
				rawStockQuantity = null;
			} else {
				rawStockQuantity = Number(item.stock_quantity);
			}
			stockDataByMarketType[marketplaceEn][type].push(rawStockQuantity);

			if (!volumesByMarketplace[marketplaceEn]) {
				volumesByMarketplace[marketplaceEn] = {
					FBA: {
						total: 0,
						count: 0,
						max: 0,
						max_price: 0,
						min_price: Infinity,
						stockTotal: 0
					},
					FBM: { total: 0, count: 0, max: 0, max_price: 0, min_price: Infinity },
					Other: { total: 0, count: 0, max: 0, max_price: 0, min_price: Infinity },
					marketAvg: 0,
					earliestDate: "",
					avgDays: 0,
					avgDaysWithVolume: 0,
					totalProducts: 0,
					productsWithVolume: 0,
					volumePercentage: 0,
					nodeStats: []
				};
			}

			volumesByMarketplace[marketplaceEn].totalProducts += 1;

			if (!volumesByMarketplace[marketplaceEn][type]) {
				volumesByMarketplace[marketplaceEn][type] = {
					total: 0,
					count: 0,
					max: 0,
					max_price: 0,
					min_price: Infinity,
					stockTotal: 0
				};
			}

			volumesByMarketplace[marketplaceEn][type].count += 1;
			volumesByMarketplace[marketplaceEn][type].total += Number(volume);
			volumesByMarketplace[marketplaceEn][type].max = Math.max(
				volumesByMarketplace[marketplaceEn][type].max,
				volume
			);

			const price = item.price || item.current_price || 0;
			volumesByMarketplace[marketplaceEn][type].max_price = Math.max(
				volumesByMarketplace[marketplaceEn][type].max_price,
				price
			);
			volumesByMarketplace[marketplaceEn][type].min_price = Math.min(
				volumesByMarketplace[marketplaceEn][type].min_price,
				price
			);

			if (volume > 0) {
				volumesByMarketplace[marketplaceEn].productsWithVolume += 1;
			}

			// 新增：收集FBA相关原始数据
			if (type === "FBA") {
				const fbaData = volumesByMarketplace[marketplaceEn][type];
				// review相关
				const reviewNum = Number(item.review_num) || 0;
				fbaData.totalReview += reviewNum;
				fbaData.maxReview = Math.max(fbaData.maxReview, reviewNum);

				// 最低出单review（有父体月销量）
				const mainMonthlySales = Number(item.Main_monthly_sales) || 0;
				if (mainMonthlySales > 0) {
					fbaData.minReviewWithSales = Math.min(fbaData.minReviewWithSales, reviewNum);
					fbaData.totalMainMonthlySales += mainMonthlySales;
				}
			}

			if (item.date_first_available) {
				const itemDate = new Date(item.date_first_available);
				if (
					!volumesByMarketplace[marketplaceEn].earliestDate ||
					itemDate < new Date(volumesByMarketplace[marketplaceEn].earliestDate)
				) {
					volumesByMarketplace[marketplaceEn].earliestDate = itemDate
						.toISOString()
						.split("T")[0];
				}
				const diffTime = currentDate.getTime() - itemDate.getTime();
				const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
				volumesByMarketplace[marketplaceEn].totalDays =
					(volumesByMarketplace[marketplaceEn].totalDays || 0) + diffDays;
				volumesByMarketplace[marketplaceEn].dateCount =
					(volumesByMarketplace[marketplaceEn].dateCount || 0) + 1;

				if (volume > 0) {
					volumesByMarketplace[marketplaceEn].volumeDays =
						(volumesByMarketplace[marketplaceEn].volumeDays || 0) + diffDays;
					volumesByMarketplace[marketplaceEn].volumeCount =
						(volumesByMarketplace[marketplaceEn].volumeCount || 0) + 1;
				}

				if (isNewProduct(item.date_first_available)) {
					volumesByMarketplace[marketplaceEn].newProductCount += 1;
				}
			}

			const isNewProduct2 =
				item.date_first_available && new Date(item.date_first_available) > ninetyDaysAgo;
			const hasRankOrSales = (item.bsr_rank && item.bsr_rank > 0) || item.Main_monthly_sales;
			const hasLowReviews = (item.review_num || 0) < 5;

			if (type === "FBA" && isNewProduct2 && hasRankOrSales && hasLowReviews) {
				volumesByMarketplace[marketplaceEn].fbaNewAsinCount += 1;
			}
			if (type === "FBM" && isNewProduct2 && hasRankOrSales && hasLowReviews) {
				volumesByMarketplace[marketplaceEn].fbmNewAsinCount += 1;
			}
			if (isNewProduct2 && hasRankOrSales && hasLowReviews && volume > 0) {
				volumesByMarketplace[marketplaceEn].newProductWithVolumeCount += 1;
			}
			if (isNewProduct2 && hasRankOrSales && hasLowReviews) {
				volumesByMarketplace[marketplaceEn].newProductVolumeTotal =
					(volumesByMarketplace[marketplaceEn].newProductVolumeTotal || 0) + volume;
			}
		});

		Object.keys(nodeStatsByMarket).forEach((market) => {
			if (!volumesByMarketplace[market]) {
				volumesByMarketplace[market] = { nodeStats: [] };
			}
			volumesByMarketplace[market].nodeStats = Object.values(nodeStatsByMarket[market])
				.filter((node) => node.totalVolume >= 0)
				.sort((a, b) => b.totalVolume - a.totalVolume);
		});

		for (const market of Object.keys(volumesByMarketplace)) {
			volumesByMarketplace[market].FBA.sellerCount = sellerCountMap[market]?.size || 0;
		}
		for (const market of Object.keys(volumesByMarketplace)) {
			volumesByMarketplace[market].FBM.sellerCount = sellerCountMap2[market]?.size || 0;
		}

		for (const marketplace of Object.keys(volumesByMarketplace)) {
			for (const type of ["FBA", "FBM", "Other"] as const) {
				const stockQuantities = stockDataByMarketType[marketplace][type];
				const hasInvalidStock = stockQuantities.some((sq) => sq === null);

				if (hasInvalidStock) {
					volumesByMarketplace[marketplace][type].stockTotal = "数据不全";
				} else if (stockQuantities.length > 0) {
					volumesByMarketplace[marketplace][type].stockTotal = stockQuantities.reduce(
						(sum, sq) => sum + (sq || 0),
						0
					);
				} else {
					volumesByMarketplace[marketplace][type].stockTotal = 0;
				}
			}
		}

		// 新增：计算6个FBA指标
		for (const market of Object.keys(volumesByMarketplace)) {
			const fbaData = volumesByMarketplace[market].FBA;
			const daysInMonth = volumesByMarketplace[market].daysInMonth || 30;
			const totalMonthlySales = fbaData.total * daysInMonth; // 总月销量

			// 1. 平均review = 总review数 / 卖家数量
			fbaData.avgReview =
				fbaData.sellerCount > 0
					? parseFloat((fbaData.totalReview / fbaData.sellerCount).toFixed(2))
					: 0;

			// 2. 最大review（已在循环中收集最大值）
			fbaData.maxReview = parseFloat(fbaData.maxReview.toFixed(2));

			// 3. 最低出单review（处理无符合条件数据的情况）
			fbaData.minReviewWithSales =
				fbaData.minReviewWithSales !== Infinity
					? parseFloat(fbaData.minReviewWithSales.toFixed(2))
					: 0;

			// 4. 库销比 = 总库存 / 总月销量（处理库存数据不全、除数为0）
			if (fbaData.stockTotal === "数据不全" || totalMonthlySales <= 0) {
				fbaData.inventorySalesRatio = 0;
			} else {
				fbaData.inventorySalesRatio = parseFloat(
					(fbaData.stockTotal / totalMonthlySales).toFixed(2)
				);
			}

			// 5. 日/人均销量（剔除最大值）= (日均销量 - 最大单量) / (ASIN数量 - 1)
			fbaData.avgDailySalesExcludeMax =
				fbaData.count > 1
					? parseFloat(((fbaData.total - fbaData.max) / (fbaData.count - 1)).toFixed(2))
					: 0;

			// 6. 日/人均销量（日均销量/ASIN数量）= 日均销量 / ASIN数量
			fbaData.avgDailySalesPerAsin =
				fbaData.count > 0 ? parseFloat((fbaData.total / fbaData.count).toFixed(2)) : 0;
		}

		for (const marketplace in volumesByMarketplace) {
			const validVolumes = filteredList.filter(
				(item) =>
					marketNameMapping[item.marketplace] === marketplace &&
					(Number(item.expected_volume) || 0) >= 0
			);
			if (validVolumes.length > 0) {
				const totalVolume = validVolumes.reduce(
					(sum, item) => sum + (Number(item.expected_volume) || 0),
					0
				);
				volumesByMarketplace[marketplace].marketAvg = totalVolume / validVolumes.length;
			} else {
				volumesByMarketplace[marketplace].marketAvg = 0;
			}

			const totalVolume =
				volumesByMarketplace[marketplace].FBA.total +
				volumesByMarketplace[marketplace].FBM.total;
			volumesByMarketplace[marketplace].newProductVolumePercentage =
				totalVolume > 0
					? ((volumesByMarketplace[marketplace].newProductVolumeTotal || 0) /
							totalVolume) *
						100
					: 0;

			volumesByMarketplace[marketplace].avgDays =
				volumesByMarketplace[marketplace].dateCount > 0
					? Math.round(
							volumesByMarketplace[marketplace].totalDays /
								volumesByMarketplace[marketplace].dateCount
						)
					: 0;
			volumesByMarketplace[marketplace].avgDaysWithVolume =
				volumesByMarketplace[marketplace].volumeCount > 0
					? Math.round(
							volumesByMarketplace[marketplace].volumeDays /
								volumesByMarketplace[marketplace].volumeCount
						)
					: 0;

			volumesByMarketplace[marketplace].volumePercentage =
				volumesByMarketplace[marketplace].totalProducts > 0
					? (volumesByMarketplace[marketplace].productsWithVolume /
							volumesByMarketplace[marketplace].totalProducts) *
						100
					: 0;

			volumesByMarketplace[marketplace].newProductPercentage =
				volumesByMarketplace[marketplace].totalProducts > 0
					? (volumesByMarketplace[marketplace].newProductCount /
							volumesByMarketplace[marketplace].totalProducts) *
						100
					: 0;
		}

		console.log("最终计算结果:", volumesByMarketplace);
		return volumesByMarketplace;
	} catch (err) {
		console.error("获取竞品数据失败:", err);
		return null;
	}
}

function getMarketName(market: string): string {
	const reverseMapping: Record<string, string> = {
		UK: "英国",
		DE: "德国",
		FR: "法国",
		ES: "西班牙",
		IT: "意大利"
	};

	return reverseMapping[market] || market;
}

function isNewProduct(dateFirstAvailable: Date): boolean {
	const currentDate = new Date();
	const productDate = new Date(dateFirstAvailable);
	const timeDifference = currentDate.getTime() - productDate.getTime();
	const daysDifference = timeDifference / (1000 * 3600 * 24);
	return daysDifference <= 90;
}

function swapMainImage(row: any, clickedField: string) {
	// 保存当前主图URL
	const temp = row.image_url;

	// 将被点击的图片设为新的主图
	row.image_url = row[clickedField];

	// 将原来的主图放到被点击的位置
	row[clickedField] = temp;

	// 更新显示用的主图（如果用到计算属性的话）
	row.image_url_display = convert_image_url(row.image_url);

	// 如果需要自动保存到服务器，可以在这里添加更新请求
	service.app.bsr_candidate_competitor.update(row);
}

// 公共参数
const common = reactive({
	cost: 0,
	length: 0,
	width: 0,
	height: 0,
	actualWeight: 0
});

const markets = ref([
	{
		country: "英国",
		currency: "GBP",
		currencySymbol: "￡",
		localPrice: 0, // 本地货币价格
		exchangeRate: 0, // 从服务获取
		shipping: 20,
		deliveryFee: 0,
		taxRate: 16.66,
		profit: 0,
		profitRate: 0
	},
	{
		country: "德国",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		exchangeRate: 0,
		shipping: 20,
		deliveryFee: 0,
		taxRate: 15.96,
		profit: 0,
		profitRate: 0
	},

	{
		country: "法国",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		shipping: 20,
		deliveryFee: 0,
		exchangeRate: 0,
		profit: 0,
		profitRate: 0,
		taxRate: 16.66
	},

	{
		country: "西班牙",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		shipping: 20,
		deliveryFee: 0,
		exchangeRate: 0,
		profit: 0,
		profitRate: 0,
		taxRate: 18.03
	},

	{
		country: "意大利",
		currency: "EUR",
		currencySymbol: "€",
		localPrice: 0,
		shipping: 20,
		deliveryFee: 0,
		exchangeRate: 0,
		profit: 0,
		profitRate: 0,
		taxRate: 17.35
	}
]);
// 加载状态
const loadingRates = ref(false);

// 计算抛重
const volumetricWeight = computed(() => {
	return (common.length * common.width * common.height) / 6000;
});

// 计算有效重量
const effectiveWeight = computed(() => {
	return Math.max(volumetricWeight.value, common.actualWeight);
});

// 获取汇率数据
const loadExchangeRates = async () => {
	try {
		loadingRates.value = true;
		const rates: ExchangeRate[] = await service.app.foreign_exchange.getExchangeRate();

		markets.value = markets.value.map((market) => {
			const rateInfo = rates.find((r) => r.symbol === market.currencySymbol);
			return {
				...market,
				exchangeRate: rateInfo?.rate || 0,
				currencySymbol: rateInfo?.symbol || market.currency
			};
		});
	} catch (error) {
		ElMessage.error("汇率获取失败");
	} finally {
		loadingRates.value = false;
		calculateAll();
	}
};
const formatNumber = (value: number | undefined) => {
	if (typeof value !== "number") return "0.00";
	if (value === Infinity) return "∞";
	if (value === -Infinity) return "-∞";
	return value.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
};

const calculateRow = (row: any) => {
	const effectiveWeight = Math.max(volumetricWeight.value, common.actualWeight);

	// 转换为人民币的售价
	const priceCNY = row.localPrice * row.exchangeRate;

	// 计算利润
	const taxAmount = row.localPrice * (row.taxRate / 100);
	const profit =
		(row.localPrice * 0.84 - row.deliveryFee - taxAmount) * row.exchangeRate -
		(common.cost + effectiveWeight * row.shipping);

	// 计算利润率
	const profitRate = priceCNY > 0 ? (profit / priceCNY) * 100 : 0;

	row.profit = Number(profit.toFixed(2));
	row.profitRate = Number(profitRate.toFixed(2));
};

// 新增同步状态
const syncing = ref(false);

// 全局计算
const calculateAll = () => {
	markets.value.forEach(calculateRow);
};

// 自动计算
watch(
	() => [
		common.cost,
		common.length,
		common.width,
		common.height,
		common.actualWeight,
		...markets.value.map((m) => [
			m.localPrice,
			m.shipping,
			m.deliveryFee,
			m.taxRate,
			m.exchangeRate
		])
	],
	calculateAll,
	{ deep: true }
);

// 新增汇率接口类型
interface ExchangeRate {
	currency: string;
	rate: number;
	symbol: string;
}

// 自动加载汇率
onMounted(async () => {
	if (!calculatorInitialized) {
		resetCalculator();
		calculatorInitialized = true;
	}
});

const resetCalculator = () => {
	// 重置公共参数
	common.cost = 0;
	common.length = 0;
	common.width = 0;
	common.height = 0;
	common.actualWeight = 0;

	// 重置国家参数（使用 forEach 保持响应性）
	markets.value.forEach((market) => {
		market.localPrice = 0;
		market.shipping = 20;
		market.deliveryFee = 0;
		market.profit = market.profitRate = 0;
	});

	// 重置表单字段（逐个属性修改）
	if (Upsert.value?.form) {
		const form = Upsert.value.form;

		// 使用 Object.assign 合并修改而不是替换整个对象
		Object.assign(form, {
			cost_price: 0,
			length: 0,
			width: 0,
			height: 0,
			actual_weight: 0,
			dimensional_weight: 0,
			// 其他需要重置的字段...
			// 保留必要字段（如 ID）
			...(form.asinid && { id: form.asinid }), // 保留原有 ID
			...(form.asin && { asin: form.asin }) // 保留 ASIN
			// 添加其他需要保留的字段...
		});
	}
};

const countryCodeMap: Record<string, string> = {
	英国: "UK",
	德国: "DE",
	法国: "FR",
	西班牙: "ES",
	意大利: "IT"
};

const handleEdit = async (row: any) => {
	try {
		// 先执行清空操作
		resetCalculator();
		const bsrCandidateDetail = await service.app.bsr_candidate.info({
			id: row.candidate_id // 或 row.asinid，根据bsr_candidate表主键字段调整
		});
		console.log("bsrCandidateDetail", bsrCandidateDetail);
		if (!bsrCandidateDetail) {
			ElMessage.warning("未查询到该条数据的最新详情");
			return;
		}

		const candidateId = row.asinid;
		let profitData = await service.app.bsr_candidate.getProfitData({ candidateId });
		if (profitData) {
			// 更新common数据
			common.cost = profitData.common.cost || 0;
			common.length = profitData.common.length || 0;
			common.width = profitData.common.width || 0;
			common.height = profitData.common.height || 0;
			common.actualWeight = profitData.common.actual_weight || 0;

			// 更新markets数据
			markets.value = markets.value.map((market) => {
				const savedData = profitData.markets.find(
					(m: any) => m.country_code === countryCodeMap[market.country]
				);
				if (savedData) {
					return {
						...market,
						localPrice: savedData.local_price || 0,
						shipping: savedData.shipping || 20,
						deliveryFee: savedData.delivery_fee || 0,
						taxRate: savedData.tax_rate || 0,
						exchangeRate: savedData.exchange_rate || 0,
						profit: savedData.profit || 0,
						profitRate: savedData.profit_rate || 0
					};
				}
				return market;
			});
		}

		// 使用组件提供的编辑方法
		Upsert.value?.edit({
			id: bsrCandidateDetail.id,
			form: {
				...bsrCandidateDetail,
				asin: bsrCandidateDetail.asin,
				marketplace: bsrCandidateDetail.marketplace
			}
		});
		await nextTick();
		initCharts(); // 每次打开都重新初始化
		updateCharts(bsrCandidateDetail);
	} catch (error) {
		console.error("编辑时发生错误:", error);
		ElMessage.error("初始化编辑表单失败");
	}
};

const selectedMarket = ref("ALL");

// 增加提交状态
const isSubmitting = ref(false);

// 修改提交方法
const handleSubmit = async () => {
	try {
		const countryCodeMap: Record<string, string> = {
			英国: "UK",
			德国: "DE",
			法国: "FR",
			西班牙: "ES",
			意大利: "IT"
		};

		const payload = {
			candidate_id: Upsert.value?.form.asinid, // 主表ID
			common: {
				cost: common.cost,
				length: common.length,
				width: common.width,
				height: common.height,
				actual_weight: common.actualWeight
			},
			markets: markets.value.map((market) => ({
				country_code: countryCodeMap[market.country],
				local_price: market.localPrice,
				shipping: market.shipping,
				delivery_fee: market.deliveryFee,
				exchange_rate: market.exchangeRate,
				tax_rate: market.taxRate,
				profit: market.profit,
				profit_rate: market.profitRate
			}))
		};
		console.log("Payload:", payload);
		await service.app.bsr_candidate.saveProfit(payload);

		ElMessage.success("数据保存成功");

		Crud.value?.refresh();
	} catch (error) {
		ElMessage.error("保存失败");
	}
};

let calculatorInitialized = false;

const salesChart = ref<HTMLElement>();
const keywordChart = ref<HTMLElement>();
let salesChartInstance: echarts.ECharts | null = null;
let keywordChartInstance: echarts.ECharts | null = null;

function openProductLinks3(row: any) {
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}
const initCharts = () => {
	console.log("执行了initCharts");
	// 销毁旧实例
	salesChartInstance?.dispose();
	keywordChartInstance?.dispose();

	if (salesChart.value && keywordChart.value) {
		salesChartInstance = echarts.init(salesChart.value);
		keywordChartInstance = echarts.init(keywordChart.value);
	}
};

// 定义国家列表和映射关系
const countries = ["英国", "德国", "法国", "西班牙", "意大利"] as const;
type Country = (typeof countries)[number];

// 处理销售数据（按国家分组）
const processSalesData = (list: any[]) => {
	const dataByCountry: Record<Country, Map<string, number>> = {
		英国: new Map(),
		德国: new Map(),
		法国: new Map(),
		西班牙: new Map(),
		意大利: new Map()
	};

	list.forEach((competitor) => {
		const country = competitor.marketplace as Country;
		if (!countries.includes(country)) return;

		const salesData =
			typeof competitor.sales_volume_data === "string"
				? JSON.parse(competitor.sales_volume_data || "[]")
				: competitor.sales_volume_data || [];

		salesData.forEach((item: any) => {
			const dateStr = item.date ? item.date.toString() : "";
			let month = "";
			if (!dateStr) return;

			if (dateStr.includes("-")) {
				month = dayjs(dateStr).format("YYYY-MM");
			} else if (dateStr.length === 6) {
				month = dayjs(dateStr, "YYYYMM").format("YYYY-MM");
			} else if (dateStr.length === 8) {
				month = dayjs(dateStr, "YYYYMMDD").format("YYYY-MM");
			} else {
				month = dayjs(dateStr).format("YYYY-MM");
			}

			// 兼容不同字段名，可能是 sales, search 或 searches
			const val = item.sales !== undefined ? item.sales : (item.searches !== undefined ? item.searches : item.search);

			if (month !== "Invalid Date") {
				const current = dataByCountry[country].get(month) || 0;
				dataByCountry[country].set(month, current + (Number(val) || 0));
			}
		});
	});

	// 转换为排序后的数组
	const result: Record<Country, [string, number][]> = {} as any;
	countries.forEach((country) => {
		result[country] = Array.from(dataByCountry[country].entries()).sort(([a], [b]) =>
			a.localeCompare(b)
		);
	});
	return result;
};

// 处理关键词数据（同样逻辑）
const processKeywordData = (list: any[]) => {
	const dataByCountry: Record<Country, Map<string, number>> = {
		英国: new Map(),
		德国: new Map(),
		法国: new Map(),
		西班牙: new Map(),
		意大利: new Map()
	};

	list.forEach((keyword) => {
		const country = keyword.marketplaces as Country;
		if (!countries.includes(country)) return;

		const keywordData =
			typeof keyword.sif_search_history === "string"
				? JSON.parse(keyword.sif_search_history || "[]")
				: keyword.sif_search_history || [];

		console.log("keywordData:", keywordData);

		keywordData.forEach((item: any) => {
			const dateStr = item.date ? item.date.toString() : "";
			let month = "";
			if (!dateStr) return;

			if (dateStr.includes("-")) {
				month = dayjs(dateStr).format("YYYY-MM");
			} else if (dateStr.length === 6) {
				month = dayjs(dateStr, "YYYYMM").format("YYYY-MM");
			} else if (dateStr.length === 8) {
				month = dayjs(dateStr, "YYYYMMDD").format("YYYY-MM");
			} else {
				month = dayjs(dateStr).format("YYYY-MM");
			}

			// 兼容不同字段名，可能是 search 或 searches
			const val = item.search !== undefined ? item.search : item.searches;

			if (month !== "Invalid Date") {
				const current = dataByCountry[country].get(month) || 0;
				dataByCountry[country].set(month, current + (Number(val) || 0));
			}
		});
	});

	const result: Record<Country, [string, number][]> = {} as any;
	countries.forEach((country) => {
		result[country] = Array.from(dataByCountry[country].entries()).sort(([a], [b]) =>
			a.localeCompare(b)
		);
	});
	console.log("result:", result);
	return result;
};

const isAdaptingPrice = ref(false);

async function autoAdaptLocalPrice() {
	try {
		isAdaptingPrice.value = true;

		// 1. 获取当前候选产品的竞品数据
		const candidateId = Upsert.value?.form.asinid;
		if (!candidateId) {
			ElMessage.warning("请先保存产品基本信息");
			return;
		}

		const response = await service.app.bsr_candidate_competitor.page({
			candidate_id: candidateId,
			size: 1000
		});

		const competitors = response.list || [];

		// 2. 按国家分组处理
		markets.value.forEach((market) => {
			// 获取当前国家的FBA竞品
			const countryName = market.country; // 如"英国"
			const fbaCompetitors = competitors.filter(
				(comp) => comp.marketplace === countryName && comp.dispatches_type == "1" // FBA类型
			);

			if (fbaCompetitors.length > 0) {
				// 3. 取FBA最低价格
				const minPrice = Math.min(
					...fbaCompetitors.map((c) => parseFloat(c.price || 0)).filter((p) => p > 0)
				);
				market.localPrice = parseFloat(minPrice.toFixed(2));
			} else {
				// 4. 没有FBA竞品时，按30%利润率推算售价
				const cost = common.cost;
				const headFreight = market.shipping;
				const deliveryFee = market.deliveryFee;
				const exchangeRate = market.exchangeRate;
				const taxRate = market.taxRate / 100; // 转换为小数

				// 计算有效重量
				const volumetricWeight = (common.length * common.width * common.height) / 6000;
				const effectiveWeight = Math.max(volumetricWeight, common.actualWeight);

				// 计算公式推导：
				// 利润 = 售价 * 汇率 * 0.3
				// 同时：利润 = (售价 * 0.84 - 配送费 - 售价 * 税率) * 汇率 - 成本 - 头程运费*有效重量
				// 解方程得：
				const numerator = deliveryFee * exchangeRate + cost + headFreight * effectiveWeight;
				const denominator = exchangeRate * (0.54 - taxRate);

				if (denominator <= 0) {
					ElMessage.warning(`${countryName}税率过高，无法计算适配价格`);
					return;
				}

				market.localPrice = parseFloat((numerator / denominator).toFixed(2));
			}
		});

		ElMessage.success("本地售价适配完成");
	} catch (error) {
		ElMessage.error("适配本地售价失败: " + error);
	} finally {
		isAdaptingPrice.value = false;
	}
}

const updateCharts = async (row: any) => {
	try {
		const [competitors, keywords] = await Promise.all([
			service.app.bsr_candidate_competitor.page({
				candidate_id: row.asinid,
				size: 1000,
				status: 2
			}),
			service.app.keyword.page({
				asin: row.asin,
				size: 1000,
				keyword_type: ["core_major", "core"]
			})
		]);

		const salesData = processSalesData(competitors.list);
		const keywordData = processKeywordData(keywords.list);

		console.log("keywords.list:", keywords.list);
		countries.forEach((country) => {
			// 销售图表
			const salesChartEl = document.getElementById(`sales-chart-${countryCodeMap[country]}`);
			if (salesChartEl) {
				const chart = echarts.init(salesChartEl);
				chart.setOption(
					getChartOption(`${country}竞品销量`, salesData[country], "#5470C6")
				);
			}

			// 关键词图表
			const keywordChartEl = document.getElementById(
				`keyword-chart-${countryCodeMap[country]}`
			);
			if (keywordChartEl) {
				const chart = echarts.init(keywordChartEl);
				chart.setOption(
					getChartOption(`${country}关键词搜索量`, keywordData[country], "#91CC75")
				);
			}
		});
	} catch (error) {
		console.error("图表更新失败", error);
	}
};

// 图表配置生成器
const getChartOption = (title: string, data: [string, number][], color: string) => {
	const xData = data.map(([month]) => month);
	const seriesData = data.map(([, value]) => value);

	return {
		title: { text: title, left: "center" },
		tooltip: { trigger: "axis" },
		xAxis: {
			type: "category",
			data: xData,
			axisLabel: {
				formatter: (value: string) => {
					const [year, month] = value.split("-");
					return `${year.slice(-2)}-${month}`; // 显示为 24-04 格式
				}
			}
		},
		yAxis: { type: "value" },
		series: [
			{
				type: "bar",
				data: seriesData,
				itemStyle: { color, borderRadius: 4 },
				emphasis: { itemStyle: { shadowBlur: 10 } }
			}
		]
	};
};

const dispatchTypeDict = {
	0: { label: "自营", type: "success" },
	1: { label: "FBA", type: "warning" },
	2: { label: "FBM", type: "info" }
};

const parseDimensions = (str: string) => {
	const matches = str?.match(/(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)\s*[x×]\s*(\d+\.?\d*)/);
	return matches ? [matches[1], matches[2], matches[3]] : null;
};

const applyDimensionsAndWeight = (row: any) => {
	const dims = parseDimensions(row.dimensions || "");
	if (dims) {
		common.length = parseFloat(dims[0]);
		common.width = parseFloat(dims[1]);
		common.height = parseFloat(dims[2]);
	}

	if (row.weight) {
		const weightKg = parseFloat(row.weight.replace(/[^\d.]/g, "")) / 1000;
		common.actualWeight = isNaN(weightKg) ? 0 : weightKg;
	}
};

const applyPriceAndDelivery = (row: any) => {
	const targetMarket = markets.value.find((m) => getMarketName(m.country) === row.marketplace);

	if (!targetMarket) {
		ElMessage.warning(`未找到对应国家配置：${row.marketplace}`);
		return;
	}

	// 带类型转换的赋值逻辑
	const shouldUpdatePrice = Number(row?.price) > 0;
	const shouldUpdateDelivery = Number(row?.FBA_price) > 0;

	// 条件式更新对象
	const updates = {
		...(shouldUpdatePrice && { localPrice: Number(row.price) }),
		...(shouldUpdateDelivery && { deliveryFee: Number(row.FBA_price) })
	};

	if (Object.keys(updates).length > 0) {
		Object.assign(targetMarket, updates);
	} else {
		ElMessage.warning("价格和运费均为空或0，未执行更新");
	}
};

// 新增打开多链接方法
function openProductLinks(row: any) {
	// 原始产品链接
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);

	// StyleSnap 链接（处理图片尺寸）
	// const styleSnapUrl = `https://www.amazon.co.uk/stylesnap?q=${row.image_url?.replace(/_AC_US\d+/, '_AC_US500') || ''}`;
	const styleSnapUrl = appConfig.get_amazon_url_picture_search(
		row.image_url?.replace(/_AC_US\d+/, "_AC_US500") || "",
		row.marketplace
	);
	// 搜索链接（处理标题关键词）
	const keywords = row.item_name
		?.split(/[\s,]+/) // 按空格和逗号分割
		?.filter((_: string, i: number) => i > 0) // 跳过第一个单词
		?.slice(0, 5) // 取前5个单词
		?.join("+"); // 用加号连接

	// const searchUrl = `https://www.amazon.co.uk/s?k=${keywords || ''}`;
	const searchUrl = appConfig.get_amazon_url_keyword_search(keywords, row.marketplace);

	// 同时打开三个窗口
	window.open(dpUrl);
	window.open(styleSnapUrl);
	window.open(searchUrl);
}

// 新增打开多链接方法
function openProductLinks2(row: any) {
	const cleanAsin = row.asin.replace(/[^A-Z0-9]/g, "");
	const dpUrl = appConfig.get_amazon_url_dp(cleanAsin, row.marketplace);
	window.open(dpUrl);
}

const deliveryFeeConfig = {
	// 英国配送费配置
	UK: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 1.83 },
			{ maxWeight: 0.04, fee: 1.87 },
			{ maxWeight: 0.06, fee: 1.89 },
			{ maxWeight: 0.08, fee: 2.07 },
			{ maxWeight: 0.1, fee: 2.08 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 2.1 },
			{ maxWeight: 0.46, fee: 2.16 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 2.72
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 2.94
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 2.91 },
			{ maxWeight: 0.4, fee: 3.0 },
			{ maxWeight: 0.9, fee: 3.04 },
			{ maxWeight: 1.4, fee: 3.05 },
			{ maxWeight: 1.9, fee: 3.25 },
			{ maxWeight: 3.9, fee: 5.1 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 2.94 },
			{ maxWeight: 0.4, fee: 3.01 },
			{ maxWeight: 0.9, fee: 3.06 },
			{ maxWeight: 1.4, fee: 3.26 },
			{ maxWeight: 1.9, fee: 3.48 },
			{ maxWeight: 2.9, fee: 4.73 },
			{ maxWeight: 3.9, fee: 5.16 },
			{ maxWeight: 5.9, fee: 5.19 },
			{ maxWeight: 8.9, fee: 5.57 },
			{ maxWeight: 11.9, fee: 5.77 }
		],
		smallOversize: (() => {
			const baseFee = 3.65;
			const increment = 0.25;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 4.67;
			const increment = 0.24;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},
	// 德国配送费配置
	DE: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 2.33 },
			{ maxWeight: 0.04, fee: 2.37 },
			{ maxWeight: 0.06, fee: 2.39 },
			{ maxWeight: 0.08, fee: 2.52 },
			{ maxWeight: 0.1, fee: 2.54 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 2.57 },
			{ maxWeight: 0.46, fee: 2.68 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 3.04
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 3.42
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 3.38 },
			{ maxWeight: 0.4, fee: 3.4 },
			{ maxWeight: 0.9, fee: 3.67 },
			{ maxWeight: 1.4, fee: 4.29 },
			{ maxWeight: 1.9, fee: 4.49 },
			{ maxWeight: 3.9, fee: 5.57 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 3.39 },
			{ maxWeight: 0.4, fee: 3.78 },
			{ maxWeight: 0.9, fee: 3.9 },
			{ maxWeight: 1.4, fee: 4.54 },
			{ maxWeight: 1.9, fee: 4.97 },
			{ maxWeight: 2.9, fee: 5.2 },
			{ maxWeight: 3.9, fee: 5.67 },
			{ maxWeight: 5.9, fee: 5.95 },
			{ maxWeight: 8.9, fee: 6.41 },
			{ maxWeight: 11.9, fee: 6.65 }
		],
		smallOversize: (() => {
			const baseFee = 4.79;
			const increment = 0.48;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 4.91;
			const increment = 0.29;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},

	// 法国配送费配置
	FR: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 2.75 },
			{ maxWeight: 0.04, fee: 2.76 },
			{ maxWeight: 0.06, fee: 2.78 },
			{ maxWeight: 0.08, fee: 3.3 },
			{ maxWeight: 0.1, fee: 3.32 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 3.33 },
			{ maxWeight: 0.46, fee: 3.77 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 4.39
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 4.72
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 4.56 },
			{ maxWeight: 0.4, fee: 5.07 },
			{ maxWeight: 0.9, fee: 5.79 },
			{ maxWeight: 1.4, fee: 5.87 },
			{ maxWeight: 1.9, fee: 6.1 },
			{ maxWeight: 3.9, fee: 9.1 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 4.58 },
			{ maxWeight: 0.4, fee: 5.4 },
			{ maxWeight: 0.9, fee: 6.28 },
			{ maxWeight: 1.4, fee: 6.41 },
			{ maxWeight: 1.9, fee: 6.84 },
			{ maxWeight: 2.9, fee: 9.36 },
			{ maxWeight: 3.9, fee: 9.55 },
			{ maxWeight: 5.9, fee: 9.67 },
			{ maxWeight: 8.9, fee: 10.53 },
			{ maxWeight: 11.9, fee: 11.03 }
		],
		smallOversize: (() => {
			const baseFee = 7.23;
			const increment = 0.24;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 7.61;
			const increment = 0.38;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},

	// 西班牙配送费配置
	ES: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 2.77 },
			{ maxWeight: 0.04, fee: 2.84 },
			{ maxWeight: 0.06, fee: 2.87 },
			{ maxWeight: 0.08, fee: 3.21 },
			{ maxWeight: 0.1, fee: 3.23 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 3.26 },
			{ maxWeight: 0.46, fee: 3.45 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 3.6
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 3.85
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 3.52 },
			{ maxWeight: 0.4, fee: 3.74 },
			{ maxWeight: 0.9, fee: 3.95 },
			{ maxWeight: 1.4, fee: 4.21 },
			{ maxWeight: 1.9, fee: 4.27 },
			{ maxWeight: 3.9, fee: 5.5 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 3.55 },
			{ maxWeight: 0.4, fee: 4.05 },
			{ maxWeight: 0.9, fee: 4.45 },
			{ maxWeight: 1.4, fee: 4.85 },
			{ maxWeight: 1.9, fee: 4.94 },
			{ maxWeight: 2.9, fee: 4.98 },
			{ maxWeight: 3.9, fee: 5.53 },
			{ maxWeight: 5.9, fee: 7.02 },
			{ maxWeight: 8.9, fee: 7.24 },
			{ maxWeight: 11.9, fee: 7.85 }
		],
		smallOversize: (() => {
			const baseFee = 5.86;
			const increment = 0.1;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 6.91;
			const increment = 0.47;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	},

	// 意大利配送费配置
	IT: {
		lightweightEnvelope: [
			{ maxWeight: 0.02, fee: 3.23 },
			{ maxWeight: 0.04, fee: 3.26 },
			{ maxWeight: 0.06, fee: 3.28 },
			{ maxWeight: 0.08, fee: 3.39 },
			{ maxWeight: 0.1, fee: 3.41 }
		],
		standardEnvelope: [
			{ maxWeight: 0.21, fee: 3.45 },
			{ maxWeight: 0.46, fee: 3.64 }
		],
		largeEnvelope: {
			maxWeight: 0.96,
			fee: 3.94
		},
		xlEnvelope: {
			maxWeight: 0.96,
			fee: 4.17
		},
		smallParcel: [
			{ maxWeight: 0.15, fee: 4.13 },
			{ maxWeight: 0.4, fee: 4.54 },
			{ maxWeight: 0.9, fee: 4.95 },
			{ maxWeight: 1.4, fee: 5.51 },
			{ maxWeight: 1.9, fee: 5.81 },
			{ maxWeight: 3.9, fee: 6.93 }
		],
		standardParcel: [
			{ maxWeight: 0.15, fee: 4.29 },
			{ maxWeight: 0.4, fee: 4.7 },
			{ maxWeight: 0.9, fee: 5.15 },
			{ maxWeight: 1.4, fee: 5.81 },
			{ maxWeight: 1.9, fee: 6.05 },
			{ maxWeight: 2.9, fee: 6.71 },
			{ maxWeight: 3.9, fee: 6.96 },
			{ maxWeight: 5.9, fee: 7.25 },
			{ maxWeight: 8.9, fee: 8.04 },
			{ maxWeight: 11.9, fee: 8.63 }
		],
		smallOversize: (() => {
			const baseFee = 7.39;
			const increment = 0.12;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})(),
		standardOversize: (() => {
			const baseFee = 7.78;
			const increment = 0.38;
			const tiers: { maxWeight: number; fee: number }[] = [];
			for (let i = 0; i <= 11; i++) {
				tiers.push({
					maxWeight: 0.76 + i,
					fee: parseFloat((baseFee + increment * i).toFixed(2))
				});
			}
			return tiers;
		})()
	}
};

// 确定包裹类型
function determinePackageType(length: number, width: number, height: number, weight: number) {
	// 排序尺寸：从大到小
	const dimensions = [length, width, height].sort((a, b) => b - a);
	const [longest, middle, shortest] = dimensions;

	// 计算体积重量 (kg) = (长×宽×高) / 5000
	const volumetricWeight = (length * width * height) / 5000;
	const effectiveWeight = Math.max(weight, volumetricWeight);

	// 检查信封类型
	if (longest <= 33 && middle <= 23) {
		if (shortest <= 2.5 && effectiveWeight <= 0.1) return "lightweightEnvelope";
		if (shortest <= 2.5 && effectiveWeight <= 0.46) return "standardEnvelope";
		if (shortest <= 4 && effectiveWeight <= 0.96) return "largeEnvelope";
		if (shortest <= 6 && effectiveWeight <= 0.96) return "xlEnvelope";
	}

	// 检查小包裹
	if (longest <= 35 && middle <= 25 && shortest <= 12 && effectiveWeight <= 3.9) {
		return "smallParcel";
	}

	// 检查标准包裹
	if (longest <= 45 && middle <= 34 && shortest <= 26 && effectiveWeight <= 11.9) {
		return "standardParcel";
	}

	// 检查小号大件
	if (longest <= 61 && middle <= 46 && shortest <= 46 && effectiveWeight <= 1.76) {
		return "smallOversize";
	}

	// 检查标准大件
	if (longest <= 120 && middle <= 60 && shortest <= 60 && effectiveWeight <= 29.76) {
		return "standardOversize";
	}

	// 其他情况视为大件
	return "largeOversize";
}

// 计算配送费
const isCalculatingFees = ref(false);

async function calculateDeliveryFee() {
	try {
		isCalculatingFees.value = true;

		// 获取尺寸参数
		const dimensions = [common.length, common.width, common.height].sort((a, b) => a - b); // 从小到大排序

		const [shortest, middle, longest] = dimensions;
		const effectiveWeight = Math.max(volumetricWeight.value, common.actualWeight);

		// 确定包裹类型
		const packageType = determinePackageType(
			common.length,
			common.width,
			common.height,
			common.actualWeight
		);

		if (!packageType) {
			ElMessage.warning("无法确定包裹类型，请检查尺寸和重量是否符合标准");
			return;
		}

		// 更新各国的配送费
		markets.value.forEach((market) => {
			const countryCode =
				market.country === "英国"
					? "UK"
					: market.country === "德国"
						? "DE"
						: market.country === "法国"
							? "FR"
							: market.country === "西班牙"
								? "ES"
								: "IT";

			const countryConfig = deliveryFeeConfig[countryCode];
			const packageConfig = countryConfig[packageType];

			if (!packageConfig) {
				ElMessage.warning(`${market.country}没有${packageType}类型的配送费配置`);
				return;
			}

			// 处理不同类型的包裹
			if (Array.isArray(packageConfig)) {
				// 处理重量分段（包裹类型）
				let fee = 0;
				for (const tier of packageConfig) {
					if (effectiveWeight <= tier.maxWeight) {
						fee = tier.fee;
						break;
					}
				}
				// 如果重量超过最大分段，使用最后一个分段的费用
				if (fee === 0 && packageConfig.length > 0) {
					fee = packageConfig[packageConfig.length - 1].fee;
				}
				market.deliveryFee = fee;
			} else {
				// 处理固定费用的类型（信封）
				market.deliveryFee = packageConfig.fee;
			}
		});

		ElMessage.success(`配送费计算完成，包裹类型: ${packageType}`);
	} catch (error) {
		console.error("计算配送费失败", error);
		ElMessage.error("计算配送费失败");
	} finally {
		isCalculatingFees.value = false;
	}
}
const parseMarketplaceNeeds = (data: any) => {
	try {
		if (Array.isArray(data) && data.length > 0) {
			const parsed = JSON.parse(data[0]);

			// 创建新的过滤对象：只包含实际存在的国家
			const result: Record<string, string> = {};

			const countries = ["uk", "de", "fr", "it", "es"];

			// 只添加存在的国家
			countries.forEach((country) => {
				if (parsed[country] !== undefined) {
					result[country] = parsed[country];
				}
			});

			return result;
		}
		return {};
	} catch (e) {
		console.error("解析marketplaceNeeds失败", e);
		return {};
	}
};

const variantMapping = ref<Record<string, Set<string>>>({});
// 加载变体映射关系的方法
async function loadVariantMapping(list: any[]) {
	try {
		const asinids = (list || []).map((item) => item.asinid).filter((id) => id);

		if (!asinids.length) {
			variantMapping.value = {};
			return;
		}

		const purchaser = userStore.info?.name || "";
		if (!purchaser) {
			variantMapping.value = {};
			return;
		}

		const res = await service.app.ai_listing_write.variantName({
			asinids,
			purchaser
		});

		const mapping: Record<string, Set<string>> = {};

		res.forEach((row: any) => {
			const candidateId = row.candidate_id || row.candidateId || row.asinid;
			const variantName = row.variantName;
			if (!candidateId || !variantName) return;

			const key = String(candidateId);
			if (!mapping[key]) {
				mapping[key] = new Set();
			}

			variantName
				.split(",")
				.map((v: string) => v.trim())
				.filter((v: string) => v)
				.forEach((v: string) => {
					mapping[key].add(v);
				});
		});

		variantMapping.value = mapping;
	} catch (error) {
		console.error("加载变体映射失败:", error);
		variantMapping.value = {};
	}
}

// 从完整MSKU中提取基础部分
function extractBaseMsku(fullMsku: string): string {
	if (!fullMsku) return "";
	const parts = fullMsku.split("-");
	const baseParts = parts.slice(0, 3);
	return baseParts.join("-");
}

// 获取变体显示信息
function getVariantDisplay(row: any) {
	if (!row.variantName) return [];

	// 获取基础MSKU对应的变体集合
	const variantSet = variantMapping.value[String(row.asinid)] || new Set();

	// 拆分变体名称并处理
	return row.variantName
		.split(",")
		.map((v) => v.trim())
		.filter((v) => v)
		.map((variant) => ({
			name: variant,
			has: variantSet.has(variant)
		}));
}
</script>

<style scoped>
/* 调整后的样式 */
.country-group {
	display: flex;
	flex-direction: column;
	gap: 16px;
	height: 100%;
}

.chart-container {
	flex: 1;
	background: #fff;
	border-radius: 8px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	padding: 12px;
	transition: all 0.3s;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
}

/* 响应式调整 */
@media (max-width: 1200px) {
	.el-col {
		flex: 0 0 33.3333%;
		max-width: 33.3333%;
	}
}

@media (max-width: 768px) {
	.el-col {
		flex: 0 0 50%;
		max-width: 50%;
	}
}

@media (max-width: 480px) {
	.el-col {
		flex: 0 0 100%;
		max-width: 100%;
	}

	.compact-chart {
		height: 160px !important;
	}
}

.chart-row {
	margin-top: 20px;

	.el-card {
		border-radius: 8px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
	}
}

.node-stats-container {
	padding: 16px;
}

.stats-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
}

.node-grid {
	display: grid;
	grid-template-columns: repeat(var(--columns), 1fr);
	gap: 16px;
}

@media (max-width: 1200px) {
	.node-grid {
		--columns: 2 !important;
	}
}

@media (max-width: 768px) {
	.node-grid {
		--columns: 1 !important;
	}
}

.node-card {
	border: 1px solid var(--el-border-color);
	border-radius: 8px;
	padding: 16px;
	height: 100%;
	transition: all 0.3s;
}

.node-card:hover {
	box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.node-header {
	margin-bottom: 12px;
	border-bottom: 1px dashed var(--el-border-color);
	padding-bottom: 8px;
}

.node-name {
	font-size: 14px;
	color: var(--el-text-color-primary);
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.node-metrics {
	display: flex;
	justify-content: space-around;
	width: 100%;
}

.metric-box {
	text-align: center;
	padding: 8px;
	flex: 1;
}

.metric-label {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-bottom: 4px;
}

.metric-value {
	font-size: 16px;
	font-weight: 600;
}

.count .metric-value {
	color: var(--el-color-primary);
}

.volume .metric-value {
	color: var(--el-color-success);
}

.calculator-card {
	margin: 20px 0;
	padding: 20px;
}

.common-params {
	margin-bottom: 20px;
}

.dimension-weight {
	margin-bottom: 20px;
}

.dimension-inputs,
.weight-inputs {
	display: flex;
	gap: 10px;

	:deep(.el-input-number) {
		flex: 1;
	}
}

.market-table {
	margin-top: 20px;

	:deep(.cell) {
		padding: 8px;
	}
}

.profit-display {
	text-align: right;
	line-height: 1.4;

	div:first-child {
		color: var(--el-color-success);
		font-weight: 500;
	}

	div:last-child {
		color: var(--el-text-color-secondary);
		font-size: 0.9em;
	}

	.profit-calculator {
		background: #f8f9fa;
		border-radius: 8px;
	}

	.common-params {
		padding: 16px;
		margin-bottom: 16px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
	}

	:deep(.custom-header) th {
		background-color: #f5f7fa !important;
		font-weight: 600;
		color: #606266;
	}

	.profit-display {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.4;
	}

	.amount {
		font-size: 14px;
		font-family: monospace;
	}

	.rate {
		font-size: 12px;
		opacity: 0.8;
	}

	.el-input-number :deep(.el-input__inner) {
		text-align: center;
		padding-left: 5px;
		padding-right: 5px;
	}

	.el-form-item {
		margin-bottom: 12px;
	}
}

.filter-header {
	display: flex;
	align-items: center;
	padding: 8px 12px;
}

.node-stats-container {
	padding: 8px;
}

.market-section {
	margin-bottom: 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 6px;
	padding: 8px;
}

.compact-node {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 6px 8px;
	margin: 4px 0;
	background: var(--el-fill-color-light);
	border-radius: 4px;
}

.compact-node .el-text {
	flex: 1;
	margin-right: 8px;
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.node-grid {
	display: grid;
	gap: 8px;
	grid-template-columns: repeat(var(--columns), 1fr);
}

/* 响应式调整 */
@media (max-width: 1200px) {
	.node-grid {
		--columns: 3 !important;
	}
}

@media (max-width: 768px) {
	.node-grid {
		--columns: 2 !important;
	}
}

.el-tag {
	height: 24px;
	line-height: 24px;
	padding: 0 6px;
}

/* FBA列变宽（原flex:1 → flex:2） */
.fba-wide-column {
	flex: 2 !important;
	min-width: 400px; /* 确保窄屏时不挤压 */
}

/* FBM/自营列缩小一半（原flex:1 → flex:0.5） */
.narrow-column {
	flex: 0.5 !important;
	min-width: 150px; /* 确保内容能正常显示 */
}

.compact-data-grid {
	display: flex;
	gap: 6px;
	/* 缩小列间距 */
	margin-top: 8px;
}

.data-column {
	flex: 1;
	min-width: 0;
	padding: 8px 6px;
	/* 缩小内边距 */
	background: #f8f9fa;
	border-radius: 4px;
}

.column-title {
	font-size: 18px !important;
	/* 标题放大 */
	margin-bottom: 8px;
}

.data-line {
	font-size: 15px;
	/* 正文放大 */
	line-height: 1.4;
	/* 调小行高保持紧凑 */
}

.data-line span {
	min-width: 38px;
	/* 标签宽度缩小 */
	font-size: 15px;
	/* 标签字体略小 */
	color: #909399;
}

/* 价格区间特殊处理 */
.compact-price {
	letter-spacing: -0.3px;
	font-size: 12.5px;
	/* 略小于正文 */
}

/* 日期显示优化 */
.compact-date {
	font-size: 12px;
}

/* 国家标题放大 */
.market-title {
	font-size: 20px !important;
	padding: 6px 0;
}

.market-block {
	margin-bottom: 12px;
}

/* 新增响应式样式 */
.node-grid {
	--columns: 4;
	--sm-columns: 2;
	--xs-columns: 1;

	display: grid;
	gap: 8px;
	grid-template-columns: repeat(var(--columns), minmax(120px, 1fr));
}

@media screen and (max-width: 1200px) {
	.node-grid {
		grid-template-columns: repeat(var(--sm-columns), minmax(100px, 1fr));
	}
}

@media screen and (max-width: 768px) {
	.node-grid {
		grid-template-columns: repeat(var(--xs-columns), minmax(80px, 1fr));
	}
}

.compact-node {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 6px 8px;
	min-width: 0;
	/* 新增：允许内容收缩 */
}

.compact-node .el-text {
	flex: 1;
	min-width: 0;
	/* 新增：解决flex布局截断问题 */
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.competitor-apply {
	margin: 16px 0;
	border-radius: 8px;

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px;
		border-bottom: 1px solid var(--el-border-color);
	}

	:deep(.el-table) {
		margin-top: 12px;

		.el-table__cell {
			padding: 8px 12px;
		}
	}

	.el-button {
		margin-left: 8px;
	}
}

/* 添加样式 */
.marketplace-needs {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	font-size: 13px;
}

.country-flag {
	padding: 2px 6px;
	border-radius: 4px;
	background-color: #f0f0f0;
}

.country-flag.active {
	background-color: #e6f7ff;
	color: #1890ff;
	font-weight: 500;
}
</style>
