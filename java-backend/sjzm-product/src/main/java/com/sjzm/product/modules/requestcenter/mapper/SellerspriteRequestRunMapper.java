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

    /** 恢复：PAUSED → RUNNING。 */
    @Update("UPDATE sellersprite_request_run SET status='RUNNING', updated_at=NOW() WHERE run_id=#{runId} AND status='PAUSED'")
    int resume(@Param("runId") String runId);

    /** 停止：RUNNING/PAUSED/PENDING → STOPPED。worker 消费时遇到 STOPPED 不再继续。 */
    @Update("UPDATE sellersprite_request_run SET status='STOPPED', finished_at=NOW(), updated_at=NOW() WHERE run_id=#{runId} AND status IN ('RUNNING','PAUSED','PENDING')")
    int stop(@Param("runId") String runId);

    /** worker 抢锁：PENDING → RUNNING，started_at 仅首次置。 */
    @Update("UPDATE sellersprite_request_run SET status='RUNNING', started_at=COALESCE(started_at, NOW()), updated_at=NOW() WHERE run_id=#{runId} AND status='PENDING'")
    int claimRunning(@Param("runId") String runId);

    /** 累加使用次数。 */
    @Update("UPDATE sellersprite_request_run SET api_calls=api_calls+#{apiCalls}, updated_at=NOW() WHERE run_id=#{runId}")
    int addApiCalls(@Param("runId") String runId, @Param("apiCalls") int apiCalls);

    @Select("SELECT run_id FROM sellersprite_request_run WHERE status IN ('PENDING','RUNNING') ORDER BY created_at ASC")
    List<String> selectRunnableRunIds();

    @Update("""
            UPDATE sellersprite_request_run r
            SET
              pending_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status IN ('PENDING','RUNNING')),
              running_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status='RUNNING'),
              success_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status IN ('SUCCESS','PARTIAL_SUCCESS')),
              failed_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status='FAILED'),
              skipped_count = (SELECT COUNT(*) FROM sellersprite_request_item i WHERE i.run_id=r.run_id AND i.status='SKIPPED'),
              updated_at = NOW()
            WHERE r.run_id=#{runId}
            """)
    int recountItemCounters(@Param("runId") String runId);
}
