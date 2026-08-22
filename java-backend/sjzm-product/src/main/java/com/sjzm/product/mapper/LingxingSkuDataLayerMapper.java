package com.sjzm.product.mapper;

import com.sjzm.product.rds.lingxing.LingxingRdsMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

/**
 * 数据同步运行记录 Mapper。
 *
 * <p>2026-07 数据库整理后，本 Mapper 只保留 lingxing_data_sync_run 表的 begin/finish 方法，
 * 原本挂在这里的 snapshot/weekly/monthly 加工方法已移除（本 Mapper 不再承载它们）。
 * 注意（2026-08-13 实地对账修正）：以下表**仍然存在且在用**，此前注释误称"已全部删除"是错的——
 * lingxing_product_performance（6.9万行）、lingxing_target_sku_pool（6451 行，被 LingxingPurchaseDataLayerMapper
 * / LingxingSkuWeeklyMapper.xml 大量引用）、lingxing_sku_weekly_performance（49万行）均为活表。
 * 生产库确实不存在的是 sku_store_snapshot / sku_pool（只有废弃建表脚本，从未建表）。</p>
 */
@Mapper
public interface LingxingSkuDataLayerMapper extends LingxingRdsMapper {

    @Insert("""
            INSERT INTO lingxing_data_sync_run (
              run_id, run_type, marketplace, start_date, end_date, snapshot_week, `year_month`,
              status, request_json, started_at
            ) VALUES (
              #{runId}, #{runType}, #{marketplace}, #{startDate}, #{endDate}, #{snapshotWeek}, #{yearMonth},
              'RUNNING', #{requestJson}, NOW()
            )
            ON DUPLICATE KEY UPDATE
              run_type = VALUES(run_type),
              marketplace = VALUES(marketplace),
              start_date = VALUES(start_date),
              end_date = VALUES(end_date),
              snapshot_week = VALUES(snapshot_week),
              `year_month` = VALUES(`year_month`),
              status = 'RUNNING',
              request_json = VALUES(request_json),
              started_at = NOW(),
              finished_at = NULL,
              error_message = NULL,
              updated_at = NOW()
            """)
    int beginRun(@Param("runId") String runId,
                 @Param("runType") String runType,
                 @Param("marketplace") String marketplace,
                 @Param("startDate") String startDate,
                 @Param("endDate") String endDate,
                 @Param("snapshotWeek") String snapshotWeek,
                 @Param("yearMonth") String yearMonth,
                 @Param("requestJson") String requestJson);

    @Update("""
            UPDATE lingxing_data_sync_run
            SET status = #{status},
                upserted_count = #{upsertedCount},
                error_message = #{errorMessage},
                finished_at = NOW(),
                updated_at = NOW()
            WHERE run_id = #{runId}
            """)
    int finishRun(@Param("runId") String runId,
                  @Param("status") String status,
                  @Param("upsertedCount") int upsertedCount,
                  @Param("errorMessage") String errorMessage);

    /** 查询最近 N 条同步记录（工作台展示同步历史） */
    @Select("""
            SELECT run_id, run_type, marketplace, start_date, end_date,
                   status, upserted_count, fetched_count, error_message,
                   started_at, finished_at
            FROM lingxing_data_sync_run
            ORDER BY started_at DESC
            LIMIT #{limit}
            """)
    List<Map<String, Object>> listRecentRuns(@Param("limit") int limit);

    // ============================================================
    // 周表加工：从 lingxing_product_performance(summary_field=msku) 的 raw_json
    // 展开 price_list[*]/tag_set[*] → 落 lingxing_sku_weekly_performance。
    // 一个时间窗一行(SKU×店铺×周)，SHA256 幂等键，限定 mid IN(4,5)=UK/DE。
    // 见 mapper/LingxingSkuWeeklyMapper.xml。
    // ============================================================

    /**
     * 从已落库产品表现加工进周表。startDate/endDate 为 null 时加工全部窗口。
     * @return 影响行数
     */
    int upsertWeeklyFromPerformance(@Param("startDate") String startDate,
                                    @Param("endDate") String endDate,
                                    @Param("snapshotWeek") String snapshotWeek,
                                    @Param("sourceRunId") String sourceRunId);

    /** 统计指定窗口周表行数（校验用）。 */
    @Select("""
            <script>
            SELECT COUNT(*) FROM lingxing_sku_weekly_performance
            <where>
              <if test="startDate != null"> AND week_start = #{startDate} </if>
              <if test="endDate != null"> AND week_end = #{endDate} </if>
            </where>
            </script>
            """)
    int countWeekly(@Param("startDate") String startDate, @Param("endDate") String endDate);

    /**
     * 只保留本周命中 6 个团队标签的 ASIN 原始周行，删掉其余以省空间。
     * 标签 ID 与统一表准入一致。
     */
    @Delete("""
            DELETE w FROM lingxing_sku_weekly_performance w
            LEFT JOIN (
                SELECT DISTINCT asin
                FROM lingxing_sku_weekly_performance
                WHERE week_start = #{startDate}
                  AND week_end = #{endDate}
                  AND tag_ids IS NOT NULL AND tag_ids <> ''
                  AND (
                        FIND_IN_SET('907563170455592213', tag_ids)
                     OR FIND_IN_SET('907654877317203632', tag_ids)
                     OR FIND_IN_SET('907585631391968576', tag_ids)
                     OR FIND_IN_SET('907585847123066054', tag_ids)
                     OR FIND_IN_SET('907596133278666918', tag_ids)
                     OR FIND_IN_SET('907657425150046095', tag_ids)
                  )
            ) keep ON keep.asin = w.asin
            WHERE w.week_start = #{startDate}
              AND w.week_end = #{endDate}
              AND keep.asin IS NULL
            """)
    int pruneWeeklyNonTeam(@Param("startDate") String startDate, @Param("endDate") String endDate);

    /** 本周窗口的产品表现原始行，只留仍在周表里的 ASIN。 */
    @Delete("""
            DELETE p FROM lingxing_product_performance p
            LEFT JOIN (
                SELECT DISTINCT asin
                FROM lingxing_sku_weekly_performance
                WHERE week_start = #{startDate}
                  AND week_end = #{endDate}
                  AND asin IS NOT NULL AND asin <> ''
            ) keep ON keep.asin = p.asin
            WHERE p.start_date = #{startDate}
              AND p.end_date = #{endDate}
              AND keep.asin IS NULL
            """)
    int pruneWeeklyRawPerformance(@Param("startDate") String startDate, @Param("endDate") String endDate);
}
