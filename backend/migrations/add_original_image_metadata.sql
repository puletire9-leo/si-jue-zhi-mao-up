-- 为 images 表添加原始图片元数据字段
-- 版本: 1.0
-- 日期: 2026-01-28

-- 切换到目标数据库
USE sijuelishi;

-- 1. 添加原始图片大小字段
ALTER TABLE images 
ADD COLUMN original_file_size BIGINT DEFAULT NULL COMMENT '原始文件大小（字节）';

-- 2. 添加原始图片格式字段
ALTER TABLE images 
ADD COLUMN original_format VARCHAR(20) DEFAULT NULL COMMENT '原始图片格式';

-- 3. 添加原始图片宽度字段
ALTER TABLE images 
ADD COLUMN original_width INT DEFAULT NULL COMMENT '原始图片宽度';

-- 4. 添加原始图片高度字段
ALTER TABLE images 
ADD COLUMN original_height INT DEFAULT NULL COMMENT '原始图片高度';

-- 5. 添加原始文件名字段
ALTER TABLE images 
ADD COLUMN original_filename VARCHAR(255) DEFAULT NULL COMMENT '原始文件名';

-- 6. 添加原始图片质量字段
ALTER TABLE images 
ADD COLUMN original_quality INT DEFAULT NULL COMMENT '原始图片质量