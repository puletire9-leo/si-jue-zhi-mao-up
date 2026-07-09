import type { ModuleManifest } from '../types'

export default {
  id: 'shop-candidate-pool',
  name: '方法卡找店',
  icon: 'CollectionTag',
  menuGroup: '店铺总览',
  menuOrder: 16,
  route: {
    path: 'shop-candidates/pool',
    name: 'ShopCandidatePool',
    component: () => import('./index.vue'),
    meta: { title: '方法卡找店' }
  }
} satisfies ModuleManifest
