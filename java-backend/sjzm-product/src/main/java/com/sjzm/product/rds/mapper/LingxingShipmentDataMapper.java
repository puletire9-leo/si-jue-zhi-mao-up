package com.sjzm.product.rds.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface LingxingShipmentDataMapper {

    @Insert("""
            INSERT INTO lingxing_shipment_plan (
              isp_id, ispg_id, order_sn, seq, sku, msku, fnsku, product_name,
              product_id, pic_url, small_image_url, sid, sname, nation, wid, wname,
              packing_type, packing_type_name, shipment_plan_quantity, shipment_time,
              status, status_name, is_relate_mws, shipment_list_sn, shipment_mws_sn,
              batch_remark, remark, create_user, create_time_remote, raw_json, synced_at
            ) VALUES (
              #{row.ispId}, #{row.ispgId}, #{row.orderSn}, #{row.seq}, #{row.sku},
              #{row.msku}, #{row.fnsku}, #{row.productName}, #{row.productId},
              #{row.picUrl}, #{row.smallImageUrl}, #{row.sid}, #{row.sname}, #{row.nation},
              #{row.wid}, #{row.wname}, #{row.packingType}, #{row.packingTypeName},
              #{row.shipmentPlanQuantity}, #{row.shipmentTime}, #{row.status}, #{row.statusName},
              #{row.isRelateMws}, #{row.shipmentListSn}, #{row.shipmentMwsSn},
              #{row.batchRemark}, #{row.remark}, #{row.createUser}, #{row.createTimeRemote},
              #{row.rawJson}, NOW()
            ) ON DUPLICATE KEY UPDATE
              ispg_id=VALUES(ispg_id), order_sn=VALUES(order_sn), seq=VALUES(seq),
              sku=VALUES(sku), msku=VALUES(msku), fnsku=VALUES(fnsku),
              product_name=VALUES(product_name), product_id=VALUES(product_id),
              pic_url=VALUES(pic_url), small_image_url=VALUES(small_image_url),
              sid=VALUES(sid), sname=VALUES(sname), nation=VALUES(nation),
              wid=VALUES(wid), wname=VALUES(wname), packing_type=VALUES(packing_type),
              packing_type_name=VALUES(packing_type_name),
              shipment_plan_quantity=VALUES(shipment_plan_quantity),
              shipment_time=VALUES(shipment_time), status=VALUES(status),
              status_name=VALUES(status_name), is_relate_mws=VALUES(is_relate_mws),
              shipment_list_sn=VALUES(shipment_list_sn), shipment_mws_sn=VALUES(shipment_mws_sn),
              batch_remark=VALUES(batch_remark), remark=VALUES(remark),
              create_user=VALUES(create_user), create_time_remote=VALUES(create_time_remote),
              raw_json=VALUES(raw_json), synced_at=NOW()
            """)
    int upsertPlan(@Param("row") Map<String, Object> row);

    @Update("""
            UPDATE lingxing_shipment_plan
            SET purchase_order_sn=#{purchaseOrderSn}, purchase_plan_sn=#{purchasePlanSn}
            WHERE isp_id=#{ispId}
            """)
    int bindPlan(@Param("ispId") long ispId,
                 @Param("purchaseOrderSn") String purchaseOrderSn,
                 @Param("purchasePlanSn") String purchasePlanSn);

    @Insert("""
            INSERT INTO lingxing_shipment_actual (
              ispr_id, isp_id, shipment_sn, seq, shipment_plan_sn,
              shipment_plan_quantity, shipment_list_quantity, shipment_mws_quantity,
              shipment_status, shipment_status_name, shipment_time, shipment_id,
              shipment_status_mws, sku, msku, fnsku, product_name, method_name,
              logistics_channel_name, wname, wid, expected_arrival_date, create_user,
              create_time_remote, update_time_remote, relate_id, num, apply_num,
              sname, sid, nation, pic_url, asin, product_id, is_final, raw_json, synced_at
            ) VALUES (
              #{row.isprId}, #{row.ispId}, #{row.shipmentSn}, #{row.seq},
              #{row.shipmentPlanSn}, #{row.shipmentPlanQuantity},
              #{row.shipmentListQuantity}, #{row.shipmentMwsQuantity},
              #{row.shipmentStatus}, #{row.shipmentStatusName}, #{row.shipmentTime},
              #{row.shipmentId}, #{row.shipmentStatusMws}, #{row.sku}, #{row.msku},
              #{row.fnsku}, #{row.productName}, #{row.methodName},
              #{row.logisticsChannelName}, #{row.wname}, #{row.wid}, #{row.expectedArrivalDate},
              #{row.createUser}, #{row.createTimeRemote}, #{row.updateTimeRemote},
              #{row.relateId}, #{row.num}, #{row.applyNum}, #{row.sname}, #{row.sid},
              #{row.nation}, #{row.picUrl}, #{row.asin}, #{row.productId}, #{row.isFinal},
              #{row.rawJson}, NOW()
            ) ON DUPLICATE KEY UPDATE
              isp_id=VALUES(isp_id), shipment_sn=VALUES(shipment_sn), seq=VALUES(seq),
              shipment_plan_sn=VALUES(shipment_plan_sn),
              shipment_plan_quantity=VALUES(shipment_plan_quantity),
              shipment_list_quantity=VALUES(shipment_list_quantity),
              shipment_mws_quantity=VALUES(shipment_mws_quantity),
              shipment_status=VALUES(shipment_status),
              shipment_status_name=VALUES(shipment_status_name),
              shipment_time=VALUES(shipment_time), shipment_id=VALUES(shipment_id),
              shipment_status_mws=VALUES(shipment_status_mws), sku=VALUES(sku),
              msku=VALUES(msku), fnsku=VALUES(fnsku), product_name=VALUES(product_name),
              method_name=VALUES(method_name),
              logistics_channel_name=VALUES(logistics_channel_name),
              wname=VALUES(wname), wid=VALUES(wid),
              expected_arrival_date=VALUES(expected_arrival_date), create_user=VALUES(create_user),
              create_time_remote=VALUES(create_time_remote), update_time_remote=VALUES(update_time_remote),
              relate_id=VALUES(relate_id), num=VALUES(num), apply_num=VALUES(apply_num),
              sname=VALUES(sname), sid=VALUES(sid), nation=VALUES(nation),
              pic_url=VALUES(pic_url), asin=VALUES(asin), product_id=VALUES(product_id),
              is_final=VALUES(is_final),
              raw_json=VALUES(raw_json), synced_at=NOW()
            """)
    int upsertActual(@Param("row") Map<String, Object> row);

    @Select("""
            SELECT DISTINCT i.sku
            FROM lingxing_purchase_order_item i
            JOIN lingxing_purchase_order o ON o.order_sn=i.order_sn
            WHERE COALESCE(i.is_delete, 0)=0
              AND i.sku IS NOT NULL AND i.sku<>''
              AND o.status NOT IN (-1, 124)
              AND o.status_shipped=3
              AND o.order_time >= #{startDate}
              AND o.order_time <= #{endDate}
            ORDER BY i.sku
            """)
    List<String> selectTrackedSkus(@Param("startDate") String startDate,
                                   @Param("endDate") String endDate);

    /**
     * 查询无法关联 SP 的采购 SKU（用于 SKU 补偿）
     * 条件：有采购入库但没有关联的 SP 计划
     */
    @Select("""
            SELECT DISTINCT i.sku
            FROM lingxing_purchase_order_item i
            JOIN lingxing_purchase_order o ON o.order_sn=i.order_sn
            LEFT JOIN lingxing_shipment_plan p ON p.sku=i.sku AND p.purchase_order_sn=i.order_sn
            WHERE COALESCE(i.is_delete, 0)=0
              AND i.sku IS NOT NULL AND i.sku<>''
              AND o.status NOT IN (-1, 124)
              AND o.status_shipped=3
              AND o.order_time >= #{startDate}
              AND o.order_time <= #{endDate}
              AND p.id IS NULL
            LIMIT 100
            """)
    List<String> selectUnlinkedPurchaseSkus(@Param("startDate") String startDate,
                                            @Param("endDate") String endDate);
}
