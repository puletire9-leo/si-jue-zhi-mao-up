package com.sjzm.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sjzm.product.entity.SubcategoryBaseline;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SubcategoryBaselineMapper extends BaseMapper<SubcategoryBaseline> {

    int deleteByBaselineMonth(@Param("baselineMonth") String baselineMonth,
                              @Param("marketplace") String marketplace);

    int insertComputedSlices(@Param("baselineMonth") String baselineMonth,
                             @Param("marketplace") String marketplace);
}
