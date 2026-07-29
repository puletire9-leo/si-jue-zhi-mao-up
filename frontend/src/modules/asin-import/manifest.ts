import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'asin-import',
  name: '卖家精灵数据获取',
  icon: 'Upload',
  menuGroup: '选品中心',
  menuSection: '数据采集',
  menuSectionOrder: 3,
  menuOrder: 14,
  route: {
    path: 'asin-import',
    name: 'AsinImport',
    component: () => import('@/views/AsinImport/index.vue'),
    meta: { title: '卖家精灵数据获取' }
  }
} satisfies ModuleManifest
