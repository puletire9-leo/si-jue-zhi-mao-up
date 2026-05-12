-- 添加腾讯云COS相关字段到images表
ALTER TABLE images 
ADD COLUMN cos_object_key VARCHAR(500) COMMENT '腾讯云COS对象键',
ADD COLUMN cos_url VARCHAR(500) COMMENT '腾讯云COS访问URL',
ADD COLUMN storage_type ENUM('local', 'cos') DEFAULT 'local' COMMENT '存储类型',
ADD COLUMN cos_thumbnail_key VARCHAR(500) COMMENT '腾讯云COS缩略图对象键',
ADD COLUMN cos_thumbnail_url VARCHAR(500) COMMENT '腾讯云COS缩略图访问URL',
ADD INDEX idx_storage_type (storage_type),
ADD INDEX idx_cos_object_key (cos_object_key);

-- 更新现有记录的存储类型
UPDATE images SET storage_type = 'local' WHERE storage_type IS NULL;

-- 创建存储统计视图
CREATE VIEW cos_storage_stats AS
SELECT 
    storage_type,
    COUNT(*) as image_count,
    SUM(file_size) as total_size,
    AVG(file_size) as avg_size
FROM images 
GROUP BY storage_type;

-- 创建存储迁移状态表
CREATE TABLE IF NOT EXISTS storage_migration_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    image_id BIGINT NOT NULL,
    original_storage_type ENUM('local', 'cos') NOT NULL,
    new_storage_type ENUM('local', 'cos') NOT NULL,
    migration_status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_image_id (image_id),
    INDEX idx_status (migration_status),
    INDEX idx_created_at (created_at)
) COMMENT '存储迁移日志表';