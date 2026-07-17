import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'premium-products',
  name: '精品',
  icon: 'Goods',
  menuGroup: '选品中心',
  menuOrder: 12.5,
  route: {
    path: 'premium-products',
    name: 'PremiumProducts',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '精品' }
  }
} satisfies ModuleManifest
