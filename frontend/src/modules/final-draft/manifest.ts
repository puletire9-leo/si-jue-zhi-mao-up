import type { ModuleManifest } from "@/modules/types";

export default {
  id: "final-draft",
  name: "设计稿",
  icon: "Brush",
  menuGroup: "非标品",
  menuOrder: 40,
  route: {
    path: "final-draft",
    name: "FinalDraft",
    component: () => import("@/views/FinalDraft/index.vue"),
    meta: { title: "设计稿" },
  },
} satisfies ModuleManifest;
