<template>
	<div class="trend-chart-container" v-loading="loading">
		<!-- 顶部工具栏：图例 + 刷新 -->
		<div class="trend-toolbar">
			<div class="trend-legend">
				<span class="legend-item"><span class="legend-dot" style="background: #3b82f6"></span>竞品销量</span>
				<span class="legend-item"><span class="legend-dot" style="background: #f59e0b"></span>搜索趋势</span>
				<span class="legend-item"><span class="legend-dot" style="background: #10b981"></span>库销比</span>
			</div>
			<span
				class="trend-refresh-btn"
				:class="{ spinning: refreshing }"
				@click="handleRefresh"
				title="刷新数据"
			>🔄</span>
		</div>
		<v-chart
			v-if="hasData"
			:option="chartOption"
			style="width: 100%; height: 150px"
			autoresize
		/>
		<div v-else class="no-data">暂无数据</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from "vue";
import { useCool } from "/@/cool";
import dayjs from "dayjs";
import * as echarts from "echarts/core";
import {
	TitleComponent,
	TooltipComponent,
	GridComponent,
	LegendComponent
} from "echarts/components";
import { BarChart, LineChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
	TitleComponent,
	TooltipComponent,
	GridComponent,
	LegendComponent,
	BarChart,
	LineChart,
	CanvasRenderer
]);

const props = defineProps({
	productCode: {
		type: String,
		required: true
	},
	asin: {
		type: String,
		required: true
	},
	marketplace: {
		type: String,
		required: true
	},
	// 可选：传递日均销量以确保库销比计算准确（如果需要），
	// 虽然图表主要依赖历史数据。
	dailyAvgSales: {
		type: Number,
		default: 0
	},
	isMock: {
		type: Boolean,
		default: false
	}
});

const { service } = useCool();
const loading = ref(false);
const hasData = ref(false);
const refreshing = ref(false);

const handleRefresh = async () => {
	if (refreshing.value || loading.value) return;
	refreshing.value = true;
	try {
		await loadData();
	} finally {
		refreshing.value = false;
	}
};

// 图表数据引用
const monthlySales = ref<number[]>([]); // 月销量
const monthlyInventory = ref<number[]>([]); // 月库存
const monthlyRatio = ref<number[]>([]); // 库销比
const allKeywords = ref<any[]>([]); // 所有关键词数据
const last12Months = ref<string[]>([]); // 最近12个月的时间轴

const loadData = async () => {
	// MOCK 模式：生成假数据
	if (props.isMock) {
		loading.value = true;
		await new Promise((resolve) => setTimeout(resolve, 500)); // 模拟延迟

		const months: string[] = [];
		const sales: number[] = [];
		const inventory: number[] = [];

		for (let i = 12; i >= 0; i--) {
			const d = dayjs().subtract(i, "month");
			months.push(d.format("YYYY-MM"));
			sales.push(Math.floor(Math.random() * 500) + 50);
			inventory.push(Math.floor(Math.random() * 1000) + 200);
		}

		last12Months.value = months;
		monthlySales.value = sales;
		monthlyInventory.value = inventory;
		monthlyRatio.value = sales.map((s, i) => parseFloat((s / (inventory[i] || 1)).toFixed(2)));

		// Mock 关键词
		allKeywords.value = [
			{
				keyword: "dog toy",
				search_volume: 12000,
				rank: 5,
				alignedData: [100, 120, 110, 130, 140, 150, 160, 155, 165, 170, 180, 190, 200]
			},
			{
				keyword: "pet chewing",
				search_volume: 5000,
				rank: 12,
				alignedData: [50, 60, 55, 65, 70, 75, 80, 78, 85, 90, 95, 100, 110]
			}
		];

		hasData.value = true;
		loading.value = false;
		return;
	}

	if (!props.productCode || !props.marketplace || !props.asin) return;

	loading.value = true;
	try {
		// 并行获取数据
		const [salesRes, keywordsRes] = await Promise.all([
			service.app.analysis.getData({
				product_code: props.productCode,
				marketplace: props.marketplace,
				asin: props.asin
			}),
			service.app.analysis.getKeywords({
				asin: props.asin,
				marketplace: props.marketplace,
				product_code: props.productCode
			})
		]);

		if (salesRes || keywordsRes) {
			hasData.value = true;
		}

		// ===== 1. 生成时间轴 (当前月 - 过去12个月) =====
		const months: string[] = [];
		for (let i = 12; i >= 0; i--) {
			const d = dayjs().subtract(i, "month");
			months.push(d.format("YYYY-MM"));
		}
		last12Months.value = months;

		// ===== 2. 处理销量 & 库存数据 =====
		if (salesRes) {
			const lastYear = salesRes.lastYear;
			const currentYear = salesRes.currentYear;
			const lastYearSales = salesRes.salesData?.last?.month || [];
			const currentYearSales = salesRes.salesData?.current?.month || [];

			monthlySales.value = months.map((monthStr) => {
				const [year, month] = monthStr.split("-").map(Number);
				const monthIndex = month - 1;
				if (year === lastYear) return lastYearSales[monthIndex] || 0;
				if (year === currentYear) return currentYearSales[monthIndex] || 0;
				return 0;
			});

			if (salesRes.inventoryData) {
				const lastYearInv = salesRes.inventoryData.last?.month || [];
				const currentYearInv = salesRes.inventoryData.current?.month || [];

				monthlyInventory.value = months.map((monthStr) => {
					const [year, month] = monthStr.split("-").map(Number);
					const monthIndex = month - 1;
					if (year === lastYear) return lastYearInv[monthIndex] || 0;
					if (year === currentYear) return currentYearInv[monthIndex] || 0;
					return 0;
				});
			}

			// 计算库销比
			monthlyRatio.value = monthlyInventory.value.map((inv, i) => {
				const sales = monthlySales.value[i];
				if (!sales || sales === 0) return 0;
				return Math.round((inv / sales) * 100) / 100;
			});
		}

		// ===== 3. 处理关键词数据 =====
		if (keywordsRes?.series) {
			const keywordXAxis = keywordsRes.xAxis || [];

			// 重新映射关键词系列以对齐我们的时间轴
			allKeywords.value = keywordsRes.series.map((serie: any) => ({
				...serie,
				alignedData: months.map((monthStr) => {
					const idx = keywordXAxis.indexOf(monthStr);
					return idx >= 0 ? serie.data?.[idx] || 0 : 0;
				})
			}));
		}
	} catch (err) {
		console.error("加载图表数据失败:", err);
	} finally {
		loading.value = false;
	}
};

// 计算属性：聚合关键词月度总数
const keywordMonthlyTotals = computed(() => {
	if (!allKeywords.value || allKeywords.value.length === 0) return [];

	// 如果有对齐的数据则使用，否则作为兜底
	const monthCount = last12Months.value.length || 13;
	const totals: number[] = [];

	for (let i = 0; i < monthCount; i++) {
		let monthSum = 0;
		for (const kw of allKeywords.value) {
			const data = (kw as any).alignedData || kw.data || [];
			monthSum += data[i] || 0;
		}
		totals.push(monthSum);
	}
	return totals;
});

// 计算属性：图表配置 (完全复刻 ListingAnalysisMini)
const chartOption = computed(() => {
	// 归一化数据到 0-1 范围以便进行趋势对比
	const salesData = monthlySales.value || [];
	const keywordData = keywordMonthlyTotals.value || [];
	const ratioData = monthlyRatio.value || [];

	const maxSales = Math.max(...salesData, 1);
	const maxKeyword = Math.max(...keywordData, 1);
	const maxRatio = Math.max(...ratioData, 1);

	const normalize = (data: number[], maxVal: number) =>
		data.map((v) => (maxVal > 0 ? v / maxVal : 0));

	const normalizedSales = normalize(salesData, maxSales);
	const normalizedKeyword = normalize(keywordData, maxKeyword);
	const normalizedRatio = normalize(ratioData, maxRatio);

	return {
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "line" },
			textStyle: { fontSize: 10 },
			confine: true,
			// 自定义格式化函数以显示真实数值
			formatter: (params: any) => {
				if (!params || params.length === 0) return "";
				const date = params[0].axisValue;
				let html = `<div style="font-size:11px;font-weight:500;margin-bottom:4px;">${date}</div>`;
				params.forEach((item: any) => {
					const idx = item.dataIndex;
					let realValue: number | string = 0;
					if (item.seriesName === "竞品销量") {
						realValue = salesData[idx] ?? 0;
					} else if (item.seriesName === "搜索趋势") {
						realValue = keywordData[idx] ?? 0;
					} else if (item.seriesName === "库销比") {
						realValue = ratioData[idx]?.toFixed(2) ?? 0;
					}
					html += `<div style="display:flex;align-items:center;gap:4px;font-size:10px;">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};"></span>
                        <span>${item.seriesName}:</span>
                        <span style="font-weight:500;">${realValue}</span>
                    </div>`;
				});
				return html;
			}
		},
		legend: { show: false },
		grid: {
			top: 8,
			right: 5,
			bottom: 0,
			left: 5,
			containLabel: true
		},
		xAxis: {
			type: "category",
			data: last12Months.value,
			axisLabel: {
				rotate: 0,
				interval: 2,
				fontSize: 8,
				color: "#9ca3af",
				formatter: (v: string) => v.slice(5)
			},
			axisTick: { show: false },
			axisLine: { show: false }
		},
		yAxis: [
			{
				type: "value",
				min: 0,
				max: 1, // 归一化范围 0-1
				show: false
			},
			{
				type: "value",
				min: 0,
				max: 1,
				show: false
			}
		],
		series: [
			{
				name: "竞品销量",
				type: "bar", // 根据源文件使用 bar
				data: normalizedSales,
				itemStyle: { color: "#3b82f6" },
				barMaxWidth: 12
			},
			{
				name: "搜索趋势",
				type: "bar",
				data: normalizedKeyword,
				itemStyle: { color: "#f59e0b" },
				barMaxWidth: 12
			},
			{
				name: "库销比",
				type: "line",
				yAxisIndex: 1,
				data: normalizedRatio,
				itemStyle: { color: "#10b981" },
				lineStyle: { width: 1.5 },
				symbolSize: 4
			}
		]
	};
});

onMounted(() => {
	loadData();
});

// 监听 props 变化，如果必要重新加载数据 (例如 props 发生改变时)
watch(
	() => props.productCode,
	() => {
		loadData();
	}
);
</script>

<style scoped>
.trend-chart-container {
	min-width: 300px;
	min-height: 160px;
	background-color: #fff;
	position: relative;
}

.trend-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 2px;
	margin-bottom: 2px;
}

.trend-legend {
	display: flex;
	align-items: center;
	gap: 10px;
}

.legend-item {
	display: flex;
	align-items: center;
	gap: 3px;
	font-size: 10px;
	color: #6b7280;
	white-space: nowrap;
}

.legend-dot {
	display: inline-block;
	width: 7px;
	height: 7px;
	border-radius: 50%;
	flex-shrink: 0;
}

.trend-refresh-btn {
	cursor: pointer;
	font-size: 13px;
	line-height: 1;
	opacity: 0.5;
	transition: opacity 0.2s, transform 0.3s;
	user-select: none;
}

.trend-refresh-btn:hover {
	opacity: 1;
}

.trend-refresh-btn.spinning {
	animation: trend-spin 0.8s linear infinite;
	opacity: 1;
}

@keyframes trend-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

.no-data {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 150px;
	color: #909399;
	font-size: 12px;
}
</style>
