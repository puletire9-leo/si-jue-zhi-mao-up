package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.AsinImportTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AsinImportTaskMapper extends BaseMapper<AsinImportTask> {

    /** 锁住来源任务，使同一初筛任务只能创建一个活跃的请求中心运行任务。 */
    @Select("SELECT * FROM asin_import_tasks WHERE id=#{taskId} FOR UPDATE")
    AsinImportTask selectByIdForUpdate(@Param("taskId") Long taskId);
}
