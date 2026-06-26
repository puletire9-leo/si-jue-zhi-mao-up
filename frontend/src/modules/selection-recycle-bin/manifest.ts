import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'selection-recycle-bin',
  name: '选品回收站',
  icon: 'Delete',
  menuOrder: 250,
  hiddenInMenu: true,
  route: {
    path: 'selection-recycle-bin',
    name: 'SelectionRecycleBin',
    component: () => import('@/components/RecycleBinPage/index.vue'),
    meta: { title: '选品回收站' }
  }
} satisfies ModuleManifest
