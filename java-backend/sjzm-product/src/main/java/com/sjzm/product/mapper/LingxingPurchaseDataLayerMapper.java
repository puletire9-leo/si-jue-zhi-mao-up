package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * Lingxing purchase fact tables.
 *
 * Purchase plans are the planned quantity source. Purchase order items are the
 * exact purchased/received quantity source for Q1/Q2.
 */
@Mapper
public interface LingxingPurchaseDataLayerMapper {

    @Insert("""
            INSERT INTO lingxing_purchase_plan (
              biz_key, plan_sn, ppg_sn, status, status_text, sku, product_id, product_name,
              spu, spu_name, sid, seller_name, marketplace_raw, fnsku, msku_json,
              supplier_id, supplier_name, wid, warehouse_name, purchaser_id, purchaser_name,
              cg_box_pcs, quantity_plan, expect_arrive_time, create_time,
              creator_uid, creator_real_name, cg_uid, cg_opt_username, remark, plan_remark,
              is_combo, is_aux, is_related_process_plan, attribute_json, file_json,
              perm_uid_json, perm_username_json, source_run_id, raw_json, synced_at
            ) VALUES (
              SHA2(CONCAT_WS('|', #{row.planSn}, #{row.sku}, COALESCE(#{row.sid}, ''), COALESCE(#{row.wid}, '')), 256),
              #{row.planSn}, #{row.ppgSn}, #{row.status}, #{row.statusText}, #{row.sku},
              #{row.productId}, #{row.productName}, #{row.spu}, #{row.spuName}, #{row.sid},
              #{row.sellerName}, #{row.marketplaceRaw}, #{row.fnsku}, #{row.mskuJson},
              #{row.supplierId}, #{row.supplierName}, #{row.wid}, #{row.warehouseName},
              #{row.purchaserId}, #{row.purchaserName}, #{row.cgBoxPcs}, #{row.quantityPlan},
              NULLIF(#{row.expectArriveTime}, ''), NULLIF(#{row.createTime}, ''),
              #{row.creatorUid}, #{row.creatorRealName}, #{row.cgUid}, #{row.cgOptUsername},
              #{row.remark}, #{row.planRemark}, #{row.isCombo}, #{row.isAux}, #{row.isRelatedProcessPlan},
              #{row.attributeJson}, #{row.fileJson}, #{row.permUidJson}, #{row.permUsernameJson},
              #{sourceRunId}, #{row.rawJson}, NOW()
            )
            ON DUPLICATE KEY UPDATE
              ppg_sn = VALUES(ppg_sn),
              status = VALUES(status),
              status_text = VALUES(status_text),
              product_id = VALUES(product_id),
              product_name = VALUES(product_name),
              spu = VALUES(spu),
              spu_name = VALUES(spu_name),
              sid = VALUES(sid),
              seller_name = VALUES(seller_name),
              marketplace_raw = VALUES(marketplace_raw),
              fnsku = VALUES(fnsku),
              msku_json = VALUES(msku_json),
              supplier_id = VALUES(supplier_id),
              supplier_name = VALUES(supplier_name),
              wid = VALUES(wid),
              warehouse_name = VALUES(warehouse_name),
              purchaser_id = VALUES(purchaser_id),
              purchaser_name = VALUES(purchaser_name),
              cg_box_pcs = VALUES(cg_box_pcs),
              quantity_plan = VALUES(quantity_plan),
              expect_arrive_time = VALUES(expect_arrive_time),
              create_time = VALUES(create_time),
              creator_uid = VALUES(creator_uid),
              creator_real_name = VALUES(creator_real_name),
              cg_uid = VALUES(cg_uid),
              cg_opt_username = VALUES(cg_opt_username),
              remark = VALUES(remark),
              plan_remark = VALUES(plan_remark),
              is_combo = VALUES(is_combo),
              is_aux = VALUES(is_aux),
              is_related_process_plan = VALUES(is_related_process_plan),
              attribute_json = VALUES(attribute_json),
              file_json = VALUES(file_json),
              perm_uid_json = VALUES(perm_uid_json),
              perm_username_json = VALUES(perm_username_json),
              source_run_id = VALUES(source_run_id),
              raw_json = VALUES(raw_json),
              synced_at = NOW(),
              updated_at = NOW()
            """)
    int upsertPurchasePlan(@Param("row") Map<String, Object> row,
                           @Param("sourceRunId") String sourceRunId);

    @Insert("""
            INSERT INTO lingxing_purchase_order (
              biz_key, order_sn, custom_order_sn, supplier_id, supplier_name,
              opt_uid, opt_realname, last_uid, last_realname, auditor_uid, auditor_realname,
              create_time, order_time, auditor_time, last_time, update_time,
              status, status_text, status_shipped, status_shipped_text, pay_status, pay_status_text,
              purchase_type, purchase_type_text, purchase_currency, purchase_rate,
              amount_total, total_price, payment, other_fee, shipping_price,
              quantity_total, quantity_real, quantity_entry, quantity_receive,
              wid, ware_house_name, ware_house_bak_name, purchaser_id,
              settlement_method, settlement_description, remark, reason,
              principal_uids_json, custom_fields_json, logistics_info_json,
              source_run_id, raw_json, synced_at
            ) VALUES (
              SHA2(#{row.orderSn}, 256), #{row.orderSn}, #{row.customOrderSn},
              #{row.supplierId}, #{row.supplierName}, #{row.optUid}, #{row.optRealname},
              #{row.lastUid}, #{row.lastRealname}, #{row.auditorUid}, #{row.auditorRealname},
              NULLIF(#{row.createTime}, ''), NULLIF(#{row.orderTime}, ''), NULLIF(#{row.auditorTime}, ''),
              NULLIF(#{row.lastTime}, ''), NULLIF(#{row.updateTime}, ''),
              #{row.status}, #{row.statusText}, #{row.statusShipped}, #{row.statusShippedText},
              #{row.payStatus}, #{row.payStatusText}, #{row.purchaseType}, #{row.purchaseTypeText},
              #{row.purchaseCurrency}, #{row.purchaseRate}, #{row.amountTotal}, #{row.totalPrice},
              #{row.payment}, #{row.otherFee}, #{row.shippingPrice}, #{row.quantityTotal},
              #{row.quantityReal}, #{row.quantityEntry}, #{row.quantityReceive}, #{row.wid},
              #{row.wareHouseName}, #{row.wareHouseBakName}, #{row.purchaserId},
              #{row.settlementMethod}, #{row.settlementDescription}, #{row.remark}, #{row.reason},
              #{row.principalUidsJson}, #{row.customFieldsJson}, #{row.logisticsInfoJson},
              #{sourceRunId}, #{row.rawJson}, NOW()
            )
            ON DUPLICATE KEY UPDATE
              custom_order_sn = VALUES(custom_order_sn),
              supplier_id = VALUES(supplier_id),
              supplier_name = VALUES(supplier_name),
              opt_uid = VALUES(opt_uid),
              opt_realname = VALUES(opt_realname),
              last_uid = VALUES(last_uid),
              last_realname = VALUES(last_realname),
              auditor_uid = VALUES(auditor_uid),
              auditor_realname = VALUES(auditor_realname),
              create_time = VALUES(create_time),
              order_time = VALUES(order_time),
              auditor_time = VALUES(auditor_time),
              last_time = VALUES(last_time),
              update_time = VALUES(update_time),
              status = VALUES(status),
              status_text = VALUES(status_text),
              status_shipped = VALUES(status_shipped),
              status_shipped_text = VALUES(status_shipped_text),
              pay_status = VALUES(pay_status),
              pay_status_text = VALUES(pay_status_text),
              purchase_type = VALUES(purchase_type),
              purchase_type_text = VALUES(purchase_type_text),
              purchase_currency = VALUES(purchase_currency),
              purchase_rate = VALUES(purchase_rate),
              amount_total = VALUES(amount_total),
              total_price = VALUES(total_price),
              payment = VALUES(payment),
              other_fee = VALUES(other_fee),
              shipping_price = VALUES(shipping_price),
              quantity_total = VALUES(quantity_total),
              quantity_real = VALUES(quantity_real),
              quantity_entry = VALUES(quantity_entry),
              quantity_receive = VALUES(quantity_receive),
              wid = VALUES(wid),
              ware_house_name = VALUES(ware_house_name),
              ware_house_bak_name = VALUES(ware_house_bak_name),
              purchaser_id = VALUES(purchaser_id),
              settlement_method = VALUES(settlement_method),
              settlement_description = VALUES(settlement_description),
              remark = VALUES(remark),
              reason = VALUES(reason),
              principal_uids_json = VALUES(principal_uids_json),
              custom_fields_json = VALUES(custom_fields_json),
              logistics_info_json = VALUES(logistics_info_json),
              source_run_id = VALUES(source_run_id),
              raw_json = VALUES(raw_json),
              synced_at = NOW(),
              updated_at = NOW()
            """)
    int upsertPurchaseOrder(@Param("row") Map<String, Object> row,
                            @Param("sourceRunId") String sourceRunId);

    @Insert("""
            INSERT INTO lingxing_purchase_order_item (
              biz_key, order_sn, custom_order_sn, item_id, plan_sn, relation_purchase_plan_json,
              product_id, product_name, sku, fnsku, sid, msku_json, wid, ware_house_name,
              model, price, amount, quantity_plan, quantity_real, quantity_entry, quantity_receive,
              quantity_return, quantity_exchange, quantity_qc, quantity_qc_prepare,
              expect_arrive_time, cases_num, quantity_per_case, is_delete,
              spu, spu_name, attribute_json, custom_fields_json, remark,
              source_run_id, raw_json, synced_at
            ) VALUES (
              SHA2(CONCAT_WS('|', #{row.orderSn}, COALESCE(#{row.itemId}, ''), #{row.sku}, COALESCE(#{row.planSn}, '')), 256),
              #{row.orderSn}, #{row.customOrderSn}, #{row.itemId}, #{row.planSn},
              #{row.relationPurchasePlanJson}, #{row.productId}, #{row.productName}, #{row.sku},
              #{row.fnsku}, #{row.sid}, #{row.mskuJson}, #{row.wid}, #{row.wareHouseName},
              #{row.model}, #{row.price}, #{row.amount}, #{row.quantityPlan}, #{row.quantityReal},
              #{row.quantityEntry}, #{row.quantityReceive}, #{row.quantityReturn}, #{row.quantityExchange},
              #{row.quantityQc}, #{row.quantityQcPrepare}, NULLIF(#{row.expectArriveTime}, ''),
              #{row.casesNum}, #{row.quantityPerCase}, #{row.isDelete}, #{row.spu}, #{row.spuName},
              #{row.attributeJson}, #{row.customFieldsJson}, #{row.remark},
              #{sourceRunId}, #{row.rawJson}, NOW()
            )
            ON DUPLICATE KEY UPDATE
              custom_order_sn = VALUES(custom_order_sn),
              plan_sn = VALUES(plan_sn),
              relation_purchase_plan_json = VALUES(relation_purchase_plan_json),
              product_id = VALUES(product_id),
              product_name = VALUES(product_name),
              fnsku = VALUES(fnsku),
              sid = VALUES(sid),
              msku_json = VALUES(msku_json),
              wid = VALUES(wid),
              ware_house_name = VALUES(ware_house_name),
              model = VALUES(model),
              price = VALUES(price),
              amount = VALUES(amount),
              quantity_plan = VALUES(quantity_plan),
              quantity_real = VALUES(quantity_real),
              quantity_entry = VALUES(quantity_entry),
              quantity_receive = VALUES(quantity_receive),
              quantity_return = VALUES(quantity_return),
              quantity_exchange = VALUES(quantity_exchange),
              quantity_qc = VALUES(quantity_qc),
              quantity_qc_prepare = VALUES(quantity_qc_prepare),
              expect_arrive_time = VALUES(expect_arrive_time),
              cases_num = VALUES(cases_num),
              quantity_per_case = VALUES(quantity_per_case),
              is_delete = VALUES(is_delete),
              spu = VALUES(spu),
              spu_name = VALUES(spu_name),
              attribute_json = VALUES(attribute_json),
              custom_fields_json = VALUES(custom_fields_json),
              remark = VALUES(remark),
              source_run_id = VALUES(source_run_id),
              raw_json = VALUES(raw_json),
              synced_at = NOW(),
              updated_at = NOW()
            """)
    int upsertPurchaseOrderItem(@Param("row") Map<String, Object> row,
                                @Param("sourceRunId") String sourceRunId);

    @Select("""
            SELECT 'lingxing_purchase_plan' AS tableName,
                   COUNT(*) AS rowsCount,
                   COUNT(DISTINCT sku) AS distinctSku,
                   SUM(COALESCE(quantity_plan, 0)) AS quantity
            FROM lingxing_purchase_plan
            UNION ALL
            SELECT 'lingxing_purchase_order' AS tableName,
                   COUNT(*) AS rowsCount,
                   NULL AS distinctSku,
                   SUM(COALESCE(quantity_real, 0)) AS quantity
            FROM lingxing_purchase_order
            UNION ALL
            SELECT 'lingxing_purchase_order_item' AS tableName,
                   COUNT(*) AS rowsCount,
                   COUNT(DISTINCT sku) AS distinctSku,
                   SUM(COALESCE(quantity_real, 0)) AS quantity
            FROM lingxing_purchase_order_item
            """)
    List<Map<String, Object>> stats();

    /** Returns completed, non-deleted purchase batches for the active target SKU pool. */
    @Select("""
            <script>
            SELECT
              i.sku AS sku,
              i.order_sn AS orderSn,
              i.item_id AS itemId,
              COALESCE(o.order_time, o.create_time) AS orderTime,
              i.sid AS sid,
              i.wid AS wid,
              i.quantity_real AS quantityReal,
              i.quantity_entry AS quantityEntry,
              i.quantity_receive AS quantityReceive,
              o.status AS status,
              o.status_shipped AS statusShipped
            FROM lingxing_purchase_order_item i
            JOIN lingxing_purchase_order o ON o.order_sn = i.order_sn
            WHERE (i.is_delete IS NULL OR i.is_delete = 0)
              AND i.quantity_real &gt; 0
              AND o.status = 9
              AND o.status_shipped = 3
              AND COALESCE(o.order_time, o.create_time) &gt;= #{startDate}
              AND COALESCE(o.order_time, o.create_time) &lt; DATE_ADD(#{endDate}, INTERVAL 1 DAY)
              AND EXISTS (
                SELECT 1
                FROM lingxing_target_sku_pool t
                WHERE t.snapshot_week = COALESCE(
                    #{snapshotWeek},
                    (SELECT MAX(snapshot_week) FROM lingxing_target_sku_pool))
                  AND t.is_active = 1
                  AND t.sku = i.sku
              )
            ORDER BY i.sku, COALESCE(o.order_time, o.create_time), i.order_sn, i.item_id
            </script>
            """)
    List<Map<String, Object>> selectCompletedPurchaseFacts(@Param("startDate") String startDate,
                                                            @Param("endDate") String endDate,
                                                            @Param("snapshotWeek") String snapshotWeek);

    @Select("""
            SELECT COUNT(DISTINCT sku)
            FROM lingxing_target_sku_pool
            WHERE snapshot_week = COALESCE(
                #{snapshotWeek},
                (SELECT MAX(snapshot_week) FROM lingxing_target_sku_pool))
              AND is_active = 1
            """)
    Long countActiveTargetSkus(@Param("snapshotWeek") String snapshotWeek);

    @Select("""
            SELECT
              sku AS sku,
              week_start AS weekStart,
              week_end AS weekEnd,
              volume AS volume,
              gross_profit AS grossProfit,
              afn_fulfillable_quantity AS afnFulfillableQuantity,
              tags AS tags,
              sid AS sid,
              marketplace AS marketplace
            FROM lingxing_sku_weekly_performance
            WHERE week_start &lt; DATE_ADD(#{endDate}, INTERVAL 1 DAY)
              AND week_end &gt;= #{startDate}
            ORDER BY sku, week_start
            """)
    List<Map<String, Object>> selectWeeklyFacts(@Param("startDate") String startDate,
                                                @Param("endDate") String endDate);
}
