import type { ModuleManifest } from '@/modules/types'

export default {
  id: 'users',
  name: '用户管理',
  icon: 'User',
  menuOrder: 210,
  route: {
    path: 'users',
    name: 'Users',
    component: () => import('@/views/UserManagement/index.vue'),
    meta: { title: '用户管理' }
  }
} satisfies ModuleManifest
