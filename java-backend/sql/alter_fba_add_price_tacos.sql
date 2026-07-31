ALTER TABLE lingxing_developer_fba ADD COLUMN dev_price DECIMAL(18,4) DEFAULT NULL COMMENT '开发人预估售价($)';
ALTER TABLE lingxing_fba_fee_compare ADD COLUMN tacos DECIMAL(18,6) DEFAULT NULL COMMENT '近3月TACOS(广告费占比)';
ALTER TABLE lingxing_fba_fee_compare ADD COLUMN dev_price DECIMAL(18,4) DEFAULT NULL COMMENT '开发人预估售价';
ALTER TABLE lingxing_fba_fee_compare ADD COLUMN actual_price DECIMAL(18,4) DEFAULT NULL COMMENT '实际售价(amount/volume)';
ALTER TABLE lingxing_fba_fee_compare ADD COLUMN price_diff DECIMAL(18,4) DEFAULT NULL COMMENT '售价差额(实际-预估)';
ALTER TABLE lingxing_fba_fee_compare ADD COLUMN price_diff_rate DECIMAL(18,6) DEFAULT NULL COMMENT '售价差额率';
