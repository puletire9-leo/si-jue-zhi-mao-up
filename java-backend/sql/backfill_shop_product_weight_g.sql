-- 店铺商品重量标准化回填（可重复执行）。
-- 背景：早期店铺同步只写 weight 文本，未写派生列 weight_g，导致 M01 的重量硬门槛将全部商品排除。
-- 口径与 ProductFeatureProcessor.extractWeightGrams 一致：g / kg / pounds / ounces。

UPDATE shop_products
SET weight_g = CASE
    WHEN LOWER(weight) REGEXP '[0-9]+([.][0-9]+)?[[:space:]]*kg' THEN
        CAST(REGEXP_SUBSTR(LOWER(weight), '[0-9]+([.][0-9]+)?') AS DECIMAL(10,2)) * 1000
    WHEN LOWER(weight) REGEXP '[0-9]+([.][0-9]+)?[[:space:]]*pounds' THEN
        CAST(REGEXP_SUBSTR(LOWER(weight), '[0-9]+([.][0-9]+)?') AS DECIMAL(10,2)) * 453.592
    WHEN LOWER(weight) REGEXP '[0-9]+([.][0-9]+)?[[:space:]]*ounces' THEN
        CAST(REGEXP_SUBSTR(LOWER(weight), '[0-9]+([.][0-9]+)?') AS DECIMAL(10,2)) * 28.3495
    WHEN LOWER(weight) REGEXP '[0-9]+([.][0-9]+)?[[:space:]]*g' THEN
        CAST(REGEXP_SUBSTR(LOWER(weight), '[0-9]+([.][0-9]+)?') AS DECIMAL(10,2))
    ELSE NULL
END,
updated_at = NOW()
WHERE weight_g IS NULL
  AND weight IS NOT NULL
  AND TRIM(weight) <> '';
