import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-products',
  name: '领星本地产品',
  icon: 'Goods',
  menuGroup: '领星',
  menuOrder: 51,
  route: {
    path: 'lingxing/local-products',
    name: 'LingxingLocalProducts',
    component: () => import('./index.vue'),
    meta: { title: '领星本地产品' }
  }
} satisfies ModuleManifest
