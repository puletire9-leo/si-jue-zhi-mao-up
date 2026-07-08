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

    /** 取一批 PENDING 子项（按 seq 升序），原子置为 RUNNING 抢锁。返回抢到的条目。 */
    @Select("SELECT * FROM sellersprite_request_item WHERE run_id=#{runId} AND status='PENDING' ORDER BY seq ASC LIMIT #{batchSize}")
    List<SellerspriteRequestItem> selectPending(@Param("runId") String runId, @Param("batchSize") int batchSize);

    @Update("UPDATE sellersprite_request_item SET status='RUNNING', started_at=NOW() WHERE id=#{id} AND status='PENDING'")
    int claimRunning(@Param("id") Long id);

    /** 累计 run 的成功/失败/跳过计数。 */
    @Update("UPDATE sellersprite_request_run SET success_count=success_count+#{success}, failed_count=failed_count+#{failed}, skipped_count=skipped_count+#{skipped}, pending_count=pending_count-#{consumed}, updated_at=NOW() WHERE run_id=#{runId}")
    int applyItemResult(@Param("runId") String runId, @Param("success") int success, @Param("failed") int failed, @Param("skipped") int skipped, @Param("consumed") int consumed);

    /** 停止任务时释放尚未开始的 PENDING item。 */
    @Update("UPDATE sellersprite_request_item SET status='SKIPPED', error_message=#{message}, finished_at=NOW() WHERE id=#{id} AND status='PENDING'")
    int markPendingSkipped(@Param("id") Long id, @Param("message") String message);

    /** 重试单条 FAILED item：置回 PENDING，pending_count+1，failed_count-1。 */
    @Update({"<script>",
        "UPDATE sellersprite_request_item SET status='PENDING', error_message=NULL, started_at=NULL, finished_at=NULL WHERE id=#{id} AND status='FAILED'",
        "</script>"})
    int resetFailedToPending(@Param("id") Long id);

    @Update("UPDATE sellersprite_request_run SET pending_count=pending_count+1, failed_count=GREATEST(failed_count-1,0), status=CASE WHEN status IN ('SUCCESS','FAILED','PARTIAL_SUCCESS') THEN 'RUNNING' ELSE status END, finished_at=NULL, updated_at=NOW() WHERE run_id=#{runId}")
    int reopenForRetry(@Param("runId") String runId);
}
