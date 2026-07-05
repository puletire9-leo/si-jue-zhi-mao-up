-- 恢复 4 张已删除的 RBAC 表 + 种子数据
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '权限ID',
  `name` varchar(100) NOT NULL COMMENT '权限名称',
  `code` varchar(100) NOT NULL COMMENT '权限代码',
  `description` varchar(255) DEFAULT NULL COMMENT '权限描述',
  `module` varchar(50) DEFAULT NULL COMMENT '所属模块',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_permissions_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限表';

CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `name` varchar(50) NOT NULL COMMENT '角色名称',
  `parent_id` int DEFAULT NULL COMMENT '父角色ID',
  `description` varchar(255) DEFAULT NULL COMMENT '角色描述',
  `permissions` json DEFAULT NULL COMMENT '权限列表（JSON格式）',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_roles_name` (`name`),
  KEY `idx_roles_parent_id` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色表';

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `permission_id` int NOT NULL COMMENT '权限ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_permission` (`role_id`,`permission_id`),
  UNIQUE KEY `idx_role_permissions_unique` (`role_id`,`permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  KEY `idx_role_permissions_role_id` (`role_id`),
  KEY `idx_role_permissions_permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色权限关联表';

CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `role_id` int NOT NULL COMMENT '角色ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`,`role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户角色关联表';

-- 种子数据（从 init_database_dev.sql 恢复）
INSERT IGNORE INTO permissions (name, code, description) VALUES
('查看产品', 'view_product', '允许查看产品信息'),
('创建产品', 'create_product', '允许创建新产品'),
('编辑产品', 'edit_product', '允许编辑产品信息'),
('删除产品', 'delete_product', '允许删除产品'),
('查看图片', 'view_image', '允许查看图片信息'),
('上传图片', 'upload_image', '允许上传图片'),
('编辑图片', 'edit_image', '允许编辑图片信息'),
('删除图片', 'delete_image', '允许删除图片'),
('查看用户', 'view_user', '允许查看用户信息'),
('创建用户', 'create_user', '允许创建新用户'),
('编辑用户', 'edit_user', '允许编辑用户信息'),
('删除用户', 'delete_user', '允许删除用户'),
('查看日志', 'view_log', '允许查看系统日志');

INSERT IGNORE INTO roles (name, description) VALUES
('admin', '系统管理员，拥有所有权限'),
('editor', '编辑，拥有编辑权限'),
('user', '普通用户，拥有基本查看权限');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'editor' AND p.code IN (
    'view_product', 'create_product', 'edit_product',
    'view_image', 'upload_image', 'edit_image',
    'view_log'
);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.code IN (
    'view_product', 'view_image'
);

-- system_config.developer_list 恢复
INSERT IGNORE INTO system_config (id, config_key, config_value, description, is_system, created_at, updated_at, updated_by)
VALUES (1,'developer_list','刘淼,宋凤莉,周沁仪,蒋舒,龙梦临,陈杨,张子轩,黄雨珊,夏浩宇','开发人列表',0,'2026-01-16 23:48:08','2026-06-22 08:06:22','admin');
