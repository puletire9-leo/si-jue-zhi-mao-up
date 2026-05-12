-- 添加本地缩略图相关字段到final_drafts表
ALTER TABLE final_drafts ADD COLUMN (
    -- 本地缩略图路径
    local_thumbnail_path VARCHAR(255) NULL COMMENT '本地缩略图文件路径',
    -- 本地缩略图状态
    local_thumbnail_status ENUM('pending', 'downloading', 'completed', 'failed') DEFAULT 'pending' COMMENT '本地缩略图下载状态',
    -- 本地缩略图更新时间
    local_thumbnail_updated_at DATETIME NULL COMMENT '本地缩略图更新时间',
    -- 本地缩略图文件大小
    local_thumbnail_size BIGINT NULL COMMENT '本地缩略图文件大小（字节）',
    -- 本地缩略图MD5校验值
    local_thumbnail_md5 VARCHAR(32) NULL COMMENT '本地缩略图MD5校验值'
);

-- 添加索引以提高查询性能
CREATE INDEX idx_local_thumbnail_status ON final_drafts(local_thumbnail_status);
CREATE INDEX idx_local_thumbnail_updated_at ON final_drafts(local_thumbnail_updated_at);

-- 为现有记录设置默认值
UPDATE final_drafts SET local_thumbnail_status = 'pending' WHERE local_thumbnail_status IS NULL;
