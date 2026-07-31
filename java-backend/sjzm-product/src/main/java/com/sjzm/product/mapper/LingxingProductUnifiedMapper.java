package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 领星产品统一表 Mapper。
 * <p>沿用老约定放在 com.sjzm.product.mapper，已被 ProductApplication.@MapperScan 第一行覆盖，无需改 @MapperScan。
 */
public interface LingxingProductUnifiedMapper extends BaseMapper<LingxingProductUnified> {

    /**
     * 全量重算统一表：DB 层 JOIN + 聚合 + INSERT...ON DUPLICATE KEY UPDATE。
     * 数据源：lingxing_asin_monthly_performance（经营指标聚合）
     *        + lingxing_local_product（developer）+ lingxing_listing（真实上架日）
     *        + lingxing_listing（真实上架日 open_date）。
     * 见 resources/mapper/LingxingProductUnifiedMapper.xml。
     *
     * @param cutoffMonth     数据覆盖截止月（写入元数据列）
     * @param unifiedVersion  统一表算法版本（写入元数据列）
     * @return 影响行数（INSERT+UPDATE 累计，MySQL 语义仅供参考）
     */
    int rebuildAll(String cutoffMonth, String unifiedVersion);

    /** 清空统一表（重算前可选调用；rebuildAll 已是幂等 upsert，通常不需要）。 */
    int truncateAll();

    // ============================================================
    // 工作台总览聚合（@Select 模式）
    // ============================================================

    /** 统一表总 ASIN 数 */
    @Select("SELECT COUNT(*) FROM lingxing_product_unified")
    long countUnified();

    /** 有销量（total_volume>0）的 ASIN 数 */
    @Select("SELECT COUNT(*) FROM lingxing_product_unified WHERE total_volume > 0")
    long countWithSales();

    /** 按国家分组（UK/DE） */
    @Select("SELECT COALESCE(NULLIF(TRIM(country), ''), '未知') AS country, COUNT(*) AS cnt " +
            "FROM lingxing_product_unified GROUP BY country ORDER BY cnt DESC")
    List<Map<String, Object>> countUnifiedByCountry();

    /** 按开发人分组 Top（developer 非空） */
    @Select("SELECT developer, COUNT(*) AS cnt " +
            "FROM lingxing_product_unified " +
            "WHERE developer IS NOT NULL AND developer <> '' " +
            "GROUP BY developer ORDER BY cnt DESC")
    List<Map<String, Object>> countUnifiedByDeveloper();

    /** 按最新月分组（近 24 月） */
    @Select("SELECT latest_month AS month, COUNT(*) AS cnt " +
            "FROM lingxing_product_unified " +
            "WHERE latest_month IS NOT NULL AND latest_month <> '' " +
            "GROUP BY latest_month ORDER BY latest_month DESC LIMIT 24")
    List<Map<String, Object>> countUnifiedByLatestMonth();

    /**
     * 6 个目标标签各自计数（一行返回 6 列）。
     * listing_tags 是中文标签名逗号分隔，用 FIND_IN_SET 精确匹配单个标签，
     * 避免 LIKE '%欧洲精铺2025%' 误把"欧洲精铺2025淘汰"等也算进"欧洲精铺2025"。
     */
    @Select("SELECT " +
            "  SUM(FIND_IN_SET('欧洲精铺2025', listing_tags) > 0) AS tag_jingpu, " +
            "  SUM(FIND_IN_SET('欧洲精铺2025非标品', listing_tags) > 0) AS tag_feibiao, " +
            "  SUM(FIND_IN_SET('欧洲精铺2025淘汰', listing_tags) > 0) AS tag_taotai, " +
            "  SUM(FIND_IN_SET('欧洲精铺2025待淘汰', listing_tags) > 0) AS tag_daitaotai, " +
            "  SUM(FIND_IN_SET('欧洲精铺2025季节性断货', listing_tags) > 0) AS tag_jijie, " +
            "  SUM(FIND_IN_SET('绿标', listing_tags) > 0) AS tag_lvbiao " +
            "FROM lingxing_product_unified")
    Map<String, Object> sumUnifiedByTag();
}