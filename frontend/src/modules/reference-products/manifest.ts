import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'reference-products',
  name: '店铺选品',
  icon: 'Shop',
  menuGroup: '选品中心',
  menuSection: '商品数据源',
  menuSectionOrder: 2,
  menuOrder: 12,
  route: {
    path: 'reference-products',
    name: 'ReferenceProducts',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '店铺选品' }
  }
} satisfies ModuleManifest
