-- 思觉智贸 - 数据库�脚本
-- 版本: 1.0
-- 日期: 2026-01-01

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS sijuelishi
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sijuelishi;

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
    INDEX idx_created_at (created_at),
    INDEX idx_name (name),
    INDEX idx_tags (tags(100)),
    INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品表';

-- ============================================
-- 产品-图片关联表
-- ============================================

CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL COMMENT '产品ID',
    image_id INT NOT NULL COMMENT '图片ID',
    sort_order INT DEFAULT 0 COMMENT '排序顺序',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    UNIQUE KEY uk_product_image (product_id, image_id),
    INDEX idx_product_id (product_id),
    INDEX idx_image_id (image_id),
    INDEX idx_sort_order (sort_order),
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品-图片关联表';

-- ============================================
-- 插入示例数据（可选）
-- ============================================

-- 插入示例产品
INSERT INTO products (sku, name, description, category, tags, price, stock, status) VALUES
('SKU001', '示例产品1', '这是一个示例产品', '电子产品', '手机,智能', 2999.00, 100, 'active'),
('SKU002', '示例产品2', '这是另一个示例产品', '服装', '时尚,夏季', 199.00, 50, 'active'),
('SKU003', '示例产品3', '第三个示例产品', '家居', '家具,现代', 899.00, 30, 'active');

-- ============================================
-- 创建视图（可选，用于统计查询）
-- ============================================

-- 产品统计视图
CREATE OR REPLACE VIEW v_product_stats AS
SELECT 
    COUNT(*) as total_products,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_products,
    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_products,
    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_products,
    COUNT(DISTINCT category) as total_categories,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price
FROM products;

-- 分类统计视图
CREATE OR REPLACE VIEW v_category_stats AS
SELECT 
    category,
    COUNT(*) as count,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price
FROM products
GROUP BY category
ORDER BY count DESC;

-- ============================================
-- 完成提示
-- ============================================

SELECT '数据库初始化完成！' AS message;
SELECT '已创建的表：' AS info;
SELECT '  - images (图片表）' AS info;
SELECT '  - products (产品表）' AS info;
SELECT '  - product_images (产品-图片关联表）' AS info;
SELECT '  - v_product_stats (产品统计视图）' AS info;
SELECT '  - v_category_stats (分类统计视图）' AS info;
SELECT '示例数据已插入' AS info;
