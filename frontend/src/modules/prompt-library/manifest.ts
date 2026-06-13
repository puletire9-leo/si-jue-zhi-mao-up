import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'prompt-library',
  name: '提示词库',
  icon: 'Document',
  menuGroup: '资料集',
  menuOrder: 30,
  route: {
    path: 'prompt-library',
    name: 'PromptLibrary',
    component: () => import('@/views/FileLinkManagement/index.vue'),
    meta: { title: '提示词库' }
  }
} satisfies ModuleManifest
