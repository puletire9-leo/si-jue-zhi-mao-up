import type { ModuleManifest } from '../types'

export default {
  id: 'zheng-shop-analysis',
  name: '总览',
  icon: 'Shop',
  menuGroup: '店铺总览',
  menuSection: '店铺分析',
  menuSectionOrder: 2,
  menuOrder: 15,
  route: {
    path: 'zheng-shop-overview',
    name: 'ZhengShopOverview',
    component: () => import('./index.vue'),
    meta: { title: '店铺总览' }
  }
} satisfies ModuleManifest
