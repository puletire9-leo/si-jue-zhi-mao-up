<template>
	<div ref="chartRef" style="width: 280px; height: 200px"></div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import * as echarts from "echarts";

const props = defineProps({
	data: Array
});

const chartRef = ref(null);

const renderChart = () => {
	if (!chartRef.value) return;
	const chart = echarts.init(chartRef.value);
	chart.setOption({
		tooltip: { trigger: "axis" },
		xAxis: { type: "category", data: Array.from({ length: 12 }, (_, i) => `X-${i + 1}`) },
		yAxis: { type: "value" },
		series: [
			{
				data: props.data,
				type: "line",
				smooth: true
			}
		]
	});
};

onMounted(renderChart);
watch(() => props.data, renderChart);
</script>
