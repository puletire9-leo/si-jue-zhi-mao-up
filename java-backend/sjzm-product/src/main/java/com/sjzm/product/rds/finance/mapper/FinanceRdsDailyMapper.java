package com.sjzm.product.rds.finance.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductPerformanceDaily;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/** 财务日报 RDS 日事实读写。 */
@Mapper
public interface FinanceRdsDailyMapper extends BaseMapper<LingxingProductPerformanceDaily> {

    /** RDS 批量写入日事实，避免数千次单行网络往返。 */
    @Insert("""
            <script>
            INSERT INTO lingxing_product_performance_daily
                (biz_key, summary_field, summary_value, sid_scope, asin, parent_asin, msku, sku,
                 item_name, currency_code, marketplace, data_date, principal_names, developer_names,
                 store_names, tag_names, product_create_time, volume, order_items, amount,
                 gross_profit, gross_margin, sessions_total, clicks, impressions, ad_order_quantity,
                 ad_sales_amount, spend, tacos, afn_fulfillable_quantity, available_inventory,
                 return_amount, avg_custom_price, raw_json, synced_at)
            VALUES
            <foreach collection="rows" item="row" separator=",">
                (#{row.bizKey}, #{row.summaryField}, #{row.summaryValue}, #{row.sidScope},
                 #{row.asin}, #{row.parentAsin}, #{row.msku}, #{row.sku}, #{row.itemName},
                 #{row.currencyCode}, #{row.marketplace}, #{row.dataDate}, #{row.principalNames},
                 #{row.developerNames}, #{row.storeNames}, #{row.tagNames}, #{row.productCreateTime},
                 #{row.volume}, #{row.orderItems}, #{row.amount}, #{row.grossProfit}, #{row.grossMargin},
                 #{row.sessionsTotal}, #{row.clicks}, #{row.impressions}, #{row.adOrderQuantity},
                 #{row.adSalesAmount}, #{row.spend}, #{row.tacos}, #{row.afnFulfillableQuantity},
                 #{row.availableInventory}, #{row.returnAmount}, #{row.avgCustomPrice},
                 #{row.rawJson}, #{row.syncedAt})
            </foreach>
            </script>
            """)
    int insertBatch(@Param("rows") List<LingxingProductPerformanceDaily> rows);

    /** 财务复算只读取必要列，禁止把大体积 raw_json 拉回 JVM。 */
    @Select("""
            SELECT asin, data_date, marketplace, currency_code,
                   principal_names, developer_names, store_names, tag_names,
                   product_create_time, volume, order_items, amount, clicks, impressions,
                   ad_order_quantity, ad_sales_amount, spend, afn_fulfillable_quantity,
                   available_inventory, return_amount, synced_at
            FROM lingxing_product_performance_daily
            WHERE data_date = #{date}
              AND (#{marketplace} IS NULL OR marketplace = #{marketplace})
            """)
    List<LingxingProductPerformanceDaily> selectFinanceFacts(
            @Param("date") LocalDate date, @Param("marketplace") String marketplace);

    @Select("""
            SELECT COUNT(*) FROM lingxing_product_performance_daily
            WHERE data_date = #{date}
              AND (#{marketplace} IS NULL OR marketplace = #{marketplace})
            """)
    int countByDate(@Param("date") LocalDate date, @Param("marketplace") String marketplace);

    @Delete("DELETE FROM lingxing_product_performance_daily WHERE data_date = #{date}")
    int deleteByDate(@Param("date") LocalDate date);

    /** 只保留当天命中 6 个团队中文标签的日事实。 */
    @Delete("""
            DELETE FROM lingxing_product_performance_daily
            WHERE data_date = #{date}
              AND (
                    tag_names IS NULL OR tag_names = ''
                 OR NOT (
                        FIND_IN_SET('欧洲精铺2025', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025非标品', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025淘汰', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025待淘汰', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025季节性断货', tag_names)
                     OR FIND_IN_SET('绿标', tag_names)
                    )
              )
            """)
    int pruneNonTeamByDate(@Param("date") LocalDate date);
}
