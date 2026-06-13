import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'final-draft-recycle-bin',
  name: '定稿回收站',
  icon: 'Delete',
  menuOrder: 252,
  hiddenInMenu: true,
  route: {
    path: 'final-draft-recycle-bin',
    name: 'FinalDraftRecycleBin',
    component: () => import('@/components/RecycleBinPage/index.vue'),
    meta: { title: '定稿回收站' }
  }
} satisfies ModuleManifest
