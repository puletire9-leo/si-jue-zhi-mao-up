import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'lingxing-profit',
  name: '领星利润统计',
  icon: 'Money',
  menuGroup: '领星',
  menuOrder: 54,
  route: {
    path: 'lingxing/profit-asin',
    name: 'LingxingProfitAsin',
    component: () => import('./index.vue'),
    meta: { title: '领星利润统计' }
  }
} satisfies ModuleManifest
