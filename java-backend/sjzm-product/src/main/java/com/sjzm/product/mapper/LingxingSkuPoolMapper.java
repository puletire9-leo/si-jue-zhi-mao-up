package com.sjzm.product.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 领星目标标签 SKU 池 Mapper。
 * 从 lingxing_product_performance.raw_json.tag_set 自动筛选，不走人工导出。
 */
@Mapper
public interface LingxingSkuPoolMapper {

    @Update("""
            UPDATE sku_pool
            SET is_active = 0, updated_at = NOW()
            WHERE snapshot_week = #{snapshotWeek}
              AND source = 'LINGXING_PERFORMANCE_TAG_SET'
            """)
    int deactivateSnapshot(@Param("snapshotWeek") String snapshotWeek);

    @Insert({
            "<script>",
            "INSERT INTO sku_pool (",
            "  sku, asin, parent_asin, product_name, marketplace, mid,",
            "  tag_ids, tags, developer, cg_price, pic_url, status, status_text,",
            "  source, snapshot_week, first_seen_week, last_seen_week, is_active",
            ")",
            "SELECT",
            "  base.sku,",
            "  MAX(base.asin) AS asin,",
            "  MAX(base.parent_asin) AS parent_asin,",
            "  COALESCE(MAX(llp.product_name), MAX(base.item_name)) AS product_name,",
            "  base.marketplace,",
            "  base.mid,",
            "  GROUP_CONCAT(DISTINCT base.global_tag_id ORDER BY base.global_tag_id SEPARATOR ',') AS tag_ids,",
            "  GROUP_CONCAT(DISTINCT base.tag_name ORDER BY base.tag_name SEPARATOR ',') AS tags,",
            "  MAX(llp.product_developer) AS developer,",
            "  MAX(llp.cg_price) AS cg_price,",
            "  MAX(llp.pic_url) AS pic_url,",
            "  MAX(llp.status) AS status,",
            "  MAX(llp.status_text) AS status_text,",
            "  'LINGXING_PERFORMANCE_TAG_SET' AS source,",
            "  #{snapshotWeek} AS snapshot_week,",
            "  COALESCE(MIN(old_pool.first_seen_week), #{snapshotWeek}) AS first_seen_week,",
            "  #{snapshotWeek} AS last_seen_week,",
            "  1 AS is_active",
            "FROM (",
            "  SELECT",
            "    pl.local_sku AS sku, p.asin, p.parent_asin, COALESCE(pl.local_name, p.item_name) AS item_name,",
            "    CAST(pl.mid AS UNSIGNED) AS mid,",
            "    CASE pl.mid WHEN '4' THEN 'UK' WHEN '5' THEN 'DE' END AS marketplace,",
            "    jt.global_tag_id, jt.tag_name",
            "  FROM lingxing_product_performance p",
            "  JOIN JSON_TABLE(",
            "    p.raw_json, '$.tag_set[*]'",
            "    COLUMNS (",
            "      global_tag_id VARCHAR(64) PATH '$.global_tag_id',",
            "      tag_name VARCHAR(255) PATH '$.tag_name'",
            "    )",
            "  ) jt",
            "  JOIN JSON_TABLE(",
            "    p.raw_json, '$.price_list[*]'",
            "    COLUMNS (",
            "      local_sku VARCHAR(128) COLLATE utf8mb4_unicode_ci PATH '$.local_sku',",
            "      local_name VARCHAR(512) COLLATE utf8mb4_unicode_ci PATH '$.local_name',",
            "      mid VARCHAR(16) PATH '$.mid'",
            "    )",
            "  ) pl",
            "  WHERE pl.mid IN ('4', '5')",
            "    AND pl.local_sku IS NOT NULL AND pl.local_sku != ''",
            "    AND jt.global_tag_id IN",
            "    <foreach collection='tagIds' item='tagId' open='(' separator=',' close=')'>",
            "      #{tagId}",
            "    </foreach>",
            ") base",
            "LEFT JOIN lingxing_local_product llp ON llp.sku = base.sku",
            "LEFT JOIN sku_pool old_pool",
            "  ON old_pool.sku = base.sku",
            " AND old_pool.marketplace = base.marketplace",
            " AND old_pool.source = 'LINGXING_PERFORMANCE_TAG_SET'",
            "GROUP BY base.sku, base.marketplace, base.mid",
            "ON DUPLICATE KEY UPDATE",
            "  asin = VALUES(asin),",
            "  parent_asin = VALUES(parent_asin),",
            "  product_name = VALUES(product_name),",
            "  mid = VALUES(mid),",
            "  tag_ids = VALUES(tag_ids),",
            "  tags = VALUES(tags),",
            "  developer = VALUES(developer),",
            "  cg_price = VALUES(cg_price),",
            "  pic_url = VALUES(pic_url),",
            "  status = VALUES(status),",
            "  status_text = VALUES(status_text),",
            "  first_seen_week = COALESCE(sku_pool.first_seen_week, VALUES(first_seen_week)),",
            "  last_seen_week = VALUES(last_seen_week),",
            "  is_active = 1,",
            "  updated_at = NOW()",
            "</script>"
    })
    int insertFromPerformanceTags(@Param("snapshotWeek") String snapshotWeek,
                                  @Param("tagIds") List<String> tagIds);

    @Select("""
            SELECT
              marketplace,
              mid,
              COUNT(*) AS skuCount,
              SUM(CASE WHEN tags LIKE '%绿标%' THEN 1 ELSE 0 END) AS greenCount,
              SUM(CASE WHEN tags LIKE '%非标品%' THEN 1 ELSE 0 END) AS customCount,
              SUM(CASE WHEN tags LIKE '%季节性断货%' THEN 1 ELSE 0 END) AS seasonalCount,
              SUM(CASE WHEN tags LIKE '%待淘汰%' THEN 1 ELSE 0 END) AS pendingEliminationCount,
              SUM(CASE WHEN tags LIKE '%淘汰%' AND tags NOT LIKE '%待淘汰%' THEN 1 ELSE 0 END) AS eliminatedCount
            FROM sku_pool
            WHERE snapshot_week = #{snapshotWeek}
              AND is_active = 1
              AND source = 'LINGXING_PERFORMANCE_TAG_SET'
            GROUP BY marketplace, mid
            ORDER BY marketplace
            """)
    List<Map<String, Object>> stats(@Param("snapshotWeek") String snapshotWeek);

    @Select("""
            SELECT
              id, sku, asin, parent_asin, product_name, marketplace, mid,
              tag_ids, tags, developer, cg_price, pic_url, status, status_text,
              snapshot_week, first_seen_week, last_seen_week, is_active, updated_at
            FROM sku_pool
            WHERE snapshot_week = #{snapshotWeek}
              AND is_active = 1
              AND source = 'LINGXING_PERFORMANCE_TAG_SET'
              AND (#{marketplace} IS NULL OR #{marketplace} = '' OR marketplace = #{marketplace})
              AND (#{sku} IS NULL OR #{sku} = '' OR sku LIKE CONCAT('%', #{sku}, '%'))
            ORDER BY marketplace, sku
            LIMIT #{limit} OFFSET #{offset}
            """)
    List<Map<String, Object>> list(@Param("snapshotWeek") String snapshotWeek,
                                   @Param("marketplace") String marketplace,
                                   @Param("sku") String sku,
                                   @Param("limit") int limit,
                                   @Param("offset") int offset);

    @Select("""
            SELECT COUNT(*)
            FROM sku_pool
            WHERE snapshot_week = #{snapshotWeek}
              AND is_active = 1
              AND source = 'LINGXING_PERFORMANCE_TAG_SET'
              AND (#{marketplace} IS NULL OR #{marketplace} = '' OR marketplace = #{marketplace})
              AND (#{sku} IS NULL OR #{sku} = '' OR sku LIKE CONCAT('%', #{sku}, '%'))
            """)
    long count(@Param("snapshotWeek") String snapshotWeek,
               @Param("marketplace") String marketplace,
               @Param("sku") String sku);
}
