-- 用户筛选预设增加国家(站点)维度：每个国家独立 9 槽位
-- 唯一键由 (user_id, preset_index) 改为 (user_id, marketplace, preset_index)

ALTER TABLE user_filter_presets
  ADD COLUMN marketplace VARCHAR(8) NOT NULL DEFAULT 'UK' COMMENT '站点/国家代码' AFTER user_id;

-- 现有行回填为 UK（默认站点）
UPDATE user_filter_presets SET marketplace = 'UK' WHERE marketplace IS NULL OR marketplace = '';

-- 替换唯一键
ALTER TABLE user_filter_presets DROP INDEX uk_user_index;
ALTER TABLE user_filter_presets
  ADD UNIQUE KEY uk_user_market_index (user_id, marketplace, preset_index);
