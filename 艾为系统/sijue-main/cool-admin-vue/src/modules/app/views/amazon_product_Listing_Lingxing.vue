<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />
			<!-- 状态筛选 -->
			<el-select
				v-model="filters.status"
				placeholder="状态"
				style="margin-right: 10px; width: 150px"
				@change="handleFilterChange('status', $event)"
				multiple
				collapse-tags
			>
				<el-option
					v-for="item in statusOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 异常销售筛选 -->
			<el-select
				v-model="filters.sale_analyze"
				placeholder="异常销售"
				style="margin-right: 10px; width: 150px"
				@change="handleFilterChange('sale_analyze', $event)"
				multiple
				collapse-tags
			>
				<el-option
					v-for="item in saleAnalyzeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 站点筛选 -->
			<el-select
				v-model="filters.marketplace"
				placeholder="站点"
				style="margin-right: 10px; width: 150px"
				@change="handleFilterChange('marketplace', $event)"
				multiple
				collapse-tags
			>
				<el-option
					v-for="item in marketplaceOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 销量分析筛选 -->
			<el-select
				v-model="filters.volume_analyze_result"
				placeholder="销量分析"
				style="margin-right: 10px; width: 150px"
				@change="handleFilterChange('volume_analyze_result', $event)"
				multiple
				collapse-tags
			>
				<el-option
					v-for="item in volumeAnalyzeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 价格分析筛选 -->
			<el-select
				v-model="filters.price_analyze_result"
				placeholder="价格分析"
				style="margin-right: 10px; width: 150px"
				@change="handleFilterChange('price_analyze_result', $event)"
				multiple
				collapse-tags
			>
				<el-option
					v-for="item in priceAnalyzeOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<!-- 到货分析 -->
			<!-- <el-select v-model="filters.arrival_analyze_result" placeholder="到货分析"
				style="margin-right: 10px; width: 150px" @change="handleFilterChange('arrival_analyze_result', $event)"
				multiple collapse-tags>
				<el-option v-for="item in arrivalanalyzeOptions" :key="item.value" :label="item.label"
					:value="item.value" />
			</el-select> -->

			<!-- 任务状态刷新按钮 -->
			<el-button @click="fetchTaskStatus()" type="primary" style="margin-right: 10px">
				<el-icon><refresh /></el-icon> 刷新任务状态
			</el-button>

			<!-- 八爪鱼识图按钮 -->
			<el-button
				@click="bzyShiTu()"
				type="success"
				:disabled="isBzyTaskRunning"
				:loading="isBzyTaskRunning"
				style="margin-right: 10px"
			>
				<template v-if="isBzyTaskRunning">
					<el-icon><loading /></el-icon> 八爪鱼识图中...
				</template>
				<template v-else-if="lastBzyTaskStatus === 'Finished'">
					<el-icon><check /></el-icon> 八爪鱼识图(已完成)
				</template>
				<template v-else-if="lastBzyTaskStatus === 'Failed'">
					<el-icon><warning /></el-icon> 八爪鱼识图(失败)
				</template>
				<template v-else> 八爪鱼识图 </template>
			</el-button>
			<!-- 八爪鱼进度显示 -->
			<el-text v-if="bzyTaskProgress" type="secondary" style="margin-right: 15px">
				{{ bzyTaskProgress }}
			</el-text>

			<!-- 获取搜索页数据按钮 -->
			<el-button
				@click="searchByItemName()"
				type="success"
				:disabled="isSearchTaskRunning"
				:loading="isSearchTaskRunning"
				style="margin-right: 10px"
			>
				<template v-if="isSearchTaskRunning">
					<el-icon><loading /></el-icon> 搜索中...
				</template>
				<template v-else-if="lastSearchTaskStatus === 'Finished'">
					<el-icon><check /></el-icon> 搜索(已完成)
				</template>
				<template v-else-if="lastSearchTaskStatus === 'Failed'">
					<el-icon><warning /></el-icon> 搜索(失败)
				</template>
				<template v-else> 获取搜索页数据 </template>
			</el-button>
			<!-- 搜索进度显示 -->
			<el-text v-if="searchTaskProgress" type="secondary" style="margin-right: 15px">
				{{ searchTaskProgress }}
			</el-text>

			<el-button @click="aliyunImageUpload()" type="success"> 阿里云图片上传 </el-button>

			<!-- 阿里云图片对比按钮 -->
			<el-button
				@click="aliyunImageSearch()"
				type="success"
				:disabled="isAliyunTaskRunning"
				:loading="isAliyunTaskRunning"
			>
				<template v-if="isAliyunTaskRunning">
					<el-icon><loading /></el-icon> 对比中...
				</template>
				<template v-else-if="lastAliyunTaskStatus === 'Finished'">
					<el-icon><check /></el-icon> 对比(已完成)
				</template>
				<template v-else-if="lastAliyunTaskStatus === 'Failed'">
					<el-icon><warning /></el-icon> 对比(失败)
				</template>
				<template v-else> 阿里云图片对比 </template>
			</el-button>
			<!-- 阿里云进度显示 -->
			<el-text v-if="aliyunTaskProgress" type="secondary">
				{{ aliyunTaskProgress }}
			</el-text>

			<!-- <el-button type="warning" @click="handleExport2">
				导出竞品详情所需
			</el-button>
			
			<cl-import-btn tips="" :on-submit="onSubmit2" type="warning" /> -->

			<el-button type="warning" @click="getCompetitor"> 获取竞品详情 </el-button>

			<el-button @click="handleMergeId" type="primary" style="margin-right: 10px">
				合并编号
			</el-button>

			<el-button @click="requestLingXingListing" type="primary" style="margin-right: 10px">
				获取数据
			</el-button>

			<el-button
				@click="requestLingXingShipmentStatus"
				type="primary"
				style="margin-right: 10px"
			>
				更新在途状态
			</el-button>

			<cl-flex1 />
			<!-- 关键字搜索 -->
			<cl-search-key placeholder="asin,品名,备注,msku模糊搜索" />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table">
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
									/>
								</template>
							</div>
						</template>
					</el-popover>
				</template>
				<template #slot-management-buttons="{ scope }">
					<el-tooltip content="分析" placement="top" :hide-after="0">
						<el-button
							type="success"
							size="default"
							plain
							circle
							@click="
								curEditingLingxingComponent = scope.row;
								lingxingComponentManagementPaneVisible = true;
							"
						>
							<el-icon>
								<memo />
							</el-icon>
						</el-button>
					</el-tooltip>
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

		<el-drawer v-model="lingxingComponentManagementPaneVisible" size="90%" direction="ltr">
			<lingxing-component :lingxing="curEditingLingxingComponent"></lingxing-component>
		</el-drawer>
	</cl-crud>
</template>

<script lang="ts" name="app-amazon_product_Listing_Lingxing" setup>
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { convert_image_url } from "/$/app/utils";
import { computed, ref, onMounted } from "vue";
import LingxingComponent from "/$/app/components/amazon_product_Listing_Lingxing_component.vue";
import { Loading, Check, Warning, Memo, Refresh } from "@element-plus/icons-vue";
import * as XLSX from "xlsx";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";

// 任务状态类型定义（包含统计字段）
interface TaskInfo {
	id?: number;
	createTime?: string;
	updateTime?: string;
	taskName?: string;
	taskCode?: string;
	taskStatus?: "Unexecuted" | "Running" | "Finished" | "Failed" | "Stopped";
	invokeTime?: string;
	executeStartTime?: string | null;
	executeEndTime?: string | null;
	retryCount?: number;
	maxRetryCount?: number;
	executeResult?: string | null;
	remark?: string | null;
	countryCode?: string;
	totalCount?: number; // 总条数
	completedCount?: number; // 完成条数
}

interface AllTaskStatus {
	overallTask?: TaskInfo | null;
	bzyTask?: TaskInfo | null;
	searchTask?: TaskInfo | null;
	aliyunTask?: TaskInfo | null;
}

const { service } = useCool();

// 任务状态管理
const taskStatus = ref<AllTaskStatus>({
	overallTask: null,
	bzyTask: null,
	searchTask: null,
	aliyunTask: null
});

// 组件状态管理
const lingxingComponentManagementPaneVisible = ref(false);
const curEditingLingxingComponent = ref<any>(null);

// 任务状态计算属性
const isBzyTaskRunning = computed(() => taskStatus.value.overallTask?.taskStatus === "Running");

const isSearchTaskRunning = computed(() => taskStatus.value.searchTask?.taskStatus === "Running");

const isAliyunTaskRunning = computed(() => taskStatus.value.aliyunTask?.taskStatus === "Running");

const isAnyTaskRunning = computed(
	() => isBzyTaskRunning.value || isSearchTaskRunning.value || isAliyunTaskRunning.value
);

const lastBzyTaskStatus = computed(() => {
	const status = taskStatus.value.overallTask?.taskStatus || "";
	return status;
});

const lastSearchTaskStatus = computed(() => taskStatus.value.searchTask?.taskStatus || "");

const lastAliyunTaskStatus = computed(() => taskStatus.value.aliyunTask?.taskStatus || "");

// 任务进度计算属性
const bzyTaskProgress = computed(() => {
	const task = taskStatus.value.overallTask;
	if (!task || (task.totalCount === undefined && task.completedCount === undefined)) {
		return null;
	}
	if (task.totalCount === 0) {
		return "总条数: 0";
	}
	const completed = task.completedCount || 0;
	const total = task.totalCount || 0;
	const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
	return `进度: ${completed}/${total} (${percent}%)`;
});

const searchTaskProgress = computed(() => {
	const task = taskStatus.value.searchTask;
	if (!task || (task.totalCount === undefined && task.completedCount === undefined)) {
		return null;
	}
	if (task.totalCount === 0) {
		return "总条数: 0";
	}
	const completed = task.completedCount || 0;
	const total = task.totalCount || 0;
	const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
	return `进度: ${completed}/${total} (${percent}%)`;
});

const aliyunTaskProgress = computed(() => {
	const task = taskStatus.value.aliyunTask;
	if (!task || (task.totalCount === undefined && task.completedCount === undefined)) {
		return null;
	}
	if (task.totalCount === 0) {
		return "总条数: 0";
	}
	const completed = task.completedCount || 0;
	const total = task.totalCount || 0;
	const percent = total > 0 ? Math.floor((completed / total) * 100) : 0;
	return `进度: ${completed}/${total} (${percent}%)`;
});

// 优化任务状态提示（包含进度）
const currentTaskStatus = computed(() => {
	if (isBzyTaskRunning.value) {
		const task = taskStatus.value.overallTask;
		const progress = task ? `${task.completedCount || 0}/${task.totalCount || 0}` : "";
		return `八爪鱼识图中 ${progress ? `(${progress})` : ""} (${task?.executeResult || ""})`;
	}
	if (isSearchTaskRunning.value) {
		const task = taskStatus.value.searchTask;
		const progress = task ? `${task.completedCount || 0}/${task.totalCount || 0}` : "";
		return `搜索数据中 ${progress ? `(${progress})` : ""} (${task?.executeResult || ""})`;
	}
	if (isAliyunTaskRunning.value) {
		const task = taskStatus.value.aliyunTask;
		const progress = task ? `${task.completedCount || 0}/${task.totalCount || 0}` : "";
		return `图片对比中 ${progress ? `(${progress})` : ""} (${task?.executeResult || ""})`;
	}
	return null;
});

// 获取标签类型
const getTagType = (status: string) => {
	if (status.includes("中")) return "info";
	if (status.includes("已完成")) return "success";
	if (status.includes("失败")) return "danger";
	return "default";
};

// 手动刷新任务状态
const fetchTaskStatus = async () => {
	try {
		ElMessage({ message: "正在刷新任务状态...", type: "info", duration: 1000 });
		const res = await service.app.amazon_product_Listing_Lingxing.getLatestTaskStatus();
		const newStatus = res as AllTaskStatus;
		taskStatus.value = { ...newStatus };
		ElMessage({ message: "任务状态已更新", type: "success", duration: 1000 });
	} catch (error) {
		console.error("获取任务状态失败:", error);
		ElMessage.error("刷新任务状态失败，请重试");
	}
};

// 组件挂载时初始化一次任务状态
onMounted(() => {
	fetchTaskStatus();
});

// cl-upsert配置
const Upsert = useUpsert({
	items: [
		{
			label: "产品编码",
			prop: "product_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "合并编号",
			prop: "mergeId",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "可售量",
			prop: "afn_fulfillable_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "入库中",
			prop: "afn_inbound_receiving_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "在途",
			prop: "afn_inbound_shipped_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "计划入库",
			prop: "afn_inbound_working_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "不可售",
			prop: "afn_unsellable_quantity",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "待发货",
			prop: "reserved_customerorders",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "调仓中",
			prop: "reserved_fc_processing",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "待调仓",
			prop: "reserved_fc_transfers",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "asin",
			prop: "asin",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "asin链接",
			prop: "asin_url",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "品牌id",
			prop: "brand_id",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "分类",
			prop: "category_text",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "货币符号",
			prop: "currency_symbol",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "fba费用",
			prop: "fba_fee",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "首单时间",
			prop: "first_order_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "fnsku",
			prop: "fnsku",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "14日销售额",
			prop: "fourteen_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "14日广告费",
			prop: "fourteen_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "14日销量",
			prop: "fourteen_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "配送方式",
			prop: "fulfillment_channel_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "货币图标",
			prop: "icon",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "领星主键",
			prop: "lx_id",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "图片链接",
			prop: "image_url",
			component: { name: "el-input", props: { clearable: true } }
		},
		{ label: "是否配对", prop: "is_pair", flex: false, component: { name: "cl-switch" } },
		{ label: "是否父体", prop: "is_parent", flex: false, component: { name: "cl-switch" } },
		{
			label: "商品名",
			prop: "item_name",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "listingid",
			prop: "listing_id",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "总价",
			prop: "landed_price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "售价",
			prop: "listing_price",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "售价货币",
			prop: "listing_price_currency_code",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "品名",
			prop: "local_name",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "本地sku",
			prop: "local_sku",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "站点",
			prop: "marketplace",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "站点id",
			prop: "marketplace_id",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "msku",
			prop: "msku",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "创建时间",
			prop: "open_date_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "创建时间",
			prop: "open_date_time_str",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "配对方式",
			prop: "pair_type",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "父体asin",
			prop: "parent_asin",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "品牌名",
			prop: "product_brand_text",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "原产品productId",
			prop: "org_product_id",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{ label: "销量", prop: "quantity", hook: "number", component: { name: "el-input-number" } },
		{ label: "排名", prop: "bs_rank", hook: "number", component: { name: "el-input-number" } },
		{
			label: "备注",
			prop: "remark",
			component: { name: "el-input", props: { type: "textarea", rows: 4 } }
		},
		{
			label: "评论数",
			prop: "reviews_num",
			component: { name: "el-input", props: { clearable: true } }
		},
		{ label: "店铺id", prop: "sid", hook: "number", component: { name: "el-input-number" } },
		{
			label: "卖家名",
			prop: "seller_name",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "7日销售额",
			prop: "seven_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "7日广告费",
			prop: "seven_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{ label: "运费", prop: "shipping", hook: "number", component: { name: "el-input-number" } },
		{
			label: "小类排名",
			prop: "small_rank",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "评分",
			prop: "stars",
			component: { name: "el-input", props: { clearable: true } }
		},
		{
			label: "销售状态(0:停售,1:在售,2:已删除)",
			prop: "status",
			component: { name: "el-radio-group", options: [] }
		},
		{
			label: "30天销售额",
			prop: "thirty_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "30天广告费",
			prop: "thirty_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "30天销量",
			prop: "thirty_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "7日销量",
			prop: "total_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "昨日销售额",
			prop: "yesterday_amount",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "昨日广告费",
			prop: "yesterday_spend",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "昨日销量",
			prop: "yesterday_volume",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "创建时间",
			prop: "create_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "更新时间",
			prop: "update_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "销量分析结果",
			prop: "volume_analyze_result",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "价格分析结果",
			prop: "price_analyze_result",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "在售时间",
			prop: "on_sale_time",
			component: {
				name: "el-date-picker",
				props: { type: "datetime", valueFormat: "YYYY-MM-DD HH:mm:ss" }
			}
		},
		{
			label: "记录异常销售的状态：1：异常销售",
			prop: "sale_analyze_result",
			flex: false,
			component: { name: "cl-switch" }
		},
		// {
		// 	label: "到货分析",
		// 	prop: "arrival_analyze_result",
		// 	hook: "number",
		// 	component: { name: "el-input-number" }
		// },
		{
			label: "是否需要更新销量预测",
			prop: "is_update_quantity_estimate",
			flex: false,
			component: { name: "cl-switch" }
		},
		{
			label: "7天销量均值增长率",
			prop: "growth_rate_quantity_7_days_avg",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "7日销量(欧洲国家与英国分别汇总)",
			prop: "total_volume_sum",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "14日销量(欧洲国家与英国分别汇总)",
			prop: "fourteen_volume_sum",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "30天销量(欧洲国家与英国分别汇总)",
			prop: "thirty_volume_sum",
			hook: "number",
			component: { name: "el-input-number" }
		},
		{
			label: "产品状态",
			prop: "product_state",
			component: { name: "el-radio-group", options: [] }
		},
		{
			label: "过滤类型",
			prop: "filter_type",
			component: { name: "el-radio-group", options: [] }
		},
		{
			label: "是否销量预测参考目标",
			prop: "is_quantity_estimate_target",
			flex: false,
			component: { name: "cl-switch" }
		},
		{ label: "标签", prop: "label", component: { name: "el-radio-group", options: [] } },
		{ label: "价格", prop: "price", hook: "number", component: { name: "el-input-number" } },
		{
			label: "价格(取优惠价和价格两者最低价)",
			prop: "price_target",
			hook: "number",
			component: { name: "el-input-number" }
		}
	]
});

// cl-table配置
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "asin", prop: "asin", minWidth: 140 },
		{
			label: "图片",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 50, fit: "contain" } },
			fixed: "left"
		},
		{ label: "站点", prop: "marketplace", minWidth: 140 },
		{ label: "fnsku", prop: "fnsku", minWidth: 140 },
		{ label: "msku", prop: "msku", minWidth: 140 },
		{ label: "品名", prop: "local_name", minWidth: 140 },
		{ label: "合并编号", prop: "mergeId", minWidth: 140 },
		{
			label: "状态",
			prop: "status",
			dict: [
				{ label: "停售", value: 0, type: "primary" },
				{ label: "在售", value: 1, type: "warning" },
				{ label: "已删除", value: 2, type: "success" }
			],
			width: 80,
			showOverflowTooltip: true,
			sortable: "custom"
		},
		{ label: "7日销量", prop: "total_volume", minWidth: 140 },
		{ label: "14日销量", prop: "fourteen_volume", minWidth: 140 },
		{ label: "30日销量", prop: "thirty_volume", minWidth: 140 },
		{ label: "7日销量(欧洲国家与英国分别汇总)", prop: "total_volume_sum", minWidth: 140 },
		{ label: "14日销量(欧洲国家与英国分别汇总)", prop: "fourteen_volume_sum", minWidth: 140 },
		{ label: "30天销量(欧洲国家与英国分别汇总)", prop: "thirty_volume_sum", minWidth: 140 },
		{
			label: "记录异常销售的状态：1：异常销售",
			prop: "sale_analyze_result",
			minWidth: 100,
			component: { name: "cl-switch" }
		},
		// {
		// 	label: "到货分析", prop: "arrival_analyze_result",
		// 	dict: [
		// 		{ label: "新品在途", value: 0, type: 'warning' },
		// 		{ label: "新品到货1天", value: 1, type: 'warning' },
		// 		{ label: "新品到货2天", value: 2, type: 'warning' },
		// 		{ label: "新品到货3天", value: 3, type: 'warning' },
		// 		{ label: "新品到货4天", value: 4, type: 'warning' },
		// 		{ label: "新品到货5天", value: 5, type: 'warning' },
		// 		{ label: "新品到货6天", value: 6, type: 'warning' },
		// 		{ label: "新品到货7天", value: 7, type: 'warning' },
		// 		{ label: "新品到货超过7天", value: 8, type: 'warning' },
		// 		{ label: "老品到货1天", value: 11, type: 'warning' },
		// 		{ label: "老品到货2天", value: 12, type: 'warning' },
		// 		{ label: "老品到货3天", value: 13, type: 'warning' },
		// 		{ label: "老品到货4天", value: 14, type: 'warning' },
		// 		{ label: "老品到货5天", value: 15, type: 'warning' },
		// 		{ label: "老品到货6天", value: 16, type: 'warning' },
		// 		{ label: "老品到货7天", value: 17, type: 'warning' },
		// 		{ label: "老品到货超过7天", value: 18, type: 'warning' },
		// 		{ label: "新品在售", value: 28, type: 'warning' },
		// 		{ label: "老品在售", value: 38, type: 'warning' },
		// 		{ label: "新品到货1234567天", value: -1, type: 'warning' },
		// 		{ label: "老品到货1234567天", value: -2, type: 'warning' },
		// 		{ label: "新品断货到货1234567天", value: -3, type: 'warning' },
		// 		{ label: "老品断货到货1234567天", value: -4, type: 'warning' },
		// 	],
		// 	width: 180, showOverflowTooltip: true, sortable: "custom",
		// },
		{ label: "可售量", prop: "afn_fulfillable_quantity", minWidth: 140 },
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
			width: 180,
			showOverflowTooltip: true,
			sortable: "custom"
		},
		{ label: "优惠价", prop: "listingPrice", minWidth: 140 },
		{ label: "价格", prop: "price", minWidth: 140 },
		{ label: "价格(综合)", prop: "price_target", minWidth: 140 },
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
			width: 180,
			showOverflowTooltip: true,
			sortable: "custom"
		},
		{ label: "跟踪人", prop: "userIdComplete", minWidth: 140 },
		{ label: "备注", prop: "remark", showOverflowTooltip: true, minWidth: 200 },
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
		{
			label: "操作",
			type: "op",
			buttons: ["edit", "delete", "slot-management-buttons"]
		}
	]
});

// cl-crud配置
const Crud = useCrud(
	{
		service: service.app.amazon_product_Listing_Lingxing,
		async onRefresh(params, { next }) {
			const { list } = await next({ ...params });
			Table.value?.data.forEach((item: any) => {
				item.image_url_display = convert_image_url(item.image_url);
			});
		}
	},
	(app) => {
		app.refresh();
	}
);

// 筛选器配置
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
	{ label: "老品到货超过7天", value: "18" },
	{ label: "新品在售", value: "28" },
	{ label: "老品在售", value: "38" },
	{ label: "新品到货1234567天", value: "-1" },
	{ label: "老品到货1234567天", value: "-2" },
	{ label: "新品断货到货1234567天", value: "-3" },
	{ label: "老品断货到货1234567天", value: "-4" }
];

// 筛选器变化处理
const handleFilterChange = (filterType: string, value: string[]) => {
	if (value.length === 0) {
		(filters.value as any)[filterType] = undefined;
	}
	Crud.value?.refresh({ [filterType]: (filters.value as any)[filterType] });
};

// 按钮点击事件
async function bzyShiTu() {
	try {
		taskStatus.value.overallTask = {
			...taskStatus.value.overallTask,
			taskStatus: "Running",
			executeResult: "任务开始执行..."
		};

		const result = await service.app.amazon_product_Listing_Lingxing.bzyShiTu_UK();
		console.log("八爪鱼识图任务启动结果:", result);
		await fetchTaskStatus();
		ElMessage.success("八爪鱼识图任务已启动");
	} catch (err) {
		console.error("八爪鱼识图任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
		await fetchTaskStatus();
	}
}

async function searchByItemName() {
	try {
		taskStatus.value.searchTask = {
			...taskStatus.value.searchTask,
			taskStatus: "Running",
			executeResult: "任务开始执行..."
		};

		const result = await service.app.amazon_product_Listing_Lingxing.searchByItemName();
		console.log("搜索任务启动结果:", result);
		await fetchTaskStatus();
		ElMessage.success("搜索任务已启动");
	} catch (err) {
		console.error("搜索任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
		await fetchTaskStatus();
	}
}

async function aliyunImageSearch() {
	try {
		taskStatus.value.aliyunTask = {
			...taskStatus.value.aliyunTask,
			taskStatus: "Running",
			executeResult: "任务开始执行..."
		};

		const result = await service.app.amazon_product_Listing_Lingxing.aliyunImageSearch();
		console.log("阿里云对比任务启动结果:", result);
		await fetchTaskStatus();
		ElMessage.success("阿里云图片对比任务已启动");
	} catch (err) {
		console.error("阿里云对比任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
		await fetchTaskStatus();
	}
}

async function aliyunImageUpload() {
	try {
		const result = await service.app.amazon_product_Listing_Lingxing.aliyunImageUpload();
		console.log("阿里云上传任务启动结果:", result);
		ElMessage.success("阿里云上传任务已启动");
	} catch (err) {
		console.error("阿里云上传任务启动失败:", err);
		ElMessage.error(`启动失败: ${(err as Error).message || "未知错误"}`);
	}
}

async function getCompetitor() {
	let response = await service.app.amazon_product_Listing_Lingxing.getCompetitor();
}

async function requestLingXingListing() {
	let response = await service.app.bsr_product_Listing_Lingxing.requestLingXingListing();
}
async function requestLingXingShipmentStatus() {
	const selectedIds = Table.value?.getSelectionRows().map((row) => row.id);

	if (!selectedIds || selectedIds.length === 0) {
		ElMessage.warning("请先选择要获取在途状态的产品");
		return;
	}

	let response = await service.app.bsr_restocking_center_lingxing.requestLingXingShipmentStatus({
		ids: selectedIds
	});
}

async function handleExport2() {
	try {
		// 获取双 CSV 数据
		let response = await service.app.amazon_product_Listing_Lingxing.exportData2();

		// 解析竞品数据
		const taskRows = response.csvData
			.split("\n")
			.filter((row) => row.trim())
			.map((row) => row.split(","));

		// 解析部门数据
		const departmentRows = response.departmentCsv
			.split("\n")
			.filter((row) => row.trim())
			.map((row) => row.split(","));

		// 创建 Excel 工作簿
		const wb = XLSX.utils.book_new();

		// 竞品数据工作表
		const taskWs = XLSX.utils.aoa_to_sheet(taskRows);
		XLSX.utils.book_append_sheet(wb, taskWs, "Sheet1");

		// 部门数据工作表
		const departmentWs = XLSX.utils.aoa_to_sheet(departmentRows);
		XLSX.utils.book_append_sheet(wb, departmentWs, "Sheet2");

		// 导出文件
		XLSX.writeFile(wb, "export_data2.xlsx");
	} catch (error) {
		console.error("导出错误:", error);
		ElMessage.error("导出失败，请检查接口");
	}
}

function onSubmit2(data: any, { close }: any) {
	// 分片处理数据转换（避免主线程阻塞，不改变外部逻辑）
	const transformBatchSize = 500;
	const total = data.list.length;
	const processedList: any[] = [];
	let index = 0;

	function processNextBatch() {
		if (index >= total) {
			// 转换完成后执行批量提交（保持原batchSubmit调用方式）
			batchSubmit(processedList, 100)
				.then(() => {
					// 所有批次完成后执行一次去重
					service.app.bsr_candidate_competitor
						.removeDuplicateCompetitors()
						.then(() => {
							ElMessage.success("所有数据已成功导入");
							close();
						})
						.catch(() => {
							ElMessage.success("所有数据已成功导入");
							close();
						});
				})
				.catch(() => {
					ElMessage.error("部分数据导入失败");
				});
			return;
		}

		// 处理当前分片（保持原映射逻辑）
		const end = Math.min(index + transformBatchSize, total);
		const batch = data.list.slice(index, end);
		const processedBatch = batch.map((item) => {
			let newItem = flexibleMapping(item);
			newItem.source = 1;
			return newItem;
		});
		processedList.push(...processedBatch);
		index = end;

		// 让出主线程，避免UI卡死
		setTimeout(processNextBatch, 0);
	}

	// 开始处理转换
	processNextBatch();
}

async function batchSubmit(dataList: any[], batchSize = 500) {
	// 按 batchSize 拆分数据（保持原拆分逻辑）
	const batches: any[][] = [];
	for (let i = 0; i < dataList.length; i += batchSize) {
		batches.push(dataList.slice(i, i + batchSize));
	}

	console.log(`共分成 ${batches.length} 批次提交`);

	// 并发控制（默认并发5批，提升速度但不改变外部接口）
	const concurrency = 3;
	for (let i = 0; i < batches.length; i += concurrency) {
		const batchGroup = batches.slice(i, i + concurrency);
		const groupPromises = batchGroup.map((batch, idx) => {
			const batchIndex = i + idx + 1;
			console.log(`正在提交第 ${batchIndex} 批数据，共 ${batch.length} 条`);
			return service.app.bsr_candidate_competitor
				.updateCompetitor(batch)
				.then(() => {
					console.log(`第 ${batchIndex} 批数据提交成功`);
				})
				.catch((err: any) => {
					console.error(`第 ${batchIndex} 批提交失败:`, err);
					ElMessage.error(`第 ${batchIndex} 批提交失败: ${err.message || "未知错误"}`);
					throw err; // 中断后续批次
				});
		});

		// 等待当前并发组完成
		await Promise.all(groupPromises);
	}

	return Promise.resolve();
}

function flexibleMapping(item: any) {
	// 定义中文字段与英文字段的映射关系（保持原映射不变）
	const mapping: Record<string, string> = {
		ASIN: "asin_competitor",
		标题: "item_name",
		img1: "img1",
		img2: "img2",
		img3: "img3",
		img4: "img4",
		img5: "img5",
		img6: "img6",
		imgurl1: "image_url",
		价格: "price",
		评论数: "review_num",
		评分: "last_star",
		类目: "bsr_category",
		类目排名: "bsr_rank",
		节点: "bsr_node",
		节点排名: "bsr_node_rank",
		节点编号: "bsr_node_id",
		配送方: "dispatches_from",
		售卖方: "sold_by",
		卖家: "sold_by",
		卖家ID: "sold_byID",
		配送方式: "dispatches_type",
		配送类型: "dispatches_type",
		上架日期: "date_first_available",
		上架时间: "date_first_available",
		首次上架时间: "date_first_available",
		国家: "marketplace",
		颜色变体数量: "color_variants",
		尺寸变体数量: "size_variants",
		售价: "price",
		任务源ASIN: "asin_candidate",
		评级: "last_star",
		review数量: "review_num",
		任务源asin: "asin_candidate",
		任务源ID: "candidate_id",
		竞品ID: "id",
		卖点: "bullet_points",
		变体数: "variants",
		父体月销: "Main_monthly_sales",
		子体月销: "Main_monthly_sales_sub",
		父体销量: "Main_monthly_sales",
		子体销量: "Main_monthly_sales_sub",
		库存数量: "stock_quantity",
		FBA配送费: "FBA_price",
		包装尺寸: "dimensions",
		包装重量: "weight",
		历史销量: "sales_volume_data",
		关联位置: "associated"
	};

	const newItem: any = {};

	// 遍历映射关系（优化：缓存映射键值，减少重复计算）
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			newItem[mapping[chineseKey]] = item[chineseKey];
		}
	});

	// 批量删除空值字段（保持原判断逻辑，优化代码结构）
	const emptyFieldRules = [
		{ field: "Main_monthly_sales", condition: (v: any) => !v },
		{ field: "Main_monthly_sales_sub", condition: (v: any) => !v },
		{ field: "stock_quantity", condition: (v: any) => !v },
		{ field: "FBA_price", condition: (v: any) => !v || v === "0" },
		{ field: "bsr_category", condition: (v: any) => !v },
		{ field: "bsr_rank", condition: (v: any) => !v },
		{ field: "bsr_node", condition: (v: any) => !v },
		{ field: "bsr_node_rank", condition: (v: any) => !v },
		{ field: "bsr_node_id", condition: (v: any) => !v },
		{ field: "dimensions", condition: (v: any) => !v || v === "0" },
		{ field: "weight", condition: (v: any) => !v || v === "0" },
		{ field: "last_star", condition: (v: any) => !v },
		{ field: "review_num", condition: (v: any) => !v },
		{ field: "price", condition: (v: any) => !v },
		{ field: "image_url", condition: (v: any) => !v },
		{ field: "marketplace", condition: (v: any) => !v },
		{ field: "date_first_available", condition: (v: any) => !v || v === "0" },
		{ field: "dispatches_from", condition: (v: any) => !v },
		{ field: "sold_by", condition: (v: any) => !v },
		{ field: "img1", condition: (v: any) => !v },
		{ field: "img2", condition: (v: any) => !v },
		{ field: "img3", condition: (v: any) => !v },
		{ field: "img4", condition: (v: any) => !v },
		{ field: "img5", condition: (v: any) => !v },
		{ field: "img6", condition: (v: any) => !v },
		{ field: "sales_volume_data", condition: (v: any) => !v },
		{ field: "bullet_points", condition: (v: any) => !v },
		{ field: "variants", condition: (v: any) => !v }
	];

	emptyFieldRules.forEach(({ field, condition }) => {
		if (condition(newItem[field])) {
			delete newItem[field];
		}
	});

	// 保持原字段处理逻辑不变
	if (newItem.dispatches_from) {
		newItem.dispatches_from = newItem.dispatches_from.split("配送")[0];
	}

	if (newItem.sold_by) {
		newItem.sold_by = newItem.sold_by.split("配送")[0];
	}

	if (newItem.image_url) {
		newItem.image_url = newItem.image_url.replace(",", ".");
	}

	if (newItem.dispatches_type && newItem.dispatches_type != "NA") {
		if (newItem.dispatches_type == "FBA") newItem.dispatches_type = "1";
		if (newItem.dispatches_type == "FBM") newItem.dispatches_type = "2";
		if (newItem.dispatches_type == "AMZ") newItem.dispatches_type = "0";
	}

	if (
		newItem.dispatches_from &&
		newItem.sold_by &&
		(!newItem.dispatches_type || newItem.dispatches_type == "NA")
	) {
		if (newItem.sold_by == "Amazon" || newItem.sold_by == "amazon") {
			newItem.dispatches_type = "0";
		} else if (newItem.dispatches_from == "amazon" || newItem.dispatches_from == "Amazon") {
			newItem.dispatches_type = "1";
		} else {
			newItem.dispatches_type = "2";
		}
	}

	if (newItem.stock_quantity) {
		newItem.stock_quantity = newItem.stock_quantity.toString().replace(">", "");
		newItem.stock_quantity = newItem.stock_quantity.toString().replace("<", "");
	}

	if (newItem.image_url) {
		newItem.image_url = newItem.image_url.replace(/_AC_US\d+/g, "_AC_US1000");
		newItem.image_url = newItem.image_url.replace(/_AC_UL\d+/g, "_AC_UL1000");
		newItem.image_url = newItem.image_url.replace(/_SL\d+/g, "_SL1000");
		newItem.image_url = newItem.image_url.replace(/SS40+/g, "SS500");
		newItem.image_url = newItem.image_url.replace(/_AC_SR\d+,?\d*/g, "_AC_SR1000,1000");
		newItem.image_url = newItem.image_url.replace(
			/_SX\d+_SY\d+_CR[^_]*_/,
			"_SX1000_SY1000_CR,0,0,1000,1000_"
		);
	}

	// 保留原始英文字段（保持原逻辑）
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});

	// 父体/子体销量处理（保持原逻辑）
	if (newItem.Main_monthly_sales && newItem.Main_monthly_sales_sub) {
		const parentSales = parseFloat(newItem.Main_monthly_sales);
		const childSales = parseFloat(newItem.Main_monthly_sales_sub);
		if (!isNaN(parentSales) && !isNaN(childSales) && parentSales < childSales) {
			newItem.Main_monthly_sales = newItem.Main_monthly_sales_sub;
		}
	}

	if (newItem.Main_monthly_sales) {
		newItem.expected_volume = newItem.Main_monthly_sales / 30;
	}

	// 价格格式化（保持原逻辑）
	if (newItem.price) {
		let priceStr = newItem.price
			.toString()
			.replace(/,/g, ".")
			.replace(/[^0-9.]/g, "");

		const dotIndex = priceStr.indexOf(".");
		if (dotIndex !== -1) {
			priceStr =
				priceStr.substring(0, dotIndex + 1) +
				priceStr.substring(dotIndex + 1).replace(/\./g, "");
		}

		const priceNum = parseFloat(priceStr);
		if (!isNaN(priceNum)) {
			const truncated = Math.floor(priceNum * 100) / 100;
			newItem.price = truncated.toFixed(2);
		} else {
			newItem.price = "0.00";
		}
	}

	if (newItem.last_star > 5) {
		newItem.last_star = 0;
	}

	// 重量处理（保持原逻辑）
	if (newItem.weight) {
		newItem.weight = newItem.weight.toString().replace(/,/g, ".");
		if (item["重量单位"]) {
			const unitMap: Record<string, string> = { Kilogramm: "kg", Gramm: "g" };
			newItem.weight += unitMap[item["重量单位"]] || item["重量单位"];
		}
	}

	// 类目截断（保持原逻辑）
	if (newItem.bsr_category) {
		const hasChinese = /[\u4e00-\u9fff]/.test(newItem.bsr_category);
		if (hasChinese) {
			newItem.bsr_category = newItem.bsr_category.substring(0, 225);
		}
	}

	// 组合bsr_html（保持原逻辑）
	if (!newItem.associated) {
		newItem.bsr_html = `所属类目：${newItem.bsr_category || ""}，类目排名：${newItem.bsr_rank || ""}，所属节点：${newItem.bsr_node || ""}，节点排名：${newItem.bsr_node_rank || ""}`;
	}

	// 国家转换（保持原逻辑）
	if (newItem.marketplace) {
		if ("UK" == newItem.marketplace || "uk" == newItem.marketplace)
			newItem.marketplace = "英国";
		if ("DE" == newItem.marketplace || "de" == newItem.marketplace)
			newItem.marketplace = "德国";
		if ("FR" == newItem.marketplace || "fr" == newItem.marketplace)
			newItem.marketplace = "法国";
		if ("ES" == newItem.marketplace || "es" == newItem.marketplace)
			newItem.marketplace = "西班牙";
		if ("IT" == newItem.marketplace || "it" == newItem.marketplace)
			newItem.marketplace = "意大利";
	}

	// Excel日期转换（保持原逻辑）
	if (newItem.date_first_available && typeof newItem.date_first_available === "number") {
		newItem.date_first_available = new Date(
			(newItem.date_first_available - 25569) * 86400 * 1000
		)
			.toISOString()
			.slice(0, 10);
	}

	return newItem;
}

// 合并编号处理函数
const handleMergeId = async () => {
	try {
		// 获取选中的行数据
		const selectedRows = Table.value?.getSelectionRows();
		if (!selectedRows || selectedRows.length < 2) {
			ElMessage.warning("请至少选择两条数据进行合并编号操作");
			return;
		}

		// 获取第一个选中项的合并编号作为目标编号
		const targetMergeId = selectedRows[0].mergeId;
		if (!targetMergeId) {
			ElMessage.warning("选中的第一个产品没有合并编号，无法作为目标编号");
			return;
		}

		// 获取所有选中项的ID
		const ids = selectedRows.map((row) => row.id);
		const affectedCount = selectedRows.length;

		// 显示确认对话框
		ElMessageBox.confirm(
			`确定要将选中的 ${affectedCount} 条数据的合并编号统一设置为 ${targetMergeId} 吗？`,
			"确认合并编号",
			{
				confirmButtonText: "确定",
				cancelButtonText: "取消",
				type: "warning"
			}
		)
			.then(async () => {
				// 显示加载状态
				const loading = ElLoading.service({
					lock: true,
					text: "正在更新合并编号，请稍候...",
					background: "rgba(0, 0, 0, 0.7)"
				});

				try {
					// 调用后端API更新合并编号
					const res = await service.app.amazon_product_Listing_Lingxing.updateMergeId({
						ids,
						mergeId: targetMergeId
					});

					if (res.success) {
						ElMessage.success(`更新成功：${res.message}`);
					} else {
						ElMessage.error(`更新失败：${res.message}`);
					}

					// 清空选择
					Table.value?.clearSelection();

					// 刷新表格数据
					Crud.value?.refresh();
				} catch (e) {
					ElMessage.error("更新合并编号失败");
					console.error(e);
				} finally {
					// 关闭加载状态
					loading.close();
				}
			})
			.catch(() => {
				// 用户取消操作，不做处理
			});
	} catch (e) {
		ElMessage.error("操作失败");
		console.error(e);
	}
};
</script>
