SELECT 'lingxing_automation_request_registry' AS t, COUNT(*) AS n FROM lingxing_automation_request_registry
UNION ALL SELECT 'lingxing_request_task', COUNT(*) FROM lingxing_request_task
UNION ALL SELECT 'lingxing_purchase_plan', COUNT(*) FROM lingxing_purchase_plan
UNION ALL SELECT 'lingxing_purchase_order', COUNT(*) FROM lingxing_purchase_order
UNION ALL SELECT 'lingxing_purchase_order_item', COUNT(*) FROM lingxing_purchase_order_item
UNION ALL SELECT 'lingxing_inventory_batch_detail', COUNT(*) FROM lingxing_inventory_batch_detail
UNION ALL SELECT 'lingxing_shipment_plan', COUNT(*) FROM lingxing_shipment_plan
UNION ALL SELECT 'lingxing_product_performance', COUNT(*) FROM lingxing_product_performance
UNION ALL SELECT 'lingxing_product_performance_daily', COUNT(*) FROM lingxing_product_performance_daily;
