import type { ModuleManifest } from '../types'

export default {
  id: 'shop-premium-pool',
  name: '精品店铺池',
  icon: 'TrophyBase',
  menuGroup: '店铺总览',
  menuOrder: 20,
  route: {
    path: 'shop-premium/pool',
    name: 'ShopPremiumPool',
    component: () => import('./index.vue'),
    meta: { title: '精品店铺池' }
  }
} satisfies ModuleManifest
