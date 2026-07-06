-- ============================================================
-- 竞品店铺品级改造：新增 m01_active 标记字段
-- 用途：标记商品是否命中 M01 合格标准（够新且达标），供竞品店铺品级
--       （方法卡命中数）复用，避免每次全表实时算 DATEDIFF。
-- 维护：导入时按 M01Rule 补标；每日 0 点摘标上架超 90 天的过期品。
-- 说明：不碰 filter_mode（入库冻结快照，别处在用）。两张表都要加。
-- ============================================================

-- 原始表
ALTER TABLE competitor_products
    ADD COLUMN m01_active TINYINT NOT NULL DEFAULT 0
    COMMENT 'M01合格标记:1=命中(够新且达标),0=否。导入补标+每日摘标' AFTER is_current;

-- 店铺品级排名查询用：按 (marketplace, m01_active, seller_name) 命中集聚合
CREATE INDEX idx_m01_active_seller
    ON competitor_products (marketplace, m01_active, seller_name);

-- 每日摘标扫描用：快速定位 m01_active=1 的候选行
CREATE INDEX idx_m01_active_avail
    ON competitor_products (m01_active, available_date);

-- 清洗表（代表行，实际店铺排名走这张，已去变体污染）
ALTER TABLE competitor_products_clean
    ADD COLUMN m01_active TINYINT NOT NULL DEFAULT 0
    COMMENT 'M01合格标记(父群组任一变体命中即1)' AFTER is_current;

CREATE INDEX idx_m01_active_seller_clean
    ON competitor_products_clean (marketplace, m01_active, seller_name);

CREATE INDEX idx_m01_active_avail_clean
    ON competitor_products_clean (m01_active, available_date);
