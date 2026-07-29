import type { ModuleManifest } from '../types'

export default {
  id: 'sellersprite-request-center',
  name: '卖家精灵请求中心',
  icon: 'Operation',
  menuGroup: '选品中心',
  menuSection: '数据采集',
  menuSectionOrder: 3,
  menuOrder: 21,
  route: {
    path: 'request-center/tasks',
    name: 'SellerspriteRequestCenter',
    component: () => import('./index.vue'),
    meta: { title: '卖家精灵请求中心' }
  }
} satisfies ModuleManifest
