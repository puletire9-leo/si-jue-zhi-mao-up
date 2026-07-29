import type { ModuleManifest } from '../types'

export default {
  id: 'shop-candidate-pool',
  name: '店铺请求中心',
  icon: 'CollectionTag',
  menuGroup: '店铺总览',
  menuSection: '店铺池',
  menuSectionOrder: 1,
  menuOrder: 16,
  route: {
    path: 'shop-candidates/pool',
    name: 'ShopCandidatePool',
    component: () => import('./index.vue'),
    meta: { title: '店铺请求中心' }
  }
} satisfies ModuleManifest
