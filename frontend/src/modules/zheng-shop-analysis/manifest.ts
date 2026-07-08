import type { ModuleManifest } from '../types'

export default {
  id: 'zheng-shop-analysis',
  name: '总览',
  icon: 'Shop',
  menuGroup: '店铺总览',
  menuOrder: 15,
  route: {
    path: 'zheng-shop-overview',
    name: 'ZhengShopOverview',
    component: () => import('./index.vue'),
    meta: { title: '店铺总览' }
  }
} satisfies ModuleManifest
