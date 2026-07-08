import type { ModuleManifest } from '../types'

export default {
  id: 'shop-collection-watchlist',
  name: '店铺观察池',
  icon: 'Aim',
  menuGroup: '店铺总览',
  menuOrder: 17,
  route: {
    path: 'shop-collection/watchlist',
    name: 'ShopCollectionWatchlist',
    component: () => import('./index.vue'),
    meta: { title: '店铺观察池' }
  }
} satisfies ModuleManifest
