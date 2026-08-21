package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.dto.LingxingShopProductVO;
import com.sjzm.product.modules.lingxing.dto.LingxingShopQueryRequest;
import com.sjzm.product.modules.lingxing.entity.LingxingDeveloperSkuPrefix;
import com.sjzm.product.modules.lingxing.entity.LingxingProductUnified;
import com.sjzm.product.rds.lingxing.LingxingRdsMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 领星产品统一表 Mapper。
 * <p>沿用老约定放在 com.sjzm.product.mapper，已被 ProductApplication.@MapperScan 第一行覆盖，无需改 @MapperScan。
 */
public interface LingxingProductUnifiedMapper extends BaseMapper<LingxingProductUnified>, LingxingRdsMapper {

    /**
     * 增量重算统一表：只 INSERT 新 ASIN（真实上架日期一次写入锁定）。
     * 数据源：lingxing_sku_weekly_performance（经营指标聚合 + FBA首现）
     *        + lingxing_local_product（developer）+ lingxing_listing（真实上架日）。
     * 上架日期优先级（仅新 ASIN）：listing.open_date > FBA首现月 > 创建时间。
     * 见 resources/mapper/LingxingProductUnifiedMapper.xml。
     *
     * @param cutoffMonth     数据覆盖截止月（写入元数据列）
     * @param unifiedVersion  统一表算法版本（写入元数据列）
     * @return 新插入行数
     */
    int rebuildAll(String cutoffMonth, String unifiedVersion);

    /**
     * 刷新所有已在统一表的 ASIN 的经营指标（不动 listing_date）。
     *
     * @param cutoffMonth     数据覆盖截止月
     * @param unifiedVersion  统一表算法版本
     * @return 更新行数
     */
    int updateMetrics(String cutoffMonth, String unifiedVersion);

    /** 从周表目标 ASIN 刷新 UK/DE 国家关系，供财务按币种分流。 */
    int upsertMarketplaceRelations();

    /** 将本轮周表已不存在的历史国家关系标为无效；在 upsert 成功后执行。 */
    int deactivateStaleMarketplaceRelations();

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

    // ============================================================
    // 领星店铺数据选品页（分页 + 图片 JOIN 双兜底 + 按店铺筛选）
    // 见 resources/mapper/LingxingProductUnifiedMapper.xml
    // ============================================================

    /** 分页查询店铺数据选品卡片（图片 listing 优先 local 兜底）。 */
    List<LingxingShopProductVO> selectShopProducts(@Param("req") LingxingShopQueryRequest req,
                                                   @Param("offset") long offset,
                                                   @Param("limit") int limit);

    /** 上述查询的总数（同 where，不 JOIN 图片）。 */
    long countShopProducts(@Param("req") LingxingShopQueryRequest req);

    /** "按领星店铺分类"下拉：各 base_store 及其商品数（可按 country 过滤）。 */
    List<Map<String, Object>> selectShopStores(@Param("country") String country);

    // ============================================================
    // 开发人前缀映射（每周同步后自动重建）
    // ============================================================

    /**
     * 从统一表提取 (developer, LEFT(base_sku, 3)) 去重组合。
     * 用于重建 lingxing_developer_sku_prefix 表。
     */
    @Select("""
            SELECT developer,
                   LEFT(base_sku, 3) AS sku_prefix,
                   COUNT(*)          AS asin_count
            FROM lingxing_product_unified
            WHERE developer IS NOT NULL
              AND developer <> ''
              AND base_sku IS NOT NULL
              AND base_sku <> ''
            GROUP BY developer, LEFT(base_sku, 3)
            ORDER BY developer, sku_prefix
            """)
    List<LingxingDeveloperSkuPrefix> selectDeveloperSkuPrefixes();
}
