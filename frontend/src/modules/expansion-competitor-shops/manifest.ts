import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'expansion-competitor-shops',
  name: '竞品店铺',
  icon: 'Shop',
  menuGroup: '选品中心',
  menuSection: '拓品',
  menuSectionOrder: 4,
  menuOrder: 36,
  route: {
    path: 'expansion-competitor-shops',
    name: 'ExpansionCompetitorShops',
    component: () => import('./index.vue'),
    meta: { title: '竞品店铺' },
  },
} satisfies ModuleManifest
