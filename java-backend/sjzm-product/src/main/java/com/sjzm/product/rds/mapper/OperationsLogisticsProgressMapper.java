package com.sjzm.product.rds.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.dataprocessing.logistics.entity.OperationsLogisticsPurchaseProgress;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface OperationsLogisticsProgressMapper extends BaseMapper<OperationsLogisticsPurchaseProgress> {

    @Select("""
            WITH latest_inventory_batch AS (
              SELECT b.*,
                     ROW_NUMBER() OVER (
                       PARTITION BY b.batch_no, b.sku
                       ORDER BY b.data_date DESC, b.id DESC
                     ) AS rn
              FROM lingxing_inventory_batch_detail b
            ), inventory_by_plan AS (
              SELECT ps.plan_sn,
                     b.sku,
                     CAST(JSON_UNQUOTE(JSON_EXTRACT(b.raw_json, '$.wid')) AS UNSIGNED) AS wid,
                     SUM(COALESCE(b.good_num, 0)) AS available_quantity
              FROM latest_inventory_batch b
              JOIN JSON_TABLE(
                b.plan_sn,
                '$[*]' COLUMNS(plan_sn VARCHAR(64) PATH '$')
              ) ps
              WHERE b.rn=1
              GROUP BY ps.plan_sn, b.sku,
                       CAST(JSON_UNQUOTE(JSON_EXTRACT(b.raw_json, '$.wid')) AS UNSIGNED)
            ), inventory_by_order AS (
              SELECT po.order_sn,
                     b.sku,
                     CAST(JSON_UNQUOTE(JSON_EXTRACT(b.raw_json, '$.wid')) AS UNSIGNED) AS wid,
                     SUM(COALESCE(b.good_num, 0)) AS available_quantity
              FROM latest_inventory_batch b
              JOIN JSON_TABLE(
                b.purchase_order_sns,
                '$[*]' COLUMNS(order_sn VARCHAR(64) PATH '$')
              ) po
              WHERE b.rn=1
              GROUP BY po.order_sn, b.sku,
                       CAST(JSON_UNQUOTE(JSON_EXTRACT(b.raw_json, '$.wid')) AS UNSIGNED)
            )
            SELECT
              i.biz_key AS businessKey,
              i.order_sn AS orderSn,
              i.item_id AS itemId,
              i.plan_sn AS planSn,
              pp.ppg_sn AS ppgSn,
              i.sku AS sku,
              o.order_time AS stockTime,
              COALESCE(i.quantity_real, 0) AS purchaseQuantity,
              COALESCE(i.quantity_entry, 0) AS receivedQuantity,
              COALESCE(ip.available_quantity, io.available_quantity, 0) AS availableQuantity,
              COALESCE(o.status_shipped, 0) AS arrivalStatus,
              0 AS linkedPlanCount,
              0 AS validShippedQuantity
            FROM lingxing_purchase_order_item i
            JOIN lingxing_purchase_order o ON o.order_sn=i.order_sn
            LEFT JOIN (
              SELECT plan_sn, MAX(ppg_sn) AS ppg_sn
              FROM lingxing_purchase_plan
              GROUP BY plan_sn
            ) pp ON pp.plan_sn=i.plan_sn
            LEFT JOIN inventory_by_plan ip
              ON ip.plan_sn=i.plan_sn COLLATE utf8mb4_unicode_ci
             AND ip.sku=i.sku COLLATE utf8mb4_unicode_ci
             AND (ip.wid=COALESCE(i.wid, o.wid) OR ip.wid IS NULL)
            LEFT JOIN inventory_by_order io
              ON io.order_sn=i.order_sn COLLATE utf8mb4_unicode_ci
             AND io.sku=i.sku COLLATE utf8mb4_unicode_ci
             AND (io.wid=COALESCE(i.wid, o.wid) OR io.wid IS NULL)
            WHERE COALESCE(i.is_delete, 0)=0
              AND o.status NOT IN (-1, 124)
              AND o.order_time >= #{startDate}
              AND o.order_time <= #{endDate}
            """)
    List<Map<String, Object>> selectCandidates(@Param("startDate") String startDate,
                                               @Param("endDate") String endDate);

    @Select("""
            WITH latest_inventory_batch AS (
              SELECT b.*,
                     ROW_NUMBER() OVER (
                       PARTITION BY b.batch_no, b.sku
                       ORDER BY b.data_date DESC, b.id DESC
                     ) AS rn
              FROM lingxing_inventory_batch_detail b
            ), purchase_batch_link AS (
              SELECT b.sku,
                     CAST(JSON_UNQUOTE(JSON_EXTRACT(b.raw_json, '$.wid')) AS UNSIGNED) AS wid,
                     STR_TO_DATE(b.purchase_in_time, '%Y-%m-%d %H:%i') AS receipt_time,
                     po.order_sn COLLATE utf8mb4_unicode_ci AS order_sn
              FROM latest_inventory_batch b
              JOIN JSON_TABLE(
                b.purchase_order_sns,
                '$[*]' COLUMNS(order_sn VARCHAR(64) PATH '$')
              ) po
              WHERE b.rn=1
                AND b.purchase_in_time IS NOT NULL
                AND b.purchase_in_time<>''
            )
            SELECT i.biz_key AS businessKey,
                   i.order_sn AS orderSn,
                   i.item_id AS itemId,
                   i.sku AS sku,
                   COALESCE(i.wid, o.wid, 0) AS wid,
                   COALESCE(i.quantity_entry, 0) AS receivedQuantity,
                   COALESCE(i.quantity_real, 0) AS purchaseQuantity,
                   MIN(link.receipt_time) AS receiptTime
            FROM lingxing_purchase_order_item i
            JOIN lingxing_purchase_order o ON o.order_sn=i.order_sn
            LEFT JOIN purchase_batch_link link
              ON link.order_sn=i.order_sn COLLATE utf8mb4_unicode_ci
             AND link.sku=i.sku COLLATE utf8mb4_unicode_ci
             AND (link.wid=COALESCE(i.wid, o.wid) OR link.wid IS NULL)
            WHERE COALESCE(i.is_delete, 0)=0
              AND o.status NOT IN (-1, 124)
              AND ((COALESCE(i.quantity_real, 0) > 0
                    AND COALESCE(i.quantity_entry, 0) >= COALESCE(i.quantity_real, 0))
                   OR o.status_shipped=3)
              AND o.order_time<=#{endDate}
            GROUP BY i.biz_key, i.order_sn, i.item_id, i.sku,
                     COALESCE(i.wid, o.wid, 0), i.quantity_entry, i.quantity_real
            HAVING receiptTime IS NOT NULL
               AND receiptTime>=#{startDate}
               AND receiptTime<=#{endDate}
            """)
    List<Map<String, Object>> selectAllocationReceipts(@Param("startDate") String startDate,
                                                       @Param("endDate") String endDate);

    @Select("""
            SELECT sa.ispr_id AS shipmentEventId,
                   sp.sku AS sku,
                   COALESCE(sp.wid, sa.wid, 0) AS wid,
                   sa.shipment_list_quantity AS shippedQuantity,
                   STR_TO_DATE(sa.shipment_time, '%Y-%m-%d %H:%i:%s') AS shipmentTime
            FROM lingxing_shipment_actual sa
            JOIN lingxing_shipment_plan sp ON sp.isp_id=sa.isp_id
            WHERE sa.shipment_status IN (1, 2)
              AND sa.shipment_list_quantity>0
              AND sa.shipment_time IS NOT NULL
              AND sa.shipment_time<>''
              AND STR_TO_DATE(sa.shipment_time, '%Y-%m-%d %H:%i:%s')<=#{endDate}
            ORDER BY shipmentTime, sa.ispr_id
            """)
    List<Map<String, Object>> selectValidShipmentEvents(@Param("endDate") String endDate);

    @Insert("""
            INSERT INTO operations_logistics_purchase_progress (
              business_key, order_sn, item_id, plan_sn, ppg_sn, sku, stock_time,
              purchase_quantity, received_quantity, valid_shipped_quantity,
              available_quantity,
              progress_status, progress_value, follow_up_status, association_status,
              source_hash, terminal, calculated_at
            ) VALUES (
              #{businessKey}, #{orderSn}, #{itemId}, #{planSn}, #{ppgSn}, #{sku}, #{stockTime},
              #{purchaseQuantity}, #{receivedQuantity}, #{validShippedQuantity},
              #{availableQuantity},
              #{progressStatus}, #{progressValue}, #{followUpStatus}, #{associationStatus},
              #{sourceHash}, #{terminal}, #{calculatedAt}
            ) ON DUPLICATE KEY UPDATE
              order_sn=VALUES(order_sn), item_id=VALUES(item_id), plan_sn=VALUES(plan_sn),
              ppg_sn=VALUES(ppg_sn),
              sku=VALUES(sku), stock_time=VALUES(stock_time),
              purchase_quantity=VALUES(purchase_quantity),
              received_quantity=VALUES(received_quantity),
              available_quantity=VALUES(available_quantity),
              valid_shipped_quantity=VALUES(valid_shipped_quantity),
              progress_status=VALUES(progress_status), progress_value=VALUES(progress_value),
              follow_up_status=VALUES(follow_up_status), association_status=VALUES(association_status),
              source_hash=VALUES(source_hash), terminal=VALUES(terminal),
              calculated_at=VALUES(calculated_at), updated_at=NOW()
            """)
    int upsert(OperationsLogisticsPurchaseProgress row);

    @Select("""
            SELECT * FROM operations_logistics_purchase_progress
            WHERE stock_time >= #{startDate}
              AND stock_time <= #{endDate}
            ORDER BY order_sn, item_id
            """)
    List<OperationsLogisticsPurchaseProgress> selectForDelivery(@Param("startDate") String startDate,
                                                                @Param("endDate") String endDate);
}
