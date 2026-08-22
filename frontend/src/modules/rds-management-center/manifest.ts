import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'rds-management-center',
  name: 'RDS 管理中心',
  icon: 'Coin',
  menuGroup: '配置',
  menuOrder: 92,
  route: {
    path: 'rds-management-center',
    name: 'RdsManagementCenter',
    component: () => import('./index.vue'),
    meta: { title: 'RDS 管理中心' }
  }
} satisfies ModuleManifest
