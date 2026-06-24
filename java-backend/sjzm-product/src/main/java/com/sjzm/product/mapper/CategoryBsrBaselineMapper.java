package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.CategoryBsrBaseline;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface CategoryBsrBaselineMapper extends BaseMapper<CategoryBsrBaseline> {

    int deleteByBaselineMonth(@Param("baselineMonth") String baselineMonth,
                              @Param("marketplace") String marketplace);

    int insertComputedSlices(@Param("baselineMonth") String baselineMonth,
                             @Param("marketplace") String marketplace);
}
