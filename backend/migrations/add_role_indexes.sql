-- 为 roles 和 role_permissions 表添加索引，提高权限查询性能

-- 为 roles 表添加索引
ALTER TABLE roles ADD INDEX idx_roles_name (name);
ALTER TABLE roles ADD INDEX idx_roles_parent_id (parent_id);

-- 为 role_permissions 表添加索引
ALTER TABLE role_permissions ADD INDEX idx_role_permissions_role_id (role_id);
ALTER TABLE role_permissions ADD INDEX idx_role_permissions_permission_id (permission_id);
ALTER TABLE role_permissions ADD UNIQUE INDEX idx_role_permissions_unique (role_id, permission_id);

-- 为 users 表的 role 字段添加索引
ALTER TABLE users ADD INDEX idx_users_role (role);

-- 为 permissions 表的 id 字段添加索引（如果不存在）
ALTER TABLE permissions ADD PRIMARY KEY IF NOT EXISTS (id);
