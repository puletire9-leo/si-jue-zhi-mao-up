import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'shop-profile',
  name: '店铺画像',
  icon: 'Shop',
  menuGroup: '店铺总览',
  menuOrder: 19,
  route: {
    path: 'shop-profile',
    name: 'ShopProfile',
    component: () => import('./Shell.vue'),
    meta: { title: '店铺画像', keepAlive: true },
    children: [
      {
        path: '',
        name: 'ShopProfileList',
        component: () => import('./index.vue'),
        meta: { title: '店铺画像' }
      },
      {
        path: 'baselines',
        name: 'ShopProfileBaselines',
        component: () => import('./baselines.vue'),
        meta: { title: '店铺基线与定位' }
      },
      {
        // 静态段优先于下面的动态 :marketplace/:sellerName，无需担心顺序
        path: 'baselines/:baselineCode',
        name: 'ShopProfileBaselineDetail',
        component: () => import('./baselines.vue'),
        meta: { title: '基线定位' }
      },
      {
        path: ':marketplace/:sellerName',
        name: 'ShopProfileDetail',
        component: () => import('./detail.vue'),
        meta: { title: '单店画像' }
      }
    ]
  }
} satisfies ModuleManifest
