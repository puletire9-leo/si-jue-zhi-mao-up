import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { ElMessage } from 'element-plus'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login/index.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/Layout/index.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Home/index.vue'),
        meta: { title: '首页', icon: 'Odometer', permission: 'dashboard:view' }
      },
      {
        path: 'products',
        name: 'Products',
        component: () => import('@/views/ProductManagement/index.vue'),
        meta: { title: '产品管理', icon: 'Box', permission: 'product:view' }
      },
      {
        path: 'product/:sku',
        name: 'ProductDetail',
        component: () => import('@/views/ProductDetail/index.vue'),
        meta: { title: '产品详情', permission: 'product:view' }
      },
      {
        path: 'selection/:id',
        name: 'SelectionDetail',
        component: () => import('@/views/SelectionDetail/index.vue'),
        meta: { title: '选品详情', permission: 'selection:view' }
      },
      {
        path: 'all-selection',
        name: 'AllSelection',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '总选品管理', icon: 'List', permission: 'selection:view' }
      },
      {
        path: 'new-products',
        name: 'NewProducts',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '新品榜', icon: 'Star', permission: 'selection:view' }
      },
      {
        path: 'reference-products',
        name: 'ReferenceProducts',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '竞品店铺', icon: 'Shop', permission: 'selection:view' }
      },
      {
        path: 'zheng-products',
        name: 'ZhengProducts',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '郑总店铺上新', icon: 'Star', permission: 'selection:view' }
      },
      {
        path: 'prompt-library',
        name: 'PromptLibrary',
        component: () => import('@/views/FileLinkManagement/index.vue'),
        meta: { title: '提示词库', icon: 'Document', permission: 'resource:view' }
      },
      {
        path: 'resource-library',
        name: 'ResourceLibrary',
        component: () => import('@/views/FileLinkManagement/index.vue'),
        meta: { title: '资料库', icon: 'Folder', permission: 'resource:view' }
      },
      {
        path: 'resource-collection',
        name: 'ResourceCollection',
        component: () => import('@/views/ResourceCollection/index.vue'),
        meta: { title: '资料集', icon: 'Picture', permission: 'resource:view' }
      },
      {
        path: 'final-draft',
        name: 'FinalDraft',
        component: () => import('@/views/FinalDraft/index.vue'),
        meta: { title: '定稿', icon: 'Check', permission: 'final-draft:view' }
      },

      {
        path: 'material-library',
        name: 'MaterialLibrary',
        component: () => import('@/views/MaterialLibrary/index.vue'),
        meta: { title: '素材库', icon: 'Picture', permission: 'final-draft:view' }
      },

      {
        path: 'carrier-library',
        name: 'CarrierLibrary',
        component: () => import('@/views/CarrierLibrary/index.vue'),
        meta: { title: '载体库', icon: 'Box', permission: 'final-draft:view' }
      },

      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/Statistics/index.vue'),
        meta: { title: '统计分析', icon: 'DataAnalysis', permission: 'statistics:view' }
      },
      {
        path: 'product-data',
        name: 'ProductData',
        component: () => import('@/views/ProductDataDashboard/index.vue'),
        meta: { title: '产品数据看板', icon: 'TrendCharts', permission: 'dashboard:view' }
      },
      {
        path: 'report-viewer',
        name: 'ReportViewer',
        component: () => import('@/views/ReportViewer/index.vue'),
        meta: { title: '数据分析报告', icon: 'Document', permission: 'dashboard:view' }
      },

      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UserManagement/index.vue'),
        meta: { title: '用户管理', icon: 'User', permission: 'user:manage' }
      },
      {
        path: 'account-settings',
        name: 'AccountSettings',
        component: () => import('@/views/AccountSettings/index.vue'),
        meta: { title: '账号设置', icon: 'User', permission: 'user:manage' }
      },

      {
        path: 'selection-recycle-bin',
        name: 'SelectionRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '选品回收站', icon: 'Delete', permission: 'selection:manage' }
      },
      {
        path: 'product-recycle-bin',
        name: 'ProductRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '产品回收站', icon: 'Delete', permission: 'product:manage' }
      },
      {
        path: 'final-draft-recycle-bin',
        name: 'FinalDraftRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '定稿回收站', icon: 'Delete', permission: 'final-draft:manage' }
      },
      {
        path: 'download-manager',
        name: 'DownloadManager',
        component: () => import('@/views/DownloadManager/index.vue'),
        meta: { title: '下载管理', icon: 'Download', permission: 'download:view' }
      },
      {
        path: 'carrier-library-recycle-bin',
        name: 'CarrierLibraryRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '载体回收站', icon: 'Delete', permission: 'final-draft:manage' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings/index.vue'),
        meta: { title: '系统设置', icon: 'Setting', permission: 'config:manage' }
      },
      {
        path: 'lingxing/import',
        name: 'LingxingImport',
        component: () => import('@/views/Lingxing/Import/index.vue'),
        meta: { title: '导入领星', icon: 'Upload', permission: 'lingxing:import' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound/index.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  console.log('[Router] beforeEach 被调用:', to.path, from.path)
  console.log('[Router] 当前路由需要的权限:', to.meta.permission)
  
  document.title = `${to.meta.title || '思觉智贸'} - 思觉智贸`

  const userStore = useUserStore()
  const token = userStore.token
  console.log('[Router] 当前token:', token ? '存在' : '不存在')

  // 简化认证逻辑
  if (to.meta.requiresAuth !== false && !token) {
    console.log('[Router] 无token，跳转到登录页')
    ElMessage.warning('请先登录')
    next('/login')
    return
  }

  if (to.path === '/login' && token) {
    console.log('[Router] 已有token，跳转到dashboard')
    next('/dashboard')
    return
  }

  // 如果有token但没有用户信息，先获取用户信息
  if (token && (!userStore.userInfo || userStore.permissions.length === 0)) {
    console.log('[Router] 有token但没有用户信息，尝试从localStorage加载')
    try {
      const savedUserInfo = localStorage.getItem('userInfo')
      if (savedUserInfo) {
        userStore.setUserInfo(JSON.parse(savedUserInfo))
        console.log('[Router] 从localStorage加载用户信息成功')
      } else {
        throw new Error('No saved user info')
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
      ElMessage.error('获取用户信息失败，请重新登录')
      userStore.logout()
      next('/login')
      return
    }
  }

  // 权限验证逻辑
  if (to.meta.permission) {
    console.log('[Router] 开始权限验证，需要权限:', to.meta.permission)
    // 检查用户是否有权限访问该路由
    const hasPermission = userStore.hasPermission(to.meta.permission as string)
    console.log('[Router] 权限验证结果:', hasPermission)
    if (!hasPermission) {
      console.log('[Router] 无权限，显示提示')
      ElMessage.error('您无此权限')
      // 无权限时不跳转，保持在当前页面
      next(false)
      return
    }
  }

  console.log('[Router] 权限验证通过，继续跳转')
  next()
})

// 路由切换完成后添加标签页
router.afterEach((to) => {
  const appStore = useAppStore()
  if (to.meta.requiresAuth !== false && to.path !== '/login') {
    appStore.addTag({
      path: to.path,
      title: (to.meta.title as string) || '未命名',
      name: to.name as string
    })
  }
})

export default router
