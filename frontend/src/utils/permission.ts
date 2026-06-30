/**
 * 角色权限工具
 *
 * 规则：
 *   admin      → 所有模块可见
 *   开发       → 除 users/settings 外全部可见
 *   美术/仓库/运营 → 仅首页 + 微定制(3) + 下载管理 可见 + 通用页面
 */

/** 美术/仓库/运营 可见的功能模块（侧边栏菜单项） */
const RESTRICTED_MODULES = new Set([
  'final-draft',
  'material-library',
  'carrier-library',
  'download-manager'
])

/** 所有角色都能访问的通用路径前缀（不出现在侧边栏，但任何登录用户可达） */
const ALWAYS_ALLOWED_PATHS = new Set([
  'dashboard',          // 首页
  'account-settings',   // 个人账号设置
  'product',            // 产品详情 /product/:sku
  'selection',          // 选品详情 /selection/:id
  'lingxing'            // /lingxing/import 等
])

/** 研发可见但屏蔽的管理后台 */
const DEVELOPER_HIDDEN = new Set([
  'users',
  'settings'
])

/**
 * 判断角色是否能看到指定模块（用于侧边栏菜单过滤）
 * @param role 用户角色（中文）
 * @param moduleId 模块 ID（manifest.ts 中的 id）
 */
export function canSeeModule(role: string | undefined | null, moduleId: string): boolean {
  if (!role) return false

  switch (role) {
    case '管理员':
    case 'admin':
      return true
    case '开发':
      return !DEVELOPER_HIDDEN.has(moduleId)
    default:
      // 美术/仓库/运营
      return RESTRICTED_MODULES.has(moduleId)
  }
}

/**
 * 判断角色是否能访问指定路径（用于路由守卫）
 * 与 canSeeModule 区别：放行通用路径（首页/账号设置/产品详情等），不在侧边栏出现也允许访问
 * @param role 用户角色（中文）
 * @param pathFirstSeg 路径首段，例如 to.path.split('/')[1]
 */
export function canAccessPath(role: string | undefined | null, pathFirstSeg: string): boolean {
  if (!role) return false
  if (!pathFirstSeg) return true            // 根路径 '/'
  if (ALWAYS_ALLOWED_PATHS.has(pathFirstSeg)) return true
  return canSeeModule(role, pathFirstSeg)
}

/**
 * 当前用户是否有写权限（上传/编辑/删除操作）
 * 仅 admin 和 开发 可以写
 */
export function canWrite(role: string | undefined | null): boolean {
  if (!role) return false
  return role === '管理员' || role === 'admin' || role === '开发'
}
