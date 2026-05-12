-- 更新素材库表，添加 final_draft_images 字段
ALTER TABLE material_library
ADD COLUMN IF NOT EXISTS final_draft_images TEXT COMMENT '设计稿图片URL列表，JSON格式';

-- 更新素材库回收站表，添加 final_draft_images 字段
ALTER TABLE material_library_recycle_bin
ADD COLUMN IF NOT EXISTS final_draft_images TEXT COMMENT '设计稿图片URL列表，JSON格式';
