package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.DengZongShop;
import org.apache.ibatis.annotations.Insert;
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

    /**
     * 插入或更新（ON DUPLICATE KEY UPDATE），自动更新 updated_at
     */
    @Insert({"<script>",
        "INSERT INTO deng_zong_shop (marketplace, asin, `month`, title, brand, brand_url, image_url, parent_asin, sku, " +
        "node_id, node_id_path, node_label_path, symbol, units, units_gr, amz_unit, amz_sales, amz_unit_date, " +
        "revenue, bsr_id, bsr, bsr_cr, bsr_cv, ratings, rating, ratings_rate, ratings_cv, rating_delta, " +
        "price, prime_price, profit, fba, delivery_price, seller_name, seller_id, seller_nation, sellers, " +
        "fulfillment, variations, weight, dimension, dimensions_type, pkg_dimensions, pkg_dimension_type, " +
        "pkg_weight, lqs, available_date, best_seller, amazon_choice, new_release, ebc, video, " +
        "product_url, similar_url, source, created_at, updated_at) VALUES (",
        "#{marketplace}, #{asin}, #{month}, #{title}, #{brand}, #{brandUrl}, #{imageUrl}, #{parentAsin}, #{sku}, " +
        "#{nodeId}, #{nodeIdPath}, #{nodeLabelPath}, #{symbol}, #{units}, #{unitsGr}, #{amzUnit}, #{amzSales}, #{amzUnitDate}, " +
        "#{revenue}, #{bsrId}, #{bsr}, #{bsrCr}, #{bsrCv}, #{ratings}, #{rating}, #{ratingsRate}, #{ratingsCv}, #{ratingDelta}, " +
        "#{price}, #{primePrice}, #{profit}, #{fba}, #{deliveryPrice}, #{sellerName}, #{sellerId}, #{sellerNation}, #{sellers}, " +
        "#{fulfillment}, #{variations}, #{weight}, #{dimension}, #{dimensionsType}, #{pkgDimensions}, #{pkgDimensionType}, " +
        "#{pkgWeight}, #{lqs}, #{availableDate}, #{bestSeller}, #{amazonChoice}, #{newRelease}, #{ebc}, #{video}, " +
        "#{productUrl}, #{similarUrl}, #{source}, NOW(), NOW())",
        "ON DUPLICATE KEY UPDATE",
        "title=VALUES(title), brand=VALUES(brand), brand_url=VALUES(brand_url), image_url=VALUES(image_url),",
        "parent_asin=VALUES(parent_asin), sku=VALUES(sku),",
        "node_id=VALUES(node_id), node_id_path=VALUES(node_id_path), node_label_path=VALUES(node_label_path),",
        "units=VALUES(units), units_gr=VALUES(units_gr), amz_unit=VALUES(amz_unit), amz_sales=VALUES(amz_sales),",
        "revenue=VALUES(revenue), bsr_id=VALUES(bsr_id), bsr=VALUES(bsr), bsr_cr=VALUES(bsr_cr), bsr_cv=VALUES(bsr_cv),",
        "ratings=VALUES(ratings), rating=VALUES(rating), ratings_rate=VALUES(ratings_rate), ratings_cv=VALUES(ratings_cv), rating_delta=VALUES(rating_delta),",
        "price=VALUES(price), prime_price=VALUES(prime_price), profit=VALUES(profit), fba=VALUES(fba), delivery_price=VALUES(delivery_price),",
        "seller_name=VALUES(seller_name), seller_id=VALUES(seller_id), seller_nation=VALUES(seller_nation), sellers=VALUES(sellers),",
        "fulfillment=VALUES(fulfillment), variations=VALUES(variations), weight=VALUES(weight), dimension=VALUES(dimension),",
        "dimensions_type=VALUES(dimensions_type), pkg_dimensions=VALUES(pkg_dimensions), pkg_dimension_type=VALUES(pkg_dimension_type),",
        "pkg_weight=VALUES(pkg_weight), lqs=VALUES(lqs), available_date=VALUES(available_date),",
        "best_seller=VALUES(best_seller), amazon_choice=VALUES(amazon_choice), new_release=VALUES(new_release),",
        "ebc=VALUES(ebc), video=VALUES(video), product_url=VALUES(product_url), similar_url=VALUES(similar_url),",
        "source=VALUES(source), updated_at=NOW()",
        "</script>"})
    int upsert(DengZongShop entity);
}
