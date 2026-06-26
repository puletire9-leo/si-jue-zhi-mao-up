import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'product-line-analysis',
  name: '品线分析',
  icon: 'DataAnalysis',
  menuGroup: '数据看板',
  menuOrder: 66,
  hiddenInMenu: true,
  route: {
    path: 'product-line-analysis',
    name: 'ProductLineAnalysis',
    component: () => import('@/views/ProductLineAnalysis/index.vue'),
    meta: { title: '品线分析' }
  }
} satisfies ModuleManifest
