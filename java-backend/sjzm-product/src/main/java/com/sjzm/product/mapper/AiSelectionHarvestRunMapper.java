package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.AiSelectionHarvestRun;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

/**
 * AI 选品全载体异步同步运行记录 Mapper。
 * 位于 com.sjzm.product.mapper（已被 ProductApplication.@MapperScan 覆盖）。
 */
@Mapper
public interface AiSelectionHarvestRunMapper extends BaseMapper<AiSelectionHarvestRun> {

    /** 更新进度：已完成载体数 + 命中累加 + 本周批次现总数。 */
    @Update("UPDATE ai_selection_harvest_run SET carrier_done = #{carrierDone}, " +
            "hit_total = #{hitTotal}, batch_total = #{batchTotal} WHERE run_id = #{runId}")
    int updateProgress(@Param("runId") String runId,
                       @Param("carrierDone") int carrierDone,
                       @Param("hitTotal") int hitTotal,
                       @Param("batchTotal") int batchTotal);

    /** 收尾：置状态 + 最终计数 + 结束时间。 */
    @Update("UPDATE ai_selection_harvest_run SET status = #{status}, batch_id = #{batchId}, " +
            "hit_total = #{hitTotal}, batch_total = #{batchTotal}, error_message = #{errorMessage}, " +
            "finished_at = NOW() WHERE run_id = #{runId}")
    int finishRun(@Param("runId") String runId,
                  @Param("status") String status,
                  @Param("batchId") String batchId,
                  @Param("hitTotal") int hitTotal,
                  @Param("batchTotal") int batchTotal,
                  @Param("errorMessage") String errorMessage);

    /** 启动时把残留 RUNNING 记录置 FAILED（僵尸恢复）。 */
    @Update("UPDATE ai_selection_harvest_run SET status = 'FAILED', " +
            "error_message = '服务重启，任务中断', finished_at = NOW() WHERE status = 'RUNNING'")
    int markStaleRunsFailed();
}
