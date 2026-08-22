import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'feishu-integration-center',
  name: '飞书对接中心',
  icon: 'Link',
  menuGroup: '配置',
  menuOrder: 91,
  route: {
    path: 'feishu-integration-center',
    name: 'FeishuIntegrationCenter',
    component: () => import('./index.vue'),
    meta: { title: '飞书对接中心' }
  }
} satisfies ModuleManifest

