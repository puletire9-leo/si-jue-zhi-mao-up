import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'bazhuayu-auto',
  name: '八爪鱼自动采集',
  icon: 'Refresh',
  menuGroup: '选品中心',
  menuSection: '数据采集',
  menuSectionOrder: 3,
  menuOrder: 13,
  route: {
    path: 'bazhuayu-auto',
    name: 'BazhuayuAuto',
    component: () => import('./index.vue'),
    meta: { title: '八爪鱼自动采集' }
  }
} satisfies ModuleManifest
