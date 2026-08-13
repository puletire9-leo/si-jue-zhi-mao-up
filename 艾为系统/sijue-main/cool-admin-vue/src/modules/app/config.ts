import { ModuleConfig } from "/@/cool";

export default (): ModuleConfig => {
	return {
		views: [
			{
				path: "/app/shoot-task",
				meta: {
					label: "摄影任务管理",
					keepAlive: true
				},
				component: () => import("./views/design-shoot-task.vue")
			},
			{
				path: "/app/design-task",
				meta: {
					label: "美工任务管理",
					keepAlive: true
				},
				component: () => import("./views/design-task.vue")
			},
			{
				path: "/app/design-task/detail",
				meta: {
					label: "美工任务详情",
					keepAlive: true
				},
				component: () => import("./views/design-task-detail.vue")
			},
			{
				path: "/app/design-requirement-list",
				meta: {
					label: "图需管理",
					keepAlive: true
				},
				component: () => import("./views/design-requirement-list.vue")
			},
			{
				path: "/app/design-task-all",
				meta: {
					label: "全部美工任务",
					keepAlive: true
				},
				component: () => import("./views/design-task-all.vue")
			},
			{
				path: "/app/design-upload-task-list",
				meta: {
					label: "上传任务列表",
					keepAlive: true
				},
				component: () => import("./views/design-upload-task-list.vue")
			},
			{
				path: "/app/listing-content-studio",
				meta: {
					label: "Listing 内容工作室",
					keepAlive: true
				},
				component: () => import("./views/listing-content-studio-list.vue")
			},
			{
				path: "/app/listing-content-studio/studio",
				meta: {
					label: "Listing 工作室",
					keepAlive: false
				},
				component: () => import("./views/listing-content-studio-detail.vue")
			},
			{
				path: "/app/listing-ai-copy-task",
				meta: {
					label: "AI 文案任务",
					keepAlive: true
				},
				component: () => import("./views/listing-ai-copy-task-list.vue")
			},
			{
				path: "/app/listing-ai-copy-task/detail",
				meta: {
					label: "AI 文案任务详情",
					keepAlive: false
				},
				component: () => import("./views/listing-ai-copy-task-detail.vue")
			},
			{
				path: "/app/candidate-purchase-plan",
				meta: {
					label: "采购计划管理",
					keepAlive: true
				},
				component: () => import("./views/bsr-candidate-purchase-plan.vue")
			},
			{
				path: "/app/lingxing-listing-ad-performance",
				meta: {
					label: "领星Listing补货运营",
					keepAlive: true
				},
				component: () => import("./views/lingxing_listing_ad_performance.vue")
			},
			{
				path: "/app/bsr-keyword-tracking",
				meta: {
					label: "关键词追踪",
					keepAlive: true
				},
				component: () => import("./views/bsr_keyword_tracking.vue")
			}
		]
	};
};
