import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-import',
  name: '导入领星',
  icon: 'Upload',
  menuGroup: '领星',
  menuOrder: 50,
  route: {
    path: 'lingxing/import',
    name: 'LingxingImport',
    component: () => import('@/views/Lingxing/Import/index.vue'),
    meta: { title: '导入领星' }
  }
} satisfies ModuleManifest
