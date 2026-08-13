import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-shop-data',
  name: '领星店铺数据',
  icon: 'DataLine',
  menuGroup: '选品中心',
  menuSection: '商品数据源',
  menuSectionOrder: 2,
  menuOrder: 14,
  route: {
    path: 'lingxing-shop-data',
    name: 'LingxingShopData',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '领星店铺数据' }
  }
} satisfies ModuleManifest
