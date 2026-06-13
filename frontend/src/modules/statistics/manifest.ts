import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'statistics',
  name: '统计分析',
  icon: 'DataAnalysis',
  menuGroup: '数据看板',
  menuOrder: 64,
  hiddenInMenu: true,
  route: {
    path: 'statistics',
    name: 'Statistics',
    component: () => import('@/views/Statistics/index.vue'),
    meta: { title: '统计分析' }
  }
} satisfies ModuleManifest
