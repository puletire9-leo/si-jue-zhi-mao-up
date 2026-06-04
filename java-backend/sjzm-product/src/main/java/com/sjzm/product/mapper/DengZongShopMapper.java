package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.DengZongShop;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Collection;
import java.util.List;
import java.util.Map;

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
        ") t WHERE t.rn = 1" +
        "<if test='sortBy != null and sortOrder != null'>" +
        "  ORDER BY " +
        "  <choose>" +
        "    <when test='sortBy == \"bsr\"'>t.bsr</when>" +
        "    <when test='sortBy == \"units\"'>t.units</when>" +
        "    <when test='sortBy == \"price\"'>t.price</when>" +
        "    <otherwise>t.bsr</otherwise>" +
        "  </choose>" +
        "  ${sortOrder}" +
        "</if>" +
        "<if test='sortBy == null'> ORDER BY t.bsr ASC</if>" +
        " LIMIT #{offset}, #{size}" +
        "</script>")
    List<DengZongShop> selectGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("category") String category,
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
        "  GROUP BY COALESCE(NULLIF(ds.parent_asin,''), ds.asin)" +
        ") g" +
        "</script>")
    long countGroupedByParent(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("brand") String brand,
            @Param("sellerName") String sellerName,
            @Param("title") String title,
            @Param("category") String category);

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

    /** 按 marketplace + sellerName 拉取单店商品（评分用） */
    @Select("<script>" +
        "SELECT ds.seller_name, ds.node_id, ds.bsr_id, ds.price" +
        " FROM deng_zong_shop ds" +
        " WHERE ds.title IS NOT NULL AND ds.marketplace = #{marketplace}" +
        " AND ds.seller_name = #{sellerName}" +
        "</script>")
    List<Map<String, Object>> selectRatingDataBySeller(
            @Param("marketplace") String marketplace,
            @Param("sellerName") String sellerName);

    /** 按 marketplace 拉取郑总店铺商品（评分基准构建用） */
    @Select("<script>" +
        "SELECT ds.seller_name, ds.node_id, ds.bsr_id, ds.price" +
        " FROM deng_zong_shop ds" +
        " WHERE ds.title IS NOT NULL AND ds.marketplace = #{marketplace}" +
        "</script>")
    List<Map<String, Object>> selectRatingData(@Param("marketplace") String marketplace);

    /** 批量检查哪些卖家在 deng_zong_shop 有数据 */
    @Select("<script>" +
        "SELECT DISTINCT seller_name FROM deng_zong_shop" +
        " WHERE marketplace = #{marketplace} AND seller_name IN" +
        " <foreach item='name' collection='sellerNames' open='(' separator=',' close=')'>" +
        "   #{name}" +
        " </foreach>" +
        "</script>")
    List<String> selectFetchedSellerNames(
            @Param("marketplace") String marketplace,
            @Param("sellerNames") Collection<String> sellerNames);
}
