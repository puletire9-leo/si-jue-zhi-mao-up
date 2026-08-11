package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingInventoryBatchDetail;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * Daily inventory batch detail snapshot.
 */
@Mapper
public interface LingxingInventoryBatchMapper extends BaseMapper<LingxingInventoryBatchDetail> {

    /**
     * Upsert one batch detail record by biz_key (batch_no|sku|data_date).
     */
    @Insert("""
            INSERT INTO lingxing_inventory_batch_detail (
              biz_key, batch_no, sku, developer, operator, sku_prefix, data_date,
              good_num, good_transit_num, total_num, balance_num, transit_balance_num,
              wh_name, type_name, purchase_in_time, purchase_order_sns, plan_sn,
              raw_json, synced_at, created_at
            ) VALUES (
              SHA2(CONCAT_WS('|', #{row.batchNo}, #{row.sku}, #{row.dataDate}), 256),
              #{row.batchNo}, #{row.sku}, #{row.developer}, #{row.operator}, #{row.skuPrefix}, #{row.dataDate},
              #{row.goodNum}, #{row.goodTransitNum}, #{row.totalNum}, #{row.balanceNum}, #{row.transitBalanceNum},
              #{row.whName}, #{row.typeName}, #{row.purchaseInTime}, #{row.purchaseOrderSns}, #{row.planSn},
              #{row.rawJson}, NOW(), NOW()
            )
            ON DUPLICATE KEY UPDATE
              operator = VALUES(operator),
              good_num = VALUES(good_num),
              good_transit_num = VALUES(good_transit_num),
              total_num = VALUES(total_num),
              balance_num = VALUES(balance_num),
              transit_balance_num = VALUES(transit_balance_num),
              wh_name = VALUES(wh_name),
              type_name = VALUES(type_name),
              purchase_in_time = VALUES(purchase_in_time),
              purchase_order_sns = VALUES(purchase_order_sns),
              plan_sn = VALUES(plan_sn),
              raw_json = VALUES(raw_json),
              synced_at = NOW()
            """)
    int upsert(@Param("row") LingxingInventoryBatchDetail row);

    /** List records for a given date (frontend query). */
    @Select("""
            SELECT * FROM lingxing_inventory_batch_detail
            WHERE data_date = #{dataDate}
            ORDER BY developer, batch_no, sku
            """)
    List<LingxingInventoryBatchDetail> findByDate(@Param("dataDate") String dataDate);

    /** List by developer + date. */
    @Select("""
            SELECT * FROM lingxing_inventory_batch_detail
            WHERE developer = #{developer} AND data_date = #{dataDate}
            ORDER BY batch_no, sku
            """)
    List<LingxingInventoryBatchDetail> findByDeveloperAndDate(
            @Param("developer") String developer,
            @Param("dataDate") String dataDate);

    /** Get distinct dates that have records. */
    @Select("SELECT DISTINCT data_date FROM lingxing_inventory_batch_detail ORDER BY data_date DESC LIMIT 30")
    List<String> distinctDates();
}
