-- 选品产品表添加等级相关字段（修复版）
-- 创建时间: 2026-05-06
-- 说明: 为 selection_products 表添加 grade, score, week_tag, is_current 字段

-- 检查并添加 grade 字段
SET @grade_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_NAME = 'selection_products' AND COLUMN_NAME = 'grade');
SET @sql = IF(@grade_exists = 0, 
              'ALTER TABLE selection_products ADD COLUMN grade VARCHAR(10) NULL COMMENT "等级（S/A/B/C/D）"',
              'SELECT "grade 字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 score 字段
SET @score_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_NAME = 'selection_products' AND COLUMN_NAME = 'score');
SET @sql = IF(@score_exists = 0, 
              'ALTER TABLE selection_products ADD COLUMN score INT NULL COMMENT "评分（0-100）"',
              'SELECT "score 字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 week_tag 字段
SET @week_tag_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_NAME = 'selection_products' AND COLUMN_NAME = 'week_tag');
SET @sql = IF(@week_tag_exists = 0, 
              'ALTER TABLE selection_products ADD COLUMN week_tag VARCHAR(20) NULL COMMENT "周标记（如2026-W19）"',
              'SELECT "week_tag 字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 is_current 字段
SET @is_current_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                          WHERE TABLE_NAME = 'selection_products' AND COLUMN_NAME = 'is_current');
SET @sql = IF(@is_current_exists = 0, 
              'ALTER TABLE selection_products ADD COLUMN is_current TINYINT DEFAULT 0 COMMENT "是否本周数据（1=本周, 0=往期）"',
              'SELECT "is_current 字段已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 创建索引以提高查询性能（如果不存在）
SET @idx_grade_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                         WHERE TABLE_NAME = 'selection_products' AND INDEX_NAME = 'idx_grade');
SET @sql = IF(@idx_grade_exists = 0, 
              'CREATE INDEX idx_grade ON selection_products(grade)',
              'SELECT "idx_grade 索引已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_score_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                         WHERE TABLE_NAME = 'selection_products' AND INDEX_NAME = 'idx_score');
SET @sql = IF(@idx_score_exists = 0, 
              'CREATE INDEX idx_score ON selection_products(score)',
              'SELECT "idx_score 索引已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_week_tag_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                            WHERE TABLE_NAME = 'selection_products' AND INDEX_NAME = 'idx_week_tag');
SET @sql = IF(@idx_week_tag_exists = 0, 
              'CREATE INDEX idx_week_tag ON selection_products(week_tag)',
              'SELECT "idx_week_tag 索引已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_is_current_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                              WHERE TABLE_NAME = 'selection_products' AND INDEX_NAME = 'idx_is_current');
SET @sql = IF(@idx_is_current_exists = 0, 
              'CREATE INDEX idx_is_current ON selection_products(is_current)',
              'SELECT "idx_is_current 索引已存在"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
