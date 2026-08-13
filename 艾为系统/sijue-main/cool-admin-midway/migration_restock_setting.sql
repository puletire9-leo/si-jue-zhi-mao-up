ALTER TABLE app_amz_bsr_product_listing_lingxing
  ADD COLUMN restock_setting_type tinyint NOT NULL DEFAULT 0 COMMENT '补货设置类型 0-正常 1-不再补货 2-未来补货',
  ADD COLUMN future_restock_date date NULL COMMENT '未来补货日期(在此日期前不显示)';
