-- 为images表添加索引，优化定稿下载查询性能
-- 创建时间: 2026-02-26
-- 问题: 定稿下载时查询images表耗时4.5秒，需要优化

-- 检查并添加cos_object_key索引
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                     WHERE table_schema = DATABASE() 
                     AND table_name = 'images' 
                     AND index_name = 'idx_images_cos_object_key');

SET @sql = IF(@index_exists = 0, 
              'CREATE INDEX idx_images_cos_object_key ON images(cos_object_key)', 
              'SELECT "Index idx_images_cos_object_key already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加cos_url索引（前255字符）
SET @index_exists2 = (SELECT COUNT(*) FROM information_schema.statistics 
                      WHERE table_schema = DATABASE() 
                      AND table_name = 'images' 
                      AND index_name = 'idx_images_cos_url');

SET @sql2 = IF(@index_exists2 = 0, 
               'CREATE INDEX idx_images_cos_url ON images(cos_url(255))', 
               'SELECT "Index idx_images_cos_url already exists"');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 验证索引是否创建成功
SHOW INDEX FROM images;
