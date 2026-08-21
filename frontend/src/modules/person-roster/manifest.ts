import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'person-roster',
  name: '人员维度配置',
  icon: 'UserFilled',
  menuOrder: 215,
  route: {
    path: 'person-roster',
    name: 'PersonRoster',
    component: () => import('./index.vue'),
    meta: { title: '人员维度配置' }
  }
} satisfies ModuleManifest
