package com.sjzm.product.modules.requestcenter.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.requestcenter.entity.SellerspriteRequestRun;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface SellerspriteRequestRunMapper extends BaseMapper<SellerspriteRequestRun> {

    /** 暂停：RUNNING → PAUSED。 */
    @Update("UPDATE sellersprite_request_run SET status='PAUSED', updated_at=NOW() WHERE run_id=#{runId} AND status='RUNNING'")
    int pause(@Param("runId") String runId);

    /** 恢复：人工暂停或系统暂停 → RUNNING。 */
    @Update("UPDATE sellersprite_request_run SET status='RUNNING', system_pause_reason=NULL, system_resume_at=NULL, updated_at=NOW() WHERE run_id=#{runId} AND status IN ('PAUSED','PAUSED_SYSTEM')")
    int resume(@Param("runId") String runId);

    /** 停止：RUNNING/PAUSED/PAUSED_SYSTEM/PENDING → STOPPED。worker 消费时遇到 STOPPED 不再继续。 */
    @Update("UPDATE sellersprite_request_run SET status='STOPPED', finished_at=NOW(), updated_at=NOW() WHERE run_id=#{runId} AND status IN ('RUNNING','PAUSED','PAUSED_SYSTEM','PENDING')")
    int stop(@Param("runId") String runId);

    /** 外部依赖门禁、熔断或结果未知时暂停整个运行，阻止领取后续子项。 */
    @Update("UPDATE sellersprite_request_run SET status='PAUSED_SYSTEM', system_pause_reason=#{reason}, system_resume_at=#{resumeAt}, updated_at=NOW() WHERE run_id=#{runId} AND status IN ('PENDING','RUNNING')")
    int pauseSystem(@Param("runId") String runId, @Param("reason") String reason,
                    @Param("resumeAt") java.time.LocalDateTime resumeAt);

    /** worker 抢锁：PENDING → RUNNING，started_at 仅首次置。 */
    @Update("UPDATE sellersprite_request_run SET status='RUNNING', started_at=COALESCE(started_at, NOW()), updated_at=NOW() WHERE run_id=#{runId} AND status='PENDING'")
    int claimRunning(@Param("runId") String runId);

    /** 累加使用次数。 */
    @Update("UPDATE sellersprite_request_run SET api_calls=api_calls+#{apiCalls}, updated_at=NOW() WHERE run_id=#{runId}")
    int addApiCalls(@Param("runId") String runId, @Param("apiCalls") int apiCalls);

    @Select("SELECT run_id FROM sellersprite_request_run WHERE status IN ('PENDING','RUNNING') ORDER BY created_at ASC")
    List<String> selectRunnableRunIds();

    @Select("SELECT run_id FROM sellersprite_request_run WHERE status='PAUSED_SYSTEM' AND system_resume_at IS NOT NULL AND system_resume_at <= NOW() ORDER BY system_resume_at ASC")
    List<String> selectDueSystemRetryRunIds();

    /** 查找同一初筛任务尚未结束的 ASIN 批量查询，供创建接口做幂等保护。 */
    @Select("SELECT * FROM sellersprite_request_run WHERE source_task_id=#{taskId} " +
            "AND request_type='ASIN_BATCH_LOOKUP' AND status IN ('PENDING','RUNNING','PAUSED','PAUSED_SYSTEM') " +
            "ORDER BY created_at DESC LIMIT 1")
    SellerspriteRequestRun selectActiveAsinRunBySourceTaskId(@Param("taskId") Long taskId);

    /**
     * 查询每个初筛任务最近一次 ASIN 批量查询运行记录，供来源页面展示真实执行状态。
     * 即使运行已结束也返回；新建任务的幂等判断仍使用 selectActiveAsinRunBySourceTaskId。
     */
    @Select("""
            <script>
            SELECT r.*
            FROM sellersprite_request_run r
            WHERE r.request_type = 'ASIN_BATCH_LOOKUP'
              AND r.source_task_id IN
              <foreach collection='taskIds' item='taskId' open='(' separator=',' close=')'>
                #{taskId}
              </foreach>
              AND r.run_id = (
                SELECT r2.run_id
                FROM sellersprite_request_run r2
                WHERE r2.source_task_id = r.source_task_id
                  AND r2.request_type = 'ASIN_BATCH_LOOKUP'
                ORDER BY r2.created_at DESC, r2.run_id DESC
                LIMIT 1
              )
            </script>
            """)
    List<SellerspriteRequestRun> selectLatestAsinRunsBySourceTaskIds(@Param("taskIds") List<Long> taskIds);

    @Select("SELECT * FROM sellersprite_request_run WHERE idempotency_key=#{key} AND status IN ('PENDING','RUNNING','PAUSED','PAUSED_SYSTEM') ORDER BY created_at DESC LIMIT 1")
    SellerspriteRequestRun selectActiveByIdempotencyKey(@Param("key") String key);

    @Update("""
            UPDATE sellersprite_request_run r
            SET
              pending_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status IN ('PENDING','RUNNING','WAITING_RETRY')),
              running_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status='RUNNING'),
              success_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status IN ('SUCCESS','PARTIAL_SUCCESS')),
              failed_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status='FAILED'),
              skipped_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status='SKIPPED'),
              updated_at = NOW()
            WHERE r.run_id=#{runId}
            """)
    int recountItemCounters(@Param("runId") String runId);
}
