import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'resource-library',
  name: '资料库',
  icon: 'Folder',
  menuGroup: '资料集',
  menuOrder: 31,
  route: {
    path: 'resource-library',
    name: 'ResourceLibrary',
    component: () => import('@/views/FileLinkManagement/index.vue'),
    meta: { title: '资料库' }
  }
} satisfies ModuleManifest
