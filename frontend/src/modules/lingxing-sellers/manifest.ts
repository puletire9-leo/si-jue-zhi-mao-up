import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-sellers',
  name: '领星店铺',
  icon: 'Shop',
  menuGroup: '领星',
  menuOrder: 52,
  route: {
    path: 'lingxing/sellers',
    name: 'LingxingSellers',
    component: () => import('./index.vue'),
    meta: { title: '领星店铺' }
  }
} satisfies ModuleManifest
