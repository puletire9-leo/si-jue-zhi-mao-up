package com.sjzm.product.rds.finance.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import com.sjzm.product.rds.finance.model.FinanceListingDateRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 财务日报 RDS 统一表元数据读取。 */
@Mapper
public interface FinanceRdsUnifiedMapper extends BaseMapper<LingxingProductUnified> {

    @Select("""
            SELECT asin
            FROM lingxing_product_unified_marketplace
            WHERE marketplace = #{marketplace} AND active = 1
            ORDER BY asin
            """)
    List<String> selectActiveAsinsByMarketplace(@Param("marketplace") String marketplace);

    /** 新 ASIN 尚未进入统一表时，用当天 Listing.open_date 作为上架日期补数。已在统一表的 ASIN 优先用 listing_date。 */
    @Select("""
            <script>
            SELECT asin, MIN(DATE(open_date)) AS listing_date
            FROM lingxing_listing
            WHERE open_date IS NOT NULL
              AND asin IN
              <foreach collection="asins" item="asin" open="(" separator="," close=")">
                #{asin}
              </foreach>
            GROUP BY asin
            </script>
            """)
    List<FinanceListingDateRow> selectListingDates(@Param("asins") List<String> asins);
}
