# RBAC 权限设计

> 最后更新：2026-05-18
> 设计目标：简单够用现在，可扩展未来
> 状态：DB 已修复 + Gateway 已实现 + 待联调

---

## 一、当前问题

```
DB 权限码:   view_product, create_product, upload_image...    (下划线格式)
API 检查:    product:view, product:write, image:upload...      (冒号格式)
前端路由:    dashboard:view, selection:view, user:manage...    (冒号格式)

三者格式不同 → 永远匹配不上 → 靠硬编码角色名绕过
```

```
真正的"鉴权":
  if role in [管理员, admin, 开发, 美术, 仓库] → 放行
  else → 也放行 (hasPermission 永远 return true)
```

5 张表、13 个权限码、CTE 递归查询 — 全是摆设。

---

## 二、设计方案

### 核心原则

1. **统一权限码格式**：`resource:action`，和前端、API 一致
2. **Gateway 集中鉴权**：所有请求在网关验 JWT + 查权限，下游服务零改动
3. **3 张表够用**：roles + permissions + role_permissions（不用 user_roles，users.role 字段已经够用）
4. **不做角色继承**：当前不需要，将来需要时加 `parent_id` 即可，不破坏现有结构

### 权限码定义（和前端路由对齐）

```sql
-- 业务模块
dashboard:view       -- 仪表盘
product:view         -- 查看产品
product:manage       -- 管理产品（增删改）
selection:view       -- 查看选品（新品榜+竞品）
selection:manage     -- 管理选品（导入/删除/评分）
final-draft:view     -- 查看定稿
final-draft:manage   -- 管理定稿（增删改+回收站）
resource:view        -- 查看资源库
competitor:lookup    -- 竞品API查询（有API调用成本）
statistics:view      -- 查看统计
download:manage      -- 下载管理

-- 系统模块
user:manage          -- 用户管理
config:manage        -- 系统配置
log:view             -- 查看日志
```

### 角色定义

| 角色 | 权限 | 使用场景 |
|------|------|---------|
| `admin` | 全部 14 个权限 | 系统管理员（1人） |
| `developer` | 业务权限（11个，不含系统模块） | 开发人日常使用 |
| `viewer` | 只读权限（dashboard/statistics/log 除外） | 外部查看 |

```
admin:
  dashboard:view, product:view, product:manage,
  selection:view, selection:manage,
  final-draft:view, final-draft:manage,
  resource:view, competitor:lookup,
  statistics:view, download:manage,
  user:manage, config:manage, log:view

developer:
  dashboard:view, product:view, product:manage,
  selection:view, selection:manage,
  final-draft:view, final-draft:manage,
  resource:view, competitor:lookup,
  statistics:view, download:manage

viewer:
  product:view, selection:view,
  final-draft:view, resource:view,
  statistics:view
```

### 表结构（清理后）

```sql
-- 保持不变
roles (id, name, description, created_at, updated_at)

-- 权限码改为 resource:action 格式，和前端/API 统一
permissions (id, name, code, description, created_at, updated_at)

-- 保持不变
role_permissions (id, role_id, permission_id)

-- users.role 字段继续用，匹配 roles.name。单人单角色够用。
```

**不用的**：`user_roles` 表（删掉，单人单角色不需要多对多）、`roles.parent_id`（删掉，不需要层级继承）。

---

## 三、鉴权流程

```
请求 → Gateway :9000
         │
         ├─ 1. CorsGlobalFilter (CORS)
         ├─ 2. JwtAuthGatewayFilter
         │      ├─ 解析 JWT → 得到 userId, username, role
         │      ├─ 公开路径 (login/register/health) → 直接放行
         │      ├─ 查权限缓存 (Redis/Caffeine)
         │      │     ├─ 缓存命中 → 拿到 permission 列表
         │      │     └─ 缓存未命中 → 查 role_permissions 表 → 缓存
         │      ├─ 匹配当前请求路径的权限
         │      │     /api/v1/competitor/lookup → 需要 competitor:lookup
         │      │     /api/v1/users/**          → 需要 user:manage
         │      ├─ 有权限 → 注入 X-User-* 头 → 放行
         │      └─ 无权限 → 403
         │
         └─ 3. 路由到下游服务 (sjzm-product / sjzm-user / Python)
               ↓
         下游服务信任 X-User-* 头，不再重复鉴权
```

## 四、路由→权限映射

```yaml
gateway:
  routes:
    - path: /api/v1/competitor/lookup
      permission: competitor:lookup
    - path: /api/v1/users/**
      permission: user:manage
    - path: /api/v1/system-config/**
      permission: config:manage
    - path: /api/v1/logs/**
      permission: log:view
    # 其他路由默认放行（已在 JWT 层验证）
```

## 五、实施步骤

### Phase 1：修复数据（立即）

```sql
-- 1. 更新 permissions 表，统一为 resource:action 格式
TRUNCATE permissions;
INSERT INTO permissions (name, code, description) VALUES
('仪表盘查看', 'dashboard:view', '查看仪表盘'),
('产品查看', 'product:view', '查看产品'),
('产品管理', 'product:manage', '增删改产品'),
('选品查看', 'selection:view', '查看选品'),
('选品管理', 'selection:manage', '导入/删除/评分选品'),
('定稿查看', 'final-draft:view', '查看定稿/素材/载体'),
('定稿管理', 'final-draft:manage', '管理定稿/回收站'),
('资源查看', 'resource:view', '查看资源库'),
('竞品查询', 'competitor:lookup', '调用竞品API（有成本）'),
('统计查看', 'statistics:view', '查看统计报表'),
('下载管理', 'download:manage', '管理下载任务'),
('用户管理', 'user:manage', '管理用户'),
('配置管理', 'config:manage', '系统配置'),
('日志查看', 'log:view', '查看系统日志');

-- 2. 重建角色权限
-- admin: 全部
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

-- developer: 11 个业务权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'developer' AND p.code IN (
  'dashboard:view', 'product:view', 'product:manage',
  'selection:view', 'selection:manage',
  'final-draft:view', 'final-draft:manage',
  'resource:view', 'competitor:lookup',
  'statistics:view', 'download:manage'
);

-- viewer: 5 个只读权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.code IN (
  'product:view', 'selection:view',
  'final-draft:view', 'resource:view', 'statistics:view'
);

-- 3. 更新现有用户的 role 字段
-- admin 已经是 'admin'，其他人根据实际角色设 'developer'
```

### Phase 2：Gateway 鉴权（Java）

在 `JwtAuthGatewayFilter` 中加权限检查（10 行代码）：

```java
// 在 JWT 验证通过后
String path = exchange.getRequest().getURI().getPath();
String requiredPermission = routePermissionMap.get(path);  // 配置映射
if (requiredPermission != null) {
    List<String> permissions = permissionCache.get(role);  // Redis 缓存
    if (!permissions.contains(requiredPermission)) {
        return forbidden(exchange, "权限不足");
    }
}
```

### Phase 3：清理（逐步）

- 删除 Python `auth_middleware.py` 中的硬编码角色绕过
- 删除 `user_roles` 表（从未使用）
- 删除 `roles.parent_id` 列（从未使用）
- 前端 `hasPermission()` 改为真实验证 `permissions` 数组

---

## 六、扩展路径

| 将来需求 | 怎么加 |
|---------|--------|
| 多人多角色 | 启用 `user_roles` 表 → 一个用户多个角色，权限取并集 |
| 角色继承 | 加 `roles.parent_id` → 子角色继承父角色权限 |
| 数据级权限 | 加 `user_permissions` 表 → 单独给某用户加/减权限（覆盖角色默认） |
| 临时权限 | 加 `permission_grants` 表（userId, permission, expireAt） |
| API 级别限流 | 已有 `ApiRateLimitService`，按角色配置不同限额 |

**关键**：上述每个扩展都只需加一张表或一列，不需要动现有结构。这就是 3 张核心表设计的好处。
