import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'reference-products',
  name: '竞品店铺',
  icon: 'Shop',
  menuGroup: '选品中心',
  menuOrder: 12,
  route: {
    path: 'reference-products',
    name: 'ReferenceProducts',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '竞品店铺' }
  }
} satisfies ModuleManifest
