import type { ModuleManifest } from "@/modules/types";

export default {
  id: "ai-selection",
  name: "AI 选品",
  icon: "MagicStick",
  menuGroup: "选品中心",
  menuSection: "选品工作台",
  menuSectionOrder: 1,
  menuOrder: 8,
  route: {
    path: "ai-selection",
    name: "AiSelection",
    component: () => import("@/views/AllSelection/index.vue"),
    meta: { title: "AI 选品" },
  },
} satisfies ModuleManifest;
