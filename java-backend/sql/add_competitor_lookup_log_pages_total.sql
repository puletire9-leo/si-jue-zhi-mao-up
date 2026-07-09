-- =================================================================
-- competitor_lookup_log 补齐 API 翻页统计列
-- 背景：CompetitorLookupLog entity 已包含 pages/total，生产旧表缺列会被 SchemaGuard 拦截。
-- 幂等可重跑：全部 information_schema 守卫。
-- =================================================================

SET @schema_name = DATABASE();

SET @sql = IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_lookup_log'
       AND COLUMN_NAME = 'pages') = 0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN pages INT NULL DEFAULT 0 COMMENT ''卖家精灵接口翻页次数'' AFTER took_ms',
    'SELECT ''competitor_lookup_log.pages exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(1) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @schema_name
       AND TABLE_NAME = 'competitor_lookup_log'
       AND COLUMN_NAME = 'total') = 0,
    'ALTER TABLE competitor_lookup_log ADD COLUMN total INT NULL DEFAULT 0 COMMENT ''卖家精灵接口返回总数'' AFTER pages',
    'SELECT ''competitor_lookup_log.total exists'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
