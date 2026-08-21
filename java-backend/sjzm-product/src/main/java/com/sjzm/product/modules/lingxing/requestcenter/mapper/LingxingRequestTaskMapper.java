package com.sjzm.product.modules.lingxing.requestcenter.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.requestcenter.entity.LingxingRequestTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

/**
 * 领星请求中心任务 Mapper。
 *
 * <p>放 {@code modules.lingxing.requestcenter.mapper}，已在
 * {@code ProductApplication.@MapperScan} 显式注册。</p>
 */
@Mapper
public interface LingxingRequestTaskMapper extends BaseMapper<LingxingRequestTask> {

    /** 取最早一条 PENDING 任务（单线程消费按 FIFO）。 */
    @Select("SELECT * FROM lingxing_request_task WHERE status='PENDING' ORDER BY priority DESC, id ASC LIMIT 1")
    LingxingRequestTask selectOldestPending();

    /** 原子抢占：PENDING → RUNNING，started_at 仅首次置。返回影响行数。 */
    @Update("UPDATE lingxing_request_task SET status='RUNNING', started_at=COALESCE(started_at, NOW()), updated_at=NOW() WHERE id=#{id} AND status='PENDING'")
    int claimRunning(@Param("id") Long id);

    /** 启动恢复：把上次进程遗留的 RUNNING 重置为 PENDING（请求尚未真实发出的任务可安全重置）。 */
    @Update("UPDATE lingxing_request_task SET status='PENDING', started_at=NULL, updated_at=NOW() WHERE status='RUNNING'")
    int resetStaleRunningToPending();

    @Select("SELECT task_id FROM lingxing_request_task WHERE status IN ('PENDING','RUNNING') ORDER BY id ASC")
    List<String> selectRunnableTaskIds();

    @Update("UPDATE lingxing_request_task SET status='SUCCESS', result_json=#{resultJson}, error_message=NULL, attempt_count=COALESCE(attempt_count,0)+1, finished_at=NOW(), updated_at=NOW() WHERE id=#{id}")
    int markSuccess(@Param("id") Long id, @Param("resultJson") String resultJson);

    @Update("UPDATE lingxing_request_task SET status='FAILED', error_message=#{errorMessage}, attempt_count=COALESCE(attempt_count,0)+1, finished_at=NOW(), updated_at=NOW() WHERE id=#{id}")
    int markFailed(@Param("id") Long id, @Param("errorMessage") String errorMessage);

    @Update("UPDATE lingxing_request_task SET status='STOPPED', finished_at=NOW(), updated_at=NOW() WHERE task_id=#{taskId} AND status IN ('PENDING','RUNNING')")
    int stop(@Param("taskId") String taskId);
}
