import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-runtime-center',
  name: '领星运行中心',
  icon: 'Monitor',
  menuGroup: '领星',
  menuOrder: 48,
  route: {
    path: 'lingxing-runtime-center',
    name: 'LingxingRuntimeCenter',
    component: () => import('./index.vue'),
    meta: { title: '领星运行中心' }
  }
} satisfies ModuleManifest
