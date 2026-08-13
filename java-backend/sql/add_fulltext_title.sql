-- FULLTEXT 索引实验（提速 B）2026-08-04
-- 给 shop_products / competitor_products_clean 的 title 建 FULLTEXT。
-- 标题 EN/DE 拉丁字符，无需 ngram parser。min_token_size=3（tin/sign/metal 均≥3，OK）。
-- 首个 FULLTEXT 索引会触发表重建，634k+219k 行约 500s；期间有锁，选空闲窗口执行。
--
-- ⚠️ 实验结论（2026-08-04，tiepihua LIKE=393 为基准）：
--   · 短语模式 "metal sign" → 漏复数 "metal signs"，召回仅 78.9%（漏83）。
--   · 词元模式 +metal* +sign* → 召回 100% 但 +266 污染（丢了相邻词约束，
--     "Metal Butterfly Wall Art" 也命中 +metal*+wall*+art*）。
--   MySQL InnoDB FULLTEXT 无词干还原、无法复现 LIKE '%相邻短语%' 语义。
--   → 决定：harvest 召回**不切换** MATCH，保留 A+C 的 LIKE 方案（已够快，~176s）。
--   本索引保留（无害，未来可用于自由文本搜索框），但当前 harvest SQL 不引用它。
CREATE FULLTEXT INDEX ft_title ON shop_products(title);
CREATE FULLTEXT INDEX ft_title ON competitor_products_clean(title);
