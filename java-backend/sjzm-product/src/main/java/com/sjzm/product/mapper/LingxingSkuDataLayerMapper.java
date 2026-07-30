package com.sjzm.product.mapper;

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
 * <p>2026-07 数据库整理后，本 Mapper 只保留 lingxing_data_sync_run 表的 begin/finish 方法。
 * 原有的 sku_store_snapshot / target_sku_pool / weekly / monthly 相关方法已删除，
 * 因为其对应的 lingxing_product_performance / target_sku_pool / sku_store_snapshot 表已全部删除。
 * SKU 周表(lingxing_sku_weekly_performance) 未来若需从 API 直接同步，应新建独立的 Mapper。</p>
 */
@Mapper
public interface LingxingSkuDataLayerMapper {

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
}
