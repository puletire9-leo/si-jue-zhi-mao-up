package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.CompetitorProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

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
