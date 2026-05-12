-- 为 images 表添加原始图片元数据字段
-- 版本: 1.0
-- 日期: 2026-01-28

-- 切换到目标数据库
USE sijuelishi;

-- 一次性添加所有原始图片元数据字段
ALTER TABLE images 
ADD COLUMN original_file_size BIGINT DEFAULT NULL COMMENT '原始文件大小（字节）',
ADD COLUMN original_format VARCHAR(20) DEFAULT NULL COMMENT '原始图片格式',
ADD COLUMN original_width INT DEFAULT NULL COMMENT '原始图片宽度',
ADD COLUMN original_height INT DEFAULT NULL COMMENT '原始图片高度',
ADD COLUMN original_filename VARCHAR(255) DEFAULT NULL COMMENT '原始文件名',
ADD COLUMN original_quality INT DEFAULT NULL COMMENT '原始图片质量（1-100）',
ADD INDEX idx_original_format (original_format),
ADD INDEX idx_original_file_size (original_file_size);

-- 同样的命令用于开发环境
-- USE sijuelishi_dev;
-- ALTER TABLE images 
-- ADD COLUMN original_file_size BIGINT DEFAULT NULL COMMENT '原始文件大小（字节）',
-- ADD COLUMN original_format VARCHAR(20) DEFAULT NULL COMMENT '原始图片格式',
-- ADD COLUMN original_width INT DEFAULT NULL COMMENT '原始图片宽度',
-- ADD COLUMN original_height INT DEFAULT NULL COMMENT '原始图片高度',
-- ADD COLUMN original_filename VARCHAR(255) DEFAULT NULL COMMENT '原始文件名',
-- ADD COLUMN original_quality INT DEFAULT NULL COMMENT '原始图片