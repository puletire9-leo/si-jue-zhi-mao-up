-- 从统一表重建 SKU 前缀→开发人映射（替换测试数据）
-- 2026-08-12
USE sijuelishi;

TRUNCATE TABLE lingxing_developer_sku_prefix;

INSERT INTO lingxing_developer_sku_prefix (developer, sku_prefix, asin_count)
SELECT developer, LEFT(base_sku, 3) AS sku_prefix, COUNT(*) AS asin_count
FROM lingxing_product_unified
WHERE developer IS NOT NULL AND developer <> ''
  AND base_sku IS NOT NULL AND base_sku <> ''
GROUP BY developer, LEFT(base_sku, 3)
ORDER BY developer, sku_prefix;

SELECT developer, sku_prefix, asin_count FROM lingxing_developer_sku_prefix ORDER BY developer, sku_prefix;
