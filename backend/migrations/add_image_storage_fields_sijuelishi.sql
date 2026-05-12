-- 为 images 表添加缺失的存储相关字段
-- 版本: 1.0
-- 日期: 2026-01-19

-- 切换到目标数据库
USE sijuelishi;

-- 1. 添加存储类型字段
ALTER TABLE images 
ADD COLUMN storage_type VARCHAR(20) DEFAULT 'local' COMMENT '存储类型: local(本地), cos(腾讯云COS)';

-- 2. 添加腾讯云COS对象键字段
ALTER TABLE images 
ADD COLUMN cos_object_key VARCHAR(500) DEFAULT NULL COMMENT '腾讯云COS对象键';

-- 3. 添加腾讯云COS访问URL字段
ALTER TABLE images 
ADD COLUMN cos_url VARCHAR(500) DEFAULT NULL COMMENT '腾讯云COS访问URL';

-- 4. 添加腾讯云COS缩略图对象键字段
ALTER TABLE images 
ADD COLUMN cos_thumbnail_key VARCHAR(500) DEFAULT NULL COMMENT '腾讯云COS缩略图对象键';

-- 5. 添加腾讯云COS缩略图访问URL字段
ALTER TABLE images 
ADD COLUMN cos_thumbnail_url VARCHAR(500) DEFAULT NULL COMMENT '腾讯云COS缩略图访问URL';

-- 6. 添加索引以提高查询性能
CREATE INDEX idx_storage_type ON images(storage_type);
CREATE INDEX idx_cos_object_key ON images(cos_object_key);
