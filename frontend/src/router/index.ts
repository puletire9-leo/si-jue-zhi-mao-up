import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { ElMessage } from 'element-plus'
import { getAllModules } from '@/modules'
import { canAccessPath } from '@/utils/permission'

// 模块化路由：从 modules/*/manifest.ts 自动收集
const moduleRoutes: RouteRecordRaw[] = getAllModules().map(m => ({
  path: m.route.path,
  name: `module-${m.id}-${m.route.name}`,
  component: m.route.component,
  children: m.route.children,
  meta: { title: m.name, icon: m.icon, permissions: m.permissions, ...m.route.meta }
}))

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
        meta: { title: '首页', icon: 'Odometer' }
      },
      // 产品管理暂时屏蔽（Python 后端未迁移）
      // {
      //   path: 'products',
      //   name: 'Products',
      //   component: () => import('@/views/ProductManagement/index.vue'),
      //   meta: { title: '产品管理', icon: 'Box', permission: 'product:view' }
      // },
      {
        path: 'product/:sku',
        name: 'ProductDetail',
        component: () => import('@/views/ProductDetail/index.vue'),
        meta: { title: '产品详情' }
      },
      {
        path: 'selection/:id',
        name: 'SelectionDetail',
        component: () => import('@/views/SelectionDetail/index.vue'),
        meta: { title: '选品详情' }
      },
      // 以下为尚未迁移到模块的路由（逐步迁移后会消失）
      {
        path: 'all-selection',
        name: 'AllSelection',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '总选品管理', icon: 'List' }
      },
      {
        path: 'new-products',
        name: 'NewProducts',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '新品榜', icon: 'Star' }
      },
      {
        path: 'reference-products',
        name: 'ReferenceProducts',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '竞品店铺', icon: 'Shop' }
      },
      {
        path: 'zheng-products',
        name: 'ZhengProducts',
        component: () => import('@/views/AllSelection/index.vue'),
        meta: { title: '郑总店铺上新', icon: 'Star' }
      },
      {
        path: 'asin-import',
        name: 'AsinImport',
        component: () => import('@/views/AsinImport/index.vue'),
        meta: { title: '卖家精灵数据获取', icon: 'Upload' }
      },
      {
        path: 'prompt-library',
        name: 'PromptLibrary',
        component: () => import('@/views/FileLinkManagement/index.vue'),
        meta: { title: '提示词库', icon: 'Document' }
      },
      {
        path: 'resource-library',
        name: 'ResourceLibrary',
        component: () => import('@/views/FileLinkManagement/index.vue'),
        meta: { title: '资料库', icon: 'Folder' }
      },
      {
        path: 'resource-collection',
        name: 'ResourceCollection',
        component: () => import('@/views/ResourceCollection/index.vue'),
        meta: { title: '资料集', icon: 'Picture' }
      },
      {
        path: 'final-draft',
        name: 'FinalDraft',
        component: () => import('@/views/FinalDraft/index.vue'),
        meta: { title: '定稿', icon: 'Check' }
      },
      {
        path: 'material-library',
        name: 'MaterialLibrary',
        component: () => import('@/views/MaterialLibrary/index.vue'),
        meta: { title: '素材库', icon: 'Picture' }
      },
      {
        path: 'carrier-library',
        name: 'CarrierLibrary',
        component: () => import('@/views/CarrierLibrary/index.vue'),
        meta: { title: '载体库', icon: 'Box' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/Statistics/index.vue'),
        meta: { title: '统计分析', icon: 'DataAnalysis' }
      },
      {
        path: 'product-data',
        name: 'ProductData',
        component: () => import('@/views/ProductDataDashboard/index.vue'),
        meta: { title: '产品数据看板', icon: 'TrendCharts' }
      },
      {
        path: 'product-line-analysis',
        name: 'ProductLineAnalysis',
        component: () => import('@/views/ProductLineAnalysis/index.vue'),
        meta: { title: '品线分析', icon: 'DataAnalysis' }
      },
      {
        path: 'report-viewer',
        name: 'ReportViewer',
        component: () => import('@/views/ReportViewer/index.vue'),
        meta: { title: '数据分析报告', icon: 'Document' }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UserManagement/index.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'account-settings',
        name: 'AccountSettings',
        component: () => import('@/views/AccountSettings/index.vue'),
        meta: { title: '账号设置', icon: 'User' }
      },
      {
        path: 'selection-recycle-bin',
        name: 'SelectionRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '选品回收站', icon: 'Delete' }
      },
      {
        path: 'product-recycle-bin',
        name: 'ProductRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '产品回收站', icon: 'Delete' }
      },
      {
        path: 'final-draft-recycle-bin',
        name: 'FinalDraftRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '定稿回收站', icon: 'Delete' }
      },
      {
        path: 'download-manager',
        name: 'DownloadManager',
        component: () => import('@/views/DownloadManager/index.vue'),
        meta: { title: '下载管理', icon: 'Download' }
      },
      {
        path: 'carrier-library-recycle-bin',
        name: 'CarrierLibraryRecycleBin',
        component: () => import('@/components/RecycleBinPage/index.vue'),
        meta: { title: '载体回收站', icon: 'Delete' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings/index.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      },
      {
        path: 'lingxing/import',
        name: 'LingxingImport',
        component: () => import('@/views/Lingxing/Import/index.vue'),
        meta: { title: '导入领星', icon: 'Upload' }
      },
      // 模块化路由（从 modules/*/manifest.ts 自动收集）
      ...moduleRoutes
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
  document.title = `${to.meta.title || '思觉智贸'} - 思觉智贸`

  const token = localStorage.getItem('token')
  const userStore = useUserStore()

  if (to.meta.requiresAuth !== false && !token) {
    // 从登录页跳转过来但 token 丢失，不显示提示（避免与"登录成功"同时出现）
    if (from.path !== '/login') {
      ElMessage.warning('请先登录')
    }
    next('/login')
    return
  }

  if (to.path === '/login' && token) {
    next('/dashboard')
    return
  }

  if (token && !userStore.userInfo) {
    try {
      const savedUserInfo = localStorage.getItem('userInfo')
      if (savedUserInfo) {
        userStore.setUserInfo(JSON.parse(savedUserInfo))
      }
    } catch {
      // localStorage 中的 userInfo 解析失败，继续走 API
      console.warn('[Router] userInfo 解析失败，尝试从 API 获取')
    }

    // 如果 localStorage 中没有有效 userInfo，从 API 获取（同时获取 role）
    if (!userStore.userInfo) {
      try {
        await userStore.getUserInfo()
      } catch {
        // API 失败说明 token 无效，清除状态跳转登录
        console.warn('[Router] getUserInfo 失败，token 可能已失效')
        userStore.logout()
        next('/login')
        return
      }
    }
  }

  // 登录态存在但 role 为空：身份不完整，强制登出避免绕过守卫
  if (token && userStore.userInfo && !userStore.userInfo.role) {
    console.warn('[Router] userInfo 缺少 role 字段，强制登出')
    userStore.logout()
    next('/login')
    return
  }

  // 按角色过滤路由访问（防止用户手敲 URL 绕过菜单隐藏）
  if (token && userStore.userInfo?.role && to.path !== '/login') {
    const pathFirstSeg = to.path.split('/')[1] || ''
    // 路径首段不在允许列表内：拦截并重定向到 dashboard
    // dashboard 自身在 ALWAYS_ALLOWED_PATHS 里，不会循环
    if (!canAccessPath(userStore.userInfo.role, pathFirstSeg)) {
      console.warn(`[Router] 角色 ${userStore.userInfo.role} 无权访问 ${to.path}，重定向到首页`)
      next('/dashboard')
      return
    }
  }

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
