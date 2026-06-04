package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.toolkit.support.SFunction;
import com.sjzm.product.entity.CompetitorProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CompetitorProductMapper extends BaseMapper<CompetitorProduct> {

    /** INSERT ON DUPLICATE KEY UPDATE: 用 (marketplace, asin, month) 唯一键判断 */
    int insertOnDuplicateKeyUpdate(CompetitorProduct product);

    /** 批量 INSERT IGNORE: 追踪记录用 */
    int insertBatchIgnoreDup(@Param("list") List<CompetitorProduct> list);

    /** 查询所有已存在的 ASIN（asin + parent_asin UNION），可选 marketplace 过滤 */
    List<String> selectExistingAsins(@Param("marketplace") String marketplace);

    /** 批量查重：给定 ASIN 列表，返回已存在于 competitor_products 的 ASIN */
    List<String> selectExistingAsinsInList(@Param("marketplace") String marketplace, @Param("asins") List<String> asins);

    /**
     * 按 parent_asin 去重查询，每组选 BSR 最低的产品作为代表
     */
    @Select("<script>" +
        "SELECT t.id, t.marketplace, t.asin, t.title, t.image_url, t.price, t.units, t.bsr, " +
        "t.parent_asin, t.filter_mode, t.filter_reasons, t.listing_days, t.weight_g, t.product_url, " +
        "t.similar_url, t.source, t.seller_name, t.seller_nation, t.fulfillment, t.variations, " +
        "t.brand, t.seller_id, t.month, t.available_date, t.revenue, t.grade, t.week_tag, " +
        "t.is_current, t.created_at, t.updated_at, " +
        "t.symbol, t.node_id, t.node_id_path, t.node_label_path, t.prime_price, t.delivery_price, " +
        "t.dimension, t.weight, t.ratings, t.rating, t.amazon_choice, t.best_seller, t.new_release, " +
        "t.ebc, t.video, t.sellers, t.sku, t.brand_url, t.bsr_id, t.lqs, t.dimensions_type, t.pkg_dimensions, " +
        "t.pkg_dimension_type, t.pkg_weight, t.profit, t.fba, t.score, t.units_gr, t.amz_unit, " +
        "t.amz_sales, t.bsr_cr, t.bsr_cv, t.ratings_rate, t.ratings_cv, t.rating_delta, " +
        "t.variant_count " +
        "FROM (SELECT cp.*, " +
        "  ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(cp.parent_asin,''), cp.asin) " +
        "    ORDER BY CASE WHEN cp.bsr IS NULL OR cp.bsr &lt;= 0 THEN 999999999 ELSE cp.bsr END) as rn, " +
        "  COUNT(*) OVER (PARTITION BY COALESCE(NULLIF(cp.parent_asin,''), cp.asin)) as variant_count " +
        "  FROM competitor_products cp WHERE cp.title IS NOT NULL" +
        "  <if test='marketplace != null'> AND cp.marketplace = #{marketplace}</if>" +
        "  <if test='month != null'> AND cp.month = #{month}</if>" +
        "  <if test='source != null'> AND cp.source = #{source}</if>" +
        "  <if test='filterMode != null'> AND cp.filter_mode = #{filterMode}</if>" +
        "  <if test='brand != null'> AND cp.brand LIKE CONCAT('%',#{brand},'%')</if>" +
        "  <if test='sellerName != null'> AND cp.seller_name LIKE CONCAT('%',#{sellerName},'%')</if>" +
        "  <if test='title != null'> AND cp.title LIKE CONCAT('%',#{title},'%')</if>" +
        "  <if test='grade != null'> AND FIND_IN_SET(cp.grade, #{grade})</if>" +
        "  <if test='weekTag != null'> AND cp.week_tag = #{weekTag}</if>" +
        "  <if test='isCurrent != null'> AND cp.is_current = #{isCurrent}</if>" +
        "  <if test='maxVariantCount != null'> AND cp.variations &lt;= #{maxVariantCount}</if>" +
        "  <if test='category != null'> AND SUBSTRING_INDEX(cp.node_label_path, ':', 1) = #{category}</if>" +
        ") t WHERE ((t.filter_mode IN ('MODE1','MODE2') AND t.rn &lt;= 3) " +
        "   OR (t.filter_mode NOT IN ('MODE1','MODE2') AND t.rn = 1)) " +
        "<if test='sortBy != null and sortOrder != null'>" +
        "  ORDER BY " +
        "  <choose>" +
        "    <when test='sortBy == \"bsr\"'>t.bsr</when>" +
        "    <when test='sortBy == \"units\"'>t.units</when>" +
        "    <when test='sortBy == \"price\"'>t.price</when>" +
        "    <when test='sortBy == \"listingDays\"'>t.listing_days</when>" +
        "    <when test='sortBy == \"weightG\"'>t.weight_g</when>" +
        "    <when test='sortBy == \"createdAt\"'>t.created_at</when>" +
        "    <when test='sortBy == \"score\"'>t.score</when>" +
        "    <otherwise>t.bsr</otherwise>" +
        "  </choose>" +
        "  ${sortOrder}" +
        "</if>" +
        "<if test='sortBy == null'> ORDER BY t.bsr ASC</if>" +
        " LIMIT #{offset}, #{size}" +
        "</script>")
    List<CompetitorProduct> selectGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("source") String source,
            @Param("filterMode") String filterMode,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("grade") String grade,
            @Param("weekTag") String weekTag,
            @Param("isCurrent") Integer isCurrent,
            @Param("maxVariantCount") Integer maxVariantCount,
            @Param("category") String category,
            @Param("sortBy") String sortBy,
            @Param("sortOrder") String sortOrder,
            @Param("offset") int offset,
            @Param("size") int size);

    /** 去重后的总数（MODE1/MODE2 每父最多3个，其他每父1个） */
    @Select("<script>" +
        "SELECT COUNT(*) FROM (" +
        "  SELECT t.id, t.filter_mode, " +
        "    ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(t.parent_asin,''), t.asin) " +
        "      ORDER BY CASE WHEN t.bsr IS NULL OR t.bsr &lt;= 0 THEN 999999999 ELSE t.bsr END) as rn " +
        "  FROM (SELECT cp.* FROM competitor_products cp WHERE cp.title IS NOT NULL" +
        "    <if test='marketplace != null'> AND cp.marketplace = #{marketplace}</if>" +
        "    <if test='month != null'> AND cp.month = #{month}</if>" +
        "    <if test='source != null'> AND cp.source = #{source}</if>" +
        "    <if test='filterMode != null'> AND cp.filter_mode = #{filterMode}</if>" +
        "    <if test='brand != null'> AND cp.brand LIKE CONCAT('%',#{brand},'%')</if>" +
        "    <if test='sellerName != null'> AND cp.seller_name LIKE CONCAT('%',#{sellerName},'%')</if>" +
        "    <if test='title != null'> AND cp.title LIKE CONCAT('%',#{title},'%')</if>" +
        "    <if test='grade != null'> AND FIND_IN_SET(cp.grade, #{grade})</if>" +
        "    <if test='weekTag != null'> AND cp.week_tag = #{weekTag}</if>" +
        "    <if test='isCurrent != null'> AND cp.is_current = #{isCurrent}</if>" +
        "    <if test='category != null'> AND SUBSTRING_INDEX(cp.node_label_path, ':', 1) = #{category}</if>" +
        "  ) t" +
        "  <if test='maxVariantCount != null'> WHERE t.variations &lt;= #{maxVariantCount}</if>" +
        ") ranked WHERE ((ranked.filter_mode IN ('MODE1','MODE2') AND ranked.rn &lt;= 3) " +
        "   OR (ranked.filter_mode NOT IN ('MODE1','MODE2') AND ranked.rn = 1))" +
        "</script>")
    long countGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("source") String source,
            @Param("filterMode") String filterMode,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("grade") String grade,
            @Param("weekTag") String weekTag,
            @Param("isCurrent") Integer isCurrent,
            @Param("maxVariantCount") Integer maxVariantCount,
            @Param("category") String category);
}
