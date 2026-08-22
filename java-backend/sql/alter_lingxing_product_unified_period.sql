-- 把旧名 lingxing_product_unified_daily 收成 lingxing_product_unified_period，
-- 并让时间列叫 period_start / period_end，避免看起来只有日数据。
-- 已有行视为日精度：起止都等于原 data_date。

ALTER TABLE `lingxing_product_unified_daily`
    ADD COLUMN `period_end` DATE NULL COMMENT '时间窗结束' AFTER `data_date`;

UPDATE `lingxing_product_unified_daily`
SET `period_end` = `data_date`
WHERE `period_end` IS NULL;

ALTER TABLE `lingxing_product_unified_daily`
    DROP PRIMARY KEY;

ALTER TABLE `lingxing_product_unified_daily`
    CHANGE COLUMN `data_date` `period_start` DATE NOT NULL COMMENT '时间窗开始',
    MODIFY `period_end` DATE NOT NULL COMMENT '时间窗结束';

ALTER TABLE `lingxing_product_unified_daily`
    ADD PRIMARY KEY (`period_start`, `period_end`, `marketplace`, `asin`);

RENAME TABLE `lingxing_product_unified_daily` TO `lingxing_product_unified_period`;
