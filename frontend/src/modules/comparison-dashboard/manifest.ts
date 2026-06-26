import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'comparison-dashboard',
  name: '双周期对比',
  icon: 'TrendCharts',
  menuGroup: '数据看板',
  menuOrder: 62,
  external: true,
  route: {
    path: 'dashboards/product_comparison_dashboard.html',
    name: 'ComparisonDashboard',
    meta: { title: '双周期对比' }
  }
} satisfies ModuleManifest
