import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'new-products',
  name: '新品榜',
  icon: 'Star',
  menuGroup: '选品中心',
  menuOrder: 11,
  route: {
    path: 'new-products',
    name: 'NewProducts',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '新品榜' }
  }
} satisfies ModuleManifest
