import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'settings',
  name: '系统设置',
  icon: 'Setting',
  menuOrder: 230,
  route: {
    path: 'settings',
    name: 'Settings',
    component: () => import('@/views/Settings/index.vue'),
    meta: { title: '系统设置' }
  }
} satisfies ModuleManifest
