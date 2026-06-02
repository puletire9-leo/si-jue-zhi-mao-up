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

-- 创建邓总店铺卖家表
CREATE TABLE IF NOT EXISTS `deng_zong_shop_seller` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `marketplace` VARCHAR(10) NOT NULL COMMENT '站点：UK/DE/US等',
    `seller_name` VARCHAR(200) NOT NULL COMMENT '卖家名称',
    `store_url` VARCHAR(500) DEFAULT NULL COMMENT 'Amazon店铺链接',
    `notes` VARCHAR(500) DEFAULT NULL COMMENT '备注',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_marketplace_seller` (`marketplace`, `seller_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邓总店铺卖家表';

-- 插入初始卖家数据
INSERT INTO `deng_zong_shop_seller` (`marketplace`, `seller_name`, `store_url`) VALUES
('UK', 'CLX-UK', 'https://www.amazon.co.uk/s?i=merchant-items&me=AH0SQDC1I3QJQ'),
('UK', 'zhoukoushizhizhuoshangmaoyouxiangongsi', 'https://www.amazon.co.uk/s?me=A3KTIHI3Z89QQX&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'zhoukoururushangmaoyouxiangongsi', 'https://www.amazon.co.uk/s?me=A22IZ0W2Q2I4CQ&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'zhoukoushilanpeishangmaoyouxiangongsi', 'https://www.amazon.co.uk/sp?ie=UTF8&seller=A290OP240JUOI1'),
('UK', 'zhoukoushiyuejieshangmaoyouxiangongsi', 'https://www.amazon.co.uk/s?ie=UTF8&marketplaceID=A1F83G8C2ARO7P&me=A34I0PK6AXQ9SV'),
('UK', 'yuzhoushiluanjiushangmaoyouxiangongsi', 'https://www.amazon.co.uk/s?ie=UTF8&marketplaceID=A1F83G8C2ARO7P&me=A2VOA8N58FIM74'),
('UK', 'BENHUANZPZ', 'https://www.amazon.co.uk/s?me=ARVWZD2HL23UE&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'wuzhengxiong', 'https://www.amazon.co.uk/s?me=AFYPO3X9PEB89&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'SDGHJZ', 'https://www.amazon.co.uk/s?me=ALK3JMIQWVFYZ&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'zhangxiaodonG', 'https://www.amazon.co.uk/s?me=AO6049V8QVVFG&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'Crysalone', 'https://www.amazon.co.uk/s?me=AERMN94SIH4FA&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'zhaofeiyu', 'https://www.amazon.co.uk/s?me=AXB6CUIZY7JYK&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'yanbiao-eu', 'https://www.amazon.co.uk/s?ie=UTF8&marketplaceID=A1F83G8C2ARO7P&me=A1P6L03XPL5OXP'),
('UK', 'luoheshinuomaixinxikejiyouxiangongsi', 'https://www.amazon.co.uk/s?me=A1A4P20841FVNH&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'YMSM-EU', 'https://www.amazon.co.uk/s?me=A14LBMEMEUOGRR&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'xinchenliang', 'https://www.amazon.co.uk/s?me=A3306WWEG2HDA2&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'ZUOQUANGUIDIANPU', 'https://www.amazon.co.uk/s?me=A2MF3L850OGSHK&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'ShangXinWen-GB', 'https://www.amazon.co.uk/s?me=A2Q32Q4RURENJB&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'xinheibu', 'https://www.amazon.co.uk/s?me=A3TSPPSCZJZDXN&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'GUANGZHOUDUANLINGSHANGMAOYOUXIANGONGSI', 'https://www.amazon.co.uk/s?me=A1E1Y8RCG7CRFF&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'BloomMsg', 'https://www.amazon.co.uk/s?me=AWXF4C2IRAN7A&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'yingyaoshangmaoUKshop', 'https://www.amazon.co.uk/s?me=AKVAN22J1D3BE&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'ZhixunTechnology', 'https://www.amazon.co.uk/s?me=A10M6B6W6F1XZW&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'zhoukouyitiaoshangmaoyouxiangongsi', 'https://www.amazon.co.uk/s?me=A3G9RUCI0D5VI0&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'HANGZHOUSHIKONGJINGLINGKEJIYOUXIANGONGSI', 'https://www.amazon.co.uk/s?i=merchant-items&me=AXBIPKZH1Y2F6'),
('UK', 'TAIZHOUMINGHAOZIDONGHUAKEJIYOUXIANGONGSI', 'https://www.amazon.co.uk/s?me=ABKMCBDNY7ID0&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'QINGDAOLIANGJIASHENGSHANGMAOYOUXIANGONGSI', 'https://www.amazon.co.uk/s?me=A1SH7LT326PXLS&marketplaceID=A1F83G8C2ARO7P'),
('UK', 'LIchenwei', 'https://www.amazon.co.uk/s?i=merchant-items&me=A2THC0WSI73B1W'),
('DE', 'xinchenliang', 'https://www.amazon.de/s?me=A3306WWEG2HDA2&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'SDGHJZ', 'https://www.amazon.de/s?me=ALK3JMIQWVFYZ&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'ZUOQUANGUIDIANPU', 'https://www.amazon.de/s?me=A2MF3L850OGSHK&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'yingyaoshangmaoUKshop', 'https://www.amazon.de/s?me=AKVAN22J1D3BE&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'YMSM-EU', 'https://www.amazon.de/s?me=A14LBMEMEUOGRR&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhoukoushizhizhuoshangmaoyouxiangongsi', 'https://www.amazon.de/s?me=A3KTIHI3Z89QQX&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhoukoururushangmaoyouxiangongsi', 'https://www.amazon.de/s?me=A22IZ0W2Q2I4CQ&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhoukoushilanpeishangmaoyouxiangongsi', 'https://www.amazon.de/s?me=A290OP240JUOI1&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhoukoushiyuejieshangmaoyouxiangongsi', 'https://www.amazon.de/s?me=A34I0PK6AXQ9SV&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'yuzhoushiluanjiushangmaoyouxiangongsi', 'https://www.amazon.de/s?me=A2VOA8N58FIM74&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'BENHUANZPZ', 'https://www.amazon.de/s?me=ARVWZD2HL23UE&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'wuzhengxiong', 'https://www.amazon.de/s?me=AFYPO3X9PEB89&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhangxiaodonG', 'https://www.amazon.de/s?me=AO6049V8QVVFG&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhaofeiyu', 'https://www.amazon.de/s?me=AXB6CUIZY7JYK&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'yanbiao-eu', 'https://www.amazon.de/s?me=A1P6L03XPL5OXP&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'luoheshinuomaixinxikejiyouxiangongsi', 'https://www.amazon.de/s?me=A1A4P20841FVNH&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'GUANGZHOUDUANLINGSHANGMAOYOUXIANGONGSI', 'https://www.amazon.de/s?me=A1E1Y8RCG7CRFF&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'BloomMsg', 'https://www.amazon.de/s?me=AWXF4C2IRAN7A&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhixunTechnology', 'https://www.amazon.de/s?me=A10M6B6W6F1XZW&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'zhoukouyitiaoshangmaoyouxiangongsi', 'https://www.amazon.de/s?me=A3G9RUCI0D5VI0&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'TAIZHOUMINGHAOZIDONGHUAKEJIYOUXIANGONGSI', 'https://www.amazon.de/-/en/s?ie=UTF8&marketplaceID=A1PA6795UKMFR9&me=ABKMCBDNY7ID0'),
('DE', 'HANGZHOUSHIKONGJINGLINGKEJIYOUXIANGONGSI', 'https://www.amazon.de/s?me=AXBIPKZH1Y2F6&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'QINGDAOLIANGJIASHENGSHANGMAOYOUXIANGONGSI', 'https://www.amazon.de/s?me=A1SH7LT326PXLS&language=en&marketplaceID=A1PA6795UKMFR9'),
('DE', 'SHEWUDE', NULL),
('DE', 'LIchenwei', NULL),
('DE', 'xinheibu', NULL),
('DE', 'ShangXinWen-GB', NULL)
ON DUPLICATE KEY UPDATE `store_url` = VALUES(`store_url`);
