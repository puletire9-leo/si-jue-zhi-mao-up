-- 思觉智贸 - 开发环境数据库初始化脚本
-- 版本: 1.0
-- 日期: 2026-01-01

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS sijuelishi_dev
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sijuelishi_dev;

-- ============================================
-- 图片表（已存在）
-- ============================================

CREATE TABLE IF NOT EXISTS images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL COMMENT '文件名',
    filepath VARCHAR(512) NOT NULL COMMENT '文件路径',
    file_size BIGINT NOT NULL COMMENT '文件大小（字节）',
    width INT NOT NULL COMMENT '图片宽度',
    height INT NOT NULL COMMENT '图片高度',
    format VARCHAR(20) NOT NULL COMMENT '图片格式',
    category VARCHAR(100) NOT NULL COMMENT '图片分类',
    tags TEXT COMMENT '图片标签（逗号分隔）',
    description TEXT COMMENT '图片描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_category (category),
    INDEX idx_created_at (created_at),
    INDEX idx_tags (tags(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片表';

-- ============================================
-- 产品表
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE COMMENT '产品SKU',
    name VARCHAR(255) NOT NULL COMMENT '产品名称',
    description TEXT COMMENT '产品描述',
    category VARCHAR(100) NOT NULL COMMENT '产品分类',
    tags TEXT COMMENT '产品标签（逗号分隔）',
    price DECIMAL(10, 2) COMMENT '产品价格',
    stock INT DEFAULT 0 COMMENT '库存数量',
    status VARCHAR(20) DEFAULT 'active' NOT NULL COMMENT '产品状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_sku (sku),
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';

-- ============================================
-- 产品图片关联表
-- ============================================

CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL COMMENT '产品ID',
    image_id INT NOT NULL COMMENT '图片ID',
    is_primary BOOLEAN DEFAULT FALSE NOT NULL COMMENT '是否主图',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_image_id (image_id),
    INDEX idx_is_primary (is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品图片关联表';

-- ============================================
-- 分类表
-- ============================================

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '分类名称',
    parent_id INT DEFAULT NULL COMMENT '父分类ID',
    level INT NOT NULL DEFAULT 1 COMMENT '分类级别',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    status VARCHAR(20) DEFAULT 'active' NOT NULL COMMENT '分类状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_parent_id (parent_id),
    INDEX idx_level (level),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分类表';

-- ============================================
-- 标签表
-- ============================================

CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '标签名称',
    usage_count INT DEFAULT 0 COMMENT '使用次数',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表';

-- ============================================
-- 产品标签关联表
-- ============================================

CREATE TABLE IF NOT EXISTS product_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL COMMENT '产品ID',
    tag_id INT NOT NULL COMMENT '标签ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_tag (product_id, tag_id),
    INDEX idx_product_id (product_id),
    INDEX idx_tag_id (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品标签关联表';

-- ============================================
-- 图片标签关联表
-- ============================================

CREATE TABLE IF NOT EXISTS image_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_id INT NOT NULL COMMENT '图片ID',
    tag_id INT NOT NULL COMMENT '标签ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE KEY uq_image_tag (image_id, tag_id),
    INDEX idx_image_id (image_id),
    INDEX idx_tag_id (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片标签关联表';

-- ============================================
-- 用户表
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（哈希值）',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
    real_name VARCHAR(100) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号码',
    avatar VARCHAR(255) COMMENT '头像地址',
    role VARCHAR(50) NOT NULL DEFAULT 'user' COMMENT '用户角色',
    developer VARCHAR(100) COMMENT '关联开发人',
    status VARCHAR(20) DEFAULT 'active' NOT NULL COMMENT '用户状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    last_login_at DATETIME COMMENT '最后登录时间',
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================
-- 角色表
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
    description TEXT COMMENT '角色描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- ============================================
-- 权限表
-- ============================================

CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '权限名称',
    code VARCHAR(100) NOT NULL UNIQUE COMMENT '权限代码',
    description TEXT COMMENT '权限描述',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_name (name),
    INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- ============================================
-- 角色权限关联表
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL COMMENT '角色ID',
    permission_id INT NOT NULL COMMENT '权限ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_role_permission (role_id, permission_id),
    INDEX idx_role_id (role_id),
    INDEX idx_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限关联表';

-- ============================================
-- 用户角色关联表
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用户ID',
    role_id INT NOT NULL COMMENT '角色ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户角色关联表';

-- ============================================
-- 回收站表
-- ============================================

CREATE TABLE IF NOT EXISTS recycle_bin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    original_table VARCHAR(100) NOT NULL COMMENT '原始表名',
    original_id INT NOT NULL COMMENT '原始记录ID',
    data JSON NOT NULL COMMENT '原始数据（JSON格式）',
    deleted_by INT NOT NULL COMMENT '删除人ID',
    deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
    restored_by INT COMMENT '恢复人ID',
    restored_at DATETIME COMMENT '恢复时间',
    
    INDEX idx_original_table (original_table),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回收站表';

-- ============================================
-- 操作日志表
-- ============================================

CREATE TABLE IF NOT EXISTS operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '操作用户ID',
    username VARCHAR(50) NOT NULL COMMENT '操作用户名',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    table_name VARCHAR(100) COMMENT '操作表名',
    record_id INT COMMENT '操作记录ID',
    old_data JSON COMMENT '操作前数据（JSON格式）',
    new_data JSON COMMENT '操作后数据（JSON格式）',
    ip_address VARCHAR(45) NOT NULL COMMENT '操作IP地址',
    user_agent TEXT COMMENT '用户代理',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_table_name (table_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- ============================================
-- 产品操作日志表
-- ============================================

CREATE TABLE IF NOT EXISTS product_operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL COMMENT '产品ID',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    operation_details TEXT NOT NULL COMMENT '操作详情',
    operator_id INT NOT NULL COMMENT '操作人ID',
    operator_name VARCHAR(100) NOT NULL COMMENT '操作人姓名',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品操作日志表';

-- ============================================
-- 图片操作日志表
-- ============================================

CREATE TABLE IF NOT EXISTS image_operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_id INT NOT NULL COMMENT '图片ID',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    operation_details TEXT NOT NULL COMMENT '操作详情',
    operator_id INT NOT NULL COMMENT '操作人ID',
    operator_name VARCHAR(100) NOT NULL COMMENT '操作人姓名',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    INDEX idx_image_id (image_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片操作日志表';

-- ============================================
-- 产品组合表
-- ============================================

CREATE TABLE IF NOT EXISTS product_bundles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '组合名称',
    description TEXT COMMENT '组合描述',
    sku VARCHAR(100) NOT NULL UNIQUE COMMENT '组合SKU',
    price DECIMAL(10, 2) COMMENT '组合价格',
    status VARCHAR(20) DEFAULT 'active' NOT NULL COMMENT '组合状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_sku (sku),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品组合表';

-- ============================================
-- 组合产品关联表
-- ============================================

CREATE TABLE IF NOT EXISTS bundle_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bundle_id INT NOT NULL COMMENT '组合ID',
    product_id INT NOT NULL COMMENT '产品ID',
    quantity INT NOT NULL DEFAULT 1 COMMENT '产品数量',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (bundle_id) REFERENCES product_bundles(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_bundle_id (bundle_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='组合产品关联表';

-- ============================================
-- 选品表
-- ============================================

CREATE TABLE IF NOT EXISTS selections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '选品名称',
    description TEXT COMMENT '选品描述',
    status VARCHAR(20) DEFAULT 'active' NOT NULL COMMENT '选品状态',
    created_by INT NOT NULL COMMENT '创建人ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品表';

-- ============================================
-- 选品产品关联表
-- ============================================

CREATE TABLE IF NOT EXISTS selection_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    selection_id INT NOT NULL COMMENT '选品ID',
    product_id INT NOT NULL COMMENT '产品ID',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_selection_product (selection_id, product_id),
    INDEX idx_selection_id (selection_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品产品关联表';

-- ============================================
-- 选品参考产品表
-- ============================================

CREATE TABLE IF NOT EXISTS selection_reference_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    selection_id INT NOT NULL COMMENT '选品ID',
    reference_product_id INT NOT NULL COMMENT '参考产品ID',
    similarity_score DECIMAL(5, 4) NOT NULL COMMENT '相似度分数',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_selection_id (selection_id),
    INDEX idx_reference_product_id (reference_product_id),
    INDEX idx_similarity_score (similarity_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品参考产品表';

-- ============================================
-- 选品新产品表
-- ============================================

CREATE TABLE IF NOT EXISTS selection_new_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    selection_id INT NOT NULL COMMENT '选品ID',
    product_id INT NOT NULL COMMENT '产品ID',
    added_by INT NOT NULL COMMENT '添加人ID',
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
    
    FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_selection_new_product (selection_id, product_id),
    INDEX idx_selection_id (selection_id),
    INDEX idx_product_id (product_id),
    INDEX idx_added_by (added_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品新产品表';

-- ============================================
-- 选品操作日志表
-- ============================================

CREATE TABLE IF NOT EXISTS selection_operation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    selection_id INT NOT NULL COMMENT '选品ID',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    operation_details TEXT NOT NULL COMMENT '操作详情',
    operator_id INT NOT NULL COMMENT '操作人ID',
    operator_name VARCHAR(100) NOT NULL COMMENT '操作人姓名',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE,
    INDEX idx_selection_id (selection_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品操作日志表';

-- ============================================
-- 插入默认权限数据
-- ============================================

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

-- ============================================
-- 插入默认角色数据
-- ============================================

INSERT IGNORE INTO roles (name, description) VALUES
('admin', '系统管理员，拥有所有权限'),
('editor', '编辑，拥有编辑权限'),
('user', '普通用户，拥有基本查看权限');

-- ============================================
-- 插入默认角色权限关联数据
-- ============================================

-- 管理员拥有所有权限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

-- 编辑拥有部分权限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'editor' AND p.code IN (
    'view_product', 'create_product', 'edit_product',
    'view_image', 'upload_image', 'edit_image',
    'view_log'
);

-- 普通用户拥有查看权限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'user' AND p.code IN (
    'view_product', 'view_image'
);

-- ============================================
-- 插入默认用户数据
-- ============================================

INSERT IGNORE INTO users (username, password, email, real_name, role, status)
VALUES ('admin', '$2b$12$Jz7vJ2Y7vJ2Y7vJ2Y7vJ2Y7vJ2Y7vJ2Y7vJ2Y7vJ2Y7vJ2Y7vJ2', 'admin@example.com', '系统管理员', 'admin', 'active');

-- ============================================
-- 插入默认分类数据
-- ============================================

INSERT IGNORE INTO categories (name, parent_id, level, sort_order, status)
VALUES 
('服装', NULL, 1, 1, 'active'),
('电子产品', NULL, 1, 2, 'active'),
('家居用品', NULL, 1, 3, 'active'),
('服装-上衣', 1, 2, 1, 'active'),
('服装-裤子', 1, 2, 2, 'active'),
('服装-鞋子', 1, 2, 3, 'active'),
('电子产品-手机', 2, 2, 1, 'active'),
('电子产品-电脑', 2, 2, 2, 'active'),
('电子产品-配件', 2, 2, 3, 'active'),
('家居用品-家具', 3, 2, 1, 'active'),
('家居用品-厨具', 3, 2, 2, 'active'),
('家居用品-装饰品', 3, 2, 3, 'active');

-- ============================================
-- 插入默认标签数据
-- ============================================

INSERT IGNORE INTO tags (name, usage_count)
VALUES 
('新品', 0),
('热销', 0),
('促销', 0),
('推荐', 0),
('限量', 0),
('经典', 0),
('时尚', 0),
('实用', 0),
('高品质', 0),
('环保', 0);
