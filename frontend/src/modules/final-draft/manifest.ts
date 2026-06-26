import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'final-draft',
  name: '定稿管理',
  icon: 'Brush',
  menuGroup: '微定制',
  menuOrder: 40,
  route: {
    path: 'final-draft',
    name: 'FinalDraft',
    component: () => import('@/views/FinalDraft/index.vue'),
    meta: { title: '定稿管理' }
  }
} satisfies ModuleManifest
