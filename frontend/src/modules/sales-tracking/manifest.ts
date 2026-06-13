import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'sales-tracking',
  name: '销量追踪',
  icon: 'TrendCharts',
  menuGroup: '数据看板',
  menuOrder: 61,
  external: true,
  route: {
    path: 'dashboards/product_sales_dashboard_v2.html',
    name: 'SalesTracking',
    meta: { title: '销量追踪' }
  }
} satisfies ModuleManifest
