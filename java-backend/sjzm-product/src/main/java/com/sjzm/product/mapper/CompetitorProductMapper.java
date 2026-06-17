package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.toolkit.support.SFunction;
import com.sjzm.product.dto.CompetitorQueryRequest;
import com.sjzm.product.entity.CompetitorProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
        "  <if test='weekTag != null'> AND FIND_IN_SET(cp.week_tag, #{weekTag})</if>" +
        "  <if test='isCurrent != null'> AND cp.is_current = #{isCurrent}</if>" +
        "  <if test='maxVariantCount != null'> AND cp.variations &lt;= #{maxVariantCount}</if>" +
        "  <if test='bsrId != null'> AND cp.bsr_id = #{bsrId}</if>" +
        "  <if test='nodeId != null'> AND cp.node_id = #{nodeId}</if>" +
        "  <if test='category != null'> AND FIND_IN_SET(SUBSTRING_INDEX(cp.node_label_path, ':', 1), #{category})</if>" +
        "  <if test='priceMin != null'> AND cp.price &gt;= #{priceMin}</if>" +
        "  <if test='priceMax != null'> AND cp.price &lt;= #{priceMax}</if>" +
        "  <if test='bsrMax != null'> AND cp.bsr &lt;= #{bsrMax}</if>" +
        "  <if test='ratingMin != null'> AND cp.rating &gt;= #{ratingMin}</if>" +
        "  <if test='weightMax != null'> AND cp.weight_g &lt;= #{weightMax}</if>" +
        "  <if test='createdAtStart != null'> AND cp.created_at &gt;= #{createdAtStart}</if>" +
        "  <if test='createdAtEnd != null'> AND cp.created_at &lt;= #{createdAtEnd}</if>" +
        "  <if test='createdWeek != null'> AND DATE_FORMAT(cp.created_at, '%x-W%v') = #{createdWeek}</if>" +
        "  <if test='keywordList != null and keywordList.size() > 0'>" +
        "    <foreach collection='keywordList' item='word' open='' separator='' close=''>" +
        "      AND cp.title LIKE CONCAT('%', #{word}, '%')" +
        "    </foreach>" +
        "  </if>" +
        "  <if test='qualifyRules != null and qualifyRules.size() > 0'>" +
        "    AND (" +
        "    <foreach collection='qualifyRules' item='r' separator=' OR '>" +
        "      ( 1=1" +
        "        <foreach collection='r.conditions' item='c'>" +
        "          <if test='c.value != null'>" +
        "            <if test='c.field == \"bsr\"'> AND cp.bsr &gt; 0</if>" +
        "            AND " +
        "            <choose>" +
        "              <when test='c.field == \"listingDays\"'>cp.listing_days</when>" +
        "              <when test='c.field == \"weightG\"'>cp.weight_g</when>" +
        "              <when test='c.field == \"units\"'>cp.units</when>" +
        "              <when test='c.field == \"bsr\"'>cp.bsr</when>" +
        "              <otherwise>NULL</otherwise>" +
        "            </choose>" +
        "            <choose>" +
        "              <when test='c.op == \"lt\"'> &lt; </when>" +
        "              <when test='c.op == \"le\"'> &lt;= </when>" +
        "              <when test='c.op == \"ge\"'> &gt;= </when>" +
        "              <when test='c.op == \"gt\"'> &gt; </when>" +
        "              <otherwise> = </otherwise>" +
        "            </choose>" +
        "            #{c.value}" +
        "          </if>" +
        "        </foreach>" +
        "      )" +
        "    </foreach>" +
        "    )" +
        "  </if>" +
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
            @Param("bsrId") String bsrId,
            @Param("nodeId") Long nodeId,
            @Param("createdAtStart") String createdAtStart,
            @Param("createdAtEnd") String createdAtEnd,
            @Param("createdWeek") String createdWeek,
            @Param("category") String category,
            @Param("priceMin") BigDecimal priceMin,
            @Param("priceMax") BigDecimal priceMax,
            @Param("bsrMax") Integer bsrMax,
            @Param("ratingMin") BigDecimal ratingMin,
            @Param("weightMax") BigDecimal weightMax,
            @Param("keywordList") List<String> keywordList,
            @Param("qualifyRules") List<CompetitorQueryRequest.QualifyRule> qualifyRules,
            @Param("sortBy") String sortBy,
            @Param("sortOrder") String sortOrder,
            @Param("offset") int offset,
            @Param("size") int size);

    /** 按 marketplace + sellerName 拉取候选店铺商品（评分用） */
    @Select("<script>" +
        "SELECT cp.seller_name, cp.node_id, cp.bsr_id, cp.price" +
        " FROM competitor_products cp" +
        " WHERE cp.title IS NOT NULL AND cp.marketplace = #{marketplace}" +
        " AND cp.seller_name = #{sellerName}" +
        "</script>")
    List<java.util.Map<String, Object>> selectRatingDataBySeller(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName);

    /** 模式一按卖家聚合候选店铺 */
    @Select("<script>" +
        "SELECT cp.seller_name as sellerName, cp.marketplace," +
        "  COUNT(DISTINCT COALESCE(NULLIF(cp.parent_asin,''), cp.asin)) as newProductCount" +
        " FROM competitor_products cp" +
        " WHERE cp.title IS NOT NULL AND cp.filter_mode = 'MODE1'" +
        " <if test='marketplace != null'> AND cp.marketplace = #{marketplace}</if>" +
        " GROUP BY cp.seller_name, cp.marketplace" +
        " HAVING COUNT(DISTINCT COALESCE(NULLIF(cp.parent_asin,''), cp.asin)) >= #{minCount}" +
        " ORDER BY newProductCount DESC" +
        "</script>")
    List<java.util.Map<String, Object>> selectNewProductCandidates(
            @Param("marketplace") String marketplace,
            @Param("minCount") int minCount);

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
        "    <if test='weekTag != null'> AND FIND_IN_SET(cp.week_tag, #{weekTag})</if>" +
        "    <if test='isCurrent != null'> AND cp.is_current = #{isCurrent}</if>" +
        "    <if test='bsrId != null'> AND cp.bsr_id = #{bsrId}</if>" +
        "    <if test='nodeId != null'> AND cp.node_id = #{nodeId}</if>" +
        "    <if test='category != null'> AND FIND_IN_SET(SUBSTRING_INDEX(cp.node_label_path, ':', 1), #{category})</if>" +
        "    <if test='priceMin != null'> AND cp.price &gt;= #{priceMin}</if>" +
        "    <if test='priceMax != null'> AND cp.price &lt;= #{priceMax}</if>" +
        "    <if test='bsrMax != null'> AND cp.bsr &lt;= #{bsrMax}</if>" +
        "    <if test='ratingMin != null'> AND cp.rating &gt;= #{ratingMin}</if>" +
        "    <if test='weightMax != null'> AND cp.weight_g &lt;= #{weightMax}</if>" +
        "    <if test='createdAtStart != null'> AND cp.created_at &gt;= #{createdAtStart}</if>" +
        "    <if test='createdAtEnd != null'> AND cp.created_at &lt;= #{createdAtEnd}</if>" +
        "    <if test='createdWeek != null'> AND DATE_FORMAT(cp.created_at, '%x-W%v') = #{createdWeek}</if>" +
        "    <if test='keywordList != null and keywordList.size() > 0'>" +
        "      <foreach collection='keywordList' item='word' open='' separator='' close=''>" +
        "        AND cp.title LIKE CONCAT('%', #{word}, '%')" +
        "      </foreach>" +
        "    </if>" +
        "    <if test='qualifyRules != null and qualifyRules.size() > 0'>" +
        "      AND (" +
        "      <foreach collection='qualifyRules' item='r' separator=' OR '>" +
        "        ( 1=1" +
        "          <foreach collection='r.conditions' item='c'>" +
        "            <if test='c.value != null'>" +
        "              <if test='c.field == \"bsr\"'> AND cp.bsr &gt; 0</if>" +
        "              AND " +
        "              <choose>" +
        "                <when test='c.field == \"listingDays\"'>cp.listing_days</when>" +
        "                <when test='c.field == \"weightG\"'>cp.weight_g</when>" +
        "                <when test='c.field == \"units\"'>cp.units</when>" +
        "                <when test='c.field == \"bsr\"'>cp.bsr</when>" +
        "                <otherwise>NULL</otherwise>" +
        "              </choose>" +
        "              <choose>" +
        "                <when test='c.op == \"lt\"'> &lt; </when>" +
        "                <when test='c.op == \"le\"'> &lt;= </when>" +
        "                <when test='c.op == \"ge\"'> &gt;= </when>" +
        "                <when test='c.op == \"gt\"'> &gt; </when>" +
        "                <otherwise> = </otherwise>" +
        "              </choose>" +
        "              #{c.value}" +
        "            </if>" +
        "          </foreach>" +
        "        )" +
        "      </foreach>" +
        "      )" +
        "    </if>" +
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
            @Param("bsrId") String bsrId,
            @Param("nodeId") Long nodeId,
            @Param("createdAtStart") String createdAtStart,
            @Param("createdAtEnd") String createdAtEnd,
            @Param("createdWeek") String createdWeek,
            @Param("category") String category,
            @Param("priceMin") BigDecimal priceMin,
            @Param("priceMax") BigDecimal priceMax,
            @Param("bsrMax") Integer bsrMax,
            @Param("ratingMin") BigDecimal ratingMin,
            @Param("weightMax") BigDecimal weightMax,
            @Param("keywordList") List<String> keywordList,
            @Param("qualifyRules") List<CompetitorQueryRequest.QualifyRule> qualifyRules);

    @Select("SELECT bsr_id AS bsrId, COUNT(*) AS productCount" +
            " FROM competitor_products" +
            " WHERE marketplace = #{marketplace} AND month = #{month}" +
            " GROUP BY bsr_id" +
            " ORDER BY productCount DESC")
    List<Map<String, Object>> countByBsrId(@Param("marketplace") String marketplace, @Param("month") String month);

    @Select("SELECT bsr_id AS bsrId, node_id AS nodeId," +
            " MAX(node_label_path) AS nodeFullPath," +
            " SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName," +
            " COUNT(*) AS productCount" +
            " FROM competitor_products" +
            " WHERE marketplace = #{marketplace} AND month = #{month}" +
            " AND filter_mode = 'MODE1'" +
            " GROUP BY bsr_id, node_id" +
            " ORDER BY bsr_id, productCount DESC")
    List<Map<String, Object>> countByNodeId(@Param("marketplace") String marketplace, @Param("month") String month);

    @Select("SELECT DISTINCT bsr_id FROM competitor_products WHERE marketplace = #{marketplace}")
    Set<String> selectDistinctBsrIdByMarketplace(@Param("marketplace") String marketplace);

    /**
     * 实时按 created_at 计算入库周次（ISO 周），返回每周条数与起止日期，按周倒序（第一条即最新批次）。
     * 不依赖 week_tag / is_current / month 列。source 用 LIKE 以兼容存量来源文案。
     */
    @Select("<script>" +
            "SELECT DATE_FORMAT(created_at, '%x-W%v') AS week, COUNT(*) AS count, " +
            "MIN(DATE(created_at)) AS startDate, MAX(DATE(created_at)) AS endDate " +
            "FROM competitor_products " +
            "WHERE marketplace = #{marketplace} AND created_at IS NOT NULL " +
            "<if test='source != null and source != \"\"'> AND source LIKE CONCAT('%', #{source}, '%')</if>" +
            "<if test='filterMode != null and filterMode != \"\"'> AND filter_mode = #{filterMode}</if>" +
            "GROUP BY week ORDER BY week DESC" +
            "</script>")
    List<Map<String, Object>> selectCreatedWeeksWithCount(@Param("marketplace") String marketplace,
                                                          @Param("source") String source,
                                                          @Param("filterMode") String filterMode);
}
