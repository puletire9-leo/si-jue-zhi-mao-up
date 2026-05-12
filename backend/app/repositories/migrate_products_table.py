"""
产品表迁移脚本
添加缺失的字段以支持新的模板结构
"""

import pymysql
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_products_table():
    """
    迁移产品表，添加缺失的字段
    """
    try:
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='root',
            database='sijuelishi',
            charset='utf8mb4'
        )
        cursor = conn.cursor()

        logger.info("开始迁移产品表...")

        # 获取当前表结构
        cursor.execute("DESCRIBE products")
        existing_columns = [row[0] for row in cursor.fetchall()]
        logger.info(f"当前表字段: {existing_columns}")

        # 添加 type 字段
        if 'type' not in existing_columns:
            cursor.execute("""
                ALTER TABLE products
                ADD COLUMN type VARCHAR(50) DEFAULT '普通产品'
                COMMENT '产品类型：普通产品/组合产品/定制产品'
                AFTER status
            """)
            logger.info("[OK] 添加 type 字段成功")
        else:
            logger.info("[WARN]  type 字段已存在，跳过")

        # 添加 developer 字段
        if 'developer' not in existing_columns:
            cursor.execute("""
                ALTER TABLE products
                ADD COLUMN developer VARCHAR(100) DEFAULT NULL
                COMMENT '开发者'
                AFTER type
            """)
            logger.info("[OK] 添加 developer 字段成功")
        else:
            logger.info("[WARN]  developer 字段已存在，跳过")

        # 添加 included_items 字段
        if 'included_items' not in existing_columns:
            cursor.execute("""
                ALTER TABLE products
                ADD COLUMN included_items TEXT DEFAULT NULL
                COMMENT '包含项目（逗号分隔）'
                AFTER developer
            """)
            logger.info("[OK] 添加 included_items 字段成功")
            # 更新existing_columns列表，避免后续检查失败
            existing_columns.append('included_items')
        else:
            logger.info("[WARN]  included_items 字段已存在，跳过")

        # 添加 image 字段
        if 'image' not in existing_columns:
            cursor.execute("""
                ALTER TABLE products
                ADD COLUMN image VARCHAR(512) DEFAULT NULL
                COMMENT '产品图片URL'
                AFTER included_items
            """)
            logger.info("[OK] 添加 image 字段成功")
        else:
            logger.info("[WARN]  image 字段已存在，跳过")

        # 添加索引
        try:
            cursor.execute("SHOW INDEX FROM products WHERE Key_name = 'idx_type'")
            if not cursor.fetchall():
                cursor.execute("""
                    CREATE INDEX idx_type ON products(type)
                """)
                logger.info("[OK] 添加 type 索引成功")
            else:
                logger.info("[WARN]  type 索引已存在，跳过")
        except pymysql.Error as e:
            logger.info(f"[WARN]  type 索引检查失败: {e}")

        conn.commit()
        logger.info("[DONE] 产品表迁移完成！")

        # 验证表结构
        cursor.execute("DESCRIBE products")
        columns = cursor.fetchall()
        logger.info("\n当前产品表结构：")
        for col in columns:
            logger.info(f"  - {col[0]}: {col[1]}")

        cursor.close()
        conn.close()

    except Exception as e:
        logger.error(f"[FAIL] 迁移失败: {e}")
        raise


if __name__ == "__main__":
    migrate_products_table()
