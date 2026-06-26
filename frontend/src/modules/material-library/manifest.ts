import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'material-library',
  name: '素材库',
  icon: 'Brush',
  menuGroup: '微定制',
  menuOrder: 41,
  route: {
    path: 'material-library',
    name: 'MaterialLibrary',
    component: () => import('@/views/MaterialLibrary/index.vue'),
    meta: { title: '素材库' }
  }
} satisfies ModuleManifest
