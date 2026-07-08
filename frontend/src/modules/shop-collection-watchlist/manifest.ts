import type { ModuleManifest } from '../types'

export default {
  id: 'shop-collection-watchlist',
  name: '店铺观察池',
  icon: 'Aim',
  menuGroup: '店铺分析',
  menuOrder: 40,
  route: {
    path: 'shop-collection/watchlist',
    name: 'ShopCollectionWatchlist',
    component: () => import('./index.vue'),
    meta: { title: '店铺观察池' }
  }
} satisfies ModuleManifest
