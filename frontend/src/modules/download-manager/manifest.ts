import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'download-manager',
  name: '下载管理',
  icon: 'Download',
  menuOrder: 200,
  route: {
    path: 'download-manager',
    name: 'DownloadManager',
    component: () => import('@/views/DownloadManager/index.vue'),
    meta: { title: '下载管理' }
  }
} satisfies ModuleManifest
