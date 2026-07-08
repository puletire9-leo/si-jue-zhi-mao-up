import type { ModuleManifest } from '../types'

export default {
  id: 'shop-collection-shops',
  name: '店铺全集画像',
  icon: 'DataBoard',
  menuGroup: '店铺分析',
  menuOrder: 41,
  route: {
    path: 'shop-collection/shops',
    name: 'ShopCollectionShops',
    component: () => import('./index.vue'),
    meta: { title: '店铺全集画像' }
  }
} satisfies ModuleManifest
