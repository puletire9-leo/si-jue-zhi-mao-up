package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 领星工作台的行数与覆盖窗口聚合 Mapper。
 * 独立文件放在 @MapperScan 扫描的包下，避免嵌套接口的注册问题。
 */
@Mapper
public interface LingxingOverviewCountMapper {

    @Select("SELECT COUNT(*) FROM lingxing_asin_baseline")
    long countBaseline();

    @Select("SELECT COUNT(*) FROM lingxing_asin_monthly_performance")
    long countMonthlyPerformance();

    @Select("SELECT COUNT(*) FROM lingxing_sku_weekly_performance")
    long countSkuWeekly();

    @Select("SELECT COUNT(*) FROM lingxing_profit_asin")
    long countProfitAsin();

    @Select("SELECT COUNT(*) FROM lingxing_local_product")
    long countLocalProduct();

    @Select("SELECT COUNT(*) FROM lingxing_seller")
    long countSeller();

    @Select("SELECT COUNT(*) FROM lingxing_purchase_plan")
    long countPurchasePlan();

    @Select("SELECT COUNT(*) FROM lingxing_purchase_order")
    long countPurchaseOrder();

    @Select("SELECT COUNT(*) FROM lingxing_purchase_order_item")
    long countPurchaseOrderItem();

    @Select("SELECT COUNT(*) FROM lingxing_data_sync_run")
    long countDataSyncRun();

    @Select("SELECT MAX(`month`) FROM lingxing_asin_monthly_performance")
    String latestMonthlyMonth();

    @Select("SELECT MIN(`month`) FROM lingxing_asin_monthly_performance")
    String earliestMonthlyMonth();

    @Select("SELECT MAX(week_end) FROM lingxing_sku_weekly_performance")
    String latestWeeklyEnd();

    @Select("SELECT MAX(data_date) FROM lingxing_profit_asin")
    String latestProfitDate();
}
