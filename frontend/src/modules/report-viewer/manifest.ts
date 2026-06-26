import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'report-viewer',
  name: '数据分析报告',
  icon: 'Document',
  menuGroup: '数据看板',
  menuOrder: 65,
  hiddenInMenu: true,
  route: {
    path: 'report-viewer',
    name: 'ReportViewer',
    component: () => import('@/views/ReportViewer/index.vue'),
    meta: { title: '数据分析报告' }
  }
} satisfies ModuleManifest
