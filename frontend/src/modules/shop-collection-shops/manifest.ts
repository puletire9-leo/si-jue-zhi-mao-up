import type { ModuleManifest } from '../types'

export default {
  id: 'shop-collection-shops',
  name: '店铺详情',
  icon: 'DataBoard',
  menuGroup: '店铺总览',
  menuOrder: 18,
  route: {
    path: 'shop-collection/shops',
    name: 'ShopCollectionShops',
    component: () => import('./index.vue'),
    meta: { title: '店铺详情' }
  }
} satisfies ModuleManifest
