package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.DengZongShop;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Mapper
public interface DengZongShopMapper extends BaseMapper<DengZongShop> {

    @Select("<script>" +
        "SELECT t.* FROM (" +
        "  SELECT ds.*, " +
        "    ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin) " +
        "      ORDER BY CASE WHEN ds.bsr IS NULL OR ds.bsr &lt;= 0 THEN 999999999 ELSE ds.bsr END) as rn, " +
        "    COUNT(*) OVER (PARTITION BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin)) as variantCount " +
        "  FROM deng_zong_shop ds WHERE ds.title IS NOT NULL" +
        "  <if test='marketplace != null'> AND ds.marketplace = #{marketplace}</if>" +
        "  <if test='month != null'> AND ds.month = #{month}</if>" +
        "  <if test='brand != null'> AND ds.brand LIKE CONCAT('%',#{brand},'%')</if>" +
        "  <if test='sellerName != null'> AND ds.seller_name LIKE CONCAT('%',#{sellerName},'%')</if>" +
        "  <if test='title != null'> AND ds.title LIKE CONCAT('%',#{title},'%')</if>" +
        "  <if test='category != null'> AND SUBSTRING_INDEX(ds.node_label_path, ':', 1) = #{category}</if>" +
        "  <if test='bsrId != null'> AND ds.bsr_id = #{bsrId}</if>" +
        "  <if test='nodeId != null'> AND ds.node_id = #{nodeId}</if>" +
        "  <if test='priceMin != null'> AND ds.price &gt;= #{priceMin}</if>" +
        "  <if test='priceMax != null'> AND ds.price &lt;= #{priceMax}</if>" +
        "  <if test='bsrMax != null'> AND ds.bsr &lt;= #{bsrMax}</if>" +
        "  <if test='ratingMin != null'> AND ds.rating &gt;= #{ratingMin}</if>" +
        "  <if test='weightMax != null'> AND ds.weight &lt;= #{weightMax}</if>" +
        ") t WHERE t.rn = 1" +
        "<if test='sortBy != null and sortOrder != null'>" +
        "  ORDER BY " +
        "  <choose>" +
        "    <when test='sortBy == \"bsr\"'>t.bsr</when>" +
        "    <when test='sortBy == \"units\"'>t.units</when>" +
        "    <when test='sortBy == \"price\"'>t.price</when>" +
        "    <otherwise>t.bsr</otherwise>" +
        "  </choose>" +
        "  <choose>" + // FIXED: CRIT-3 SQL注入白名单
        "    <when test='sortOrder != null and sortOrder.toString().toLowerCase() == \"asc\"'>ASC</when>" +
        "    <when test='sortOrder != null and sortOrder.toString().toLowerCase() == \"desc\"'>DESC</when>" +
        "    <otherwise>ASC</otherwise>" +
        "  </choose>" +
        "</if>" +
        "<if test='sortBy == null'> ORDER BY t.bsr ASC</if>" +
        " LIMIT #{size} OFFSET #{offset}" + // FIXED: HIGH-7 MySQL分页语法
        "</script>")
    List<DengZongShop> selectGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("category") String category,
            @Param("bsrId") String bsrId,
            @Param("nodeId") Long nodeId,
            @Param("priceMin") java.math.BigDecimal priceMin,
            @Param("priceMax") java.math.BigDecimal priceMax,
            @Param("bsrMax") Integer bsrMax,
            @Param("ratingMin") java.math.BigDecimal ratingMin,
            @Param("weightMax") String weightMax,
            @Param("sortBy") String sortBy,
            @Param("sortOrder") String sortOrder,
            @Param("offset") int offset,
            @Param("size") int size);

    @Select("<script>" +
        "SELECT COUNT(*) FROM (" +
        "  SELECT COALESCE(NULLIF(ds.parent_asin,''), ds.asin) as grp" +
        "  FROM deng_zong_shop ds WHERE ds.title IS NOT NULL" +
        "  <if test='marketplace != null'> AND ds.marketplace = #{marketplace}</if>" +
        "  <if test='month != null'> AND ds.month = #{month}</if>" +
        "  <if test='brand != null'> AND ds.brand LIKE CONCAT('%',#{brand},'%')</if>" +
        "  <if test='sellerName != null'> AND ds.seller_name LIKE CONCAT('%',#{sellerName},'%')</if>" +
        "  <if test='title != null'> AND ds.title LIKE CONCAT('%',#{title},'%')</if>" +
        "  <if test='category != null'> AND SUBSTRING_INDEX(ds.node_label_path, ':', 1) = #{category}</if>" +
        "  <if test='bsrId != null'> AND ds.bsr_id = #{bsrId}</if>" +
        "  <if test='nodeId != null'> AND ds.node_id = #{nodeId}</if>" +
        "  <if test='priceMin != null'> AND ds.price &gt;= #{priceMin}</if>" +
        "  <if test='priceMax != null'> AND ds.price &lt;= #{priceMax}</if>" +
        "  <if test='bsrMax != null'> AND ds.bsr &lt;= #{bsrMax}</if>" +
        "  <if test='ratingMin != null'> AND ds.rating &gt;= #{ratingMin}</if>" +
        "  <if test='weightMax != null'> AND ds.weight &lt;= #{weightMax}</if>" +
        "  GROUP BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin)" +
        ") g" +
        "</script>")
    long countGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("category") String category,
            @Param("bsrId") String bsrId,
            @Param("nodeId") Long nodeId,
            @Param("priceMin") java.math.BigDecimal priceMin,
            @Param("priceMax") java.math.BigDecimal priceMax,
            @Param("bsrMax") Integer bsrMax,
            @Param("ratingMin") java.math.BigDecimal ratingMin,
            @Param("weightMax") String weightMax);

    @Select("<script>" +
        "SELECT ds.seller_name as sellerName, ds.marketplace," +
        "  COUNT(DISTINCT COALESCE(NULLIF(ds.parent_asin,''), ds.asin)) as productCount," +
        "  COALESCE(SUM(ds.revenue), 0) as totalRevenue," +
        "  COALESCE(SUM(ds.units), 0) as totalUnits," +
        "  ROUND(AVG(ds.rating), 1) as avgRating," +
        "  MAX(ds.month) as latestMonth" +
        " FROM deng_zong_shop ds WHERE ds.title IS NOT NULL" +
        " <if test='marketplace != null'> AND ds.marketplace = #{marketplace}</if>" +
        " GROUP BY ds.seller_name, ds.marketplace" +
        " ORDER BY totalRevenue DESC" +
        "</script>")
    List<java.util.Map<String, Object>> selectSellerSummary(
            @Param("marketplace") String marketplace);

    /** 查询已抓取数据的卖家名称（去重） */
    @Select("<script>" +
        "SELECT DISTINCT seller_name FROM deng_zong_shop WHERE title IS NOT NULL" +
        " <if test='marketplace != null'> AND marketplace = #{marketplace}</if>" +
        " <if test='sellerNames != null and sellerNames.size > 0'>" +
        "   AND seller_name IN " +
        "   <foreach collection='sellerNames' item='name' open='(' separator=',' close=')'>#{name}</foreach>" +
        " </if>" +
        "</script>")
    List<String> selectFetchedSellerNames(
            @Param("marketplace") String marketplace,
            @Param("sellerNames") List<String> sellerNames);

    /** 查询评分所需数据（卖家名称、类目、BSR、价格） */
    @Select("<script>" +
        "SELECT seller_name, node_id, bsr_id, price FROM deng_zong_shop WHERE title IS NOT NULL" +
        " <if test='marketplace != null'> AND marketplace = #{marketplace}</if>" +
        "</script>")
    List<java.util.Map<String, Object>> selectRatingData(
            @Param("marketplace") String marketplace);

    @Select("SELECT CONCAT(bsr_id, '_', node_id) AS composite_key, COUNT(*) AS product_count " +
            "FROM deng_zong_shop " +
            "WHERE marketplace = #{marketplace} AND month = #{month} " +
            "AND bsr_id IS NOT NULL AND node_id IS NOT NULL " +
            "GROUP BY bsr_id, node_id")
    List<Map<String, Object>> selectZhengNodeCounts(@Param("marketplace") String marketplace, @Param("month") String month);

    /** 郑总 bsr_id 按数量降序排列（保持郑总店铺当前的榜单顺序） */
    @Select("SELECT bsr_id AS bsrId, COUNT(*) AS productCount " +
            "FROM deng_zong_shop " +
            "WHERE marketplace = #{marketplace} AND month = #{month} " +
            "AND bsr_id IS NOT NULL " +
            "GROUP BY bsr_id ORDER BY productCount DESC")
    List<Map<String, Object>> selectZhengBsrIdsOrdered(
            @Param("marketplace") String marketplace,
            @Param("month") String month);

    @Select("SELECT MAX(month) FROM deng_zong_shop WHERE marketplace = #{marketplace}")
    String selectMaxMonth(@Param("marketplace") String marketplace);
}
