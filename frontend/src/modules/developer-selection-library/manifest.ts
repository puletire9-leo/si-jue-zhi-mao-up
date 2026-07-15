import type { ModuleManifest } from '../types'

export default {
  id: 'developer-selection-library',
  name: '人工选品库',
  icon: 'Collection',
  menuGroup: '选品中心',
  menuOrder: 13,
  route: {
    path: 'developer-selection-library',
    name: 'DeveloperSelectionLibrary',
    component: () => import('./index.vue'),
    meta: { title: '人工选品库' }
  }
} satisfies ModuleManifest
