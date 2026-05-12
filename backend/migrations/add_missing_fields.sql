-- 为 carrier_library_recycle_bin 表添加缺失的字段（如果不存在）
ALTER TABLE carrier_library_recycle_bin ADD COLUMN IF NOT EXISTS element VARCHAR(255) DEFAULT NULL COMMENT '元素';
ALTER TABLE carrier_library_recycle_bin ADD COLUMN IF NOT EXISTS modification_requirement TEXT DEFAULT NULL COMMENT '修改需求';
