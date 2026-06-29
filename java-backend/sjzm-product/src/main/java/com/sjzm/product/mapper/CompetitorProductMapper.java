package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
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

    /** 模式一按卖家聚合候选店铺（统计场景：走清洗表，避免变体污染） */
    @Select("<script>" +
        "SELECT cp.seller_name as sellerName, cp.marketplace," +
        "  COUNT(DISTINCT COALESCE(NULLIF(cp.parent_asin,''), cp.asin)) as newProductCount" +
        " FROM competitor_products_clean cp" +
        " WHERE cp.title IS NOT NULL AND cp.filter_mode = 'MODE1'" +
        " <if test='marketplace != null'> AND cp.marketplace = #{marketplace}</if>" +
        " GROUP BY cp.seller_name, cp.marketplace" +
        " HAVING COUNT(DISTINCT COALESCE(NULLIF(cp.parent_asin,''), cp.asin)) >= #{minCount}" +
        " ORDER BY newProductCount DESC" +
        "</script>")
    List<java.util.Map<String, Object>> selectNewProductCandidates(
            @Param("marketplace") String marketplace,
            @Param("minCount") int minCount);

    /** 统计场景：按 bsr_id 商品数量（走清洗表） */
    @Select("SELECT bsr_id AS bsrId, COUNT(*) AS productCount" +
            " FROM competitor_products_clean" +
            " WHERE marketplace = #{marketplace} AND month = #{month}" +
            " GROUP BY bsr_id" +
            " ORDER BY productCount DESC")
    List<Map<String, Object>> countByBsrId(@Param("marketplace") String marketplace, @Param("month") String month);

    /** 统计场景：按 node_id 商品数量（走清洗表） */
    @Select("SELECT bsr_id AS bsrId, node_id AS nodeId," +
            " MAX(node_label_path) AS nodeFullPath," +
            " SUBSTRING_INDEX(MAX(node_label_path), ':', -1) AS nodeName," +
            " COUNT(*) AS productCount" +
            " FROM competitor_products_clean" +
            " WHERE marketplace = #{marketplace} AND month = #{month}" +
            " AND filter_mode = 'MODE1'" +
            " GROUP BY bsr_id, node_id" +
            " ORDER BY bsr_id, productCount DESC")
    List<Map<String, Object>> countByNodeId(@Param("marketplace") String marketplace, @Param("month") String month);

    @Select("SELECT DISTINCT bsr_id FROM competitor_products WHERE marketplace = #{marketplace}")
    Set<String> selectDistinctBsrIdByMarketplace(@Param("marketplace") String marketplace);

    @Select("<script>" +
            "SELECT MAX(month) FROM competitor_products " +
            "WHERE month IS NOT NULL AND month != '' " +
            "<if test='marketplace != null and marketplace != \"\"'> AND marketplace = #{marketplace}</if>" +
            "</script>")
    String selectLatestMonth(@Param("marketplace") String marketplace);

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

    /**
     * 数据清洗层：拉取候选商品（走清洗表，已按父 ASIN 去重）
     * 用于 ④线 ElementDiscovery 的元素发现/载体审计/manual-candidates 接口
     * 见 docs/选品方法库/补充/数据清洗层.md
     */
    @Select("<script>" +
            "SELECT marketplace, asin, `month`, title, brand, node_label_path, bsr_id, units, bsr, price " +
            "FROM competitor_products_clean " +
            "WHERE marketplace = #{marketplace} AND `month` = #{month} " +
            "AND title IS NOT NULL AND title != '' " +
            "ORDER BY units DESC, asin ASC " +
            "LIMIT #{scanLimit}" +
            "</script>")
    List<CompetitorProduct> selectCleanCandidatesForDiscovery(
            @Param("marketplace") String marketplace,
            @Param("month") String month,
            @Param("scanLimit") int scanLimit);

    /**
     * 清洗表分页查询：复用业务层组装的 LambdaQueryWrapper（其条件列名与 clean 表一致），
     * 只换 FROM 表名为 competitor_products_clean。
     */
    long selectCountFromClean(@Param("ew") Wrapper<CompetitorProduct> wrapper);

    List<CompetitorProduct> selectListFromClean(@Param("ew") Wrapper<CompetitorProduct> wrapper);

    /**
     * 按 (marketplace, dedupKey) 批量统计原始表 competitor_products 中每个父群组的变体行数。
     * dedupKey = COALESCE(NULLIF(parent_asin,''), asin)，与清洗表的 dedup_key 一致。
     * 返回每条 { dedupKey: String, variantCount: Long }。
     */
    List<Map<String, Object>> selectVariantCountsByDedupKeys(@Param("marketplace") String marketplace,
                                                              @Param("keys") List<String> dedupKeys);
}
