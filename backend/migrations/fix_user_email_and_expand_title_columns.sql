-- 2026-06-24: 用户邮箱改为可空，并扩展长标题字段长度
-- 解决问题:
-- 1. 用户管理/注册已不再强制填写邮箱，但 users.email 仍为 NOT NULL
-- 2. 德语 ASIN / 文件链接标题可能超过 500 字符
-- 3. 品线选品依赖 deng_zong_shop.batch_date

ALTER TABLE users
    MODIFY COLUMN email VARCHAR(100) NULL COMMENT '邮箱（可为空）';

ALTER TABLE asin_import_results
    MODIFY COLUMN title VARCHAR(1000);

ALTER TABLE deng_zong_shop
    MODIFY COLUMN title VARCHAR(1000);

ALTER TABLE product_30day_new
    MODIFY COLUMN title VARCHAR(1000);

ALTER TABLE file_links
    MODIFY COLUMN title VARCHAR(1000) NOT NULL COMMENT '链接标题';

ALTER TABLE deng_zong_shop
    ADD COLUMN IF NOT EXISTS batch_date VARCHAR(10) DEFAULT NULL AFTER source;
