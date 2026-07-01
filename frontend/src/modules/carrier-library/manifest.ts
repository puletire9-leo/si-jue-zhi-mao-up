import type { ModuleManifest } from "@/modules/types";

export default {
  id: "carrier-library",
  name: "载体库",
  icon: "Brush",
  menuGroup: "非标品",
  menuOrder: 42,
  route: {
    path: "carrier-library",
    name: "CarrierLibrary",
    component: () => import("@/views/CarrierLibrary/index.vue"),
    meta: { title: "载体库" },
  },
} satisfies ModuleManifest;
