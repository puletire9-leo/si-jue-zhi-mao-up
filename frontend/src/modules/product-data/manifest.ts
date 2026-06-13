import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'product-data',
  name: '产品数据看板',
  icon: 'TrendCharts',
  menuGroup: '数据看板',
  menuOrder: 60,
  route: {
    path: 'product-data',
    name: 'ProductData',
    component: () => import('@/views/ProductDataDashboard/index.vue'),
    meta: { title: '产品数据看板' }
  }
} satisfies ModuleManifest
