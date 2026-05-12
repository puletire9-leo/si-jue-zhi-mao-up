-- 创建用户表
CREATE TABLE IF NOT EXISTS `user` (
    `id` BIGINT NOT NULL COMMENT '用户ID',
    `username` VARCHAR(50) NOT NULL COMMENT '用户名',
    `password` VARCHAR(255) NOT NULL COMMENT '密码（BCrypt加密）',
    `nickname` VARCHAR(100) DEFAULT NULL COMMENT '昵称',
    `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
    `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
    `role` VARCHAR(20) NOT NULL DEFAULT 'USER' COMMENT '角色：USER/ADMIN',
    `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0禁用 1启用',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 插入测试用户（密码：123456，使用 BCrypt 加密）
INSERT INTO `user` (`id`, `username`, `password`, `nickname`, `role`, `status`) VALUES
(1, 'admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.AF0.7KyJ/Z3Gq', '管理员', 'ADMIN', 1),
(2, 'user', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.AF0.7KyJ/Z3Gq', '普通用户', 'USER', 1)
ON DUPLICATE KEY UPDATE `username`=`username`;

-- 创建产品表
CREATE TABLE IF NOT EXISTS `product` (
    `id` BIGINT NOT NULL COMMENT '产品ID',
    `asin` VARCHAR(20) NOT NULL COMMENT 'ASIN',
    `name` VARCHAR(255) NOT NULL COMMENT '产品名称',
    `category_id` BIGINT DEFAULT NULL COMMENT '分类ID',
    `seller` VARCHAR(100) DEFAULT NULL COMMENT '卖家',
    `carrier_id` BIGINT DEFAULT NULL COMMENT '载体ID',
    `price` DECIMAL(10,2) DEFAULT NULL COMMENT '价格',
    `score` INT DEFAULT 0 COMMENT '评分',
    `source` VARCHAR(50) DEFAULT NULL COMMENT '来源',
    `image_url` VARCHAR(500) DEFAULT NULL COMMENT '图片URL',
    `status` TINYINT DEFAULT 1 COMMENT '状态：0下架 1上架',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_asin` (`asin`),
    KEY `idx_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';

-- 创建分类表
CREATE TABLE IF NOT EXISTS `category` (
    `id` BIGINT NOT NULL COMMENT '分类ID',
    `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
    `parent_id` BIGINT DEFAULT NULL COMMENT '父分类ID',
    `sort_order` INT DEFAULT 0 COMMENT '排序',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分类表';

-- 创建定稿表
CREATE TABLE IF NOT EXISTS `final_draft` (
    `id` BIGINT NOT NULL COMMENT '定稿ID',
    `title` VARCHAR(255) NOT NULL COMMENT '标题',
    `content` TEXT COMMENT '内容',
    `product_id` BIGINT DEFAULT NULL COMMENT '关联产品ID',
    `status` TINYINT DEFAULT 1 COMMENT '状态：0草稿 1已发布',
    `author_id` BIGINT DEFAULT NULL COMMENT '作者ID',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定稿表';

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS `system_config` (
    `id` BIGINT NOT NULL COMMENT '配置ID',
    `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
    `config_value` TEXT COMMENT '配置值',
    `config_type` VARCHAR(50) DEFAULT 'string' COMMENT '类型：string/number/boolean/json',
    `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 插入默认系统配置
INSERT INTO `system_config` (`id`, `config_key`, `config_value`, `config_type`, `description`) VALUES
(1, 'carrier_list', '[]', 'json', '载体列表'),
(2, 'developer_list', '[]', 'json', '开发人列表'),
(3, 'image_settings', '{"quality": 80, "maxSize": 5000}', 'json', '图片设置')
ON DUPLICATE KEY UPDATE `config_key`=`config_key`;
