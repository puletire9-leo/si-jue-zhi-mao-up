package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.SkipAsin;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SkipAsinMapper extends BaseMapper<SkipAsin> {

    /** 批量 INSERT IGNORE: 唯一键冲突时静默跳过 */
    int insertBatchIgnoreDup(@Param("list") List<SkipAsin> list);

    /** 批量查重：给定 ASIN 列表，返回已存在于 skip_asins 的 ASIN */
    List<String> selectExistingAsinsInList(@Param("marketplace") String marketplace, @Param("asins") List<String> asins);
}
