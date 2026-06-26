import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'zheng-products',
  name: '郑总店铺上新',
  icon: 'Star',
  menuGroup: '选品中心',
  menuOrder: 13,
  route: {
    path: 'zheng-products',
    name: 'ZhengProducts',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '郑总店铺上新' }
  }
} satisfies ModuleManifest
