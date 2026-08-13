package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.AiSelectionProduct;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface AiSelectionMapper extends BaseMapper<AiSelectionProduct> {

    /**
     * 从 shop_products 表查找 ASIN（优先数据源）。
     */
    @Select("SELECT * FROM shop_products WHERE asin = #{asin} AND marketplace = #{marketplace} LIMIT 1")
    Map<String, Object> lookupFromShop(@Param("asin") String asin, @Param("marketplace") String marketplace);

    /**
     * 从 competitor_products_clean 表查找 ASIN（兜底数据源）。
     */
    @Select("SELECT * FROM competitor_products_clean WHERE asin = #{asin} AND marketplace = #{marketplace} LIMIT 1")
    Map<String, Object> lookupFromClean(@Param("asin") String asin, @Param("marketplace") String marketplace);

    /**
     * 批量插入（INSERT IGNORE 防重复）。
     */
    int insertBatchIgnoreDup(@Param("list") List<AiSelectionProduct> list);

    /**
     * 全量捞取：从 shop_products 按双通道（标题主词 ∪ 类目路径）INSERT IGNORE 进 ai_selection。
     * 在数据库内完成，不进 Java 内存。批次/载体等常量由参数填充。
     */
    int harvestFromShop(@Param("marketplace") String marketplace,
                        @Param("batchId") String batchId,
                        @Param("batchLabel") String batchLabel,
                        @Param("carrier") String carrier,
                        @Param("pushedBy") String pushedBy,
                        @Param("titleKeywords") List<String> titleKeywords,
                        @Param("categoryPaths") List<String> categoryPaths,
                        @Param("excludeKeywords") List<String> excludeKeywords,
                        @Param("conditionalExcludeKeywords") List<String> conditionalExcludeKeywords,
                        @Param("includeKeywords") List<String> includeKeywords);

    /**
     * 全量捞取：从 competitor_products_clean 按双通道 INSERT IGNORE 进 ai_selection。
     * shop 先跑、clean 后跑，靠 uk_batch_asin(batch_id, asin) 去重优先保留 shop。
     */
    int harvestFromClean(@Param("marketplace") String marketplace,
                         @Param("batchId") String batchId,
                         @Param("batchLabel") String batchLabel,
                         @Param("carrier") String carrier,
                         @Param("pushedBy") String pushedBy,
                         @Param("titleKeywords") List<String> titleKeywords,
                         @Param("categoryPaths") List<String> categoryPaths,
                         @Param("excludeKeywords") List<String> excludeKeywords,
                         @Param("conditionalExcludeKeywords") List<String> conditionalExcludeKeywords,
                         @Param("includeKeywords") List<String> includeKeywords);

    /**
     * 合并扫描（提速 C）：一次扫 shop_products 某站点，全载体 OR 并集召回 + CASE 分流 carrier。
     * 把「每载体一条」压成「每站点一条」，扫表次数减 17 倍。
     */
    int harvestAllFromShop(@Param("marketplace") String marketplace,
                           @Param("batchId") String batchId,
                           @Param("batchLabel") String batchLabel,
                           @Param("pushedBy") String pushedBy,
                           @Param("carriers") List<com.sjzm.product.dto.CarrierHarvestSpec> carriers);

    /**
     * 合并扫描：一次扫 competitor_products_clean 某站点，全载体 OR 并集 + CASE 分流。
     */
    int harvestAllFromClean(@Param("marketplace") String marketplace,
                            @Param("batchId") String batchId,
                            @Param("batchLabel") String batchLabel,
                            @Param("pushedBy") String pushedBy,
                            @Param("carriers") List<com.sjzm.product.dto.CarrierHarvestSpec> carriers);

    /**
     * 统计某批次实际写入行数。
     */
    @Select("SELECT COUNT(*) FROM ai_selection WHERE batch_id = #{batchId}")
    int countByBatch(@Param("batchId") String batchId);

    /**
     * 查询批次列表（聚合每个批次的商品数）。
     */
    @Select("SELECT batch_id, " +
            "       MAX(batch_label) AS batch_label, " +
            "       MAX(pushed_by)   AS pushed_by, " +
            "       MAX(pushed_at)   AS pushed_at, " +
            "       COUNT(*)         AS product_count " +
            "FROM ai_selection " +
            "WHERE marketplace = #{marketplace} " +
            "GROUP BY batch_id " +
            "ORDER BY MAX(pushed_at) DESC")
    List<Map<String, Object>> selectBatches(@Param("marketplace") String marketplace);

    /**
     * 查询大类目统计。
     */
    @Select("<script>" +
            "SELECT TRIM(SUBSTRING_INDEX(node_label_path, ':', 1)) AS category, COUNT(*) AS count " +
            "FROM ai_selection " +
            "WHERE marketplace = #{marketplace} " +
            "  AND node_label_path IS NOT NULL " +
            "  AND TRIM(node_label_path) != '' " +
            "  AND LOWER(TRIM(SUBSTRING_INDEX(node_label_path, ':', 1))) != 'null' " +
            "  AND TRIM(SUBSTRING_INDEX(node_label_path, ':', 1)) != '' " +
            "<if test='batchIds != null and batchIds.size() > 0'>" +
            "  AND batch_id IN " +
            "  <foreach item='id' collection='batchIds' open='(' separator=',' close=')'>#{id}</foreach>" +
            "</if>" +
            "GROUP BY TRIM(SUBSTRING_INDEX(node_label_path, ':', 1)) ORDER BY count DESC" +
            "</script>")
    List<Map<String, Object>> selectCategories(@Param("marketplace") String marketplace,
                                               @Param("batchIds") List<String> batchIds);
}
