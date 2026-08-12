import type { ModuleManifest } from "@/modules/types";

export default {
  id: "lingxing-inventory-arrival",
  name: "到货情况看板",
  icon: "Van",
  menuGroup: "领星",
  menuOrder: 50,
  route: {
    path: "lingxing/inventory-arrival",
    name: "LingxingInventoryArrival",
    component: () => import("./index.vue"),
    meta: { title: "到货情况看板" },
  },
} satisfies ModuleManifest;
