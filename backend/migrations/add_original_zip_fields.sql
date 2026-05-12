-- 添加原始图片zip包字段到images表
ALTER TABLE `images` 
ADD COLUMN `original_zip_filepath` VARCHAR(255) DEFAULT NULL COMMENT '原始图片zip包路径',
ADD COLUMN `original_zip_cos_key` VARCHAR(255) DEFAULT NULL COMMENT '原始图片zip包COS对象键';

-- 添加索引以提高查询性能
ALTER TABLE `images` 
ADD INDEX `idx_original_zip_filepath` (`original_zip_filepath`),
ADD INDEX `idx_original_zip_cos_key` (`original_zip_cos_key`);
