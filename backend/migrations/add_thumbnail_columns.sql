-- 为 images 表添加缩略图相关列
ALTER TABLE images
    ADD COLUMN IF NOT EXISTS thumbnail_cos_key VARCHAR(512) DEFAULT '' COMMENT '缩略图COS对象键',
    ADD COLUMN IF NOT EXISTS thumbnail_cos_url VARCHAR(1024) DEFAULT '' COMMENT '缩略图COS访问URL',
    ADD COLUMN IF NOT EXISTS thumbnail_local_path VARCHAR(512) DEFAULT '' COMMENT '缩略图本地存储路径';
