import type { ModuleManifest } from "@/modules/types";

export default {
  id: "lingxing-workspace",
  name: "领星工作台",
  icon: "DataAnalysis",
  menuGroup: "领星",
  menuOrder: 49,
  route: {
    path: "lingxing/workspace",
    name: "LingxingWorkspace",
    component: () => import("./index.vue"),
    meta: { title: "领星工作台" },
  },
} satisfies ModuleManifest;
