package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.ProductLineGuidance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ProductLineGuidanceMapper extends BaseMapper<ProductLineGuidance> {

    /** 批量插入品线指导意见 */
    int insertBatch(@Param("list") List<ProductLineGuidance> list);

    /** 按批次ID查询所有品线指导 */
    List<ProductLineGuidance> selectByBatchId(@Param("batchId") String batchId);

    /** 按批次ID删除（重跑时清理旧数据） */
    int deleteByBatchId(@Param("batchId") String batchId);
}
