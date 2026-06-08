package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.AsinImportResult;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AsinImportResultMapper extends BaseMapper<AsinImportResult> {

    @Insert("<script>INSERT INTO asin_import_results (task_id, seller_name, status) VALUES " +
            "<foreach collection='list' item='r' separator=','>" +
            "(#{r.taskId}, #{r.sellerName}, #{r.status})" +
            "</foreach></script>")
    void insertBatch(@Param("list") List<AsinImportResult> results);
}
