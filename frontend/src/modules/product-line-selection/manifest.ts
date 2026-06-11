// 品线选品模块 — Amber Classic 风格
import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'product-line-selection',
  name: '品线选品',
  icon: 'Search',
  menuGroup: '选品中心',
  menuOrder: 20,
  permissions: [],
  route: {
    path: 'product-line-selection',
    name: 'ProductLineSelection',
    component: () => import('./index.vue'),
    meta: { title: '品线选品', keepAlive: true }
  }
} satisfies ModuleManifest
