<template>
	<cl-crud ref="Crud">
		<cl-row>
			<!-- 刷新按钮 -->
			<cl-refresh-btn />
			<!-- 新增按钮 -->
			<cl-add-btn />
			<!-- 删除按钮 -->
			<cl-multi-delete-btn />

			<cl-import-btn tips="" :on-submit="onSubmit" :template="importTemplate" />
			<cl-flex1 />
			<!-- 关键字搜索 -->
			<cl-search-key />
		</cl-row>

		<cl-row>
			<!-- 数据表格 -->
			<cl-table ref="Table" />
		</cl-row>

		<cl-row>
			<cl-flex1 />
			<!-- 分页控件 -->
			<cl-pagination />
		</cl-row>

		<!-- 在表格上方添加图表 -->
		<!-- <cl-row>
		<v-chart class="chart" :option="chartOptions" autoresize />
		</cl-row> -->

		<!-- 新增、编辑 -->
		<cl-upsert ref="Upsert" />
	</cl-crud>
</template>

<script lang="ts" name="app-keywordAnalysis" setup>
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import {
	GridComponent,
	TitleComponent,
	TooltipComponent,
	LegendComponent
} from "echarts/components";
import VChart from "vue-echarts";
import { useCrud, useTable, useUpsert } from "@cool-vue/crud";
import { useCool } from "/@/cool";
import { ElMessage } from "element-plus";

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);
const { service } = useCool();
// 新增的图表相关引入
import { ref, onMounted, watch, h } from "vue";
// 定义 ECharts 基础配置 —— 放在最前面
const baseChartOptions = {
	tooltip: {
		trigger: "axis",
		formatter: (params: any) => {
			if (params && params.length) {
				const idx = params[0].dataIndex;
				const monthLabel = "" + (idx + 1);
				return `月份: ${monthLabel}<br/>搜索量: ${params[0].value}`;
			}
			return "";
		},
		position: (point, params, dom, rect, size) => {
			return [point[1], point[1] - 20];
		}
	},
	animation: false,
	xAxis: {
		type: "category",
		show: false,
		data: ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9", "X10", "X11", "X12"]
	},
	yAxis: {
		type: "value",
		max: function (value: any) {
			// 例如，取最大值的 120% 作为上限
			return value.max * 1.2;
		},
		show: false
	},
	grid: { top: 5, bottom: 5, left: 5, right: 5 },
	series: [
		{
			type: "line",
			smooth: true,
			lineStyle: { width: 2, color: "#409EFF" },
			areaStyle: {
				color: {
					type: "linear",
					x: 0,
					y: 0,
					x2: 0,
					y2: 1,
					colorStops: [
						{ offset: 0, color: "rgba(64, 158, 255, 0.3)" },
						{ offset: 1, color: "rgba(64, 158, 255, 0)" }
					]
				}
			},
			showSymbol: false
		}
	]
};
// cl-upsert 配置
const Upsert = useUpsert({
	items: [
		{ label: "关键词", prop: "keyword" },
		{ label: "任务源", prop: "task_asin" },
		{ label: "关键词中文意思", prop: "keyword_cn" },
		{ label: "月搜索量", prop: "monthly_search" },
		{ label: "广告竞品数", prop: "ad_competitor_count" },
		{ label: "PPC竞价", prop: "ppc_bid" },
		{ label: "X-1", prop: "x_1_month_search" },
		{ label: "X-2", prop: "x_2_month_search" },
		{ label: "X-3", prop: "x_3_month_search" },
		{ label: "X-4", prop: "x_4_month_search" },
		{ label: "X-5", prop: "x_5_month_search" },
		{ label: "X-6", prop: "x_6_month_search" },
		{ label: "X-7", prop: "x_7_month_search" },
		{ label: "X-8", prop: "x_8_month_search" },
		{ label: "X-9", prop: "x_9_month_search" },
		{ label: "X-10", prop: "x_10_month_search" },
		{ label: "X-11", prop: "x_11_month_search" },
		{ label: "X-12", prop: "x_12_month_search" }
	]
});

// cl-table 配置
const Table = useTable({
	columns: [
		{ type: "selection" },
		{ label: "关键词", prop: "keyword", width: 150 },
		{ label: "任务源", prop: "task_asin", width: 120 },
		{
			label: "趋势分析",
			prop: "chart",
			width: 500,
			component: ({ row }) => {
				// 构造图表配置
				const chartOption = {
					...baseChartOptions,
					series: [
						{
							...baseChartOptions.series[0],
							data: [
								Number(row.x_1_month_search || 0),
								Number(row.x_2_month_search || 0),
								Number(row.x_3_month_search || 0),
								Number(row.x_4_month_search || 0),
								Number(row.x_5_month_search || 0),
								Number(row.x_6_month_search || 0),
								Number(row.x_7_month_search || 0),
								Number(row.x_8_month_search || 0),
								Number(row.x_9_month_search || 0),
								Number(row.x_10_month_search || 0),
								Number(row.x_11_month_search || 0),
								Number(row.x_12_month_search || 0)
							]
						}
					]
				};
				// 返回 VChart 包裹在一个 div 中
				return h("div", { style: "width: 100%; height: 120;" }, [
					h(VChart, {
						option: chartOption,
						autoresize: true
						// style: "width: 100%; height: 120px;"
					})
				]);
			}
		},
		{
			label: "详细数据",
			prop: "detail",
			children: [
				{ label: "月搜索量", prop: "monthly_search", width: 100 },
				{ label: "广告竞品数", prop: "ad_competitor_count", width: 120 },
				{ label: "PPC竞价", prop: "ppc_bid", width: 100 }
			]
		},
		{ label: "创建时间", prop: "createTime", width: 180 },
		{ label: "更新时间", prop: "updateTime", width: 180 },
		{ type: "op", buttons: ["edit", "delete"], width: 120 }
	]
});

// cl-crud 配置
const Crud = useCrud({ service: service.app.keywordAnalysis }, (app) => {
	app.refresh();
});

const importTemplate = [
	{
		关键词: "",
		任务源asin: "",
		关键词中文意思: "",
		月搜索量: "",
		供需比或商品数: "",
		广告竞品数: "",
		PPC竞价: "",
		"X-1月搜索量": "",
		"X-2月搜索量": "",
		"X-3月搜索量": "",
		"X-4月搜索量": "",
		"X-5月搜索量": "",
		"X-6月搜索量": "",
		"X-7月搜索量": "",
		"X-8月搜索量": "",
		"X-9月搜索量": "",
		"X-10月搜索量": "",
		"X-11月搜索量": "",
		"X-12月搜索量": ""
	}
];

function flexibleMapping(item: any) {
	const mapping: Record<string, string> = {
		关键词: "keyword",
		任务源asin: "task_asin",
		关键词中文意思: "keyword_cn",
		月搜索量: "monthly_search",
		供需比或商品数: "supply_demand_ratio",
		广告竞品数: "ad_competitor_count",
		PPC竞价: "ppc_bid",
		"X-1月搜索量": "x_1_month_search",
		"X-2月搜索量": "x_2_month_search",
		"X-3月搜索量": "x_3_month_search",
		"X-4月搜索量": "x_4_month_search",
		"X-5月搜索量": "x_5_month_search",
		"X-6月搜索量": "x_6_month_search",
		"X-7月搜索量": "x_7_month_search",
		"X-8月搜索量": "x_8_month_search",
		"X-9月搜索量": "x_9_month_search",
		"X-10月搜索量": "x_10_month_search",
		"X-11月搜索量": "x_11_month_search",
		"X-12月搜索量": "x_12_month_search"
	};
	const newItem: any = {};
	Object.keys(mapping).forEach((chineseKey) => {
		if (item.hasOwnProperty(chineseKey)) {
			newItem[mapping[chineseKey]] = item[chineseKey];
		}
	});
	Object.values(mapping).forEach((key) => {
		if (!newItem[key] && item.hasOwnProperty(key)) {
			newItem[key] = item[key];
		}
	});
	return newItem;
}

async function batchSubmit(dataList: any[], batchSize = 100) {
	const batches: any[][] = [];
	for (let i = 0; i < dataList.length; i += batchSize) {
		batches.push(dataList.slice(i, i + batchSize));
	}
	console.log(`共分成 ${batches.length} 批次提交`);
	for (let index = 0; index < batches.length; index++) {
		const batch = batches[index];
		try {
			console.log(`正在提交第 ${index + 1} 批数据，共 ${batch.length} 条`);
			await service.app.keywordAnalysis.add(batch);
			console.log(`第 ${index + 1} 批数据提交成功`);
		} catch (err: any) {
			console.error(`第 ${index + 1} 批提交失败:`, err);
			ElMessage.error(`第 ${index + 1} 批提交失败: ${err.message || "未知错误"}`);
			return Promise.reject(err);
		}
	}
	return Promise.resolve();
}

function onSubmit(data: any, { close }: any) {
	data.list = data.list.map((item: any) => {
		let newItem = flexibleMapping(item);
		newItem.status = 2;
		newItem.competitor_spider_status = 0;
		return newItem;
	});
	batchSubmit(data.list, 100)
		.then(() => {
			ElMessage.success("所有数据已成功导入");
			close();
		})
		.catch(() => {
			ElMessage.error("部分数据导入失败");
		});
}
</script>

<style scoped>
/* 添加图表容器样式 */
:deep(.vue-echarts) {
	background: rgba(255, 0, 0, 0.1) !important; /* 确认容器可见 */
}
</style>
