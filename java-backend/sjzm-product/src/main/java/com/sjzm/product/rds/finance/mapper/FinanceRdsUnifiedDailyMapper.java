package com.sjzm.product.rds.finance.mapper;

import com.sjzm.product.rds.finance.model.FinanceMarketplaceAsinRow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/** 统一表日快照读写。 */
@Mapper
public interface FinanceRdsUnifiedDailyMapper {

    @Select("SELECT COUNT(*) FROM lingxing_product_unified_daily WHERE data_date = #{date}")
    int countByDate(@Param("date") LocalDate date);

    @Select("""
            SELECT marketplace, asin
            FROM lingxing_product_unified_daily
            WHERE data_date = #{date}
            ORDER BY marketplace, asin
            """)
    List<FinanceMarketplaceAsinRow> selectMarketplaceAsins(@Param("date") LocalDate date);

    @Delete("DELETE FROM lingxing_product_unified_daily WHERE data_date = #{date}")
    int deleteByDate(@Param("date") LocalDate date);

    @Insert("""
            INSERT INTO lingxing_product_unified_daily (
                data_date, marketplace, asin, parent_asin, country, developer, principal,
                listing_tags, listing_date, product_create_time, title, base_sku, synced_at)
            SELECT #{dataDate}, UPPER(d.marketplace), d.asin, u.parent_asin, u.country,
                   u.developer, u.principal, u.listing_tags, u.listing_date, u.product_create_time,
                   u.title, u.base_sku, NOW()
            FROM (
                SELECT marketplace, asin
                FROM lingxing_product_performance_daily
                WHERE data_date = #{dataDate}
                  AND UPPER(marketplace) IN ('UK', 'DE')
                  AND asin IS NOT NULL AND asin <> ''
                GROUP BY marketplace, asin
            ) d
            LEFT JOIN lingxing_product_unified u ON u.asin = d.asin
            """)
    int insertFromDailyFacts(@Param("dataDate") LocalDate dataDate);
}
