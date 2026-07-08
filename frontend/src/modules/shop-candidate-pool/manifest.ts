import type { ModuleManifest } from '../types'

export default {
  id: 'shop-candidate-pool',
  name: '店铺候选池',
  icon: 'CollectionTag',
  menuGroup: '店铺分析',
  menuOrder: 39,
  route: {
    path: 'shop-candidates/pool',
    name: 'ShopCandidatePool',
    component: () => import('./index.vue'),
    meta: { title: '店铺候选池' }
  }
} satisfies ModuleManifest
