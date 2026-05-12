"""
创建选品产品表

用于存储选品相关的产品信息，包括新品榜和竞品店铺
"""

CREATE_SELECTION_PRODUCTS_TABLE = """
CREATE TABLE IF NOT EXISTS selection_products (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '产品ID',
    asin VARCHAR(50) NOT NULL COMMENT '产品ASIN',
    product_title VARCHAR(500) NOT NULL COMMENT '商品标题',
    price DECIMAL(10, 2) DEFAULT NULL COMMENT '商品价格',
    image_url TEXT DEFAULT NULL COMMENT '商品图片URL',
    local_path VARCHAR(500) DEFAULT NULL COMMENT '本地图片路径',
    thumb_path VARCHAR(500) DEFAULT NULL COMMENT '缩略图路径',
    store_name VARCHAR(200) DEFAULT NULL COMMENT '店铺名称',
    store_url TEXT DEFAULT NULL COMMENT '店铺URL',
    category VARCHAR(100) DEFAULT NULL COMMENT '产品分类',
    tags TEXT DEFAULT NULL COMMENT '产品标签列表（逗号分隔）',
    notes TEXT DEFAULT NULL COMMENT '备注信息',
    product_type ENUM('new', 'reference', 'zheng') NOT NULL DEFAULT 'new' COMMENT '产品类型：new(新品榜)/reference(竞品店铺)/zheng(郑总店铺)',
    product_link TEXT DEFAULT NULL COMMENT '商品链接',
    sales_volume INT DEFAULT NULL COMMENT '销量',
    listing_days INT DEFAULT NULL COMMENT '上架时间(天)',
    delivery_method VARCHAR(50) DEFAULT NULL COMMENT '配送方式',
    similar_products TEXT DEFAULT NULL COMMENT '相似商品',
    source VARCHAR(50) DEFAULT NULL COMMENT '来源',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_asin (asin),
    INDEX idx_product_type (product_type),
    INDEX idx_store_name (store_name),
    INDEX idx_category (category),
    INDEX idx_created_at (created_at),
    INDEX idx_price (price),
    INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品产品表';
"""

CREATE_SELECTION_RECYCLE_BIN_TABLE = """
CREATE TABLE IF NOT EXISTS selection_recycle_bin (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '回收记录ID',
    product_id INT NOT NULL COMMENT '原产品ID',
    asin VARCHAR(50) NOT NULL COMMENT '产品ASIN',
    product_title VARCHAR(500) NOT NULL COMMENT '商品标题',
    price DECIMAL(10, 2) DEFAULT NULL COMMENT '商品价格',
    image_url TEXT DEFAULT NULL COMMENT '商品图片URL',
    local_path VARCHAR(500) DEFAULT NULL COMMENT '本地图片路径',
    thumb_path VARCHAR(500) DEFAULT NULL COMMENT '缩略图路径',
    store_name VARCHAR(200) DEFAULT NULL COMMENT '店铺名称',
    store_url TEXT DEFAULT NULL COMMENT '店铺URL',
    category VARCHAR(100) DEFAULT NULL COMMENT '产品分类',
    tags TEXT DEFAULT NULL COMMENT '产品标签列表（逗号分隔）',
    notes TEXT DEFAULT NULL COMMENT '备注信息',
    product_type ENUM('new', 'reference', 'zheng') NOT NULL DEFAULT 'new' COMMENT '产品类型：new(新品榜)/reference(竞品店铺)/zheng(郑总店铺)',
    product_link TEXT DEFAULT NULL COMMENT '商品链接',
    sales_volume INT DEFAULT NULL COMMENT '销量',
    listing_days INT DEFAULT NULL COMMENT '上架时间(天)',
    delivery_method VARCHAR(50) DEFAULT NULL COMMENT '配送方式',
    similar_products TEXT DEFAULT NULL COMMENT '相似商品',
    source VARCHAR(50) DEFAULT NULL COMMENT '来源',
    deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
    deleted_by VARCHAR(100) DEFAULT NULL COMMENT '删除操作人',
    restore_count INT DEFAULT 0 COMMENT '恢复次数',
    INDEX idx_product_id (product_id),
    INDEX idx_asin (asin),
    INDEX idx_product_type (product_type),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选品回收站表';
"""

async def create_selection_tables(mysql_repo):
    """
    创建选品相关的数据库表
    
    Args:
        mysql_repo: MySQL仓库实例
    """
    try:
        await mysql_repo.execute_update(CREATE_SELECTION_PRODUCTS_TABLE)
        print("[OK] 选品产品表创建成功")
        
        await mysql_repo.execute_update(CREATE_SELECTION_RECYCLE_BIN_TABLE)
        print("[OK] 选品回收站表创建成功")
        
    except Exception as e:
        print(f"[FAIL] 创建选品表失败: {e}")
        raise

if __name__ == "__main__":
    import sys
    import os
    
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
    
    import asyncio
    from app.repositories.mysql_repo import MySQLRepository
    from app.config import settings
    
    async def main():
        mysql = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            pool_size=settings.MYSQL_POOL_SIZE,
            pool_recycle=settings.MYSQL_POOL_RECYCLE,
            echo=settings.MYSQL_ECHO
        )
        
        await mysql.connect()
        await create_selection_tables(mysql)
        await mysql.disconnect()
    
    asyncio.run(main())
