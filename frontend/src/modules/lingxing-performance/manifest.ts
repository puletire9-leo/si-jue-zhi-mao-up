import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-performance',
  name: '领星产品表现',
  icon: 'TrendCharts',
  menuGroup: '领星',
  menuOrder: 53,
  route: {
    path: 'lingxing/product-performance',
    name: 'LingxingProductPerformance',
    component: () => import('./index.vue'),
    meta: { title: '领星产品表现' }
  }
} satisfies ModuleManifest
