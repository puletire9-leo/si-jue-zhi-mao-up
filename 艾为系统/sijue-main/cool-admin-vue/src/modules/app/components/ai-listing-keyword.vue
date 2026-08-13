<template>
	<cl-crud ref="Crud">
		<template v-if="listing">
			<el-divider>Listing 信息</el-divider>
			<cl-row>
				<listing-description :listing="listing"></listing-description>
			</cl-row>
		</template>

		<el-divider>关键词列表</el-divider>
		<cl-row>
			<cl-refresh-btn />
			<el-space direction="horizontal" wrap>
				<el-select
					v-for="country in ['英国', '德国', '法国', '西班牙', '意大利']"
					:key="country"
					v-model="selectedNodesByCountry[country]"
					:placeholder="`${country} BSR节点`"
					style="width: 300px; margin-right: 10px"
					value-key="bsr_node_id"
				>
					<el-option
						v-for="node in filteredBsrNodes(country)"
						:key="node.bsr_node_id"
						:label="`${country}节点:${node.bsr_node} (${node.count}个竞品,总销量:${node.total_sales.toLocaleString()},节点编号:${node.bsr_node_id},类目名称:${node.bsr_category})`"
						:value="node"
					/>
				</el-select>
			</el-space>

			<!-- <el-button @click="setAllCore">全选核心词</el-button> -->
			<!-- 模板部分修改 -->

			<!-- 在复选框后面添加国家下拉框 -->
			<el-space direction="horizontal">
				<el-checkbox-group v-model="selectedCountries">
					<el-checkbox
						v-for="country in ['美国', '英国', '德国', '法国', '意大利', '西班牙']"
						:key="country"
						:label="country"
						:checked="countryKeywordCounts[country] >= 3"
					/>
				</el-checkbox-group>
				<el-divider direction="vertical" />

				<el-select
					v-model="currentCountry"
					placeholder="选择国家查看"
					style="width: 180px"
					@change="handleCountryChange"
				>
					<el-option
						v-for="country in selectedCountries"
						:key="country"
						:label="country"
						:value="country"
					/>
				</el-select>
			</el-space>
			<el-select
				v-model="batchAction"
				placeholder="批量操作"
				@change="handleBatchAction"
				style="width: 180px; margin-right: 10px"
				clearable
			>
				<!-- <el-option label="设置勾选为核心大词" value="core_major" /> -->
				<el-option label="设置勾选为核心词" value="core" />
				<el-option label="设置勾选为长尾词" value="long_tail" />
				<el-option label="" value="" />
			</el-select>
			<!-- <el-select v-model="selectedStore" placeholder="选择店铺" style="width: 250px; margin-right: 10px"
        @change="handleStoreChange" value-key="seller_account_id">
        <el-option v-for="store in uniqueStoreList" :key="store.seller_account_id" :label="`${store.account_name} `"
          :value="store">
          <span style="float: left">{{ store.account_name }}</span>
          <span style="float: right; color: #8492a6; font-size: 13px"> ({{ store.seller_account_id }})
          </span>
        </el-option>
      </el-select> -->

			<el-select
				v-model="selectedVariant"
				placeholder="选择变体"
				style="width: 250px; margin-right: 10px"
				@change="handleVariantChange"
				value-key="name"
			>
				<el-option
					v-for="(variant, index) in props.listing?.variant_Combination || []"
					:key="index"
					:label="`${variant.name} - ${variant.description}`"
					:value="variant"
				>
					<span style="float: left">{{ variant.name }}</span>
					<span style="float: right; color: #8492a6; font-size: 13px">
						({{ variant.description }})</span
					>
				</el-option>
			</el-select>

			<el-button type="primary" @click="openCompetitorDialog">选择竞品</el-button>

			<el-button type="primary" @click="exportListing">写Listing</el-button>

			<cl-flex1 />

			<!-- <el-space direction="horizontal">
          <el-text>仅展示已入库</el-text>
          <el-switch v-model="showOnlyStatusLibrary" active-text="是" inactive-text="否" inline-prompt></el-switch>
          <el-divider direction="vertical"></el-divider>
        </el-space>
        <KeywordFilterStatus /> -->
			<cl-search-key />
		</cl-row>

		<el-dialog
			v-model="previewDialogVisible"
			title="图片预览"
			width="70%"
			top="5vh"
			:lock-scroll="false"
			custom-class="image-preview-dialog"
			append-to-body
			@closed="resetPreview"
		>
			<div class="preview-container">
				<el-image
					:src="previewImageUrl"
					fit="contain"
					style="max-height: 70vh; width: 100%"
				/>
			</div>
			<template #footer>
				<el-button @click="previewDialogVisible = false">关闭</el-button>
			</template>
		</el-dialog>

		<!-- 新增竞品选择对话框 -->
		<el-dialog v-model="competitorDialogVisible" title="选择竞品" width="80%">
			<el-table
				ref="CompetitorTable"
				row-key="id"
				:data="competitors"
				@selection-change="handleCompetitorSelection"
				style="width: 100%"
				height="500"
			>
				<el-table-column type="selection" width="55" />
				<el-table-column prop="id" label="竞品id" />
				<el-table-column prop="asin_competitor" label="竞品ASIN" />
				<el-table-column prop="marketplace" label="国家" width="100" />

				<el-table-column label="图片" width="100">
					<template #default="{ row }">
						<el-popover placement="right" trigger="hover" :width="300">
							<!-- 大图预览 -->
							<img :src="row.image_url" style="max-width: 280px; max-height: 280px" />

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

				<el-table-column prop="item_name" label="标题" show-overflow-tooltip>
					<template #default="{ row }">
						<div v-if="row.fetchingBulletPoints" class="loading-indicator">
							<el-icon class="is-loading">
								<Loading />
							</el-icon>
							加载中...
						</div>

						<template v-else>
							<!-- 如果有卖点数据，显示原有的popover -->
							<template v-if="row.item_name">
								<el-popover
									placement="top-start"
									trigger="hover"
									:width="600"
									popper-class="wide-bullet-points-popover"
								>
									<template #reference>
										<div class="truncated-bullet-points">
											{{ truncateBulletPoints(row.item_name, 80) }}
										</div>
									</template>
									<div class="full-bullet-points">
										{{ row.item_name }}
									</div>
								</el-popover>
							</template>

							<!-- 如果没有卖点数据，显示"获取卖点"按钮 -->
							<template v-else>
								<el-button
									type="primary"
									size="small"
									:loading="row.fetchingBulletPoints"
									@click="fetchBulletPoints(row)"
								>
									获取标题
								</el-button>
							</template>
						</template>
					</template>
				</el-table-column>

				<el-table-column prop="description" label="描述" show-overflow-tooltip>
					<template #default="{ row }">
						<div v-if="row.fetchingBulletPoints" class="loading-indicator">
							<el-icon class="is-loading">
								<Loading />
							</el-icon>
							加载中...
						</div>

						<template v-else>
							<!-- 如果有卖点数据，显示原有的popover -->
							<template v-if="row.description">
								<el-popover
									placement="top-start"
									trigger="hover"
									:width="600"
									popper-class="wide-bullet-points-popover"
								>
									<template #reference>
										<div class="truncated-bullet-points">
											{{ truncateBulletPoints(row.description, 80) }}
										</div>
									</template>
									<div class="full-bullet-points">
										{{ row.description }}
									</div>
								</el-popover>
							</template>

							<!-- 如果没有卖点数据，显示"获取卖点"按钮 -->
							<template v-else>
								<el-button
									type="primary"
									size="small"
									:loading="row.fetchingBulletPoints"
									@click="fetchBulletPoints(row)"
								>
									获取描述
								</el-button>
							</template>
						</template>
					</template>
				</el-table-column>

				<el-table-column prop="price" label="价格" />
				<el-table-column prop="review_num" label="评论数" />

				<el-table-column prop="Main_monthly_sales" label="父体销量" width="120" />
				<el-table-column prop="expected_volume" label="预估单量" />

				<el-table-column prop="bullet_points" label="卖点" min-width="300">
					<template #default="{ row }">
						<div v-if="row.fetchingBulletPoints" class="loading-indicator">
							<el-icon class="is-loading">
								<Loading />
							</el-icon>
							加载中...
						</div>

						<template v-else>
							<!-- 如果有卖点数据，显示原有的popover -->
							<template v-if="row.bullet_points">
								<el-popover
									placement="top-start"
									trigger="hover"
									:width="600"
									popper-class="wide-bullet-points-popover"
								>
									<template #reference>
										<div class="truncated-bullet-points">
											{{ truncateBulletPoints(row.bullet_points, 80) }}
										</div>
									</template>
									<div class="full-bullet-points">
										{{ row.bullet_points }}
									</div>
								</el-popover>
							</template>

							<!-- 如果没有卖点数据，显示"获取卖点"按钮 -->
							<template v-else>
								<el-button
									type="primary"
									size="small"
									:loading="row.fetchingBulletPoints"
									@click="fetchBulletPoints(row)"
								>
									获取卖点
								</el-button>
							</template>
						</template>
					</template>
				</el-table-column>

				<el-table-column prop="bsr_rank" label="BSR排名" />
				<el-table-column
					prop="distributionType"
					label="配送方式"
					min-width="120"
					:formatter="
						(row) =>
							appConfig
								.estimate_distribution_type(row.dispatches_from, row.sold_by)
								?.toString()
					"
				/>
				<!-- <el-table-column prop="bullet_points" label="卖点" /> -->
			</el-table>

			<el-divider>自定义卖点（优先使用，空则使用竞品卖点）</el-divider>
			<el-form label-width="120px">
				<el-row :gutter="20">
					<el-col :span="12" v-for="n in 8" :key="n">
						<el-form-item :label="`卖点 ${n}`">
							<el-input
								v-model="customBulletPoints[n - 1]"
								type="textarea"
								:rows="2"
								:placeholder="`输入卖点 ${n} 内容`"
								clearable
							/>
						</el-form-item>
					</el-col>
				</el-row>
			</el-form>

			<el-divider>产品描述</el-divider>
			<el-form-item label="产品描述" label-width="120px">
				<el-input
					v-model="productDescription"
					type="textarea"
					:rows="4"
					placeholder="输入产品详细描述（支持Markdown格式）"
					clearable
					resize="vertical"
					show-word-limit
					maxlength="2000"
				/>
			</el-form-item>

			<template #footer>
				<el-button @click="competitorDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="confirmCompetitors">确认选择</el-button>
			</template>
		</el-dialog>

		<!-- <el-dialog 
    v-model="customBulletPointsDialogVisible" 
    title="输入自定义卖点" 
    width="600px"
    :close-on-click-modal="false"
  >
    <el-alert type="warning" show-icon style="margin-bottom: 15px">
      当前选择的关键词不足10个或未选择竞品，请补充卖点信息
    </el-alert>
    
    <el-input
      v-model="customBulletPoints"
      type="textarea"
      :rows="8"
      placeholder="请输入产品卖点（每个卖点单独一行）"
      resize="none"
      clearable
    />
    
    <template #footer>
      <el-button @click="customBulletPointsDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleCustomBulletPointsConfirm">确认生成</el-button>
    </template>
  </el-dialog> -->

		<cl-row>
			<cl-table ref="Table" row-key="id">
				<template #column-bullet_points="{ scope }">
					<el-popover
						placement="right"
						title="五点描述"
						:width="500"
						trigger="hover"
						v-if="scope.row.bullet_points"
					>
						<template #reference>
							<el-button plain circle size="default">
								<el-icon>
									<List />
								</el-icon>
							</el-button>
						</template>
						<template #default>
							<div style="white-space: pre-line">{{ scope.row.bullet_points }}</div>
						</template>
					</el-popover>
					<span v-else>无</span>
				</template>
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
						<template
							v-if="scope.row.result_details && scope.row.result_details.length > 0"
						>
							<el-popover
								placement="right"
								title="关键词搜索结果图片"
								:width="560"
								trigger="hover"
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
										<template
											v-for="(res, index) in scope.row.result_details"
											:key="index"
										>
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
													:src="convert_image_url(res.url_image)"
													style="
														padding: 5px;
														width: 50px;
														height: 50px;
														border: 1px solid #eee;
														object-fit: contain;
													"
													:preview-src-list="
														scope.row.result_details.map((item) =>
															convert_image_url(item.url_image)
														)
													"
													:initial-index="index"
													preview-teleported
													hide-on-click-modal
												></el-image>
											</el-link>
										</template>
									</el-space>
								</template>
							</el-popover>
						</template>
						<template v-else>
							<el-tag size="small" type="info">无</el-tag>
						</template>
					</el-space>
				</template>

				<template #column-search_volume_data="{ scope }">
					<el-button
						size="small"
						v-if="!!scope.row.search_volume_data"
						@click="
							jsonViewerContent = JSON.stringify(
								scope.row.search_volume_data,
								null,
								2
							);
							jsonViewerDialogVisible = true;
						"
					>
						查看 {{ scope.row.search_volume_data?.length }}
					</el-button>
					<template v-else>暂无</template>
				</template>

				<template #column-search_volume_chart="{ scope }">
					<template v-if="scope.row.search_volume_data">
						<el-popover
							placement="right"
							title="关键词搜索量走势"
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
									:option="
										generateKeywordSearchVolumeChartOption(
											scope.row.search_volume_data
										)
									"
									style="height: 200px"
									autoresize
								></v-chart>
							</template>
						</el-popover>
					</template>
					<template v-else>暂无</template>
				</template>

				<template #column-keyword_type="{ scope }">
					<el-select
						v-model="scope.row.keyword_type"
						placeholder="请选择"
						style="width: 100%"
						@change="handleSelectionChange"
					>
						<el-option label="核心大词" value="core_major" />
						<el-option label="核心词" value="core" />
						<el-option label="长尾词" value="long_tail" />
						<el-option label="" value="" />
					</el-select>
				</template>
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert" />

		<el-dialog v-model="batchImportDialogVisible" align-center draggable width="500">
			<template #header>批量添加</template>
			<template #default>
				<el-space fill style="width: 100%">
					<el-alert type="info" show-icon :closable="false">
						请输入若干个关键词条，一行一个。 <br />
						完全一致的关键词条不会被重复添加到系统中。
					</el-alert>
					<el-input
						type="textarea"
						:rows="10"
						resize="vertical"
						:autosize="{ minRows: 10, maxRows: 30 }"
						v-model="importingKeywordsInput"
					></el-input>
					<el-alert type="info" show-icon :closable="false">
						关键词分析和调价策略均依赖在库的核心关键词。<br />
						若当前 listing 还没有核心关键词，建议勾选以下开关。
					</el-alert>
					<el-space>
						是否作为 <strong>核心关键词</strong> 导入：
						<el-switch
							v-model="importAsCoreKeyword"
							inline-prompt
							active-text="是"
							inactive-text="否"
						/>
					</el-space>
				</el-space>
			</template>
			<template #footer>
				<el-button @click="batchImportDialogVisible = false">取消</el-button>
				<el-button type="primary" @click="importKeywords()">确认导入</el-button>
			</template>
		</el-dialog>

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

<script lang="ts" name="app-listing-keyword" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { computed, ref, watch, nextTick } from "vue";
import { ElLoading, ElMessage } from "element-plus";
import ListingDescription from "/$/app/components/listing-description.vue";
import BatchUpdateKeywordStatus from "/$/app/components/batch-update-keyword-status.vue";
import { useUserStore } from "/$/base/store/user";
import ClDialog from "/~/crud/src/components/dialog";
import { DataLine, Picture } from "@element-plus/icons-vue";
import { generateKeywordSearchVolumeChartOption } from "/$/app/utils";
import KeywordFilterStatus from "/$/app/components/keyword-filter-status.vue";
import DuplicatorForKeywordOrCompetitor from "/$/app/components/duplicator-for-keyword-or-competitor.vue";
import { appConfig } from "../../../../../appConfig";
import { convert_image_url } from "/$/app/utils";
import pinyin from "pinyin";

const { service } = useCool();

const props = defineProps(["listing"]);

const userStore = useUserStore();
const is_admin = computed(() => {
	return "admin" === userStore.info?.username;
});

const Crud = useCrud(
	{
		service: service.app.keyword,

		async onRefresh(params, { next, done, render }) {
			if (showOnlyStatusLibrary.value)
				Object.assign(params, { status: appConfig.KEYWORD_STATUS.LIBRARY.value });
			if (currentCountry.value) {
				params.marketplaces = currentCountry.value;
			}
			const { list } = await next({
				...params,

				// sid: props.listing?.sid,
				asin: props.listing?.asin
				// seller_sku: props.listing?.seller_sku,
			});
			render(list);
			updateSelectedKeywordsByCountry(list);
		}
	},
	(app) => {
		app.refresh({
			size: 50
		});
	}
);

function updateSelectedKeywordsByCountry(keywordList: any[]) {
	// 按国家分组，只保留有关键词类型的
	const byCountry: Record<string, any[]> = {};
	keywordList.forEach((keyword) => {
		if (keyword.keyword_type && keyword.marketplaces) {
			// 确保国家字段是字符串类型
			const country = String(keyword.marketplaces);
			if (!byCountry[country]) {
				byCountry[country] = [];
			}
			byCountry[country].push(keyword);
		}
	});

	// 更新selectedKeywordsByCountry，只更新当前获取到的数据中存在的国家
	Object.keys(byCountry).forEach((country) => {
		// 确保我们不会覆盖已经存在的选择
		if (!selectedKeywordsByCountry.value[country]) {
			selectedKeywordsByCountry.value[country] = [];
		}

		// 合并现有选择和新的关键词
		const existingIds = new Set(selectedKeywordsByCountry.value[country].map((k) => k.id));
		byCountry[country].forEach((k) => {
			if (!existingIds.has(k.id)) {
				selectedKeywordsByCountry.value[country].push(k);
			}
		});
	});

	// 更新当前国家的表格选中状态
	if (currentCountry.value) {
		const currentCountryKeywords = selectedKeywordsByCountry.value[currentCountry.value] || [];
		nextTick(() => {
			Table.value?.clearSelection();
			Table.value?.data.forEach((row: any) => {
				const isSelected = currentCountryKeywords.some((k) => k.id === row.id);
				Table.value?.toggleRowSelection(row, isSelected);
			});
		});
	}
}

watch(props, () => {
	Crud.value?.refresh();
});

const showOnlyStatusLibrary = ref(true);
watch([showOnlyStatusLibrary], () => {
	setTimeout(() => Crud.value!.refresh(), 200);
});

const Table = useTable({
	columns: [
		{ type: "selection", fixed: "left" },

		{
			label: "关键词",
			prop: "value",
			minWidth: 160,
			"show-overflow-tooltip": true,
			fixed: "left",
			sortable: "custom"
		},
		{
			label: "关键词中文意思",
			prop: "value_cn",
			minWidth: 160,
			"show-overflow-tooltip": true,
			fixed: "left",
			sortable: "custom"
		},
		{ label: "搜索直达", prop: "search_page_link", width: 90 },

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
			sortable: "custom"
		},
		{
			label: "关键词类型",
			prop: "keyword_type",
			width: 140,
			align: "center"
		},
		{ label: "国家", prop: "marketplaces", width: 120, sortable: "custom" },
		{ label: "广告竞品数", prop: "ad_competitor_count", width: 120, sortable: "custom" },
		{ label: "PPC竞价", prop: "ppc_bid", width: 120, sortable: "custom" },
		{ label: "PPC竞价最小值", prop: "ppc_bid_min", width: 120, sortable: "custom" },
		{ label: "PPC竞价最大值", prop: "ppc_bid_max", width: 120, sortable: "custom" },
		{ label: "月搜索量", prop: "search_volume_monthly", width: 120, sortable: "desc" },
		{ label: "图片相似度评分", prop: "score1", width: 150, sortable: "custom" },
		{ label: "关键词匹配度评分", prop: "score2", width: 165, sortable: "custom" },
		{
			label: "评分日期",
			prop: "score_time",
			sortable: "custom",
			minWidth: 160,
			component: { name: "cl-date-text" }
		},
		{ label: "搜索量数据 *", prop: "search_volume_data", width: 110, hidden: !is_admin.value },
		{ label: "搜索量走势", prop: "search_volume_chart", width: 70 },
		{
			label: "月搜索量查询时间 *",
			prop: "search_volume_monthly_update_time",
			width: 180,
			component: { name: "cl-date-text" },
			sortable: "custom",
			hidden: !is_admin.value
		},
		{ label: "权重", prop: "weight", width: 100, sortable: "custom" },
		{
			label: "创建时间",
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
			sortable: "custom"
		},

		{ type: "op", buttons: ["edit", "delete"] }
	]
});

const Upsert = useUpsert({
	dialog: {
		draggable: true,
		"align-center": true,
		width: "650"
	},
	props: {
		labelWidth: 150
	},
	items: [
		{
			label: "关键词条",
			prop: "value",
			component: { name: "el-input", props: { clearable: true } },
			required: true
		},

		{
			label: "状态",
			prop: "status",
			component: {
				name: "el-radio-group",
				options: [
					{ label: "待调研", value: 0 },
					{ label: "调研中", value: 1 },
					{ label: "待入库", value: 2 },
					{ label: "已入库", value: 3 },
					{ label: "已归档", value: 4 }
				]
			},
			value: 0,
			required: true
		},
		{
			label: "是否核心关键词",
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
			label: "权重",
			prop: "weight",
			hook: "number",
			component: { name: "el-input-number" },
			required: true
		}
	]
});

const batchImportDialogVisible = ref(false);
const importingKeywordsInput = ref("");
const importAsCoreKeyword = ref(false);

async function setKeywordTypesByAsin() {
	try {
		const result = await service.app.keyword.setKeywordTypesByAsin({
			asin: props.listing?.asin
		});
		if ("ok" === result) {
			ElMessage.success("设置成功");
			Crud.value?.refresh();
		} else {
			ElMessage.error("设置失败，请重试。");
		}
	} catch (error) {
		console.error("设置失败:", error);
		ElMessage.error("设置失败");
	}
}
async function importKeywords() {
	let input = importingKeywordsInput.value
		.trim()
		.split("\n")
		.map((row) => row.trim())
		.filter((row) => row);

	if (input.length === 0) {
		ElMessage.info("请填写内容。");
		return false;
	}

	const loading = ElLoading.service({
		lock: true,
		text: "请稍后"
	});
	try {
		const result = await service.app.keyword.batch_import({
			sid: props.listing?.sid,
			asin: props.listing?.asin,
			seller_sku: props.listing?.seller_sku,
			keywords: input
		});
		if ("ok" === result) {
			ElMessage.success("导入成功");
			importingKeywordsInput.value = "";
			Crud.value?.refresh();
		} else {
			ElMessage.error("导入失败，请重试。");
		}
	} catch (err: any) {
		ElMessage.error(err);
	} finally {
		batchImportDialogVisible.value = false;
		loading.close();
	}
}

const jsonViewerDialogVisible = ref(false);
const jsonViewerContent = ref();

// 响应式变量
const selectedLongTail = ref<number[]>([]);

// 新增国家选择

// script 部分修改
const batchAction = ref("");

// 处理批量操作
async function handleBatchAction(action: string) {
	const selection = Table.value?.selection;

	if (!selection || selection.length === 0) {
		ElMessage.warning("请先勾选要操作的关键词");
		batchAction.value = "";
		return;
	}

	// 立即更新前端显示
	selection.forEach((row) => {
		row.keyword_type = action; // 直接修改选中行的标签
	});

	ElMessage.success(`已更新 ${selection.length} 个关键词类型`);
	batchAction.value = "";
}

interface OutputItem {
	asin: string;
	price: number;
	title: string;
	bullet_points: string;
	核心大词: string[];
	核心词: string[];
	长尾词: string[];
	国家: string;
}
// 新增状态
const competitorDialogVisible = ref(false);
const competitors = ref<any[]>([]);
const selectedCompetitors = ref<any[]>([]);
const tempSelectedCompetitors = ref<any[]>([]);
const CompetitorTable = ref(); // 添加表格引用

// 处理表格选择变化
function handleCompetitorSelection(selection: any[]) {
	if (selection.length > 4) {
		const validSelection = selection.slice(0, 4);
		tempSelectedCompetitors.value = validSelection;
		nextTick(() => {
			CompetitorTable.value.clearSelection();
			validSelection.forEach((row) => {
				CompetitorTable.value.toggleRowSelection(row, true);
			});
		});
		ElMessage.warning("最多只能选择4个竞品");
	} else {
		// 按国家+ASIN去重
		const uniqueSelection: any[] = []; // 明确指定数组类型为any[]
		const seenIds = new Set();

		selection.forEach((row) => {
			// 使用 id 作为唯一标识符
			if (row.id && !seenIds.has(row.id)) {
				seenIds.add(row.id);
				uniqueSelection.push(row);
			}
		});

		tempSelectedCompetitors.value = uniqueSelection;
	}
}

// 处理表格选择变化
function handleSelectionChange() {
	const rows = Table.value?.data; // 获取表格中的所有行

	if (rows?.length) {
		rows.forEach((row) => {
			if (row.keyword_type) {
				if (currentCountry.value) {
					// 深拷贝避免引用问题
					selectedKeywordsByCountry.value[currentCountry.value] =
						selectedKeywordsByCountry.value[currentCountry.value] || [];
					selectedKeywordsByCountry.value[currentCountry.value] = rows.filter(
						(r) => r.keyword_type
					);
				}
			}
		});
	}
}

const COUNTRY_LANG_MAP = {
	美国: "English",
	英国: "English",
	德国: "German",
	法国: "French",
	意大利: "Italian",
	西班牙: "Spanish"
};

// 替换原来的 selectedCountries 和 currentCountry
const selectedCountries = ref<string[]>([]); // 选中的国家列表
const currentCountry = ref(""); // 当前查看的国家
const selectedKeywordsByCountry = ref<Record<string, any[]>>({}); // 按国家存储关键词选择
const selectedCompetitorsByCountry = ref<Record<string, any[]>>({}); // 按国家存储竞品选择

async function handleCountryChange(country: string) {
	// 切换到新国家
	currentCountry.value = country;

	// 刷新表格数据
	await Crud.value?.refresh();

	// 获取当前选中的数据
	const selectedData = Table.value?.selection || [];
	console.log("当前选中数据：", selectedData);

	// 恢复新国家的选择状态
	nextTick(() => {
		Table.value?.clearSelection();
		const currentSelection = selectedKeywordsByCountry.value[country] || [];

		// 更可靠的选择恢复方式
		Table.value?.data.forEach((row: any) => {
			const isSelected = currentSelection.some((selectedRow) => selectedRow.id === row.id);
			Table.value?.toggleRowSelection(row, isSelected);
		});
	});
}

// 表格过滤方法
const getBulletPointsCacheKey = () => `bullet_points_${props.listing?.asin}`;
const getDescriptionCacheKey = () => `product_description_${props.listing?.asin}`;

// 在声明 customBulletPoints 后添加 watch
const customBulletPoints = ref<string[]>(Array(8).fill(""));

// 添加 watch 监听 customBulletPoints 变化
watch(
	customBulletPoints,
	(newValue) => {
		localStorage.setItem(getBulletPointsCacheKey(), JSON.stringify(newValue));
	},
	{ deep: true }
);

const productDescription = ref("");
// 添加 watch 监听 productDescription 变化
watch(productDescription, (newValue) => {
	localStorage.setItem(getDescriptionCacheKey(), newValue);
});

// 打开竞品选择对话框时加载缓存
async function openCompetitorDialog() {
	const loading = ElLoading.service();
	try {
		const res = await service.app.bsr_candidate_competitor_customize.page({
			candidate_id: props.listing?.asinid,
			page: 1,
			size: 100
		});
		competitors.value = res.list;

		// 从缓存加载卖点和描述
		const cachedBulletPoints = localStorage.getItem(getBulletPointsCacheKey());
		if (cachedBulletPoints) {
			customBulletPoints.value = JSON.parse(cachedBulletPoints);
		}

		const cachedDescription = localStorage.getItem(getDescriptionCacheKey());
		if (cachedDescription) {
			productDescription.value = cachedDescription;
		}

		tempSelectedCompetitors.value = [
			...(selectedCompetitorsByCountry.value[currentCountry.value] || [])
		];

		nextTick(() => {
			allCompetitors.value.forEach((row) => {
				const isSelected = selectedCompetitorsGlobal.value.some((s) => s.id === row.id);
				CompetitorTable.value?.toggleRowSelection(row, isSelected);
			});
		});
	} finally {
		loading.close();
	}
	competitorDialogVisible.value = true;
}

// 确认选择竞品
function confirmCompetitors() {
	selectedCompetitorsGlobal.value = [...tempSelectedCompetitors.value];

	// 按国家分组保存选择的竞品
	const byCountry: Record<string, any[]> = {};
	tempSelectedCompetitors.value.forEach((comp) => {
		if (!byCountry[comp.marketplace]) {
			byCountry[comp.marketplace] = [];
		}
		byCountry[comp.marketplace].push(comp);
	});
	selectedCompetitorsByCountry.value = byCountry;

	competitorDialogVisible.value = false;
}

function validateKeywordsForCountry(country: string): boolean {
	const keywords = selectedKeywordsByCountry.value[country] || [];

	// 统计核心大词和核心词的数量
	const coreMajorCount = keywords.filter((k) => k.keyword_type === "core_major").length;
	const coreCount = keywords.filter((k) => k.keyword_type === "core").length;

	// 检查条件：至少1个核心大词和2个核心词
	if (coreMajorCount < 1) {
		ElMessage.error(`国家 ${country} 需要至少选择一个核心大词`);
		return false;
	}

	if (coreCount < 2) {
		ElMessage.error(`国家 ${country} 需要至少选择两个核心词`);
		return false;
	}

	return true;
}
const hasCompetitorsOrBulletPoints = computed(() => {
	// 检查是否选择了竞品（全局竞品或按国家选择的竞品）
	const hasCompetitors =
		selectedCompetitorsGlobal.value.length > 0 ||
		Object.values(selectedCompetitorsByCountry.value).some((arr) => arr.length > 0);

	// 检查是否填写了自定义卖点
	const hasCustomBulletPoints = customBulletPoints.value.some((point) => point.trim() !== "");

	return hasCompetitors || hasCustomBulletPoints;
});

async function exportListing() {
	if (selectedCountries.value.length === 0) {
		ElMessage.error("请至少选择一个国家");
		return;
	}
	// if (!selectedVariant.value) {
	//   ElMessage.error('请先选择一个变体');
	//   return;
	// }
	if (!hasCompetitorsOrBulletPoints.value) {
		ElMessage.error("请至少选择一个竞品或填写自定义卖点");
		return;
	}
	for (const country of selectedCountries.value) {
		if (!validateKeywordsForCountry(country)) {
			return; // 如果有任何一个国家不满足条件，就停止执行
		}
	}

	// 处理卖点逻辑
	const processBulletPoints = () => {
		const userBullets = customBulletPoints.value.filter((b) => b.trim());
		if (userBullets.length >= 5) return [userBullets.slice(0, 8)];

		// 合并所有竞品卖点
		const competitorBullets = selectedCompetitorsGlobal.value
			.map(
				(c) =>
					(c.bullet_points?.split("\n") || [])
						.map((b) => b.trim())
						.filter(Boolean)
						.slice(0, 5) // 每个竞品最多取5个卖点
			)
			.filter((arr) => arr.length > 0); // 过滤掉空数组

		return [...(userBullets.length ? [userBullets.slice(0, 8)] : []), ...competitorBullets];
	};
	const bullets = processBulletPoints(); // 返回数组格式

	// 定义account_name映射关系
	const accountNameMap = {
		YY: "壹逸",
		QL: "琦路",
		RJH: "瑞君衡",
		TLGY: "汤了个圆",
		AYT: "艾优途",
		RY: "润云"
	};

	// 遍历所有选中的国家
	for (const country of selectedCountries.value) {
		let generatedSKU = props.listing?.msku;
		// 更新listing数据
		await service.app.bsr_candidate_customize.update({
			id: props.listing?.id,
			msku: generatedSKU
		});

		// 提取SKU前缀（第一个"-"前面的部分）
		const skuPrefix = generatedSKU ? generatedSKU.split("-")[0] : "";
		// 根据前缀获取对应的account_name，如果没有匹配则使用默认值
		const accountName = accountNameMap[skuPrefix] || selectedStore.value?.account_name;

		// 获取当前国家的关键词
		const countryKeywords = (selectedKeywordsByCountry.value[country] || [])
			.filter((k) => k.marketplaces === country)
			.map((k) => ({
				type:
					k.keyword_type === "core_major"
						? "核心大词"
						: k.keyword_type === "core"
							? "核心词"
							: "长尾词",
				keyword: k.value,
				search_volume: k.search_volume_monthly || 1
			}));

		// 获取当前国家的节点
		const nodeInfo = selectedNodesByCountry.value[country];

		// 获取当前国家的竞品标题
		const countryCompetitors = selectedCompetitorsByCountry.value[country] || [];
		const competitorTitles = countryCompetitors.map((c) => c.item_name);

		// 如果当前国家没有竞品，使用全局竞品
		if (competitorTitles.length === 0) {
			competitorTitles.push(...selectedCompetitorsGlobal.value.map((c) => c.item_name));
		}
		const productInitials = pinyin(selectedVariant.value?.name, {
			style: pinyin.STYLE_FIRST_LETTER
		})
			.map((arr) => arr[0].toUpperCase())
			.join("")
			.substring(0, 5);

		const productSummary = selectedVariant.value?.description;

		const requestBody = {
			assistant_id: "amazon_listing_generator",
			asin: props.listing?.asin,
			candidate_id: props.listing?.id,
			msku: generatedSKU + "-" + productInitials,
			sku: props.listing?.sku,
			image_url: props.listing?.image_url,
			produce_name: props.listing?.produce_name,
			HS_code: props.listing?.HS_code,
			input: {
				language: COUNTRY_LANG_MAP[country],
				keywords: countryKeywords, // 当前国家的关键词
				competitor_titles: competitorTitles, // 当前国家的竞品标题
				competitor_bullet_points: bullets, // 格式为[["卖点1", "卖点2", ...], ["卖点1", "卖点2", ...]]
				product_description: productDescription.value, // 添加产品描述
				product_args: "",
				key_parameters: "",
				package_info: "",
				duplicate_num: 1,
				product_summary: productSummary
			},
			seller_info: {
				account_name: accountName, // 使用映射后的account_name
				seller_account_id: "",
				sid: selectedStore.value?.sid
			},
			node_info: {
				bsr_node: nodeInfo?.bsr_node,
				bsr_node_rank: nodeInfo?.bsr_node_rank,
				bsr_node_id: nodeInfo?.bsr_node_id, // 当前国家的节点ID
				bsr_category: nodeInfo?.bsr_category
			},
			variant: {
				procurement: selectedVariant.value?.procurement,
				selectedVariant: selectedVariant.value?.selected_variant,
				factory_links: props.listing?.factory_links,
				variant_Combination: props.listing?.variant_Combination
			}
		};

		console.log("Request Body for", country, ":", requestBody);

		// 调用接口
		try {
			await service.app.search_threads.createAmazonListing(requestBody);
			ElMessage.success(`${country} Listing生成请求已提交`);
		} catch (err) {
			console.error(`${country} Listing生成失败:`, err);
			ElMessage.error(`${country} Listing生成失败: ${err}`);
		}
	}
}

const selectedCompetitorsGlobal = ref<any[]>([]); // 全局共享的竞品选择
const allCompetitors = ref<any[]>([]); // 所有国家竞品

// 新增店铺相关代码
interface Store {
	seller_account_id: string;
	account_name: string;
	sid: number;
}

const selectedStore = ref<Store>();

// 在 script 部分添加去重逻辑
const storeList = ref<
	Array<{
		sid: number;
		seller_account_id: string;
		account_name: string;
	}>
>([]);

// 计算属性：去重后的店铺列表
const uniqueStoreList = computed(() => {
	const seen = new Map();
	return storeList.value.filter((store) => {
		// 如果这个账号名称还没出现过，保留它
		if (!seen.has(store.account_name)) {
			seen.set(store.account_name, true);
			return true;
		}
		return false;
	});
});

// 监听用户信息变化获取店铺列表
watch(
	() => userStore.info,
	async (userInfo) => {
		if (userInfo?.sidList?.length) {
			try {
				const res = await service.app.seller.page({
					sids: userInfo.sidList.join(","),
					page: 1,
					size: 1000
				});

				// 原始店铺列表（包含可能的重复名称）
				storeList.value = res.list.map((store) => ({
					sid: Number(store.sid) || 0,
					seller_account_id: store.seller_account_id?.toString() || "",
					account_name: store.account_name?.toString() || ""
				}));

				// 默认选择去重后的第一个店铺
				if (uniqueStoreList.value.length > 0) {
					selectedStore.value = uniqueStoreList.value[0];
				}
			} catch (err) {
				console.error("获取店铺列表失败:", err);
			}
		}
	},
	{ immediate: true }
);

// 店铺选择处理
function handleStoreChange(store) {
	console.log("当前选中店铺:", store);
	// 可以在这里处理店铺切换后的逻辑
}

interface BsrNode {
	bsr_node: string;
	bsr_node_rank: number;
	bsr_node_id: string;
	count: number;
	total_sales: number;
	bsr_category: string;
	marketplace: string;
	nodes: any[];
}

const bsrNodes = ref<BsrNode[]>([]);

// 监听listing变化获取节点数据
watch(
	() => props.listing?.asin,
	async (asin) => {
		if (asin) {
			try {
				const res = await service.app.bsr_candidate_competitor.page({
					asin_candidate: asin,
					page: 1,
					size: 1000
				});

				// 处理节点数据 - 按节点名称和国家分组并合并
				const groupedNodes = {};

				res.list.forEach((item) => {
					const nodeName = item.bsr_node?.trim() || "";
					// 新增：过滤掉节点ID为空的项
					if (!nodeName || !item.bsr_node_id) return;

					const key = `${nodeName}|${item.marketplace}`;

					if (!groupedNodes[key]) {
						groupedNodes[key] = {
							bsr_node: nodeName,
							marketplace: item.marketplace,
							count: 0,
							total_sales: 0, // 使用新字段存储总销量
							bsr_node_id: item.bsr_node_id,
							nodes: [], // 保存原始节点用于后续选择
							bsr_category: item.bsr_category
						};
					}

					// 累加竞品数量和父体销量（数值相加）
					const sales = item.Main_monthly_sales ? parseFloat(item.Main_monthly_sales) : 0;
					groupedNodes[key].count += 1;
					groupedNodes[key].total_sales += sales; // 数值相加
					groupedNodes[key].nodes.push(item);
				});

				// 转换为数组并按总销量排序
				bsrNodes.value = (Object.values(groupedNodes) as BsrNode[]).sort(
					(a, b) => b.total_sales - a.total_sales
				); // 按数值排序

				// 为每个国家设置默认选择（节点ID不为空且总销量最高的节点）
				["英国", "德国", "法国", "西班牙", "意大利"].forEach((country) => {
					// 筛选出该国家且节点ID不为空的节点
					const nodesForCountry = bsrNodes.value.filter(
						(node) => node.marketplace === country && node.bsr_node_id
					);

					if (nodesForCountry.length > 0) {
						// 选择该国家中总销量最高的节点（已按销量排序，取第一个）
						selectedNodesByCountry.value[country] = nodesForCountry[0];
					}
				});
			} catch (err) {
				console.error("获取BSR节点失败:", err);
			}
		}
	},
	{ immediate: true }
);

const countryKeywordCounts = ref<Record<string, number>>({
	美国: 0,
	英国: 0,
	德国: 0,
	法国: 0,
	意大利: 0,
	西班牙: 0
});

// 在watch中自动设置选中
watch(
	() => props.listing?.asin,
	async (asin) => {
		if (asin) {
			try {
				const res = await service.app.keyword.countByCountry({ asin });
				countryKeywordCounts.value = res;
				console.log("countryKeywordCounts:", countryKeywordCounts.value);
				// 自动勾选符合条件的国家
				selectedCountries.value = Object.keys(countryKeywordCounts.value).filter(
					(country) => countryKeywordCounts.value[country] >= 3
				);
			} catch (err) {
				console.error("获取国家关键词统计失败:", err);
			}
		}
	},
	{ immediate: true }
);

// 新增预览相关状态
const previewDialogVisible = ref(false);
const previewImageUrl = ref("");

// 重置预览状态
function resetPreview() {
	previewImageUrl.value = "";
}

const selectedNodesByCountry = ref({
	英国: null,
	德国: null,
	法国: null,
	西班牙: null,
	意大利: null
});

const filteredBsrNodes = (country) => {
	return (bsrNodes.value || [])
		.filter((node) => node?.marketplace === country)
		.sort((a, b) => b.total_sales - a.total_sales); // 按数值排序
};

function truncateBulletPoints(text, maxLength) {
	if (!text) return "";
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + "...";
}

async function fetchBulletPoints(competitor) {
	try {
		competitor.fetchingBulletPoints = true; // 设置加载状态
		const result = await service.app.bsr_candidate.fetchAndSaveProductInfo({
			id: competitor.id,
			marketplace: competitor.marketplace,
			asin: competitor.asin_competitor
		});

		if ("ok" === result) {
			ElMessage.success("获取成功");

			// 更新当前竞品的卖点信息
			const updatedCompetitor = await service.app.bsr_candidate_competitor_customize.info({
				id: competitor.id
			});

			// 在竞品列表中找到并更新该竞品
			const index = competitors.value.findIndex((c) => c.id === competitor.id);
			if (index !== -1) {
				competitors.value[index] = {
					...competitors.value[index],
					...updatedCompetitor,
					fetchingBulletPoints: false
				};
			}
		} else {
			ElMessage.error("获取失败，请重试。");
		}
	} catch (err) {
		console.error("获取失败:", err);
	} finally {
		competitor.fetchingBulletPoints = false;
	}
}

interface Variant {
	name: string;
	description: string;
	showTooltip: boolean;
	selectedGroups: string[];
	groupProportions: Record<string, number>;
}

const variants = ref<Variant[]>([]); // 存储变体列表
const selectedVariant = ref<Variant>(); // 当前选中的变体

// 处理变体选择变化
function handleVariantChange(variant: Variant) {
	console.log("当前选中变体:", variant);
	// 这里可以添加变体变化后的处理逻辑
	// 例如更新相关数据或触发其他操作
}
</script>

<style scoped>
.truncated-bullet-points {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 300px;
	/* 增加默认显示宽度 */
	cursor: pointer;
}

/* 添加全局样式确保弹窗足够宽 */
:deep(.wide-bullet-points-popover) {
	max-width: 800px !important;
	max-height: 500px !important;
	overflow: auto !important;
}

.full-bullet-points {
	white-space: pre-line;
	max-height: 400px;
	overflow-y: auto;
	padding: 10px;
	font-size: 14px;
	line-height: 1.6;
}

:deep(.el-radio) {
	margin-right: 0;
}

:deep(.el-checkbox) {
	margin-right: 0;
}

.dialog-content {
	max-height: 70vh;
	overflow-y: auto;
	padding: 0 20px;
}

.el-form-item {
	margin-bottom: 12px;
}

.el-textarea {
	font-family: Monaco, Consolas, monospace;
}

.loading-indicator {
	display: flex;
	align-items: center;
	color: #999;
	font-size: 12px;
}
</style>
