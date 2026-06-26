import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'product-recycle-bin',
  name: '产品回收站',
  icon: 'Delete',
  menuOrder: 251,
  hiddenInMenu: true,
  route: {
    path: 'product-recycle-bin',
    name: 'ProductRecycleBin',
    component: () => import('@/components/RecycleBinPage/index.vue'),
    meta: { title: '产品回收站' }
  }
} satisfies ModuleManifest
