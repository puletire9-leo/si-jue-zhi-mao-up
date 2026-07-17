import type { ModuleManifest } from "@/modules/types";

export default {
  id: "lingxing-baseline",
  name: "ASIN 基准表",
  icon: "Aim",
  menuGroup: "领星",
  menuOrder: 55,
  route: {
    path: "lingxing/baseline",
    name: "LingxingBaseline",
    component: () => import("./index.vue"),
    meta: { title: "ASIN 基准表" },
  },
} satisfies ModuleManifest;
