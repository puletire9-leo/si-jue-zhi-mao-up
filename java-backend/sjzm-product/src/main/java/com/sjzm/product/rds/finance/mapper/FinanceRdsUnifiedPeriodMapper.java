package com.sjzm.product.rds.finance.mapper;

import com.sjzm.product.rds.finance.model.FinanceMarketplaceAsinRow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/** 统一表时间窗读写。查某一天必须 period_start=period_end=当天，避免碰到周窗口。 */
@Mapper
public interface FinanceRdsUnifiedPeriodMapper {

    @Select("""
            SELECT COUNT(*) FROM lingxing_product_unified_period
            WHERE period_start = #{date} AND period_end = #{date}
            """)
    int countByDate(@Param("date") LocalDate date);

    @Select("""
            SELECT marketplace, asin
            FROM lingxing_product_unified_period
            WHERE period_start = #{date} AND period_end = #{date}
            ORDER BY marketplace, asin
            """)
    List<FinanceMarketplaceAsinRow> selectMarketplaceAsins(@Param("date") LocalDate date);

    @Delete("""
            DELETE FROM lingxing_product_unified_period
            WHERE period_start = #{date} AND period_end = #{date}
            """)
    int deleteByDate(@Param("date") LocalDate date);

    @Delete("""
            DELETE FROM lingxing_product_unified_period
            WHERE period_start = #{periodStart} AND period_end = #{periodEnd}
            """)
    int deletePeriod(@Param("periodStart") String periodStart, @Param("periodEnd") String periodEnd);

    @Insert("""
            INSERT INTO lingxing_product_unified_period (
                period_start, period_end, marketplace, asin, parent_asin, country, developer, principal,
                listing_tags, listing_date, product_create_time, title, base_sku, synced_at)
            SELECT #{dataDate}, #{dataDate}, UPPER(d.marketplace), d.asin,
                   COALESCE(u.parent_asin, d.parent_asin),
                   COALESCE(NULLIF(TRIM(u.country), ''), d.marketplace),
                   COALESCE(u.developer, d.developer_names),
                   COALESCE(u.principal, d.principal_names),
                   COALESCE(u.listing_tags, d.tag_names),
                   COALESCE(u.listing_date, listing_open.listing_date),
                   COALESCE(u.product_create_time, d.product_create_time),
                   COALESCE(u.title, d.item_name),
                   COALESCE(u.base_sku, d.sku),
                   NOW()
            FROM (
                SELECT marketplace, asin,
                       MAX(parent_asin) AS parent_asin,
                       MAX(developer_names) AS developer_names,
                       MAX(principal_names) AS principal_names,
                       MAX(tag_names) AS tag_names,
                       MAX(product_create_time) AS product_create_time,
                       MAX(item_name) AS item_name,
                       MAX(sku) AS sku
                FROM lingxing_product_performance_daily
                WHERE data_date = #{dataDate}
                  AND UPPER(marketplace) IN ('UK', 'DE')
                  AND asin IS NOT NULL AND asin <> ''
                  AND (
                        FIND_IN_SET('欧洲精铺2025', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025非标品', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025淘汰', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025待淘汰', tag_names)
                     OR FIND_IN_SET('欧洲精铺2025季节性断货', tag_names)
                     OR FIND_IN_SET('绿标', tag_names)
                  )
                GROUP BY marketplace, asin
            ) d
            LEFT JOIN lingxing_product_unified u ON u.asin = d.asin
            LEFT JOIN (
                SELECT asin, MIN(DATE(open_date)) AS listing_date
                FROM lingxing_listing
                WHERE open_date IS NOT NULL
                GROUP BY asin
            ) listing_open ON listing_open.asin = d.asin
            """)
    int insertFromDailyFacts(@Param("dataDate") LocalDate dataDate);

    @Insert("""
            INSERT INTO lingxing_product_unified_period (
                period_start, period_end, marketplace, asin, parent_asin, country, developer, principal,
                listing_tags, listing_date, product_create_time, title, base_sku, synced_at)
            SELECT #{periodStart}, #{periodEnd}, UPPER(w.marketplace), w.asin,
                   COALESCE(u.parent_asin, w.parent_asin),
                   COALESCE(NULLIF(TRIM(u.country), ''), w.marketplace),
                   u.developer, u.principal,
                   COALESCE(u.listing_tags, w.tags),
                   COALESCE(u.listing_date, listing_open.listing_date),
                   u.product_create_time,
                   COALESCE(u.title, w.product_name),
                   COALESCE(u.base_sku, w.sku),
                   NOW()
            FROM (
                SELECT marketplace, asin,
                       MAX(parent_asin) AS parent_asin,
                       MAX(tags) AS tags,
                       MAX(product_name) AS product_name,
                       MAX(sku) AS sku
                FROM lingxing_sku_weekly_performance
                WHERE week_start = #{periodStart}
                  AND week_end = #{periodEnd}
                  AND asin IS NOT NULL AND asin <> ''
                  AND UPPER(marketplace) IN ('UK', 'DE')
                GROUP BY marketplace, asin
            ) w
            LEFT JOIN lingxing_product_unified u ON u.asin = w.asin
            LEFT JOIN (
                SELECT asin, MIN(DATE(open_date)) AS listing_date
                FROM lingxing_listing
                WHERE open_date IS NOT NULL
                GROUP BY asin
            ) listing_open ON listing_open.asin = w.asin
            """)
    int insertFromWeeklyWindow(@Param("periodStart") String periodStart,
                               @Param("periodEnd") String periodEnd);
}
