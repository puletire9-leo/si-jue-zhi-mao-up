package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.SubcategoryAliasMap;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface SubcategoryAliasMapMapper extends BaseMapper<SubcategoryAliasMap> {

    @Insert({
            "<script>",
            "INSERT INTO subcategory_alias_map (",
            "id, source_type, marketplace, raw_subcategory, normalized_subcategory,",
            "canonical_key, canonical_name, carrier_hint, sample_count, latest_month,",
            "match_method, status, notes, deleted, created_at, updated_at",
            ") VALUES (",
            "#{id}, #{sourceType}, #{marketplace}, #{rawSubcategory}, #{normalizedSubcategory},",
            "#{canonicalKey}, #{canonicalName}, #{carrierHint}, #{sampleCount}, #{latestMonth},",
            "#{matchMethod}, #{status}, #{notes}, #{deleted}, #{createdAt}, #{updatedAt}",
            ") ON DUPLICATE KEY UPDATE",
            "normalized_subcategory = VALUES(normalized_subcategory),",
            "canonical_key = VALUES(canonical_key),",
            "canonical_name = VALUES(canonical_name),",
            "carrier_hint = VALUES(carrier_hint),",
            "sample_count = VALUES(sample_count),",
            "latest_month = VALUES(latest_month),",
            "match_method = VALUES(match_method),",
            "status = VALUES(status),",
            "notes = VALUES(notes),",
            "deleted = VALUES(deleted),",
            "updated_at = VALUES(updated_at)",
            "</script>"
    })
    int upsert(SubcategoryAliasMap entity);

    @Select("<script>" +
            "SELECT totals.rawSubcategory, dominant.carrierHint, totals.sampleCount " +
            "FROM (" +
            "  SELECT category_sub AS rawSubcategory, COUNT(*) AS sampleCount " +
            "  FROM product_performance_actual " +
            "  WHERE category_sub IS NOT NULL AND TRIM(category_sub) != '' " +
            "    AND LOWER(TRIM(category_sub)) != 'null' " +
            "  GROUP BY category_sub" +
            ") totals " +
            "LEFT JOIN (" +
            "  SELECT ranked.rawSubcategory, ranked.carrierHint " +
            "  FROM (" +
            "    SELECT grouped.rawSubcategory, grouped.carrierHint, grouped.carrierCount, " +
            "           ROW_NUMBER() OVER (" +
            "               PARTITION BY grouped.rawSubcategory " +
            "               ORDER BY grouped.carrierCount DESC, grouped.carrierHint" +
            "           ) AS rn " +
            "    FROM (" +
            "      SELECT category_sub AS rawSubcategory, " +
            "             NULLIF(TRIM(carrier), '') AS carrierHint, " +
            "             COUNT(*) AS carrierCount " +
            "      FROM product_performance_actual " +
            "      WHERE category_sub IS NOT NULL AND TRIM(category_sub) != '' " +
            "        AND LOWER(TRIM(category_sub)) != 'null' " +
            "      GROUP BY category_sub, NULLIF(TRIM(carrier), '')" +
            "    ) grouped" +
            "  ) ranked " +
            "  WHERE ranked.rn = 1" +
            ") dominant ON dominant.rawSubcategory = totals.rawSubcategory " +
            "ORDER BY totals.sampleCount DESC, totals.rawSubcategory" +
            "</script>")
    List<Map<String, Object>> selectWinnerSubcategorySeeds();

    @Select("<script>" +
            "SELECT marketplace, " +
            "TRIM(SUBSTRING_INDEX(node_label_path, ':', -1)) AS rawSubcategory, " +
            "COUNT(*) AS sampleCount " +
            "FROM competitor_products " +
            "WHERE month = #{baselineMonth} " +
            "AND node_label_path IS NOT NULL " +
            "AND TRIM(SUBSTRING_INDEX(node_label_path, ':', -1)) != '' " +
            "AND LOWER(TRIM(SUBSTRING_INDEX(node_label_path, ':', -1))) != 'null' " +
            "<if test='marketplace != null and marketplace != \"\"'> AND marketplace = #{marketplace}</if> " +
            "GROUP BY marketplace, TRIM(SUBSTRING_INDEX(node_label_path, ':', -1)) " +
            "ORDER BY marketplace, sampleCount DESC, rawSubcategory" +
            "</script>")
    List<Map<String, Object>> selectCompetitorLeafSeeds(@Param("baselineMonth") String baselineMonth,
                                                        @Param("marketplace") String marketplace);
}
