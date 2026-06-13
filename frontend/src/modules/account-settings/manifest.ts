import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'account-settings',
  name: '账号设置',
  icon: 'User',
  menuOrder: 220,
  route: {
    path: 'account-settings',
    name: 'AccountSettings',
    component: () => import('@/views/AccountSettings/index.vue'),
    meta: { title: '账号设置' }
  }
} satisfies ModuleManifest
