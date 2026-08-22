import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'automation-center',
  name: '自动化任务中心',
  icon: 'Connection',
  menuGroup: '配置',
  menuOrder: 90,
  route: {
    path: 'automation-center',
    name: 'AutomationCenter',
    component: () => import('./index.vue'),
    meta: { title: '自动化任务中心' }
  }
} satisfies ModuleManifest

