package com.sjzm.product.modules.requestcenter.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface SellerspriteRequestItemMapper extends BaseMapper<SellerspriteRequestItem> {

    int insertBatch(@Param("items") List<SellerspriteRequestItem> items);

    /**
     * 一次性找店入口的全局去重：历史已发出、成功抓取、已有店铺数据或当前活跃任务都不可再入队。
     */
    @Select("""
            <script>
            SELECT DISTINCT shop_key
            FROM (
                SELECT CONVERT(CONCAT(UPPER(TRIM(i.marketplace)), '|', LOWER(TRIM(i.seller_name))) USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci AS shop_key
                FROM sellersprite_request_item i
                JOIN sellersprite_request_run r ON r.run_id = i.run_id
                WHERE i.seller_name IS NOT NULL
                  AND (
                    COALESCE(i.request_dispatched, 0) = 1
                    OR i.status IN ('SUCCESS', 'PARTIAL_SUCCESS')
                    OR (r.status IN ('PENDING', 'RUNNING', 'PAUSED', 'PAUSED_SYSTEM')
                        AND i.status IN ('PENDING', 'RUNNING', 'WAITING_RETRY'))
                  )
                  AND CONVERT(CONCAT(UPPER(TRIM(i.marketplace)), '|', LOWER(TRIM(i.seller_name))) USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci IN
                  <foreach collection='shopKeys' item='key' open='(' separator=',' close=')'>#{key}</foreach>
                UNION
                SELECT CONVERT(CONCAT(UPPER(TRIM(f.marketplace)), '|', LOWER(TRIM(f.seller_name))) USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci AS shop_key
                FROM shop_fetch_run f
                WHERE f.status IN ('SUCCESS', 'PARTIAL_SUCCESS')
                  AND CONVERT(CONCAT(UPPER(TRIM(f.marketplace)), '|', LOWER(TRIM(f.seller_name))) USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci IN
                  <foreach collection='shopKeys' item='key' open='(' separator=',' close=')'>#{key}</foreach>
                UNION
                SELECT CONVERT(CONCAT(UPPER(TRIM(p.marketplace)), '|', LOWER(TRIM(p.seller_name))) USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci AS shop_key
                FROM shop_products p
                WHERE p.seller_name IS NOT NULL AND TRIM(p.seller_name) != ''
                  AND CONVERT(CONCAT(UPPER(TRIM(p.marketplace)), '|', LOWER(TRIM(p.seller_name))) USING utf8mb4)
                    COLLATE utf8mb4_unicode_ci IN
                  <foreach collection='shopKeys' item='key' open='(' separator=',' close=')'>#{key}</foreach>
            ) existing
            </script>
            """)
    List<String> selectUnavailableOnceShopKeys(@Param("shopKeys") List<String> shopKeys);

    /** 精品复抓只拦截当前活跃任务，历史成功记录允许按周期再次抓取。 */
    @Select("""
            <script>
            SELECT DISTINCT CONVERT(CONCAT(UPPER(TRIM(i.marketplace)), '|', LOWER(TRIM(i.seller_name))) USING utf8mb4)
                COLLATE utf8mb4_unicode_ci AS shop_key
            FROM sellersprite_request_item i
            JOIN sellersprite_request_run r ON r.run_id = i.run_id
            WHERE i.seller_name IS NOT NULL
              AND r.status IN ('PENDING', 'RUNNING', 'PAUSED', 'PAUSED_SYSTEM')
              AND i.status IN ('PENDING', 'RUNNING', 'WAITING_RETRY')
              AND CONVERT(CONCAT(UPPER(TRIM(i.marketplace)), '|', LOWER(TRIM(i.seller_name))) USING utf8mb4)
                COLLATE utf8mb4_unicode_ci IN
              <foreach collection='shopKeys' item='key' open='(' separator=',' close=')'>#{key}</foreach>
            </script>
            """)
    List<String> selectActiveShopKeys(@Param("shopKeys") List<String> shopKeys);

    /** 取一批 PENDING 子项（按 seq 升序），原子置为 RUNNING 抢锁。返回抢到的条目。 */
    @Select("SELECT * FROM sellersprite_request_item WHERE run_id=#{runId} AND status='PENDING' ORDER BY seq ASC LIMIT #{batchSize}")
    List<SellerspriteRequestItem> selectPending(@Param("runId") String runId, @Param("batchSize") int batchSize);

    @Update("UPDATE sellersprite_request_item SET status='RUNNING', started_at=COALESCE(started_at, NOW()), last_attempt_at=NOW(), attempt_count=attempt_count+1 WHERE id=#{id} AND status='PENDING'")
    int claimRunning(@Param("id") Long id);

    /** 累计 run 的成功/失败/跳过计数。 */
    @Update("UPDATE sellersprite_request_run SET success_count=success_count+#{success}, failed_count=failed_count+#{failed}, skipped_count=skipped_count+#{skipped}, pending_count=pending_count-#{consumed}, updated_at=NOW() WHERE run_id=#{runId}")
    int applyItemResult(@Param("runId") String runId, @Param("success") int success, @Param("failed") int failed, @Param("skipped") int skipped, @Param("consumed") int consumed);

    /** 停止任务时释放尚未开始的 PENDING item。 */
    @Update("UPDATE sellersprite_request_item SET status='SKIPPED', error_message=#{message}, finished_at=NOW() WHERE id=#{id} AND status='PENDING'")
    int markPendingSkipped(@Param("id") Long id, @Param("message") String message);

    /** 手动重试失败/等待确认子项：保留历史错误和尝试次数，置回 PENDING。 */
    @Update({"<script>",
        "UPDATE sellersprite_request_item SET status='PENDING', next_retry_at=NULL, started_at=NULL, finished_at=NULL WHERE id=#{id} AND status IN ('FAILED','WAITING_RETRY')",
        "</script>"})
    int resetFailedToPending(@Param("id") Long id);

    @Update("UPDATE sellersprite_request_item SET status='WAITING_RETRY', error_message=#{message}, error_code=#{errorCode}, error_summary=#{summary}, request_dispatched=#{requestDispatched}, usage_confirmed=#{usageConfirmed}, next_retry_at=#{retryAt}, finished_at=NULL WHERE id=#{id} AND status='RUNNING'")
    int markWaitingRetry(@Param("id") Long id, @Param("message") String message,
                         @Param("errorCode") String errorCode, @Param("summary") String summary,
                         @Param("requestDispatched") boolean requestDispatched,
                         @Param("usageConfirmed") boolean usageConfirmed,
                         @Param("retryAt") java.time.LocalDateTime retryAt);

    @Update("UPDATE sellersprite_request_run SET status=CASE WHEN status IN ('SUCCESS','FAILED','PARTIAL_SUCCESS','PAUSED_SYSTEM') THEN 'RUNNING' ELSE status END, system_pause_reason=NULL, system_resume_at=NULL, finished_at=NULL, updated_at=NOW() WHERE run_id=#{runId}")
    int reopenForRetry(@Param("runId") String runId);

    /** 重启回收：已发出且尚未确认计费的请求不得自动重发，转为 WAITING_RETRY。 */
    @Update("UPDATE sellersprite_request_item SET status=CASE WHEN request_dispatched=1 AND usage_confirmed=0 THEN 'WAITING_RETRY' ELSE 'PENDING' END, next_retry_at=CASE WHEN request_dispatched=1 AND usage_confirmed=0 THEN NULL ELSE next_retry_at END, started_at=NULL, error_code=CASE WHEN request_dispatched=1 AND usage_confirmed=0 THEN COALESCE(error_code,'READ_TIMEOUT') ELSE error_code END, error_summary=CASE WHEN request_dispatched=1 AND usage_confirmed=0 THEN COALESCE(error_summary,'服务重启时请求结果未知，等待人工确认') ELSE error_summary END WHERE run_id=#{runId} AND status='RUNNING'")
    int resetRunningToPending(@Param("runId") String runId);

    @Select("SELECT COUNT(*) FROM sellersprite_request_item WHERE run_id=#{runId} AND status='WAITING_RETRY'")
    int countWaitingRetry(@Param("runId") String runId);

    @Update("UPDATE sellersprite_request_item SET status='PENDING', next_retry_at=NULL, started_at=NULL WHERE run_id=#{runId} AND status='WAITING_RETRY' AND request_dispatched=0 AND next_retry_at IS NOT NULL AND next_retry_at <= NOW()")
    int releaseDueSafeRetries(@Param("runId") String runId);
}
