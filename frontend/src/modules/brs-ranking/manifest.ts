import type { ModuleManifest } from "@/modules/types";

export default {
  id: "brs-ranking",
  name: "BRS榜单",
  icon: "TrendCharts",
  menuGroup: "选品中心",
  menuSection: "商品数据源",
  menuSectionOrder: 2,
  menuOrder: 11.5,
  route: {
    path: "brs-ranking",
    name: "BrsRanking",
    component: () => import("@/views/AllSelection/index.vue"),
    meta: { title: "BRS榜单" },
  },
} satisfies ModuleManifest;
