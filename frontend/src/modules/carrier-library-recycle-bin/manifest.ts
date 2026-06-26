import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'carrier-library-recycle-bin',
  name: '载体回收站',
  icon: 'Delete',
  menuOrder: 253,
  hiddenInMenu: true,
  route: {
    path: 'carrier-library-recycle-bin',
    name: 'CarrierLibraryRecycleBin',
    component: () => import('@/components/RecycleBinPage/index.vue'),
    meta: { title: '载体回收站' }
  }
} satisfies ModuleManifest
