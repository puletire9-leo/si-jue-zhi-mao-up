/**
 * 角色权限工具（兼容多角色逗号分隔，如 "管理员,运营"）
 *
 * 规则：
 *   admin / 管理员 → 所有模块可见 + 写权限
 *   developer / 开发 → 除 users/settings 外全部可见 + 写权限
 *   运营/美术/仓库   → 仅通用路径 + 非标品(3) + 下载管理 可见，只读
 */

/** 美术/仓库/运营 可见的功能模块（侧边栏菜单项） */
const RESTRICTED_MODULES = new Set([
  "final-draft",
  "material-library",
  "carrier-library",
  "download-manager",
]);

/** 所有角色都能访问的通用路径前缀（不出现在侧边栏，但任何登录用户可达） */
const ALWAYS_ALLOWED_PATHS = new Set([
  "dashboard", // 首页
  "account-settings", // 个人账号设置
]);

/** 研发可见但屏蔽的管理后台 */
const DEVELOPER_HIDDEN = new Set([
  "users",
  "settings",
  "person-roster",
  "lingxing-runtime-center",
  "automation-center",
  "feishu-integration-center",
]);

/**
 * 判断角色是否能看到指定模块（用于侧边栏菜单过滤）
 * @param role 用户角色（支持中英文，支持逗号分隔多角色如 "管理员,运营"）
 * @param moduleId 模块 ID（manifest.ts 中的 id）
 */
export function canSeeModule(
  role: string | undefined | null,
  moduleId: string,
): boolean {
  if (!role) return false;

  // 管理员可以看到所有模块
  if (role.includes("管理员") || role.includes("admin")) return true;

  // 开发者可以看到除了 users/settings 之外的所有模块
  if (role.includes("开发") || role.includes("developer")) {
    return !DEVELOPER_HIDDEN.has(moduleId);
  }

  // 运营/美术/仓库只能看到受限模块列表中的模块
  return RESTRICTED_MODULES.has(moduleId);
}

/**
 * 判断角色是否能访问指定路径（用于路由守卫）
 * 与 canSeeModule 区别：放行通用路径（首页/账号设置等）
 */
export function canAccessPath(
  role: string | undefined | null,
  pathFirstSeg: string,
): boolean {
  if (!role) return false;
  if (!pathFirstSeg) return true;
  if (ALWAYS_ALLOWED_PATHS.has(pathFirstSeg)) return true;
  return canSeeModule(role, pathFirstSeg);
}

/**
 * 当前用户是否有写权限（上传/编辑/删除操作）
 * 管理员 和 开发 可以写（兼容多角色逗号分隔，支持中英文）
 */
export function canWrite(role: string | undefined | null): boolean {
  if (!role) return false;
  return (
    role.includes("管理员") ||
    role.includes("admin") ||
    role.includes("开发") ||
    role.includes("developer")
  );
}
