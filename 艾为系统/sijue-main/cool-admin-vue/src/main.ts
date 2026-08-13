import { createApp } from "vue";
import App from "./App.vue";
import { bootstrap } from "./cool";
import { installGlobalImageLoadingOptimizer } from "/@/cool/utils/image-loading";
import { installFrontendErrorLogging, reportFrontendError } from "/$/app/utils/error-log-reporter";

const app = createApp(App);
installGlobalImageLoadingOptimizer();
installFrontendErrorLogging();

// 暴露到 window，方便在控制台直接查看
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__BUILD_VERSION__ = import.meta.env.VITE_GIT_SHA;
console.log("BUILD_VERSION", import.meta.env.VITE_GIT_SHA);

/*=========================== ECharts start ===========================*/
// import "echarts"; /* 全量引入。要按需引入的话使用工具：https://vue-echarts.dev/#codegen */

import { use } from "echarts/core";
import { BarChart } from "echarts/charts";
import {
	TooltipComponent,
	GridComponent,
	ToolboxComponent,
	BrushComponent
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

use([TooltipComponent, GridComponent, ToolboxComponent, BrushComponent, BarChart, SVGRenderer]);

// import type {ComposeOption} from 'echarts/core'
// import type {BarSeriesOption} from 'echarts/charts'
// import type {TooltipComponentOption, GridComponentOption} from 'echarts/components'
//
// type EChartsOption = ComposeOption<
//   | TooltipComponentOption
//   | GridComponentOption
//   | BarSeriesOption
// >

/* Vue EChart 貌似不需要显式引入，直接使用 <v-chart> 即可*/
// import VChart from 'vue-echarts';
/*=========================== ECharts end ===========================*/

// 启动
bootstrap(app)
	.then(() => {
		app.mount("#app");
	})
	.catch((err) => {
		console.error("COOL-ADMIN 启动失败", err);
		reportFrontendError({
			module: "bootstrap",
			message: err?.message || "COOL-ADMIN startup failed",
			stack: err?.stack,
			extra: {
				type: "startup_error"
			}
		});
	});
