import type { RouteRecordRaw } from 'vue-router'

export interface ModuleManifest {
  /** 唯一标识，用于路由 name 前缀 */
  id: string
  /** 显示名称 */
  name: string
  /** Element Plus 图标名（字符串），如 'Shop' */
  icon?: string
  /** 菜单分组名，有则归入子菜单，无则顶级 */
  menuGroup?: string
  /** 排序权重，越小越靠前 */
  menuOrder?: number
  /** 权限标识，预留 */
  permissions?: string[]
  /** 是否为外部链接（如数据看板），外部链接无 component */
  external?: boolean
  /** 是否在菜单中隐藏（如回收站页面），仍会注册路由 */
  hiddenInMenu?: boolean
  route: {
    path: string
    name: string
    component?: () => Promise<any>
    children?: RouteRecordRaw[]
    meta?: Record<string, any>
  }
}
