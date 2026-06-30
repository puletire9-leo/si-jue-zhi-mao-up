import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'image-search',
  name: '以图识图',
  icon: 'Search',
  menuGroup: '选品中心',
  menuOrder: 14,
  route: {
    path: 'image-search',
    name: 'ImageSearch',
    component: () => import('./index.vue'),
    meta: { title: '以图识图' }
  }
} satisfies ModuleManifest
