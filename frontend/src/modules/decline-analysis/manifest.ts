import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'decline-analysis',
  name: '销量下滑分析',
  icon: 'TrendCharts',
  menuGroup: '数据看板',
  menuOrder: 63,
  external: true,
  route: {
    path: 'dashboards/product_decline_analysis.html',
    name: 'DeclineAnalysis',
    meta: { title: '销量下滑分析' }
  }
} satisfies ModuleManifest
