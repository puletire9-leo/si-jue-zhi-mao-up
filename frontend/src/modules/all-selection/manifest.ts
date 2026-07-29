import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'all-selection',
  name: '总选品管理',
  icon: 'List',
  menuGroup: '选品中心',
  menuSection: '选品工作台',
  menuSectionOrder: 1,
  menuOrder: 10,
  route: {
    path: 'all-selection',
    name: 'AllSelection',
    component: () => import('@/views/AllSelection/index.vue'),
    meta: { title: '总选品管理' }
  }
} satisfies ModuleManifest
