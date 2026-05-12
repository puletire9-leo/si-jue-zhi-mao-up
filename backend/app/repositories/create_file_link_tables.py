"""创建文件链接管理相关数据库表"""

import asyncio
import logging
from .mysql_repo import get_mysql_repo

logger = logging.getLogger(__name__)

CREATE_FILE_LINKS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS file_links (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '文件链接ID',
    title VARCHAR(500) NOT NULL COMMENT '链接标题',
    url TEXT NOT NULL COMMENT '链接地址',
    link_type ENUM('feishu_xlsx', 'standard_url') NOT NULL COMMENT '链接类型：feishu_xlsx(飞书xlsx)/standard_url(标准链接)',
    description TEXT DEFAULT NULL COMMENT '链接描述',
    tags JSON DEFAULT NULL COMMENT '标签列表',
    category VARCHAR(100) DEFAULT NULL COMMENT '分类',
    library_type ENUM('prompt-library', 'resource-library') NOT NULL COMMENT '所属库类型',
    status ENUM('active', 'inactive', 'error') NOT NULL DEFAULT 'active' COMMENT '链接状态',
    last_checked DATETIME DEFAULT NULL COMMENT '最后检查时间',
    check_result JSON DEFAULT NULL COMMENT '检查结果',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_library_type (library_type),
    INDEX idx_link_type (link_type),
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_created_at (created_at),
    INDEX idx_title (title(100)),
    FULLTEXT idx_title_desc (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件链接表';
"""

CREATE_FILE_UPLOADS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS file_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '文件上传ID',
    filename VARCHAR(500) NOT NULL COMMENT '文件名',
    file_path VARCHAR(1000) NOT NULL COMMENT '文件存储路径',
    file_url TEXT NOT NULL COMMENT '文件访问URL',
    file_size INT NOT NULL COMMENT '文件大小(字节)',
    file_type VARCHAR(100) NOT NULL COMMENT '文件类型',
    library_type ENUM('prompt-library', 'resource-library') NOT NULL COMMENT '所属库类型',
    upload_user_id INT DEFAULT NULL COMMENT '上传用户ID',
    description TEXT DEFAULT NULL COMMENT '文件描述',
    tags JSON DEFAULT NULL COMMENT '标签列表',
    status ENUM('active', 'deleted') NOT NULL DEFAULT 'active' COMMENT '文件状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_library_type (library_type),
    INDEX idx_file_type (file_type),
    INDEX idx_upload_user_id (upload_user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_filename (filename(100)),
    FULLTEXT idx_filename_desc (filename, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件上传表';
"""


async def create_file_link_tables():
    """创建文件链接管理相关表"""
    mysql_repo = await get_mysql_repo()
    
    try:
        # 创建文件链接表
        await mysql_repo.execute_update(CREATE_FILE_LINKS_TABLE_SQL)
        logger.info("文件链接表创建成功")
        
        # 创建文件上传表
        await mysql_repo.execute_update(CREATE_FILE_UPLOADS_TABLE_SQL)
        logger.info("文件上传表创建成功")
        
        return True
        
    except Exception as e:
        logger.error(f"创建文件链接表失败: {e}")
        return False


async def main():
    """主函数 - 用于测试表创建"""
    success = await create_file_link_tables()
    if success:
        print("文件链接表创建成功")
    else:
        print("文件链接表创建失败")


if __name__ == "__main__":
    asyncio.run(main())