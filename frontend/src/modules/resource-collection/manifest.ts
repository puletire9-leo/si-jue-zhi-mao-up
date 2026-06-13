import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'resource-collection',
  name: '图片管理',
  icon: 'Picture',
  menuGroup: '资料集',
  menuOrder: 32,
  route: {
    path: 'resource-collection',
    name: 'ResourceCollection',
    component: () => import('@/views/ResourceCollection/index.vue'),
    meta: { title: '图片管理' }
  }
} satisfies ModuleManifest
