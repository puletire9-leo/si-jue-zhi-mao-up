/**
 * 角色权限工具
 *
 * 规则：
 *   admin      → 所有模块可见
 *   开发       → 除 users/settings 外全部可见
 *   美术/仓库/运营 → 仅首页 + 微定制(3) + 下载管理 可见
 */

/** 美术/仓库/运营 可见的模块 ID 白名单 */
const RESTRICTED_MODULES = new Set([
  'final-draft',
  'material-library',
  'carrier-library',
  'download-manager'
])

/** 研发可见但屏蔽的管理后台 */
const DEVELOPER_HIDDEN = new Set([
  'users',
  'settings'
])

/**
 * 判断角色是否能看到指定模块
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
 * 当前用户是否有写权限（上传/编辑/删除操作）
 * 仅 admin 和 开发 可以写
 */
export function canWrite(role: string | undefined | null): boolean {
  if (!role) return false
  return role === '管理员' || role === 'admin' || role === '开发'
}
