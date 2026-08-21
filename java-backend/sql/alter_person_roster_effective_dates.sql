-- 人员名单增加按日报日期生效区间；幂等执行。
SET @schema_name = DATABASE();

SET @add_effective_from = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = @schema_name
          AND table_name = 'person_roster'
          AND column_name = 'effective_from'
    ),
    'SELECT 1',
    'ALTER TABLE person_roster ADD COLUMN effective_from DATE NULL COMMENT ''生效日期（含）'' AFTER enabled'
);
PREPARE stmt FROM @add_effective_from;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_effective_to = IF(
    EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = @schema_name
          AND table_name = 'person_roster'
          AND column_name = 'effective_to'
    ),
    'SELECT 1',
    'ALTER TABLE person_roster ADD COLUMN effective_to DATE NULL COMMENT ''失效日期（含）'' AFTER effective_from'
);
PREPARE stmt FROM @add_effective_to;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
