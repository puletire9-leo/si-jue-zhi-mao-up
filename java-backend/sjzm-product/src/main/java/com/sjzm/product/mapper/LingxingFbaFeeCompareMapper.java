package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingFbaFeeCompare;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * FBA 配送费对比表 Mapper。
 * <p>资格 ASIN = 统一表目标 ASIN ∩ 近3月(5/6/7)合计销量>30 ∩ 近3月合计正利润。</p>
 */
public interface LingxingFbaFeeCompareMapper extends BaseMapper<LingxingFbaFeeCompare> {

    /**
     * 查合格 ASIN 对应的 listing sid+msku（给 getPrices 拉 FBA 预估费）。
     * 资格：统一表目标 ASIN ∩ 周表近3月合计销量>30 ∩ 财务近3月合计正利润。
     * 返回去重的 {sid, msku}。
     */
    @Select("""
            SELECT DISTINCT w.sid AS sid, w.seller_sku AS msku
            FROM lingxing_sku_weekly_performance w
            INNER JOIN (
                SELECT w2.asin
                FROM lingxing_sku_weekly_performance w2
                INNER JOIN lingxing_product_unified u ON u.asin = w2.asin
                WHERE w2.`year_month` IN ('2026-05','2026-06','2026-07')
                GROUP BY w2.asin
                HAVING SUM(w2.volume) > 30
            ) qv ON qv.asin = w.asin
            INNER JOIN (
                SELECT asin
                FROM lingxing_profit_asin
                WHERE data_date >= '2026-05-01' AND data_date <= '2026-07-31'
                GROUP BY asin
                HAVING SUM(gross_profit) > 0
            ) qp ON qp.asin = w.asin
            WHERE w.`year_month` IN ('2026-05','2026-06','2026-07')
              AND w.sid IS NOT NULL AND w.seller_sku IS NOT NULL AND w.seller_sku != ''
            """)
    List<Map<String, Object>> selectQualifiedSidMskus();

    /**
     * 查指定月份销量>阈值的统一表目标 ASIN 对应 sid+msku（给 getPrices 拉 FBA 预估费）。
     * 用于按月补拉亚马逊 FBA 费（如 7 月销量>10 的新品）。
     *
     * @param ym        月份，如 '2026-07'
     * @param minVolume 该月销量下限（>）
     */
    @Select("""
            SELECT DISTINCT w.sid AS sid, w.seller_sku AS msku
            FROM lingxing_sku_weekly_performance w
            INNER JOIN (
                SELECT w2.asin
                FROM lingxing_sku_weekly_performance w2
                INNER JOIN lingxing_product_unified u ON u.asin = w2.asin
                WHERE w2.`year_month` = #{ym}
                GROUP BY w2.asin
                HAVING SUM(w2.volume) > #{minVolume}
            ) qv ON qv.asin = w.asin
            WHERE w.`year_month` = #{ym}
              AND w.sid IS NOT NULL AND w.seller_sku IS NOT NULL AND w.seller_sku != ''
            """)
    List<Map<String, Object>> selectSidMskusByMonth(String ym, int minVolume);

    /** 全量重算对比表（truncate 后调用）。见 XML。 */
    int rebuildAll();

    /** 清空对比表。 */
    int truncateAll();
}
