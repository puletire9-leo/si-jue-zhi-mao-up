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

			<!-- <el-button @click="updateStatusTo1" type="primary">获取所有竞品数据</el-button> -->
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
					<div class="date-cell">
						<div class="asin-value">{{ scope.row.asin_competitor }}</div>
						<!-- 状态标签 -->
						<br />
						<el-dropdown
							trigger="hover"
							@command="(command) => handleStatusChange(scope.row, command)"
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
										command="2"
										:disabled="scope.row.status === 2"
									>
										<el-tag type="success" size="small">竞品</el-tag>
									</el-dropdown-item>
									<el-dropdown-item
										command="1"
										:disabled="scope.row.status === 1"
									>
										<el-tag type="warning" size="small">关键词</el-tag>
									</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
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

				<template #column-dispatches_type="{ scope }">
					<!-- 合法值时显示文字 -->
					<template v-if="['0', '1', '2'].includes(scope.row.dispatches_type)">
						{{ DISPATCH_TYPE_MAP[scope.row.dispatches_type] }}
					</template>

					<!-- 非法值（包括 null、undefined、NaN 及其他数字）时显示下拉框 -->
					<el-select
						v-else
						v-model="scope.row.dispatches_type"
						@change="handleDispatchTypeChange(scope.row)"
						@blur="handleDispatchTypeBlur(scope.row)"
						placeholder="请选择类型"
						size="small"
					>
						<el-option label="自营" :value="0" />
						<el-option label="FBA" :value="1" />
						<el-option label="FBM" :value="2" />
					</el-select>
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
import ClCrud from "/~/crud/src/components/crud";
import ClTableColumnBsrHtml from "/$/app/components/cl-table-column-bsr-html.vue";
import ClTableColumnBulletPoints from "/$/app/components/cl-table-column-bullet-points.vue";
import ClRow from "/~/crud/src/components/row";
import { ElMessage } from "element-plus";
import dayjs from "dayjs";
import { generateKeywordSearchVolumeChartOption } from "/$/app/utils";
import { DataLine, Picture } from "@element-plus/icons-vue";
import { Check, Close } from "@element-plus/icons-vue";
import { status } from "nprogress";
import { ElMessageBox } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";

const { service } = useCool();

const countryStatusData = ref<any[]>([]);

// 独立获取国家状态数据的方法
const fetchCountryStatus = async () => {
	const res = await service.app.bsr_candidate_competitor.page({
		candidate_id: props.candidate?.id,
		status: [1, 2],
		size: 1000
	});
	countryStatusData.value = res.list || [];
};

const getStatusText = (status: number) => {
	return status === 2 ? "竞" : "关";
};

// 状态标签样式类
const getStatusClass = (status: number) => {
	return {
		"status-tag--compete": status === 2,
		"status-tag--close": status === 1
	};
};

// 状态切换处理
const handleStatusChange = async (row: any, newStatus: string) => {
	try {
		const statusValue = parseInt(newStatus);
		// 更新状态
		const updateData: any = {
			id: row.id,
			status: statusValue
		};
		if (
			statusValue === BSR_COMPETITOR_STATUS.COMPETITOR.value ||
			statusValue === BSR_COMPETITOR_STATUS.NON_SAME.value
		) {
			updateData.inventory_status = "1";
		}
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

// 修改国家状态判断方法
const hasCountryData = computed(() => (countryCode: string) => {
	return countryStatusData.value.some((item) => item.marketplace === countryCode);
});

const props = defineProps(["candidate"]);
const Crud = useCrud({
	service: service.app.bsr_candidate_competitor,
	async onRefresh(params, { next, done, render }) {
		try {
			// 获取数据
			const { list } = await next({
				...params,
				candidate_id: props.candidate?.id,
				status: [1, 2],
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
	// 只做前端过滤，不再请求接口
	// Table.value?.setData?.(filteredData.value);
	Crud.value?.refresh({ marketplace: selectedCountry.value, page: 1 });
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
			minWidth: 50,
			showOverflowTooltip: true,
			fixed: "left"
		},
		{
			label: "竞品图",
			prop: "image_url_display",
			component: { name: "cl-image", props: { size: 30, fit: "contain" } },
			fixed: "left"
		},
		{ label: "竞品页", prop: "dp_url", fixed: "left", minWidth: 80 },
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
		{
			label: "图片对比分数",
			prop: "similarity_score",
			minWidth: 50,
			showOverflowTooltip: true
		},
		{
			label: "预估日均销量",
			prop: "expected_volume",
			minWidth: 70
		},
		{ label: "月销量走势", prop: "search_volume_chart", width: 70 },

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
			minWidth: 80,
			sortable: "custom",
			formatter(row, column, value) {
				return value === -1 ? "无" : value;
			}
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
		{
			label: "配送类型",
			prop: "dispatches_type",
			minWidth: 80
		},
		{ label: "卖点", prop: "bullet_points", minWidth: 50 },
		{ label: "BSR", prop: "bsr_html", minWidth: 200, showOverflowTooltip: true },
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
			label: "上架时间",
			prop: "date_first_available",
			minWidth: 100,
			formatter(row, column, value) {
				return formatDate(value); // 确保其他使用formatter的地方也正确格式化
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
			label: "国家",
			prop: "marketplace",
			fixed: "left",
			minWidth: 50,
			showOverflowTooltip: true
		},

		{
			label: "最近爬虫时间*",
			prop: "spider_time",
			minWidth: 170,
			sortable: "custom",
			component: { name: "cl-date-text" },
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

		{ type: "op", buttons: ["edit", "delete"] }
	]
});

const DISPATCH_TYPE_MAP: Record<number, string> = {
	0: "自营",
	1: "FBA",
	2: "FBM"
} as const;
// 配送类型保存逻辑
const handleDispatchTypeChange = async (row: any) => {
	if ([0, 1, 2].includes(row.dispatches_type)) {
		await saveDispatchType(row);
	}
};

const saveDispatchType = async (row: any) => {
	try {
		if (![0, 1, 2].includes(row.dispatches_type)) {
			ElMessage.warning("请选择有效的配送类型");
			Crud.value?.refresh();
			return;
		}

		await service.app.bsr_candidate_competitor.update({
			id: row.id,
			dispatches_type: row.dispatches_type
		});

		ElMessage.success("配送类型已更新");
		// 刷新数据保持一致性
		Crud.value?.refresh();
	} catch (error) {
		console.error("保存失败:", error);
		ElMessage.error("保存失败");
		// 恢复原始数据
		Crud.value?.refresh();
	}
};

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
		const payload = items.value
			.filter((item) => item.asin_competitor && item.marketplace && item.status)
			.map((item) => ({
				...item,
				candidate_id: props.candidate?.id,
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
			const payload = items.value
				.filter(
					(item) =>
						item.asin_competitor && item.marketplace && item.item_name && item.status
				)
				.map((item) => ({
					...item,
					candidate_id: props.candidate.id,
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

const handleDispatchTypeBlur = (row) => {
	row.dispatches_type = Number(row.dispatches_type); // 强制转换为数字
	saveDispatchType(row);
};

// 新增国家选项配置
const countryOptions = ref([
	{ label: "英国", value: "英国" },
	{ label: "德国", value: "德国" },
	{ label: "法国", value: "法国" },
	{ label: "西班牙", value: "西班牙" },
	{ label: "意大利", value: "意大利" }
]);
const selectedCountry = ref<string>("");

// 监听选品信息变化，设置默认国家
watch(
	() => props.candidate,
	(newVal) => {
		if (newVal?.marketplace) {
			selectedCountry.value = newVal.marketplace;
			// 立即触发查询
			Crud.value?.refresh({
				marketplace: newVal.marketplace,
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
		const asinCandidate = props.candidate?.asin;
		if (!asinCandidate) {
			ElMessage.warning("缺少候选ASIN信息");
			return;
		}

		const currentData = filteredData.value;

		const groups: Record<string, any[]> = {};

		currentData.forEach((item) => {
			const hasValidVariants =
				item.variants != null && item.variants !== -1 && item.variants !== "无";
			const hasValidSoldBy = item.sold_by != null && item.sold_by.trim() !== "";

			if (hasValidVariants && hasValidSoldBy) {
				const key = `${item.sold_by}_${item.variants}_${item.Main_monthly_sales}`;
				if (!groups[key]) groups[key] = [];
				groups[key].push(item);
			}
		});

		const idsToDelete: any[] = [];

		Object.values(groups).forEach((group) => {
			// 只有当组内有2条或以上记录时才处理
			if (group.length <= 1) return;

			let keepItem = group[0];

			const asinMatch = group.find((item) => item.asin_competitor === asinCandidate);
			if (asinMatch) {
				keepItem = asinMatch;
			} else {
				keepItem = group.reduce((maxItem, current) =>
					(current.similarity_score || 0) > (maxItem.similarity_score || 0)
						? current
						: maxItem
				);

				const sameScoreItems = group.filter(
					(item) => item.similarity_score === keepItem.similarity_score
				);

				if (sameScoreItems.length > 1) {
					keepItem = sameScoreItems.reduce((recent, current) =>
						new Date(current.updateTime) > new Date(recent.updateTime)
							? current
							: recent
					);
				}
			}

			group.forEach((item) => {
				if (item.id !== keepItem.id) {
					idsToDelete.push(item.id);
				}
			});
		});

		if (idsToDelete.length === 0) {
			ElMessage.warning("没有找到符合去重条件的记录");
			return;
		}

		try {
			await ElMessageBox.confirm(
				`确定要删除 ${idsToDelete.length} 条重复数据吗？`,
				"确认删除",
				{ type: "warning" }
			);

			await service.app.bsr_candidate_competitor.delete({ ids: idsToDelete });
			ElMessage.success(`成功删除 ${idsToDelete.length} 条重复数据`);
			Crud.value?.refresh();
		} catch (cancel) {
			ElMessage.info("已取消删除操作");
		}
	} catch (error) {
		console.error("去重失败:", error);
		ElMessage.error("去重操作失败");
	}
};
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

.asin-cell {
	position: relative;
	min-height: 40px;
	padding-bottom: 18px;
	/* 给标签留出空间 */
}
.status-tag {
	position: absolute;
	bottom: 0;
	left: 0;
	font-size: 12px;
	padding: 2px 8px;
	border-radius: 3px;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 3px;
	transition: all 0.3s ease;

	.el-icon {
		font-size: 10px;
		transition: transform 0.3s;
	}

	&:hover {
		box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);

		.el-icon {
			transform: translateY(1px);
		}
	}

	&--close {
		background: #f56c6c20;
		color: #f56c6c;
		border: 1px solid #f56c6c50;

		&:hover {
			background: #f56c6c30;
		}
	}

	&--compete {
		background: #409eff20;
		color: #409eff;
		border: 1px solid #409eff50;

		&:hover {
			background: #409eff30;
		}
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
		padding: 5px 10px;
		display: flex;
		justify-content: center;

		&:hover {
			background: #f5f7fa;
		}

		&.is-disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
}

/* 表格行悬停效果 */
.el-table__row:hover {
	.status-tag {
		box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
		transform: translateY(-1px);
	}
}
</style>
