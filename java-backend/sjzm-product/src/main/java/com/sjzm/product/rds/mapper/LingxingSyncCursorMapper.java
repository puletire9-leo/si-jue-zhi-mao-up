package com.sjzm.product.rds.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.modules.lingxing.entity.LingxingSyncCursor;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface LingxingSyncCursorMapper extends BaseMapper<LingxingSyncCursor> {

    @Select("SELECT last_success_time FROM lingxing_sync_cursor WHERE data_type = #{dataType}")
    LocalDateTime getLastSuccessTime(@Param("dataType") String dataType);

    @Update("INSERT INTO lingxing_sync_cursor " +
            "(data_type, last_success_time, last_run_id, sync_count, last_record_count) " +
            "VALUES (#{dataType}, #{lastSuccessTime}, #{lastRunId}, 1, #{recordCount}) " +
            "ON DUPLICATE KEY UPDATE " +
            "last_success_time = VALUES(last_success_time), " +
            "last_run_id = VALUES(last_run_id), " +
            "sync_count = sync_count + 1, " +
            "last_record_count = VALUES(last_record_count)")
    void updateCursor(@Param("dataType") String dataType,
                      @Param("lastSuccessTime") LocalDateTime lastSuccessTime,
                      @Param("lastRunId") String lastRunId,
                      @Param("recordCount") Integer recordCount);
}
