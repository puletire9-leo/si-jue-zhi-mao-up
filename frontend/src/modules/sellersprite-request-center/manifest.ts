import type { ModuleManifest } from '../types'

export default {
  id: 'sellersprite-request-center',
  name: '卖家精灵请求中心',
  icon: 'Operation',
  menuGroup: '店铺总览',
  menuOrder: 21,
  route: {
    path: 'request-center/tasks',
    name: 'SellerspriteRequestCenter',
    component: () => import('./index.vue'),
    meta: { title: '卖家精灵请求中心' }
  }
} satisfies ModuleManifest
