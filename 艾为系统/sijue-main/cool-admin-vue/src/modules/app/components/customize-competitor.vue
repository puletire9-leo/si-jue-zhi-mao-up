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
				<!-- 新增全部选项 -->

				<el-option
					v-for="country in countryOptions"
					:key="country.value"
					:label="country.label"
					:value="country.value"
				/>
			</el-select>

			<el-button @click="updateStatusTo1" type="primary">获取所有竞品数据</el-button>

			<cl-flex1 />
			<cl-search-key placeholder="模糊搜索" />
		</cl-row>

		<cl-row>
			<cl-table ref="Table">
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
					<template v-if="[0, 1, 2].includes(scope.row.dispatches_type)">
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
						clearable
						filterable
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
						<el-row :gutter="15">
							<el-col :span="10">
								<el-input
									v-model="item.asin_competitor"
									placeholder="竞品ASIN"
									clearable
								/>
							</el-col>
							<el-col :span="10">
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
							<el-col :span="4" class="flex items-center justify-end gap-1">
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
import { watch, ref, computed } from "vue";
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

const { service } = useCool();

const props = defineProps(["candidate"]);

const Crud = useCrud(
	{
		service: service.app.bsr_candidate_competitor_customize,
		async onRefresh(params, { next, done, render }) {
			const { list } = await next({
				...params,
				asin_candidate: props.candidate?.asin_candidate,
				marketplace: selectedCountry.value // 添加国家筛选参数
			});

			Table.value?.data.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				dispatches_type: Number(item.dispatches_type); // 确保数值类型
			});

			list.forEach((item) => {
				item.image_url_display = convert_image_url(item.image_url);
				item.dispatches_type =
					item.dispatches_type != null ? Number(item.dispatches_type) : null;
			});

			render(list);
		}
	},
	(app) => {
		app.refresh({
			size: 50
		});
	}
);
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

watch(props, () => {
	Crud.value?.refresh();
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
			label: "预估日均销量",
			prop: "expected_volume",
			minWidth: 70
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
		marketplace: lastItem?.marketplace || "" // 自动继承上一个选择
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
			countryOptions.value.some((c) => c.value === item.marketplace)
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
			.filter((item) => item.asin_competitor && item.marketplace)
			.map((item) => ({
				...item,
				candidate_id: props.candidate?.id,
				asin_candidate: props.candidate?.asin,
				status: 0
			}));

		await service.app.bsr_candidate_competitor.add(payload);
		ElMessage.success(`成功添加${payload.length}条竞品数据`);
		Crud.value?.refresh();
		Upsert.value?.close();
	} catch (error) {
		console.error("批量添加失败:", error);
		ElMessage.error("添加失败，请检查数据格式");
	}
};

// script部分修改
const items = ref([{ asin_competitor: "", marketplace: "" }]);

const Upsert = useUpsert({
	dialog: {
		width: "600px",
		beforeClose: () => {
			items.value = [{ asin_competitor: "", marketplace: "" }]; // 重置表单
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
				.filter((item) => item.asin_competitor && item.marketplace)
				.map((item) => ({
					...item,
					candidate_id: props.candidate.id,
					asin_candidate: props.candidate.asin,
					status: 0
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
			// 立即触发一次搜索
			Crud.value?.refresh();
		}
	},
	{ immediate: true }
);

const handleCountryChange = () => {
	Crud.value?.refresh({
		marketplace: selectedCountry.value
	});
};

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
</style>
