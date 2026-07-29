package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.AsinImportTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface AsinImportTaskMapper extends BaseMapper<AsinImportTask> {

    /** 锁住来源任务，使同一初筛任务只能创建一个活跃的请求中心运行任务。 */
    @Select("SELECT * FROM asin_import_tasks WHERE id=#{taskId} FOR UPDATE")
    AsinImportTask selectByIdForUpdate(@Param("taskId") Long taskId);

    @Select("SELECT * FROM asin_import_tasks WHERE bazhuayu_mapping_id=#{mappingId} "
            + "AND bazhuayu_batch_no=#{batchNo} ORDER BY id DESC LIMIT 1")
    AsinImportTask selectBazhuayuBatch(@Param("mappingId") Long mappingId,
                                       @Param("batchNo") String batchNo);

    /**
     * 按 importType + marketplace 统计各状态任务数，替代 Java 全量加载后 stream 聚合。
     * 返回 map 包含 marketplace, task_status, cnt 三字段。
     */
    @Select("SELECT marketplace, task_status, COUNT(*) AS cnt FROM asin_import_tasks "
            + "WHERE import_type = #{importType} GROUP BY marketplace, task_status")
    List<Map<String, Object>> countByMarketplaceAndStatus(@Param("importType") String importType);

    /**
     * 按 importType + marketplace 统计本周（createdAt >= weekStart）各状态任务数。
     */
    @Select("SELECT marketplace, task_status, COUNT(*) AS cnt FROM asin_import_tasks "
            + "WHERE import_type = #{importType} AND created_at >= #{weekStart} "
            + "GROUP BY marketplace, task_status")
    List<Map<String, Object>> countByMarketplaceAndStatusSince(@Param("importType") String importType,
                                                               @Param("weekStart") java.time.LocalDateTime weekStart);
}
