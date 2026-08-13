<template>
	<cl-crud ref="Crud">
		<template v-if="candidate">
			<el-divider>选品信息</el-divider>
			<cl-row>
				<bsr-candidate-description :candidate="candidate" />
			</cl-row>
		</template>

		<el-divider>竞品列表</el-divider>
		<cl-row>
			<cl-refresh-btn />
			<cl-add-btn />
			<cl-multi-delete-btn />

			<el-radio-group v-model="viewMode" @change="handleViewModeChange" style="margin-right: 10px; margin-bottom: 10px;">
				<el-radio-button label="normal">正常数据</el-radio-button>
				<el-radio-button label="recycle">回收站</el-radio-button>
			</el-radio-group>

			<el-select
				v-model="selectedCountry"
				placeholder="选择国家"
				style="width: 120px; margin-right: 10px"
				@change="handleCountryChange"
			>
				<el-option label="全部国家" value="" />
				<el-option
					v-for="country in countryOptions"
					:key="country.value"
					:label="country.label"
					:value="country.value"
				/>
			</el-select>

			<el-select
				v-model="dispatchesTypeCountry"
				placeholder="选择配送类型"
				style="width: 120px; margin-right: 10px"
				@change="dispatchesTypeChange"
			>
				<el-option label="全部配送类型" value="" />
				<el-option
					v-for="country in dispatchesTypeOptions"
					:key="country.value"
					:label="country.label"
					:value="country.value"
				/>
			</el-select>
			<el-select
				v-model="dataTypeFilter"
				placeholder="选择数据类型"
				style="width: 140px; margin-right: 10px"
				@change="handleDataTypeFilterChange"
			>
				<el-option label="全部" value="" />
				<el-option
					v-for="item in dataTypeFilterOptions"
					:key="item.value"
					:label="item.label"
					:value="item.value"
				/>
			</el-select>

			<el-link
				v-if="candidate?.image_url"
				target="_blank"
				:underline="false"
				:href="imageSearchUrl"
				style="margin-left: 10px"
			>
				<el-button type="primary">以图搜图</el-button>
			</el-link>
			<el-button @click="handleRemoveDuplicates" type="primary">竞品去重</el-button>
			<el-button @click="getCompetitor" type="primary">勾选获取详细信息</el-button>
			<el-button @click="handleKeywordReverse" type="warning" plain>关键词反查</el-button>
			<el-button @click="handleScoreKeywordOrganicAd" :loading="scoreLoading" type="success" plain>竞品关键词自然广告得分</el-button>

			<el-dropdown v-if="viewMode === 'recycle'" @command="handleMoveToLibrary" style="margin-left: 10px;">
				<el-button type="success">
					勾选入库<el-icon class="el-icon--right"><arrow-down /></el-icon>
				</el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item :command="1">设为关键词</el-dropdown-item>
						<el-dropdown-item :command="2">设为竞品</el-dropdown-item>
						<el-dropdown-item :command="9">设为非同款</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>

			<div class="country-status" style="margin-left: 10px">
				<template v-for="country in countryOptions" :key="country.value">
					<el-tooltip
						:content="`${country.label}数据${hasCountryData(country.value) ? '已' : '未'}收录`"
						placement="top"
					>
						<span class="status-item">
							{{ country.label }}
							<el-icon :color="hasCountryData(country.value) ? '#67C23A' : '#F56C6C'">
								<check v-if="hasCountryData(country.value)" />
								<close v-else />
							</el-icon>
						</span>
					</el-tooltip>
				</template>
			</div>

			<cl-flex1 />
			<cl-search-key placeholder="模糊搜索" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
				<template #column-asin_competitor="{ scope }">
					<div class="date-cell asin-cell">
						<!-- 修改：将ASIN改为可点击跳转的链接 -->
						<div class="asin-value">
							<el-link
								target="_blank"
								:underline="false"
								:href="
									appConfig.get_amazon_url_dp(
										scope.row.asin_competitor,
										scope.row.marketplace
									)
								"
								class="asin-link"
								@click.stop
							>
								{{ scope.row.asin_competitor }}
							</el-link>
						</div>
						<!-- 状态和配送类型下拉框容器 - 水平排列 -->
						<div class="tags-container">
							<!-- 状态标签下拉框 -->
							<el-dropdown
								trigger="hover"
								@command="(command) => handleStatusChange(scope.row, command)"
								class="status-dropdown"
							>
								<span class="status-tag" :class="getStatusClass(scope.row.status)">
									{{ getStatusText(scope.row.status) }}
									<el-icon>
										<arrow-down />
									</el-icon>
								</span>
								<template #dropdown>
									<el-dropdown-menu>
										<el-dropdown-item
											:command="
												String(BSR_COMPETITOR_STATUS.COMPETITOR.value)
											"
											:disabled="
												scope.row.status ===
												BSR_COMPETITOR_STATUS.COMPETITOR.value
											"
										>
											<el-tag type="success" size="small">竞品</el-tag>
										</el-dropdown-item>
										<el-dropdown-item
											:command="String(BSR_COMPETITOR_STATUS.KEYWORD.value)"
											:disabled="
												scope.row.status ===
												BSR_COMPETITOR_STATUS.KEYWORD.value
											"
										>
											<el-tag type="warning" size="small">关键词</el-tag>
										</el-dropdown-item>
										<el-dropdown-item
											:command="String(BSR_COMPETITOR_STATUS.LIBRARY.value)"
											:disabled="
												scope.row.status ===
												BSR_COMPETITOR_STATUS.LIBRARY.value
											"
										>
											<el-tag type="info" size="small">未选</el-tag>
										</el-dropdown-item>
										<el-dropdown-item
											:command="String(BSR_COMPETITOR_STATUS.NON_SAME.value)"
											:disabled="
												scope.row.status ===
												BSR_COMPETITOR_STATUS.NON_SAME.value
											"
										>
											<el-tag type="danger" size="small">非同款竞品</el-tag>
										</el-dropdown-item>
									</el-dropdown-menu>
								</template>
							</el-dropdown>

							<!-- 配送类型下拉框 -->
							<el-dropdown
								trigger="hover"
								@command="(command) => handleDispatchTypeChange(scope.row, command)"
								class="dispatch-dropdown"
							>
								<span
									class="dispatch-tag"
									:class="getDispatchClass(scope.row.dispatches_type)"
								>
									{{
										scope.row.dispatches_type != null
											? DISPATCH_TYPE_MAP[scope.row.dispatches_type]
											: "未选"
									}}
									<el-icon>
										<arrow-down />
									</el-icon>
								</span>
								<template #dropdown>
									<el-dropdown-menu>
										<el-dropdown-item
											command="0"
											:disabled="scope.row.dispatches_type === 0"
										>
											<el-tag type="info" size="small">自营</el-tag>
										</el-dropdown-item>
										<el-dropdown-item
											command="1"
											:disabled="scope.row.dispatches_type === 1"
										>
											<el-tag type="primary" size="small">FBA</el-tag>
										</el-dropdown-item>
										<el-dropdown-item
											command="2"
											:disabled="scope.row.dispatches_type === 2"
										>
											<el-tag type="warning" size="small">FBM</el-tag>
										</el-dropdown-item>
									</el-dropdown-menu>
								</template>
							</el-dropdown>
						</div>
					</div>
				</template>

				<template #column-date_first_available="{ scope }">
					<div class="date-cell">
						<div>{{ formatDate(scope.row.date_first_available) }}</div>
						<div v-if="isNewProduct(scope.row.date_first_available)" class="new-tag">
							新品
						</div>
					</div>
				</template>

				<template #column-dp_url="{ scope }">
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
					<cl-table-column-bullet-points :bullet_points="scope.row.bullet_points" />
				</template>

				<template #column-bsr_html="{ scope }">
					<cl-table-column-bsr-html :bsr_html="scope.row.bsr_html" />
				</template>

				<template #column-search_volume_chart="{ scope }">
					<template v-if="scope.row.sales_volume_data">
						<el-popover
							placement="right"
							title="月销量走势"
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
											scope.row.sales_volume_data
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

				<template #column-expected_volume="{ scope }">
					<el-input
						v-model="scope.row.expected_volume"
						@blur="handleBlur(scope.row)"
						size="small"
						placeholder="请输入"
					/>
				</template>

				<template #column-image_url_display="{ scope }">
					<el-popover placement="right" trigger="hover" :width="300">
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
			</cl-table>
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<cl-pagination />
		</cl-row>

		<cl-upsert ref="Upsert">
			<template #slot-add="{ scope }">
				<div class="dynamic-form">
					<!-- 动态输入行 -->
					<div v-for="(item, index) in items" :key="index" class="input-group">
						<el-row :gutter="25">
							<el-col :span="6">
								<el-input
									v-model="item.asin_competitor"
									placeholder="竞品ASIN"
									clearable
								/>
							</el-col>
							<el-col :span="6">
								<el-select
									v-model="item.marketplace"
									placeholder="选择国家"
									clearable
									filterable
								>
									<el-option
										v-for="country in countryOptions"
										:key="country.value"
										:label="country.label"
										:value="country.value"
									/>
								</el-select>
							</el-col>
							<el-col :span="6">
								<el-input v-model="item.item_name" placeholder="标题" clearable />
							</el-col>
							<el-col :span="4">
								<el-select
									v-model="item.status"
									placeholder="操作类型"
									clearable
									@change="handleOperationTypeChange(item)"
								>
									<el-option label="入库关键词" :value="1" />
									<el-option label="入库竞品" :value="2" />
								</el-select>
							</el-col>
							<el-col :span="2" class="flex items-center justify-end gap-1">
								<el-button
									v-if="index === items.length - 1"
									@click="addRow"
									:icon="Plus"
									circle
									type="primary"
								/>
								<el-button
									v-if="index > 0"
									@click="removeRow(index)"
									:icon="Minus"
									circle
									type="danger"
								/>
							</el-col>
						</el-row>
					</div>
					<br />
					<!-- 提交按钮 -->
					<div class="form-footer">
						<el-button type="primary" @click="batchSubmit">批量提交</el-button>
					</div>
				</div>
			</template>
		</cl-upsert>

		<!-- 关键词反查结果 -->
		<batch-keyword-result
			v-model:visible="keywordReverseVisible"
			:asin="candidate?.asin || ''"
			:product-code="candidate?.asin || ''"
			:marketplaces="keywordReverseMarketplaces"
			:competitor-asins="keywordReverseCompetitorAsins"
		/>
		<!-- 竞品关键词自然广告得分结果 -->
		<el-dialog v-model="scoreResultVisible" title="竞品关键词自然广告得分" width="800px">
			<div v-if="scoreResultData" class="score-result">
				<el-alert :title="scoreResultData.message" type="info" :closable="false" style="margin-bottom: 15px" />
				<el-table :data="scoreResultData.data?.competitors || []" border stripe>
					<el-table-column prop="asin" label="竞品ASIN" width="140" />
					<el-table-column prop="item_name" label="标题" show-overflow-tooltip />
					<el-table-column prop="Main_monthly_sales" label="父体月销量" width="110" />
					<el-table-column prop="keyword_organic_score" label="自然得分" width="100">
						<template #default="{ row }">
							<el-tag type="success">{{ row.keyword_organic_score }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column prop="keyword_ad_score" label="广告得分" width="100">
						<template #default="{ row }">
							<el-tag type="warning">{{ row.keyword_ad_score }}</el-tag>
						</template>
					</el-table-column>
				</el-table>
			</div>
		</el-dialog>
	</cl-crud>
</template>

<script lang="ts" name="bsr-candidate-competitor-component" setup>
import { Plus, Minus } from "@element-plus/icons-vue";

import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { watch, ref, computed, onMounted } from "vue";
import { appConfig } from "../../../../../appConfig";
import { is_admin } from "/$/app/utils";
import { convert_image_url } from "/$/app/utils";
import BsrCandidateDescription from "/$/app/components/bsr-candidate-description.vue";
import BatchKeywordResult from "/$/app/components/BatchKeywordResult.vue";
import ClCrud from "/~/crud/src/components/crud";
import ClTableColumnBsrHtml from "/$/app/components/cl-table-column-bsr-html.vue";
import ClTableColumnBulletPoints from "/$/app/components/cl-table-column-bullet-points.vue";
import ClRow from "/~/crud/src/components/row";
import { ElMessage } from "element-plus";
import dayjs from "dayjs";
import { generateKeywordSearchVolumeChartOption } from "/$/app/utils";
import { DataLine, Picture } from "@element-plus/icons-vue";
import { Check, Close } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";

const { service } = useCool();
const BSR_COMPETITOR_STATUS = appConfig.BSR_CANDIDATE_COMPETITOR_STATUS;

const countryStatusData = ref<any[]>([]);

// 独立获取国家状态数据的方法
const fetchCountryStatus = async () => {
	let id = props.candidate?.id;
	if (props.candidate?.candidate_id) {
		id = props.candidate?.candidate_id;
	}
	const res = await service.app.bsr_candidate_competitor.page({
		candidate_id: id,
		status: [
			BSR_COMPETITOR_STATUS.KEYWORD.value,
			BSR_COMPETITOR_STATUS.COMPETITOR.value,
			BSR_COMPETITOR_STATUS.LIBRARY.value,
			BSR_COMPETITOR_STATUS.NON_SAME.value
		],
		size: 1000
	});
	countryStatusData.value = res.list || [];
};

const getStatusText = (status: number) => {
	if (status === BSR_COMPETITOR_STATUS.COMPETITOR.value) return "竞";
	if (status === BSR_COMPETITOR_STATUS.NON_SAME.value) return "非";
	return "关";
};

// 状态标签样式类
const getStatusClass = (status: number) => {
	return {
		"status-tag--compete": status === BSR_COMPETITOR_STATUS.COMPETITOR.value,
		"status-tag--close": status === BSR_COMPETITOR_STATUS.KEYWORD.value,
		"status-tag--non-same": status === BSR_COMPETITOR_STATUS.NON_SAME.value
	};
};

// 配送类型标签样式类
const getDispatchClass = (dispatchType: number | null) => {
	if (dispatchType === null) return "dispatch-tag--empty";

	return {
		"dispatch-tag--self": dispatchType === 0,
		"dispatch-tag--fba": dispatchType === 1,
		"dispatch-tag--fbm": dispatchType === 2
	};
};

// 状态切换处理
const handleStatusChange = async (row: any, newStatus: string) => {
	try {
		const statusValue = Number(newStatus);
		// 更新状态
		const updateData: any = {
			id: row.id,
			status: statusValue
		};
		await service.app.bsr_candidate_competitor.update(updateData);

		// 更新本地数据
		row.status = statusValue;
		const statusTextMap = {
			[BSR_COMPETITOR_STATUS.COMPETITOR.value]: "竞品",
			[BSR_COMPETITOR_STATUS.KEYWORD.value]: "关键词",
			[BSR_COMPETITOR_STATUS.LIBRARY.value]: "未选",
			[BSR_COMPETITOR_STATUS.NON_SAME.value]: "非同款竞品"
		};

		ElMessage.success(`状态已更新为${statusTextMap[statusValue] || "未知状态"}`);

		// 刷新国家状态数据
		fetchCountryStatus();
	} catch (error) {
		console.error("状态更新失败:", error);
		ElMessage.error("状态更新失败");
	}
};

// 配送类型切换处理
const handleDispatchTypeChange = async (row: any, newDispatchType: string) => {
	try {
		const dispatchType = parseInt(newDispatchType);
		// 更新配送类型
		await service.app.bsr_candidate_competitor.update({
			id: row.id,
			dispatches_type: dispatchType
		});

		// 更新本地数据
		row.dispatches_type = dispatchType;

		ElMessage.success(`配送类型已更新为${DISPATCH_TYPE_MAP[dispatchType]}`);
	} catch (error) {
		console.error("配送类型更新失败:", error);
		ElMessage.error("配送类型更新失败");
	}
};

// 修改国家状态判断方法
const hasCountryData = computed(() => (countryCode: string) => {
	return countryStatusData.value.some((item) => item.marketplace === countryCode);
});

const props = defineProps(["candidate"]);

const viewMode = ref('normal');

const handleViewModeChange = () => {
	Crud.value?.refresh({ page: 1 });
};

const handleMoveToLibrary = async (status: number) => {
	const selection = Table.value?.selection;
	if (!selection || selection.length === 0) {
		ElMessage.warning("请先勾选要入库的数据");
		return;
	}

	try {
		const ids = selection.map(item => item.id);
		const res = await service.app.bsr_candidate_competitor.moveToLibrary({ ids, status });
		if (res.code === 1000) {
			ElMessage.success("入库成功");
			Crud.value?.refresh();
		} else {
			ElMessage.error(res.message || "入库失败");
		}
	} catch (err: any) {
		ElMessage.error(err.message || "入库操作失败");
	}
};

const statusFilterByDataType = (dataType: string) => {
	if (viewMode.value === 'recycle') {
		// 返回所有不属于 1, 2, 9 的状态，这里列举常见的其他状态
		return [0, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
	}

	if (dataType === "competitor") {
		return BSR_COMPETITOR_STATUS.COMPETITOR.value;
	}
	if (dataType === "keyword") {
		return BSR_COMPETITOR_STATUS.KEYWORD.value;
	}
	if (dataType === "nonSame") {
		return BSR_COMPETITOR_STATUS.NON_SAME.value;
	}
	return [
		BSR_COMPETITOR_STATUS.KEYWORD.value,
		BSR_COMPETITOR_STATUS.COMPETITOR.value,
		BSR_COMPETITOR_STATUS.NON_SAME.value
	];
};

const Crud = useCrud({
	service: service.app.bsr_candidate_competitor,
	async onRefresh(params, { next, done, render }) {
		try {
			// 获取数据

			let id = props.candidate?.id;
			if (props.candidate?.candidate_id) {
				id = props.candidate?.candidate_id;
			}
			const { list } = await next({
				...params,
				candidate_id: id,
				status: statusFilterByDataType(dataTypeFilter.value),
				marketplace: params.marketplace || selectedCountry.value,
				page: 1,
				size: 100 // 确保这里设置合适的每页数量
			});

			// 在渲染前处理数据
			const processedList = (list || []).map((item) => ({
				...item,
				image_url_display: convert_image_url(item.image_url),
				dispatches_type: item.dispatches_type != null ? Number(item.dispatches_type) : null
			}));

			// 只在这里渲染一次
			render(processedList);

			// 设置全量数据（用于去重功能）
			allData.value = processedList;
		} catch (error) {
			console.error("数据加载失败:", error);
			ElMessage.error("数据加载失败");
		} finally {
			done();
		}
	}
});

const filteredData = computed(() => {
	if (!selectedCountry.value) return allData.value;
	return allData.value.filter((item) => item.marketplace === selectedCountry.value);
});

const handleCountryChange = () => {
	Crud.value?.refresh({ marketplace: selectedCountry.value, page: 1 });
};

const dispatchesTypeChange = () => {
	Crud.value?.refresh({ dispatches_type: dispatchesTypeCountry.value, page: 1 });
};

const handleDataTypeFilterChange = () => {
	Crud.value?.refresh({ page: 1 });
};

const allData = ref<any[]>([]);

const formatDate = (dateStr: string) => {
	if (!dateStr) return "-";
	return dayjs(dateStr).format("YYYY-MM-DD");
};

// 新品判断方法
const isNewProduct = (dateStr: string) => {
	if (!dateStr) return false;

	const now = dayjs();
	const productDate = dayjs(dateStr);
	const threeMonthsAgo = now.subtract(3, "month");

	return productDate.isAfter(threeMonthsAgo);
};

// 增加初始化加载逻辑
onMounted(() => {
	if (props.candidate?.id) {
		Crud.value?.refresh({
			marketplace: selectedCountry.value
		});
		fetchCountryStatus();
	}
});

watch(props, () => {
	Crud.value?.refresh();
	Table.value?.setData?.(filteredData.value);
});

const Table = useTable({
	columns: [
		{ type: "selection" },
		{
			label: "竞品 ASIN",
			prop: "asin_competitor",
			minWidth: 100,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{
			label: "竞品图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 30, fit: "contain" } },
			fixed: "left"
		},
		{
			label: "竞品标题",
			prop: "item_name",
			showOverflowTooltip: true,
			minWidth: 80,
			fixed: "left"
		},
		{
			label: "价格",
			prop: "price",
			minWidth: 80,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "评论数量",
			prop: "review_num",
			minWidth: 60,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "星级",
			prop: "last_star",
			minWidth: 50,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		// { label: '图片对比分数', prop: 'similarity_score', minWidth: 50, showOverflowTooltip: true, },
		{
			label: "预估日均销量",
			prop: "expected_volume",
			minWidth: 70
		},
		{ label: "月销量走势", prop: "search_volume_chart", width: 70 },
		{ label: "自然得分", prop: "keyword_organic_score", minWidth: 60, sortable: "custom", formatter(row, column, value) { return value ?? 0; } },
		{ label: "广告得分", prop: "keyword_ad_score", minWidth: 60, sortable: "custom", formatter(row, column, value) { return value ?? 0; } },
		{
			label: "父体月销量",
			prop: "Main_monthly_sales",
			minWidth: 60,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "子体月销量",
			prop: "Main_monthly_sales_sub",
			minWidth: 60,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "库存数量",
			prop: "stock_quantity",
			minWidth: 60,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "库存状态",
			prop: "inventory_type",
			minWidth: 60,
			sortable: "custom",
			formatter(row, column, value) {
				// 先判断字符串类型的特殊值
				if (value === "XIAN") return "限";
				if (value === "SHANCHU") return "删除";
				if (value === "NORMAL") return "正常";
				if (value === "BODONG") return "加载失败";
				if (value === "DUANHUO") return "断货";
				// 再判断数值类型的特殊值
				if (value === -1) return "无";
				if (typeof value === "number" && value >= 999) return "999+";
				// 其他情况直接返回原值
				return value;
			}
		},
		{
			label: "变体数量",
			prop: "variants",
			minWidth: 60,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "FBA配送费",
			prop: "FBA_price",
			minWidth: 50,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{ label: "卖点", prop: "bullet_points", minWidth: 50 },
		{ label: "BSR", prop: "bsr_html", minWidth: 80, showOverflowTooltip: true },
		{
			label: "BSR 排名",
			prop: "bsr_rank",
			minWidth: 80,
			sortable: "asc",
			formatter(row, column, value, index) {
				return value === 999999999 ? "-" : value;
			}
		},
		{
			label: "配送方*",
			prop: "dispatches_from",
			minWidth: 80,
			showOverflowTooltip: true,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			label: "售卖方*",
			prop: "sold_by",
			minWidth: 80,
			showOverflowTooltip: true,
			sortable: "custom",
			hidden: !is_admin.value
		},
		{
			label: "更新时间",
			prop: "updateTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{
			label: "创建时间",
			prop: "createTime",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" }
		},
		{
			label: "上架时间",
			prop: "date_first_available",
			minWidth: 100,
			formatter(row, column, value) {
				return formatDate(value); // 确保其他使用formatter的地方也正确格式化
			}
		},
		{ label: "国家", prop: "marketplace", minWidth: 50, showOverflowTooltip: true },
		{
			label: "最近爬虫时间*",
			prop: "spider_time",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" },
			hidden: !is_admin.value
		},
		{
			label: "包装重量",
			prop: "weight",
			minWidth: 80,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
		},
		{
			label: "包装尺寸",
			prop: "dimensions",
			minWidth: 80,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			},
			showOverflowTooltip: true
		},
		{ type: "op", buttons: ["edit", "delete"] }
	]
});

// 配送类型映射
const DISPATCH_TYPE_MAP: Record<number, string> = {
	0: "自营",
	1: "FBA",
	2: "FBM"
} as const;

// 添加输入行
const addRow = () => {
	const lastItem = items.value[items.value.length - 1];
	const newItem = {
		asin_competitor: "",
		marketplace: lastItem?.marketplace || "", // 自动继承上一个选择
		item_name: "",
		status: lastItem?.status || "" // 自动继承上一个选择
	};
	items.value.push(newItem);
};

// 删除输入行
const removeRow = (index) => {
	items.value.splice(index, 1);
};

// 批量提交验证
const validateForm = () => {
	return items.value.every(
		(item) =>
			item.asin_competitor.trim() &&
			countryOptions.value.some((c) => c.value === item.marketplace) &&
			item.status
	);
};

// 批量提交逻辑
const batchSubmit = async () => {
	if (!validateForm()) {
		ElMessage.warning("请填写完整的ASIN和选择有效国家");
		return;
	}

	try {
		let id = props.candidate?.id;
		if (props.candidate?.candidate_id) {
			id = props.candidate?.candidate_id;
		}

		const payload = items.value
			.filter((item) => item.asin_competitor && item.marketplace && item.status)
			.map((item) => ({
				...item,
				candidate_id: id,
				asin_candidate: props.candidate?.asin,
				similarity_score: 2
			}));

		await service.app.bsr_candidate_competitor.add(payload);
		ElMessage.success(`成功添加${payload.length}条竞品数据`);
		items.value = [{ asin_competitor: "", marketplace: "", item_name: "", status: "" }];

		Crud.value?.refresh();
		Upsert.value?.close();
	} catch (error) {
		console.error("批量添加失败:", error);
		ElMessage.error("添加失败，请检查数据格式");
	}
};

// 新增计算属性
const imageSearchUrl = computed(() => {
	if (!props.candidate?.image_url || !selectedCountry.value) return "#";

	// 国家与域名映射表
	const domainMap: Record<string, string> = {
		英国: "amazon.co.uk",
		德国: "amazon.de",
		法国: "amazon.fr",
		西班牙: "amazon.es",
		意大利: "amazon.it"
	};

	// 获取对应国家域名
	const domain = domainMap[selectedCountry.value] || "amazon.com";

	// 生成带图片URL的stylesnap链接（添加图片转换）
	return `https://www.${domain}/stylesnap?q=${props.candidate.image_url}`;
});

const handleOperationTypeChange = (item: any) => {
	// 根据选择自动设置status
	item.status = item.status;
};

// script部分修改
const items = ref([{ asin_competitor: "", marketplace: "", item_name: "", status: "" }]);

const Upsert = useUpsert({
	op: {
		buttons: [] // 清空默认按钮
	},
	dialog: {
		width: "900",
		beforeClose: () => {
			items.value = [{ asin_competitor: "", marketplace: "", item_name: "", status: "" }]; // 重置表单
		}
	},
	items: [
		{
			prop: "basic_info",
			component: {
				name: "cl-form-card",
				props: {
					label: "竞品信息",
					expand: true,
					isExpand: true
				}
			},
			children: [{ component: { name: "slot-add" } }]
		}
	],
	async onSubmit(data, { next, done, close }) {
		try {
			// 过滤空值并添加必要字段

			let id = props.candidate?.id;
			if (props.candidate?.candidate_id) {
				id = props.candidate?.candidate_id;
			}
			const payload = items.value
				.filter(
					(item) =>
						item.asin_competitor && item.marketplace && item.item_name && item.status
				)
				.map((item) => ({
					...item,
					candidate_id: id,
					asin_candidate: props.candidate.asin,
					status: props.candidate?.status,
					item_name: props.candidate?.item_name
				}));

			if (payload.length === 0) {
				ElMessage.warning("请至少填写一组有效数据");
				return done();
			}

			// 调用批量添加接口
			await service.app.bsr_candidate_competitor.add(payload);

			ElMessage.success(`成功添加 ${payload.length} 个竞品`);
			close();
			Crud.value?.refresh();
		} catch (err) {
			console.error("批量添加失败:", err);
			ElMessage.error("添加失败，请检查数据格式");
			done();
		}
	}
});

const handleBlur = async (row) => {
	try {
		await service.app.bsr_candidate_competitor.update({
			id: row.id,
			expected_volume: row.expected_volume
		});
		ElMessage.success("保存成功");
		// 新增：触发主页面刷新数据
		if (props.candidate?.id) {
			Crud.value?.refresh();
		}
	} catch (error) {
		ElMessage.error("保存失败");
		Crud.value?.refresh();
	}
};

// 新增国家选项配置
const countryOptions = ref([
	{ label: "英国", value: "英国" },
	{ label: "德国", value: "德国" },
	{ label: "法国", value: "法国" },
	{ label: "西班牙", value: "西班牙" },
	{ label: "意大利", value: "意大利" }
]);

const dispatchesTypeOptions = ref([
	{ label: "FBA", value: "1" },
	{ label: "FBM", value: "2" },
	{ label: "自营", value: "0" }
]);
const dataTypeFilterOptions = ref([
	{ label: "竞品", value: "competitor" },
	{ label: "关键词", value: "keyword" },
	{ label: "非同款竞品", value: "nonSame" }
]);

const selectedCountry = ref<string>("");
const dispatchesTypeCountry = ref<string>("");
const dataTypeFilter = ref<string>("");

// 监听选品信息变化，设置默认国家
watch(
	() => props.candidate,
	(newVal) => {
		if (newVal?.marketplace) {
			selectedCountry.value = newVal.marketplace;
			dispatchesTypeCountry.value = newVal.dispatches_type;
			// 立即触发查询
			Crud.value?.refresh({
				marketplace: newVal.marketplace,
				dispatches_type: newVal.dispatches_type,
				page: 1
			});
			fetchCountryStatus();
		}
	},
	{ immediate: true, deep: true }
);

watch(
	() => props.candidate?.id,
	() => {
		fetchCountryStatus();
	}
);

const updateStatusTo1 = async () => {
	const asin_candidate = props.candidate?.asin;
	console.log(asin_candidate);
	if (!asin_candidate) {
		ElMessage.error("缺少竞品 ASIN");
		return;
	}
	try {
		await service.app.bsr_candidate_competitor.updateStatus({
			asin_candidate: asin_candidate,
			status: 1
		});

		ElMessage.success("状态更新成功");
		// 刷新数据保持一致性
		Crud.value?.refresh();
	} catch (error) {
		console.error("状态更新失败:", error);
		ElMessage.error("状态更新失败");
	}
};

const handleRemoveDuplicates = async () => {
	try {
		const candidateId = props.candidate?.id;
		if (!candidateId) {
			ElMessage.warning("缺少候选产品ID信息");
			return;
		}

		// 获取当前筛选后的数据（支持按国家筛选去重）
		const currentData = filteredData.value;
		if (currentData.length === 0) {
			ElMessage.warning("暂无竞品数据可去重");
			return;
		}

		// 核心：按 asin_competitor + marketplace 分组，保留第一条，收集重复ID
		const uniqueMap = new Map<string, any>(); // key: asin_marketplace, value: 保留的那条数据
		const duplicateIds: number[] = [];

		currentData.forEach((item) => {
			// 处理空值，避免生成无效key
			const asin = item.asin_competitor || "";
			const marketplace = item.marketplace || "";
			const uniqueKey = `${asin}_${marketplace}`;

			if (uniqueMap.has(uniqueKey)) {
				// 已存在该组合，收集重复ID待删除
				duplicateIds.push(item.id);
			} else {
				// 不存在，保留该条数据
				uniqueMap.set(uniqueKey, item);
			}
		});

		if (duplicateIds.length === 0) {
			ElMessage.info("未检测到重复的竞品数据（按ASIN+国家组合）");
			return;
		}

		// 确认删除
		try {
			await ElMessageBox.confirm(
				`检测到 ${duplicateIds.length} 条重复的竞品数据（ASIN+国家组合重复），确定删除吗？`,
				"确认去重删除",
				{ type: "warning", confirmButtonText: "确认删除", cancelButtonText: "取消" }
			);

			// 批量删除重复数据
			await service.app.bsr_candidate_competitor.delete({ ids: duplicateIds });
			ElMessage.success(`成功删除 ${duplicateIds.length} 条重复竞品数据`);

			// 刷新表格数据
			Crud.value?.refresh();
		} catch (cancel) {
			ElMessage.info("已取消删除操作");
		}
	} catch (error) {
		console.error("竞品去重失败:", error);
		ElMessage.error(`去重操作失败：${error instanceof Error ? error.message : "未知错误"}`);
	}
};

async function getCompetitor() {
	try {
		// 获取表格选择的候选产品ID
		const selectedIds = Table.value?.getSelectionRows().map((row) => row.id);

		if (!selectedIds || selectedIds.length === 0) {
			ElMessage.warning("请先选择要获取详情的数据");
			return;
		}

		// 调用接口
		const response = await service.app.bsr_candidate_competitor.getCompetitor({
			ids: selectedIds
		});

		ElMessage.success("获取详情成功");
		Crud.value?.refresh();
	} catch (error) {
		console.error("获取详情失败:", error);
		ElMessage.error("获取详情失败");
	}
}

// ========== 关键词反查 ==========
const keywordReverseVisible = ref(false);
const keywordReverseMarketplaces = ref('');
const keywordReverseCompetitorAsins = ref<string[]>([]);

const scoreLoading = ref(false);
const scoreResultVisible = ref(false);
const scoreResultData = ref<any>(null);

async function handleKeywordReverse() {
	const selection = Table.value?.getSelectionRows();

	if (!selection || selection.length === 0) {
		ElMessage.warning("请先勾选要反查关键词的竞品");
		return;
	}

	const marketplaces = [...new Set(selection.map((row: any) => row.marketplace).filter(Boolean))];

	if (marketplaces.length > 1) {
		ElMessage.warning("只能勾选相同国家的竞品进行关键词反查，当前勾选了多个国家");
		return;
	}

	const competitorAsins = selection.map((row: any) => row.asin_competitor).filter(Boolean);

	if (competitorAsins.length === 0) {
		ElMessage.warning("勾选的竞品缺少ASIN");
		return;
	}

	keywordReverseMarketplaces.value = marketplaces[0] || '';
	keywordReverseCompetitorAsins.value = competitorAsins;
	keywordReverseVisible.value = true;
}

async function handleScoreKeywordOrganicAd() {
	const id = props.candidate?.candidate_id || props.candidate?.id;
	if (!id) {
		ElMessage.warning("缺少选品ID");
		return;
	}
	scoreLoading.value = true;
	try {
		const res = await service.app.bsr_candidate_competitor.scoreKeywordOrganicAd({ candidate_id: id });
		if (res.code === 1000) {
			scoreResultData.value = res.data;
			scoreResultVisible.value = true;
			Crud.value?.refresh();
		} else {
			ElMessage.error(res.message || "得分计算失败");
		}
	} catch (err: any) {
		console.error("竞品关键词自然广告得分失败:", err);
		ElMessage.error(err.message || "得分计算失败");
	} finally {
		scoreLoading.value = false;
	}
}
</script>

<style lang="scss">
table .el-rate .el-rate__icon {
	margin-right: 2px;
}

.date-cell {
	position: relative;
	min-height: 40px;

	.new-tag {
		position: absolute;
		bottom: -2px;
		right: 0;
		color: #ff0000;
		font-size: 12px;
		font-weight: bold;
		transform: scale(0.8);
		background: rgba(255, 0, 0, 0.1);
		padding: 1px 3px;
		border-radius: 2px;
	}
}

/* ASIN单元格样式 - 紧凑布局 */
.asin-cell {
	min-height: 40px;
	padding-bottom: 20px;
	position: relative;
}

/* 新增：ASIN链接样式 */
.asin-link {
	color: #409eff;
	cursor: pointer;
	&:hover {
		color: #66b1ff;
		text-decoration: underline;
	}
}

/* 标签容器 - 水平排列 */
.tags-container {
	display: flex;
	gap: 8px;
	margin-top: 4px;
	align-items: center;
}

/* 保持原有样式 */
table .el-rate .el-rate__icon {
	margin-right: 2px;
}

.asin-group {
	border: 1px solid #ebeef5;
	border-radius: 4px;
	padding: 15px;
	margin-bottom: 15px;
	position: relative;

	&:after {
		content: "竞品 " counter(item);
		counter-increment: item;
		position: absolute;
		right: 10px;
		top: 10px;
		font-size: 12px;
		color: #909399;
	}
}

/* 计数器初始化 */
.el-form {
	counter-reset: item;
}

.dynamic-form .el-col.operations {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding-right: 10px;
}

.country-status {
	display: inline-flex;
	align-items: center;
	gap: 15px;
	margin-left: 10px;
}

.status-item {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	font-size: 14px;

	.el-icon {
		margin-left: 2px;
	}
}

/* 状态标签样式 - 更紧凑 */
.status-tag {
	font-size: 11px;
	padding: 1px 6px;
	border-radius: 3px;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	transition: all 0.2s ease;

	.el-icon {
		font-size: 9px;
		transition: transform 0.2s;
	}

	&:hover {
		box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);

		.el-icon {
			transform: translateY(1px);
		}
	}

	&--close {
		background: #f56c6c20;
		color: #f56c6c;
		border: 1px solid #f56c6c50;
	}

	&--compete {
		background: #409eff20;
		color: #409eff;
		border: 1px solid #409eff50;
	}

	&--non-same {
		background: #f56c6c20;
		color: #f56c6c;
		border: 1px solid #f56c6c50;
	}
}

/* 配送类型标签样式 - 更紧凑 */
.dispatch-tag {
	font-size: 11px;
	padding: 1px 6px;
	border-radius: 3px;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 2px;
	transition: all 0.2s ease;

	.el-icon {
		font-size: 9px;
		transition: transform 0.2s;
	}

	&:hover {
		box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);

		.el-icon {
			transform: translateY(1px);
		}
	}

	&--empty {
		background: #e6e6e620;
		color: #909399;
		border: 1px solid #e6e6e650;
	}

	&--self {
		background: #1989fa20;
		color: #1989fa;
		border: 1px solid #1989fa50;
	}

	&--fba {
		background: #409eff20;
		color: #409eff;
		border: 1px solid #409eff50;
	}

	&--fbm {
		background: #e6a23c20;
		color: #e6a23c;
		border: 1px solid #e6a23c50;
	}
}

.new-tag {
	position: absolute;
	bottom: 0;
	right: 0;
	color: #67c23a;
	font-size: 12px;
	padding: 2px 5px;
	transform: scale(0.8);
	background: rgba(103, 194, 58, 0.1);
	border: 1px solid rgba(103, 194, 58, 0.3);
	border-radius: 3px;
}

.el-dropdown-menu {
	.el-dropdown-menu__item {
		padding: 4px 8px;
		display: flex;
		justify-content: center;
		font-size: 12px;

		&:hover {
			background: #f5f7fa;
		}

		&.is-disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
}

/* 表格行高优化 */
.el-table__row {
	height: 50px !important;

	& > td {
		padding: 4px 0 !important;
	}
}

/* 表格行悬停效果 */
.el-table__row:hover {
	.status-tag,
	.dispatch-tag {
		box-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
		transform: translateY(-0.5px);
	}
}
</style>
