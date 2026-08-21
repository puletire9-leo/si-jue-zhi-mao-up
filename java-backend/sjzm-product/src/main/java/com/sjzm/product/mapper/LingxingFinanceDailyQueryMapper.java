package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 财务日报只读查询 Mapper。
 *
 * <p>只承载「累计销量 > 0」判断所需的历史正销量 ASIN 集合查询，
 * 严格以 reportDate 为界避免未来泄漏：
 * <ul>
 *   <li>周表 lingxing_sku_weekly_performance：只取 week_end &lt; reportDate 的完整周；</li>
 *   <li>日表 lingxing_product_performance_daily：只取 data_date &lt; reportDate 的既往日事实。</li>
 * </ul>
 * 当期未收口周（week_end &gt;= reportDate）被排除，避免把未来销量倒灌进断货判断。</p>
 */
@Mapper
public interface LingxingFinanceDailyQueryMapper {

    /** 历史正销量 ASIN：完成周（week_end 严格早于 cutoff）内销量 &gt; 0 的 ASIN 集合。 */
    @Select("""
            SELECT DISTINCT asin
            FROM lingxing_sku_weekly_performance
            WHERE week_end < #{cutoff}
              AND volume > 0
              AND asin IS NOT NULL
              AND asin <> ''
            """)
    List<String> selectPriorPositiveAsinsFromWeekly(@Param("cutoff") String cutoff);

    /** 历史正销量 ASIN：既往日事实（data_date 严格早于 date）销量 &gt; 0 的 ASIN 集合。 */
    @Select("""
            SELECT DISTINCT asin
            FROM lingxing_product_performance_daily
            WHERE data_date < #{date}
              AND volume > 0
              AND asin IS NOT NULL
              AND asin <> ''
            """)
    List<String> selectPriorPositiveAsinsFromDaily(@Param("date") String date);
}
