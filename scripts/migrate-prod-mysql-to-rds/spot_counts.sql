SELECT 'person_roster' AS t, COUNT(*) AS n FROM person_roster
UNION ALL SELECT 'automation_run', COUNT(*) FROM automation_run
UNION ALL SELECT 'competitor_products', COUNT(*) FROM competitor_products
UNION ALL SELECT 'shop_products', COUNT(*) FROM shop_products
UNION ALL SELECT 'asin_import_results', COUNT(*) FROM asin_import_results
UNION ALL SELECT 'final_drafts', COUNT(*) FROM final_drafts
UNION ALL SELECT 'images', COUNT(*) FROM images;
